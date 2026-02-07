/**
 * Scheduling V2 API Routes
 * Enterprise scheduling endpoints with org-aware access control
 */

import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext } from '../../auth/rbac.js';

import {
  requireSchedulingPermission,
  SchedulingAuthError,
} from './guard.js';
import { SCHEDULING_PERMISSIONS } from './permissions.js';
import { SchedulingV2Service } from './scheduling-v2-service.js';
import {
  ListSchedulePeriodsQuerySchema,
  CreateSchedulePeriodBodySchema,
  PublishSchedulePeriodBodySchema,
  LockSchedulePeriodBodySchema,
} from './validators.js';

/**
 * Register V2 scheduling routes
 * @param fastify - Fastify instance
 * @param options - Plugin options containing prisma instance
 */
export async function schedulingV2Routes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
): Promise<void> {
  const { prisma } = options;
  const service = new SchedulingV2Service(prisma);

  // ========== SCHEDULE PERIOD ROUTES ==========

  /**
   * GET /api/scheduling/v2/schedule-periods
   * List schedule periods for a property
   * Query params: propertyId (required), start?, end?, status?
   */
  fastify.get('/schedule-periods', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Require scheduling.view permission
      requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.VIEW);

      // Validate query params
      const query = ListSchedulePeriodsQuerySchema.parse(request.query);

      // Parse date filters if provided
      const filters: { start?: Date; end?: Date; status?: string } = {};
      if (query.start) {
        filters.start = new Date(query.start);
      }
      if (query.end) {
        filters.end = new Date(query.end);
      }
      if (query.status) {
        filters.status = query.status;
      }

      const periods = await service.listSchedulePeriods(userContext, query.propertyId, filters);

      return reply.code(200).send({
        success: true,
        data: periods,
      });
    } catch (error) {
      if (error instanceof SchedulingAuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('validation')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /api/scheduling/v2/schedule-periods
   * Create a new schedule period
   * Body: propertyId, startDate, endDate, name?
   */
  fastify.post('/schedule-periods', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Require scheduling.edit.shifts permission
      requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.EDIT_SHIFTS);

      // Validate request body
      const body = CreateSchedulePeriodBodySchema.parse(request.body);

      const period = await service.createSchedulePeriod(
        userContext,
        body.propertyId,
        new Date(body.startDate),
        new Date(body.endDate),
        body.name
      );

      return reply.code(201).send({
        success: true,
        data: period,
      });
    } catch (error) {
      if (error instanceof SchedulingAuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('validation')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.code(409).send({
          success: false,
          message: error.message,
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /api/scheduling/v2/schedule-periods/:id/publish
   * Publish a schedule period
   * Body: notes?
   */
  fastify.post(
    '/schedule-periods/:id/publish',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        // Require scheduling.publish permission
        requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.PUBLISH);

        // Validate body
        const body = PublishSchedulePeriodBodySchema.parse(request.body || {});

        const { id } = request.params as { id: string };

        const result = await service.publishSchedulePeriod(userContext, id, body.notes);

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof SchedulingAuthError) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            success: false,
            message: error.message,
          });
        }

        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/scheduling/v2/schedule-periods/:id/lock
   * Lock a schedule period
   */
  fastify.post(
    '/schedule-periods/:id/lock',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        // Require scheduling.lock permission
        requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.LOCK);

        // Validate body (empty)
        LockSchedulePeriodBodySchema.parse(request.body || {});

        const { id } = request.params as { id: string };

        const period = await service.lockSchedulePeriod(userContext, id);

        return reply.code(200).send({
          success: true,
          data: period,
        });
      } catch (error) {
        if (error instanceof SchedulingAuthError) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            success: false,
            message: error.message,
          });
        }

        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  // Placeholder health check
  fastify.get('/health', async () => ({
    status: 'ok',
    version: 'v2',
    message: 'Scheduling V2 API',
  }));
}
