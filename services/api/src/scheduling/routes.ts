/**
 * Scheduling API Routes
 * Endpoints for shift scheduling and management
 */

import { PrismaClient } from '@prisma/client';
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';

import { getAuthContext, hasAnyRole } from '../auth/rbac';

import { createSchedulingService } from './scheduling-service';
import type { CreateShiftRequest, UpdateShiftRequest } from './types';

const prisma = new PrismaClient();

// Input validation schemas
const CreateShiftSchema = z.object({
  employeeId: z.string().describe('Employee ID for the shift'),
  scheduleId: z.string().describe('Schedule ID the shift belongs to'),
  date: z.string().datetime().describe('Date of the shift'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe('Start time in HH:MM format'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe('End time in HH:MM format'),
  breakMinutes: z.number().int().min(0).optional().describe('Break duration in minutes'),
});

const UpdateShiftSchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .describe('Start time in HH:MM format'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .describe('End time in HH:MM format'),
  breakMinutes: z.number().int().min(0).optional().describe('Break duration in minutes'),
  status: z
    .enum(['scheduled', 'published', 'confirmed', 'completed', 'cancelled'])
    .optional()
    .describe('Shift status'),
});

const GetShiftsQuerySchema = z.object({
  startDate: z.string().datetime().describe('Start date for shift query'),
  endDate: z.string().datetime().describe('End date for shift query'),
  employeeId: z.string().optional().describe('Filter by employee ID'),
});

/**
 * Register scheduling routes
 */
export async function schedulingRoutes(fastify: FastifyInstance) {
  const schedulingService = createSchedulingService(prisma);

  /**
   * GET /api/scheduling/shifts
   * Get shifts for a date range
   */
  fastify.get(
    '/shifts',
    {
      schema: {
        description: 'Retrieve shifts for a date range',
        querystring: GetShiftsQuerySchema,
        response: {
          200: z.object({
            success: z.boolean(),
            shifts: z.array(z.any()),
            count: z.number(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetShiftsQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        const { startDate, endDate, employeeId } = request.query;

        const shifts = await schedulingService.getShifts(
          context.tenantId!,
          new Date(startDate),
          new Date(endDate),
          employeeId
        );

        return reply.send({
          success: true,
          shifts,
          count: shifts.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/scheduling/shifts
   * Create a new shift
   */
  fastify.post(
    '/shifts',
    {
      schema: {
        description: 'Create a new shift',
        body: CreateShiftSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            message: z.string(),
            shift: z.any().optional(),
            conflicts: z.array(z.any()).optional(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateShiftSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        // Check permissions
        if (!hasAnyRole(context, ['Platform Administrator', 'HR Manager', 'Scheduler'])) {
          return reply.code(403).send({
            success: false,
            message: 'Insufficient permissions to create shifts',
          });
        }

        const result = await schedulingService.createShift(
          context.tenantId!,
          request.body as CreateShiftRequest
        );

        return reply.code(201).send(result);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * PATCH /api/scheduling/shifts/:shiftId
   * Update an existing shift
   */
  fastify.patch(
    '/shifts/:shiftId',
    {
      schema: {
        description: 'Update an existing shift',
        params: z.object({
          shiftId: z.string(),
        }),
        body: UpdateShiftSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            shift: z.any().optional(),
            conflicts: z.array(z.any()).optional(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { shiftId: string };
        Body: z.infer<typeof UpdateShiftSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        // Check permissions
        if (!hasAnyRole(context, ['Platform Administrator', 'HR Manager', 'Scheduler'])) {
          return reply.code(403).send({
            success: false,
            message: 'Insufficient permissions to update shifts',
          });
        }

        const { shiftId } = request.params;
        const result = await schedulingService.updateShift(
          context.tenantId!,
          shiftId,
          request.body as UpdateShiftRequest
        );

        return reply.send(result);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * DELETE /api/scheduling/shifts/:shiftId
   * Delete a shift
   */
  fastify.delete(
    '/shifts/:shiftId',
    {
      schema: {
        description: 'Delete a shift',
        params: z.object({
          shiftId: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { shiftId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        // Check permissions
        if (!hasAnyRole(context, ['Platform Administrator', 'HR Manager', 'Scheduler'])) {
          return reply.code(403).send({
            success: false,
            message: 'Insufficient permissions to delete shifts',
          });
        }

        const { shiftId } = request.params;
        const result = await schedulingService.deleteShift(context.tenantId!, shiftId);

        return reply.send(result);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/scheduling/schedules/:scheduleId/publish
   * Publish a schedule
   */
  fastify.post(
    '/schedules/:scheduleId/publish',
    {
      schema: {
        description: 'Publish a schedule to make shifts visible to employees',
        params: z.object({
          scheduleId: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { scheduleId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const context = getAuthContext(request);
        if (!context) {
          return reply.code(401).send({ success: false, message: 'Unauthorized' });
        }

        // Check permissions
        if (!hasAnyRole(context, ['Platform Administrator', 'HR Manager', 'Scheduler'])) {
          return reply.code(403).send({
            success: false,
            message: 'Insufficient permissions to publish schedules',
          });
        }

        const { scheduleId } = request.params;
        const result = await schedulingService.publishSchedule(context.tenantId!, scheduleId);

        return reply.send(result);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );
}
