import { PrismaClient } from '@prisma/client';
import { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireTenantScope, getAuthContext, hasAnyRole, hasTenantScope } from '../auth/rbac';
import { AuditLogger } from '../services/audit-logger';
import { IdempotencyService } from '../services/idempotency';
import { PunchValidator } from '../services/punch-validator';

const prisma = new PrismaClient();

// ============================================================================
// Schemas
// ============================================================================

const CreateScheduleSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  name: z.string().optional(),
});

const CreateShiftSchema = z.object({
  scheduleId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).default(0),
});

const CreatePunchSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['in', 'out', 'break_start', 'break_end']),
  shiftId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deviceId: z.string().optional(),
});

const ResolveExceptionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

export async function taRoutes(server: FastifyInstance) {
  // ========== SCHEDULES ==========

  /**
   * GET /api/schedules - List employee schedules for tenant
   */
  server.get('/api/schedules', { onRequest: requireTenantScope }, async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }
    const tenantId = context.tenantId;

    const schedules = await prisma.schedule.findMany({
      where: { tenantId },
      include: {
        employee: true,
        shifts: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return reply.send({ data: schedules });
  });

  /**
   * POST /api/schedules - Create a schedule for an employee
   */
  server.post('/api/schedules', { onRequest: requireTenantScope }, async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }
    const tenantId = context.tenantId;
    const data = CreateScheduleSchema.parse(request.body);

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee || employee.tenantId !== tenantId) {
      return reply.status(404).send({ message: 'Employee not found' });
    }

    const schedule = await prisma.schedule.create({
      data: {
        tenantId,
        propertyId: employee.propertyId,
        employeeId: data.employeeId,
        startDate: data.startDate,
        endDate: data.endDate,
        name: data.name,
      },
      include: { shifts: true },
    });

    await AuditLogger.log(prisma, {
      tenantId,
      userId: context.userId,
      action: 'created',
      entity: 'Schedule',
      entityId: schedule.id,
      employeeId: data.employeeId,
    });

    return reply.status(201).send(schedule);
  });

  // ========== SHIFTS ==========

  /**
   * GET /api/schedules/:scheduleId/shifts - Get shifts for a schedule
   */
  server.get(
    '/api/schedules/:scheduleId/shifts',
    { onRequest: requireTenantScope },
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }
      const tenantId = context.tenantId;
      const { scheduleId } = request.params as { scheduleId: string };

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule || schedule.tenantId !== tenantId) {
        return reply.status(404).send({ message: 'Schedule not found' });
      }

      const shifts = await prisma.shift.findMany({
        where: { scheduleId },
        orderBy: { dayOfWeek: 'asc' },
      });

      return reply.send({ data: shifts });
    }
  );

  /**
   * POST /api/schedules/:scheduleId/shifts - Create a shift
   */
  server.post(
    '/api/schedules/:scheduleId/shifts',
    { onRequest: requireTenantScope },
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }
      const tenantId = context.tenantId;
      const { scheduleId } = request.params as { scheduleId: string };
      const data = CreateShiftSchema.parse(request.body);

      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule || schedule.tenantId !== tenantId) {
        return reply.status(404).send({ message: 'Schedule not found' });
      }

      const shift = await prisma.shift.create({
        data: {
          tenantId,
          scheduleId,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          breakMinutes: data.breakMinutes,
        },
      });

      await AuditLogger.log(prisma, {
        tenantId,
        userId: context.userId,
        action: 'created',
        entity: 'Shift',
        entityId: shift.id,
        scheduleId,
      });

      return reply.status(201).send(shift);
    }
  );

  // ========== PUNCHES ==========

  /**
   * POST /api/punches - Record a punch (clock in/out)
   * Supports idempotency via Idempotency-Key header
   */
  server.post(
    '/api/punches',
    {
      onRequest: requireTenantScope,
      schema: {
        tags: ['time'],
        description:
          'Record a time punch (clock in/out/break). Supports idempotency via Idempotency-Key header to prevent duplicate punches.',
        headers: z.object({
          'idempotency-key': z
            .string()
            .optional()
            .describe(
              'Unique key for idempotent request processing. If provided, duplicate requests with the same key will return the same response without creating duplicate punches.'
            ),
        }),
        body: CreatePunchSchema,
        response: {
          201: {
            type: 'object',
            description: 'Successfully created punch',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              employeeId: { type: 'string' },
              shiftId: { type: 'string', nullable: true },
              type: { type: 'string', enum: ['in', 'out', 'break_start', 'break_end'] },
              timestamp: { type: 'string', format: 'date-time' },
              latitude: { type: 'number', nullable: true },
              longitude: { type: 'number', nullable: true },
              deviceId: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            description: 'Validation error',
            properties: {
              message: { type: 'string' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            description: 'Employee not found',
            properties: {
              message: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            description: 'Forbidden',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          message: 'Tenant scope required',
        });
      }
      const tenantId = context.tenantId;
      const data = CreatePunchSchema.parse(request.body);

      // Check for idempotency key in header
      const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

      if (idempotencyKey) {
        // Check if this request was already processed
        const stored = await IdempotencyService.getStoredResponse(prisma, {
          tenantId,
          userId: context.userId,
          idempotencyKey,
          endpoint: 'POST /api/punches',
        });

        if (stored) {
          // Replay the stored response
          IdempotencyService.replayResponse(reply, stored);
          return;
        }
      }

      // Verify employee belongs to tenant
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
      });

      if (!employee || employee.tenantId !== tenantId) {
        return reply.status(404).send({ message: 'Employee not found' });
      }

      // Get recent punches for validation (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPunches = await prisma.punch.findMany({
        where: {
          employeeId: data.employeeId,
          tenantId,
          timestamp: { gte: yesterday },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      // Get shift if provided (with tenant validation)
      let shift = null;
      if (data.shiftId) {
        shift = await prisma.shift.findUnique({
          where: { id: data.shiftId },
        });

        // Validate shift belongs to tenant
        if (shift && shift.tenantId !== tenantId) {
          return reply.status(403).send({
            message: 'Shift does not belong to your tenant',
          });
        }
      }

      // Validate punch
      const validationErrors = PunchValidator.validate({
        employeeId: data.employeeId,
        tenantId,
        punchType: data.type,
        timestamp: new Date(),
        shift: shift ?? undefined,
        recentPunches,
      });

      if (validationErrors.length > 0) {
        return reply.status(400).send({
          message: 'Punch validation failed',
          errors: validationErrors,
        });
      }

      // Create punch
      const punch = await prisma.punch.create({
        data: {
          tenantId,
          employeeId: data.employeeId,
          shiftId: data.shiftId,
          type: data.type,
          timestamp: new Date(),
          latitude: data.latitude,
          longitude: data.longitude,
          deviceId: data.deviceId,
        },
      });

      // Generate exceptions if this was a clock out
      if (data.type === 'out' && shift) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayPunches = await prisma.punch.findMany({
          where: {
            employeeId: data.employeeId,
            tenantId,
            timestamp: { gte: today },
          },
        });

        const exceptions = PunchValidator.generateExceptions(
          data.employeeId,
          tenantId,
          today,
          todayPunches,
          shift
        );

        for (const exc of exceptions) {
          await prisma.exception.create({
            data: {
              tenantId,
              employeeId: data.employeeId,
              type: exc.type,
              reason: exc.reason,
              date: today,
              status: 'pending',
            },
          });
        }
      }

      await AuditLogger.log(prisma, {
        tenantId,
        userId: context.userId,
        action: 'created',
        entity: 'Punch',
        entityId: punch.id,
        employeeId: data.employeeId,
        punchId: punch.id,
      });

      const responseBody = punch;
      const statusCode = 201;

      // Store response for idempotency if key was provided
      if (idempotencyKey) {
        await IdempotencyService.storeResponse(
          prisma,
          {
            tenantId,
            userId: context.userId,
            idempotencyKey,
            endpoint: 'POST /api/punches',
          },
          statusCode,
          responseBody
        );
      }

      return reply.status(statusCode).send(responseBody);
    }
  );

  /**
   * GET /api/punches - List punches for employee/date range
   */
  server.get('/api/punches', { onRequest: requireTenantScope }, async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }
    const tenantId = context.tenantId;
    const { employeeId, startDate, endDate } = request.query as {
      employeeId?: string;
      startDate?: string;
      endDate?: string;
    };

    interface PunchWhere {
      tenantId: string;
      employeeId?: string;
      timestamp?: { gte?: Date; lte?: Date };
    }

    const where: PunchWhere = { tenantId };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const punches = await prisma.punch.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    return reply.send({ data: punches });
  });

  // ========== EXCEPTIONS ==========

  /**
   * GET /api/exceptions - List exceptions (with optional status filter)
   */
  server.get('/api/exceptions', { onRequest: requireTenantScope }, async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }
    const tenantId = context.tenantId;
    const { status, employeeId } = request.query as {
      status?: string;
      employeeId?: string;
    };

    interface ExceptionWhere {
      tenantId: string;
      status?: string;
      employeeId?: string;
    }

    const where: ExceptionWhere = { tenantId };
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const exceptions = await prisma.exception.findMany({
      where,
      include: { employee: true },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return reply.send({ data: exceptions });
  });

  /**
   * GET /api/exceptions/:exceptionId - Get exception details
   */
  server.get(
    '/api/exceptions/:exceptionId',
    { onRequest: requireTenantScope },
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Tenant scope required' });
      }
      const tenantId = context.tenantId;
      const { exceptionId } = request.params as { exceptionId: string };

      const exception = await prisma.exception.findUnique({
        where: { id: exceptionId },
        include: { employee: true },
      });

      if (!exception || exception.tenantId !== tenantId) {
        return reply.status(404).send({ message: 'Exception not found' });
      }

      return reply.send(exception);
    }
  );

  /**
   * PUT /api/exceptions/:exceptionId/resolve - Approve/reject exception
   */
  server.put(
    '/api/exceptions/:exceptionId/resolve',
    { onRequest: requireTenantScope },
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Tenant scope required' });
      }
      const tenantId = context.tenantId;
      const { exceptionId } = request.params as { exceptionId: string };
      const data = ResolveExceptionSchema.parse(request.body);

      // Require manager or admin role to resolve exceptions
      if (!hasAnyRole(context, ['Manager', 'Admin', 'TenantAdmin'])) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Manager or Admin role required to resolve exceptions',
        });
      }

      const exception = await prisma.exception.findUnique({
        where: { id: exceptionId },
      });

      if (!exception || exception.tenantId !== tenantId) {
        return reply.status(404).send({ message: 'Exception not found' });
      }

      const updated = await prisma.exception.update({
        where: { id: exceptionId },
        data: {
          status: data.status,
          approvedAt: new Date(),
          approvedBy: context.userId,
        },
        include: { employee: true },
      });

      await AuditLogger.log(prisma, {
        tenantId,
        userId: context.userId,
        action: data.status === 'approved' ? 'approved' : 'rejected',
        entity: 'Exception',
        entityId: exceptionId,
        exceptionId,
        employeeId: exception.employeeId,
        changes: {
          status: { before: exception.status, after: data.status },
        },
      });

      return reply.send(updated);
    }
  );
}
