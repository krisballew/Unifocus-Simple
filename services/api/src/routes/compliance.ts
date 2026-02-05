/**
 * Compliance Rules API Routes
 * Endpoints for compiling, managing, and applying labor compliance rules
 */

import { PrismaClient } from '@prisma/client';
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';

import { getAuthContext, hasAnyRole } from '../auth/rbac';
import { getBuiltinRules } from '../compliance/builtin-rules';
import { createComplianceCompiler } from '../compliance/llm-compiler';
import { createRulesEngine } from '../compliance/rules-engine';
import { buildCanonicalWorkedDays } from '../compliance/shift-adapter';
import { type RuleContext, type CompiledRuleWithParams } from '../compliance/types';
import { getConfig } from '../config';

// Input validation schemas
const CompileComplianceTextSchema = z.object({
  complianceText: z.string().min(10).max(10000).describe('CBA or compliance document text'),
  context: z.string().optional().describe('Additional context about the compliance document'),
  name: z.string().min(1).max(255).optional().describe('Name for the rule package'),
});

const PublishRulePackageSchema = z.object({
  message: z.string().optional().describe('Publishing message or notes'),
});

const ValidateRulesSchema = z.object({
  rulePackageId: z.string().describe('Rule package to validate against'),
  employeeId: z
    .string()
    .optional()
    .describe('Specific employee to validate (if not provided, batch mode)'),
  dateStart: z.string().datetime().describe('Start date for validation period'),
  dateEnd: z.string().datetime().describe('End date for validation period'),
});

const ClarifyRuleSchema = z.object({
  ruleName: z.string().describe('Name of the rule to clarify'),
  ruleDescription: z.string().describe('Description of the rule'),
  sourceText: z.string().optional().describe('Source text for the rule'),
});

/**
 * Register compliance routes
 */
