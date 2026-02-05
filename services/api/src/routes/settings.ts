import { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext, hasAnyRole, hasRole } from '../auth/rbac';

const prisma = new PrismaClient();

interface UpdateUserPreferencesBody {
  locale?: string; // ISO 639-1 language code with region (e.g., 'en-US', 'es-ES', 'fr-FR')
  timezone?: string;
  currency?: string; // ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
  avatarUrl?: string;
  defaultPropertyId?: string;
}

interface TenantSettingsBody {
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  defaultLocale?: 'en-US' | 'es-ES';
  defaultTimezone?: string;
  defaultCurrency?: string;
}

export async function settingsRoutes(server: FastifyInstance) {
  // GET /api/users/me/preferences - Get user preferences
  server.get(
    '/users/me/preferences',
    {
      schema: {
        description: 'Get current user preferences',
        tags: ['Settings'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authContext = getAuthContext(request);
        const userId = authContext.userId || (request.headers['x-user-id'] as string | undefined);
        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'User ID required',
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            locale: true,
            timezone: true,
            currency: true,
            avatarUrl: true,
            defaultPropertyId: true,
            tenant: {
              select: {
                weekStartDay: true,
                defaultCurrency: true,
              },
            },
          },
        });

        if (!user) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return reply.send({
          locale: user.locale || 'en-US',
          timezone: user.timezone || 'UTC',
          currency: user.currency || user.tenant?.defaultCurrency || 'USD',
          avatarUrl: user.avatarUrl || null,
          defaultPropertyId: user.defaultPropertyId || null,
          weekStartDay: user.tenant?.weekStartDay || 0,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get preferences',
        });
      }
    }
  );

  // PUT /api/users/me/preferences - Update user preferences
  server.put(
    '/users/me/preferences',
    async (request: FastifyRequest<{ Body: UpdateUserPreferencesBody }>, reply: FastifyReply) => {
      try {
        const authContext = getAuthContext(request);
        const userId = authContext.userId || (request.headers['x-user-id'] as string | undefined);
        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'User ID required',
          });
        }

        const { locale, timezone, currency, avatarUrl, defaultPropertyId } = request.body;

        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(locale && { locale }),
            ...(timezone && { timezone }),
            ...(currency && { currency }),
            ...(avatarUrl !== undefined && { avatarUrl }),
            ...(defaultPropertyId !== undefined && { defaultPropertyId }),
          },
          select: {
            locale: true,
            timezone: true,
            currency: true,
            avatarUrl: true,
            defaultPropertyId: true,
            tenant: {
              select: {
                defaultCurrency: true,
              },
            },
          },
        });

        return reply.send({
          locale: updated.locale || 'en-US',
          timezone: updated.timezone || 'UTC',
          currency: updated.currency || updated.tenant?.defaultCurrency || 'USD',
          avatarUrl: updated.avatarUrl || null,
          defaultPropertyId: updated.defaultPropertyId || null,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update preferences',
        });
      }
    }
  );

  // GET /api/tenants/:tenantId/settings - Get tenant settings
  server.get(
    '/tenants/:tenantId/settings',
    {
      schema: {
        description: 'Get tenant settings',
        tags: ['Settings'],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              weekStartDay: { type: 'number' },
              defaultLocale: { type: 'string' },
              defaultTimezone: { type: 'string' },
              defaultCurrency: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
      try {
        const { tenantId } = request.params;
        const userId = request.headers['x-user-id'] as string;

        // Verify user has access to this tenant
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            tenantId: tenantId,
          },
        });

        if (!user) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            weekStartDay: true,
          },
        });

        if (!tenant) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Tenant not found',
          });
        }

        return reply.send({
          weekStartDay: tenant.weekStartDay || 0,
          defaultLocale: 'en-US',
          defaultTimezone: 'UTC',
          defaultCurrency: 'USD',
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get settings',
        });
      }
    }
  );

  // PUT /api/tenants/:tenantId/settings - Update tenant settings (admin only)
  server.put(
    '/tenants/:tenantId/settings',
    {
      schema: {
        description: 'Update tenant settings (admin only)',
        tags: ['Settings'],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            weekStartDay: { type: 'number', minimum: 0, maximum: 6 },
            defaultLocale: { type: 'string', enum: ['en-US', 'es-ES'] },
            defaultTimezone: { type: 'string' },
            defaultCurrency: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              weekStartDay: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { tenantId: string }; Body: TenantSettingsBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;
        const { weekStartDay } = request.body;
        const userId = request.headers['x-user-id'] as string;

        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        // Get auth context for RBAC
        const authContext = getAuthContext(request);

        // Verify user is admin of this tenant
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            tenantId: tenantId,
          },
        });

        if (!user) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Require admin role for tenant settings
        if (!hasRole(authContext, 'Admin') && !hasRole(authContext, 'TenantAdmin')) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Admin role required to update tenant settings',
          });
        }

        const updated = await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            ...(typeof weekStartDay === 'number' && { weekStartDay }),
          },
          select: {
            weekStartDay: true,
          },
        });

        return reply.send({
          weekStartDay: updated.weekStartDay || 0,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }
  );

  const jobStructureRoles = ['Platform Administrator', 'Property Administrator'];

  const resolveJobStructureAccess = async (
    request: FastifyRequest,
    reply: FastifyReply,
    propertyId: string | undefined
  ) => {
    const authContext = getAuthContext(request);
    const userId = authContext.userId || (request.headers['x-user-id'] as string | undefined);
    const tenantId = authContext.tenantId || (request.headers['x-tenant-id'] as string | undefined);

    if (!userId) {
      reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return null;
    }

    if (!tenantId) {
      reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
      return null;
    }

    const roles = authContext.roles.length
      ? authContext.roles
      : ((
          await prisma.user.findUnique({
            where: { id: userId },
            include: { roleAssignments: { include: { role: true } } },
          })
        )?.roleAssignments.map((assignment) => assignment.role.name) ?? []);

    if (!hasAnyRole({ ...authContext, roles, tenantId }, jobStructureRoles)) {
      reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Platform or Property Administrator role required',
      });
      return null;
    }

    if (!propertyId) {
      reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: 'Property ID is required',
      });
      return null;
    }

    const property = await prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });

    if (!property) {
      reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Property not found',
      });
      return null;
    }

    return { tenantId, userId, propertyId };
  };

  // GET /api/settings/job-structure - Get job structure by property
  server.get('/settings/job-structure', async (request, reply) => {
    try {
      const { propertyId } = request.query as { propertyId?: string };
      const access = await resolveJobStructureAccess(request, reply, propertyId);
      if (!access) return;

      const [departmentCategories, jobCategories, divisions] = await Promise.all([
        prisma.departmentCategory.findMany({
          where: { tenantId: access.tenantId, isActive: true },
          orderBy: { name: 'asc' },
        }),
        prisma.jobCategory.findMany({
          where: { tenantId: access.tenantId, isActive: true },
          orderBy: { name: 'asc' },
        }),
        prisma.division.findMany({
          where: { tenantId: access.tenantId, propertyId: access.propertyId },
          orderBy: { name: 'asc' },
          include: {
            departments: {
              orderBy: { name: 'asc' },
              include: {
                departmentCategory: true,
                jobRoles: {
                  orderBy: { name: 'asc' },
                  include: {
                    jobCategory: true,
                    jobAssignments: { orderBy: { name: 'asc' } },
                  },
                },
              },
            },
          },
        }),
      ]);

      return reply.send({
        propertyId: access.propertyId,
        divisions,
        departmentCategories,
        jobCategories,
      });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load job structure',
      });
    }
  });

  // POST /api/settings/job-structure/divisions - Create division
  server.post(
    '/settings/job-structure/divisions',
    async (
      request: FastifyRequest<{ Body: { propertyId: string; name: string; code?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { propertyId, name, code } = request.body;
        const access = await resolveJobStructureAccess(request, reply, propertyId);
        if (!access) return;

        const division = await prisma.division.create({
          data: {
            tenantId: access.tenantId,
            propertyId: access.propertyId,
            name: name.trim(),
            code: code?.trim() || null,
          },
        });

        return reply.send(division);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create division',
        });
      }
    }
  );

  // POST /api/settings/job-structure/departments - Create department
  server.post(
    '/settings/job-structure/departments',
    async (
      request: FastifyRequest<{
        Body: {
          propertyId: string;
          divisionId: string;
          departmentCategoryId: string;
          name: string;
          code?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { propertyId, divisionId, departmentCategoryId, name, code } = request.body;
        const access = await resolveJobStructureAccess(request, reply, propertyId);
        if (!access) return;

        const [division, category] = await Promise.all([
          prisma.division.findFirst({
            where: { id: divisionId, propertyId: access.propertyId, tenantId: access.tenantId },
            select: { id: true },
          }),
          prisma.departmentCategory.findFirst({
            where: { id: departmentCategoryId, tenantId: access.tenantId, isActive: true },
            select: { id: true },
          }),
        ]);

        if (!division) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Division not found',
          });
        }

        if (!category) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Department category not found',
          });
        }

        const department = await prisma.department.create({
          data: {
            tenantId: access.tenantId,
            propertyId: access.propertyId,
            divisionId,
            departmentCategoryId,
            name: name.trim(),
            code: code?.trim() || null,
          },
        });

        return reply.send(department);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create department',
        });
      }
    }
  );

  // POST /api/settings/job-structure/jobs - Create job role
  server.post(
    '/settings/job-structure/jobs',
    async (
      request: FastifyRequest<{
        Body: {
          propertyId: string;
          departmentId: string;
          jobCategoryId: string;
          name: string;
          code?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { propertyId, departmentId, jobCategoryId, name, code } = request.body;
        const access = await resolveJobStructureAccess(request, reply, propertyId);
        if (!access) return;

        const [department, category] = await Promise.all([
          prisma.department.findFirst({
            where: { id: departmentId, propertyId: access.propertyId, tenantId: access.tenantId },
            select: { id: true },
          }),
          prisma.jobCategory.findFirst({
            where: { id: jobCategoryId, tenantId: access.tenantId, isActive: true },
            select: { id: true },
          }),
        ]);

        if (!department) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Department not found',
          });
        }

        if (!category) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Job category not found',
          });
        }

        const jobRole = await prisma.jobRole.create({
          data: {
            tenantId: access.tenantId,
            propertyId: access.propertyId,
            departmentId,
            jobCategoryId,
            name: name.trim(),
            code: code?.trim() || null,
          },
        });

        return reply.send(jobRole);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job role',
        });
      }
    }
  );

  // POST /api/settings/job-structure/assignments - Create assignment
  server.post(
    '/settings/job-structure/assignments',
    async (
      request: FastifyRequest<{
        Body: {
          propertyId: string;
          jobRoleId: string;
          name: string;
          code?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { propertyId, jobRoleId, name, code } = request.body;
        const access = await resolveJobStructureAccess(request, reply, propertyId);
        if (!access) return;

        const jobRole = await prisma.jobRole.findFirst({
          where: { id: jobRoleId, propertyId: access.propertyId, tenantId: access.tenantId },
          select: { id: true },
        });

        if (!jobRole) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Job role not found',
          });
        }

        const assignment = await prisma.jobAssignment.create({
          data: {
            tenantId: access.tenantId,
            propertyId: access.propertyId,
            jobRoleId,
            name: name.trim(),
            code: code?.trim() || null,
          },
        });

        return reply.send(assignment);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create assignment',
        });
      }
    }
  );

  // PUT /api/settings/job-structure/divisions/:divisionId - Update division
  server.put(
    '/settings/job-structure/divisions/:divisionId',
    async (
      request: FastifyRequest<{
        Params: { divisionId: string };
        Body: Partial<{ name: string; code?: string }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { divisionId } = request.params;
        const { name, code } = request.body;
        const authContext = getAuthContext(request);
        const tenantId =
          authContext.tenantId || (request.headers['x-tenant-id'] as string | undefined);

        if (!tenantId) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Tenant scope required',
          });
        }

        const division = await prisma.division.findFirst({
          where: { id: divisionId, tenantId },
          select: { id: true },
        });

        if (!division) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Division not found',
          });
        }

        const updated = await prisma.division.update({
          where: { id: divisionId },
          data: {
            ...(name && { name: name.trim() }),
            ...(code !== undefined && { code: code?.trim() || null }),
          },
        });

        return reply.send(updated);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update division',
        });
      }
    }
  );

  // PUT /api/settings/job-structure/departments/:departmentId - Update department
  server.put(
    '/settings/job-structure/departments/:departmentId',
    async (
      request: FastifyRequest<{
        Params: { departmentId: string };
        Body: Partial<{
          name: string;
          code?: string;
          costCenter?: string;
          laborBudget?: number;
          location?: string;
          reportingGroupId?: string;
          managerId?: string;
        }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { departmentId } = request.params;
        const { name, code, costCenter, laborBudget, location, reportingGroupId, managerId } =
          request.body;
        const authContext = getAuthContext(request);
        const tenantId =
          authContext.tenantId || (request.headers['x-tenant-id'] as string | undefined);

        if (!tenantId) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Tenant scope required',
          });
        }

        const department = await prisma.department.findFirst({
          where: { id: departmentId, tenantId },
          select: { id: true },
        });

        if (!department) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Department not found',
          });
        }

        const updated = await prisma.department.update({
          where: { id: departmentId },
          data: {
            ...(name && { name: name.trim() }),
            ...(code !== undefined && { code: code?.trim() || null }),
            ...(costCenter !== undefined && { costCenter: costCenter || null }),
            ...(laborBudget !== undefined && {
              laborBudget: laborBudget ? BigInt(laborBudget) : null,
            }),
            ...(location !== undefined && { location: location || null }),
            ...(reportingGroupId !== undefined && { reportingGroupId: reportingGroupId || null }),
            ...(managerId !== undefined && { managerId: managerId || null }),
          },
          include: { departmentCategory: true },
        });

        return reply.send(updated);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update department',
        });
      }
    }
  );

  // PUT /api/settings/job-structure/jobs/:jobRoleId - Update job role
  server.put(
    '/settings/job-structure/jobs/:jobRoleId',
    async (
      request: FastifyRequest<{
        Params: { jobRoleId: string };
        Body: Partial<{
          name: string;
          code?: string;
          payCode?: string;
          skillClassification?: string;
          unionClassification?: string;
          flsaStatus?: string;
          certificationRequirements?: string[];
        }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { jobRoleId } = request.params;
        const {
          name,
          code,
          payCode,
          skillClassification,
          unionClassification,
          flsaStatus,
          certificationRequirements,
        } = request.body;
        const authContext = getAuthContext(request);
        const tenantId =
          authContext.tenantId || (request.headers['x-tenant-id'] as string | undefined);

        if (!tenantId) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Tenant scope required',
          });
        }

        const jobRole = await prisma.jobRole.findFirst({
          where: { id: jobRoleId, tenantId },
          select: { id: true },
        });

        if (!jobRole) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Job role not found',
          });
        }

        const updated = await prisma.jobRole.update({
          where: { id: jobRoleId },
          data: {
            ...(name && { name: name.trim() }),
            ...(code !== undefined && { code: code?.trim() || null }),
            ...(payCode !== undefined && { payCode: payCode || null }),
            ...(skillClassification !== undefined && {
              skillClassification: skillClassification || null,
            }),
            ...(unionClassification !== undefined && {
              unionClassification: unionClassification || null,
            }),
            ...(flsaStatus !== undefined && { flsaStatus: flsaStatus || null }),
            ...(certificationRequirements !== undefined && { certificationRequirements }),
          },
          include: { jobCategory: true, jobAssignments: true },
        });

        return reply.send(updated);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update job role',
        });
      }
    }
  );

  // PUT /api/settings/job-structure/assignments/:assignmentId - Update assignment
  server.put(
    '/settings/job-structure/assignments/:assignmentId',
    async (
      request: FastifyRequest<{
        Params: { assignmentId: string };
        Body: Partial<{ name: string; code?: string; description?: string }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { assignmentId } = request.params;
        const { name, code, description } = request.body;
        const authContext = getAuthContext(request);
        const tenantId =
          authContext.tenantId || (request.headers['x-tenant-id'] as string | undefined);

        if (!tenantId) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Tenant scope required',
          });
        }

        const assignment = await prisma.jobAssignment.findFirst({
          where: { id: assignmentId, tenantId },
          select: { id: true },
        });

        if (!assignment) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Assignment not found',
          });
        }

        const updated = await prisma.jobAssignment.update({
          where: { id: assignmentId },
          data: {
            ...(name && { name: name.trim() }),
            ...(code !== undefined && { code: code?.trim() || null }),
            ...(description !== undefined && { description: description || null }),
          },
        });

        return reply.send(updated);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update assignment',
        });
      }
    }
  );
}