export async function complianceRoutes(fastify: FastifyInstance) {
  const prisma = fastify.getHooks().get('prisma') || new PrismaClient();
  const compiler = createComplianceCompiler();
  const rulesEngine = createRulesEngine();

  // Register builtin rules with the engine
  rulesEngine.registerRules(getBuiltinRules());

  // ============================================================================
  // POST /api/compliance/compile
  // Compile compliance text into rule package
  // ============================================================================
  fastify.post<{ Body: z.infer<typeof CompileComplianceTextSchema> }>(
    '/compile',
    {
      schema: {
        description: 'Compile compliance text into rule package',
        body: CompileComplianceTextSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            rulePackageId: z.string().optional(),
            rules: z.array(z.any()).optional(),
            message: z.string(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CompileComplianceTextSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        // Check authorization
        if (!hasAnyRole(context, ['Platform Administrator', 'Property Administrator'])) {
          return reply.code(403).send({ success: false, message: 'Forbidden' });
        }

        // Check if compliance rules feature is enabled
        const config = getConfig();
        if (!config.complianceRulesEnabled) {
          return reply.code(403).send({
            success: false,
            message: 'Labor compliance rules feature is not enabled',
          });
        }

        const { complianceText, context: textContext, name } = request.body;

        // Compile the compliance text
        const compilationResult = await compiler.compileComplianceText({
          complianceText,
          context: textContext,
          includeReview: true,
        });

        if (!compilationResult.success || !compilationResult.ruleJson) {
          return reply.code(400).send({
            success: false,
            message: compilationResult.error || 'Compilation failed',
          });
        }

        // Create the rule package in database
        const rulePackage = await prisma.rulePackage.create({
          data: {
            tenantId: context.tenantId,
            name: name || `Rule Package ${new Date().toLocaleDateString()}`,
            version: 1,
            status: 'DRAFT',
            sourceText: complianceText,
            createdBy: context.userId,
            compiledRules: {
              createMany: {
                data: compilationResult.ruleJson.rules.map((rule) => ({
                  ruleId: rule.ruleId,
                  name: rule.name,
                  description: rule.description,
                  enabled: rule.enabled !== false,
                  severity: rule.severity,
                  params: rule.params || {},
                  citations: rule.citations,
                  clarifications: rule.clarifications,
                })),
              },
            },
          },
          include: { compiledRules: true },
        });

        reply.code(201).send({
          success: true,
          rulePackageId: rulePackage.id,
          rules: rulePackage.compiledRules,
          message: `Successfully created rule package with ${rulePackage.compiledRules.length} rules`,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );

  // ============================================================================
  // POST /api/compliance/publish/:rulePackageId
  // Publish a draft rule package
  // ============================================================================
  fastify.post<{
    Params: { rulePackageId: string };
    Body: z.infer<typeof PublishRulePackageSchema>;
  }>(
    '/publish/:rulePackageId',
    {
      schema: {
        description: 'Publish a draft rule package',
        params: z.object({ rulePackageId: z.string() }),
        body: PublishRulePackageSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Params: { rulePackageId: string };
        Body: z.infer<typeof PublishRulePackageSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        if (!hasAnyRole(context, ['Platform Administrator', 'Property Administrator'])) {
          return reply.code(403).send({ success: false, message: 'Forbidden' });
        }

        const { rulePackageId } = request.params;

        // Get the current rule package
        const current = await prisma.rulePackage.findFirst({
          where: {
            id: rulePackageId,
            tenantId: context.tenantId,
          },
        });

        if (!current) {
          return reply.code(404).send({ success: false, message: 'Rule package not found' });
        }

        if (current.status === 'PUBLISHED') {
          return reply.code(400).send({ success: false, message: 'Package is already published' });
        }

        // Publish the package (increment version, change status)
        const published = await prisma.rulePackage.create({
          data: {
            tenantId: context.tenantId,
            propertyId: current.propertyId,
            name: current.name,
            version: current.version + 1,
            status: 'PUBLISHED',
            sourceText: current.sourceText,
            createdBy: context.userId,
            publishedBy: context.userId,
            publishedAt: new Date(),
            compiledRules: {
              createMany: {
                data: await prisma.compiledRule
                  .findMany({
                    where: { rulePackageId: current.id },
                  })
                  .then((rules) =>
                    rules.map((rule) => ({
                      ruleId: rule.ruleId,
                      name: rule.name,
                      description: rule.description,
                      enabled: rule.enabled,
                      severity: rule.severity,
                      params: rule.params,
                      citations: rule.citations,
                      clarifications: rule.clarifications,
                    }))
                  ),
              },
            },
          },
          include: { compiledRules: true },
        });

        reply.code(200).send({
          success: true,
          rulePackageId: published.id,
          version: published.version,
          message: `Rule package published as v${published.version}`,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );

  // ============================================================================
  // GET /api/compliance/packages
  // List rule packages for the tenant
  // ============================================================================
  fastify.get(
    '/packages',
    {
      schema: {
        description: 'List rule packages',
        response: {
          200: z.object({
            packages: z.array(z.any()),
            total: z.number(),
          }),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        const packages = await prisma.rulePackage.findMany({
          where: { tenantId: context.tenantId },
          include: {
            compiledRules: true,
            createdByUser: { select: { id: true, name: true, email: true } },
            publishedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ createdAt: 'desc' }],
        });

        reply.send({ packages, total: packages.length });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );

  // ============================================================================
  // GET /api/compliance/packages/:rulePackageId
  // Get a specific rule package with details
  // ============================================================================
  fastify.get<{ Params: { rulePackageId: string } }>(
    '/packages/:rulePackageId',
    {
      schema: {
        description: 'Get a specific rule package',
        params: z.object({ rulePackageId: z.string() }),
      },
    },
    async (request: FastifyRequest<{ Params: { rulePackageId: string } }>, reply: FastifyReply) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        const { rulePackageId } = request.params;

        const rulePackage = await prisma.rulePackage.findFirst({
          where: {
            id: rulePackageId,
            tenantId: context.tenantId,
          },
          include: {
            compiledRules: true,
            createdByUser: { select: { id: true, name: true, email: true } },
            publishedByUser: { select: { id: true, name: true, email: true } },
          },
        });

        if (!rulePackage) {
          return reply.code(404).send({ success: false, message: 'Rule package not found' });
        }

        reply.send(rulePackage);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );

  // ============================================================================
  // POST /api/compliance/validate
  // Validate shifts/timecards against a rule package
  // ============================================================================
  fastify.post<{ Body: z.infer<typeof ValidateRulesSchema> }>(
    '/validate',
    {
      schema: {
        description: 'Validate shifts against rules',
        body: ValidateRulesSchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof ValidateRulesSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        const { rulePackageId, employeeId, dateStart, dateEnd } = request.body;

        // Get the rule package
        const rulePackage = await prisma.rulePackage.findFirst({
          where: {
            id: rulePackageId,
            tenantId: context.tenantId,
            status: 'PUBLISHED', // Only validate using published packages
          },
          include: { compiledRules: true },
        });

        if (!rulePackage) {
          return reply
            .code(404)
            .send({ success: false, message: 'Published rule package not found' });
        }

        // Build list of employees to validate
        let employees = [];
        if (employeeId) {
          const emp = await prisma.employee.findFirst({
            where: {
              id: employeeId,
              tenantId: context.tenantId,
            },
          });
          if (!emp) {
            return reply.code(404).send({ success: false, message: 'Employee not found' });
          }
          employees = [emp];
        } else {
          // Batch mode: get all employees
          employees = await prisma.employee.findMany({
            where: { tenantId: context.tenantId },
            take: 100, // Limit to 100 for performance
          });
        }

        const startDate = new Date(dateStart);
        const endDate = new Date(dateEnd);

        // Validate each employee
        const allResults = [];
        for (const employee of employees) {
          // Get schedules, punches, and exceptions for the employee
          const schedules = await prisma.schedule.findMany({
            where: {
              employeeId: employee.id,
            },
            include: { shifts: true },
          });

          const punches = await prisma.punch.findMany({
            where: {
              employeeId: employee.id,
              timestamp: {
                gte: startDate,
                lte: endDate,
              },
            },
          });

          const exceptions = await prisma.exception.findMany({
            where: {
              employeeId: employee.id,
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          });

          // Build canonical worked days
          const workedDays = buildCanonicalWorkedDays({
            employee: {
              id: employee.id,
              tenantId: employee.tenantId,
              employeeId: employee.employeeId,
              firstName: employee.firstName,
              lastName: employee.lastName,
            },
            dateStart: startDate,
            dateEnd: endDate,
            schedules,
            punches: punches.map((p) => ({
              type: p.type as 'in' | 'out' | 'break_start' | 'break_end',
              timestamp: p.timestamp,
            })),
            exceptions: exceptions.map((e) => ({
              type: e.type,
              date: e.date,
              startTime: e.startTime || undefined,
              endTime: e.endTime || undefined,
              status: e.status as 'pending' | 'approved' | 'rejected',
            })),
          });

          // Create rule context
          const ruleContext: RuleContext = {
            employee: {
              id: employee.id,
              tenantId: employee.tenantId,
              employeeId: employee.employeeId,
              firstName: employee.firstName,
              lastName: employee.lastName,
            },
            dateRange: { start: startDate, end: endDate },
            workedDays,
          };

          // Evaluate the rule package
          const evalResult = await rulesEngine.evaluate({
            rulePackageId: rulePackage.id,
            compiledRules: rulePackage.compiledRules as CompiledRuleWithParams[],
            context: ruleContext,
          });

          // Store result in database
          const validationResult = await prisma.ruleValidationResult.create({
            data: {
              tenantId: context.tenantId,
              rulePackageId: rulePackage.id,
              employeeId: employee.id,
              dateStart: startDate,
              dateEnd: endDate,
              violations: evalResult.violations,
              violationCount: evalResult.violations.length,
              hasErrors: evalResult.hasErrors,
              hasWarnings: evalResult.hasWarnings,
              runBy: context.userId,
            },
          });

          allResults.push({
            employeeId: employee.id,
            violationCount: evalResult.violations.length,
            hasErrors: evalResult.hasErrors,
            hasWarnings: evalResult.hasWarnings,
            violations: evalResult.violations,
            validationResultId: validationResult.id,
          });
        }

        reply.send({
          success: true,
          rulePackageId,
          dateRange: { start: startDate, end: endDate },
          results: allResults,
          totalViolations: allResults.reduce((sum, r) => sum + r.violationCount, 0),
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );

  // ============================================================================
  // POST /api/compliance/clarify
  // Get clarifications for a rule (LLM-generated explanations)
  // ============================================================================
  fastify.post<{ Body: z.infer<typeof ClarifyRuleSchema> }>(
    '/clarify',
    {
      schema: {
        description: 'Get clarification for a rule',
        body: ClarifyRuleSchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof ClarifyRuleSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        const { ruleName, ruleDescription, sourceText } = request.body;

        // Get clarification from compiler
        const clarification = await compiler.clarifyRule(ruleName, ruleDescription, sourceText);

        reply.send({
          success: true,
          ruleName,
          clarification,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Server error',
        });
      }
    }
  );
}
