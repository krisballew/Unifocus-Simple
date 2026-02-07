/**
 * Scheduling V2 API Routes
 * Enterprise scheduling endpoints with org-aware access control
 */

import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext } from '../../auth/rbac.js';

import { requireSchedulingPermission, SchedulingAuthError } from './guard.js';
import { SCHEDULING_PERMISSIONS } from './permissions.js';
import { SchedulingV2Service } from './scheduling-v2-service.js';
import {
  ListSchedulePeriodsQuerySchema,
  CreateSchedulePeriodBodySchema,
  PublishSchedulePeriodBodySchema,
  LockSchedulePeriodBodySchema,
  ListShiftsQuerySchema,
  CreateShiftBodySchema,
  UpdateShiftBodySchema,
  DeleteShiftQuerySchema,
  AssignShiftBodySchema,
  UnassignShiftBodySchema,
  ClaimOpenShiftBodySchema,
  ListRequestsQuerySchema,
  ApproveRequestBodySchema,
  DenyRequestBodySchema,
  CreateSwapRequestBodySchema,
  CancelSwapRequestBodySchema,
  AvailabilityListQuerySchema,
  AvailabilityCreateBodySchema,
  AvailabilityDeleteQuerySchema,
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

      // Handle validation and business logic errors as 400
      if (
        error instanceof Error &&
        (error.message.includes('validation') ||
          error.message.includes('Invalid') ||
          error.message.includes('must be') ||
          error.message.includes('startDate') ||
          error.message.includes('endDate'))
      ) {
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

        // Handle validation and business logic errors as 400
        if (
          error instanceof Error &&
          (error.message.includes('locked') ||
            error.message.includes('LOCKED') ||
            error.message.includes('Cannot') ||
            error.message.includes('Forbidden') ||
            error.message.includes('validation') ||
            error.message.includes('Invalid') ||
            error.message.includes('must be'))
        ) {
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

  // ========== SHIFT PLAN ROUTES ==========

  /**
   * GET /api/scheduling/v2/schedule-periods/:id/shifts
   * List shifts for a schedule period
   * Query params: propertyId (required), departmentId?, jobRoleId?, start?, end?
   */
  fastify.get(
    '/schedule-periods/:id/shifts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        const { id } = request.params as { id: string };

        // Validate query params
        const query = ListShiftsQuerySchema.parse(request.query);

        // Parse date filters
        const filters: { start?: Date; end?: Date; departmentId?: string; jobRoleId?: string } = {};
        if (query.start) {
          filters.start = new Date(query.start);
        }
        if (query.end) {
          filters.end = new Date(query.end);
        }
        if (query.departmentId) {
          filters.departmentId = query.departmentId;
        }
        if (query.jobRoleId) {
          filters.jobRoleId = query.jobRoleId;
        }

        const shifts = await service.listShifts(userContext, id, query.propertyId, filters);

        return reply.code(200).send({
          success: true,
          data: shifts,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Forbidden')) {
          return reply.code(403).send({
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
    }
  );

  /**
   * POST /api/scheduling/v2/shifts
   * Create a new shift
   * Body: schedulePeriodId, propertyId, departmentId, jobRoleId, startDateTime, endDateTime, breakMinutes?, isOpenShift?, notes?
   */
  fastify.post('/shifts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate request body
      const body = CreateShiftBodySchema.parse(request.body);

      const shift = await service.createShift(userContext, body);

      return reply.code(201).send({
        success: true,
        data: shift,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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

      if (error instanceof Error && error.message.includes('Validation')) {
        return reply.code(400).send({
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
   * PATCH /api/scheduling/v2/shifts/:shiftId
   * Update a shift
   * Body: propertyId, departmentId?, jobRoleId?, startDateTime?, endDateTime?, breakMinutes?, isOpenShift?, notes?
   */
  fastify.patch('/shifts/:shiftId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { shiftId } = request.params as { shiftId: string };

      // Validate request body
      const body = UpdateShiftBodySchema.parse(request.body);

      const shift = await service.updateShift(userContext, shiftId, body);

      return reply.code(200).send({
        success: true,
        data: shift,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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

      if (error instanceof Error && error.message.includes('Validation')) {
        return reply.code(400).send({
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
   * DELETE /api/scheduling/v2/shifts/:shiftId
   * Delete a shift
   * Query params: propertyId (required)
   */
  fastify.delete('/shifts/:shiftId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { shiftId } = request.params as { shiftId: string };

      // Validate query params
      const query = DeleteShiftQuerySchema.parse(request.query);

      await service.deleteShift(userContext, shiftId, query.propertyId);

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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

  // ========== SHIFT ASSIGNMENT ROUTES ==========

  /**
   * POST /api/scheduling/v2/shifts/:shiftId/assign
   * Assign an employee to a shift
   */
  fastify.post('/shifts/:shiftId/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { shiftId } = request.params as { shiftId: string };

      // Validate body
      const body = AssignShiftBodySchema.parse(request.body);

      const shift = await service.assignEmployeeToShift(userContext, shiftId, body);

      return reply.code(200).send({
        success: true,
        data: shift,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 409
      ) {
        return reply.code(409).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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
   * POST /api/scheduling/v2/shifts/:shiftId/unassign
   * Unassign an employee from a shift
   */
  fastify.post(
    '/shifts/:shiftId/unassign',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        const { shiftId } = request.params as { shiftId: string };

        // Validate body
        const body = UnassignShiftBodySchema.parse(request.body);

        const shift = await service.unassignEmployeeFromShift(userContext, shiftId, body);

        return reply.code(200).send({
          success: true,
          data: shift,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Forbidden')) {
          return reply.code(403).send({
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
    }
  );

  // ========== OPEN SHIFT CLAIM ROUTES ==========

  /**
   * POST /api/scheduling/v2/open-shifts/:shiftId/claim
   * Employee claims an open shift
   */
  fastify.post(
    '/open-shifts/:shiftId/claim',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        const { shiftId } = request.params as { shiftId: string };

        // Validate body
        const body = ClaimOpenShiftBodySchema.parse(request.body);

        const claimRequest = await service.claimOpenShift(userContext, shiftId, body);

        return reply.code(201).send({
          success: true,
          data: claimRequest,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          'status' in error &&
          (error as { status: number }).status === 409
        ) {
          return reply.code(409).send({
            success: false,
            message: error.message,
          });
        }

        if (
          error instanceof Error &&
          'status' in error &&
          (error as { status: number }).status === 400
        ) {
          return reply.code(400).send({
            success: false,
            message: error.message,
          });
        }

        if (error instanceof Error && error.message.includes('Forbidden')) {
          return reply.code(403).send({
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
    }
  );

  // ========== SWAP REQUEST ROUTES ==========

  /**
   * POST /api/scheduling/v2/swap-requests
   * Employee creates a swap request to give their shift to another employee
   */
  fastify.post('/swap-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate body
      const body = CreateSwapRequestBodySchema.parse(request.body);

      const swapRequest = await service.createSwapRequest(userContext, body);

      return reply.code(201).send({
        success: true,
        data: swapRequest,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 409
      ) {
        return reply.code(409).send({
          success: false,
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 403
      ) {
        return reply.code(403).send({
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
   * POST /api/scheduling/v2/swap-requests/:id/cancel
   * Employee cancels their own pending swap request
   */
  fastify.post(
    '/swap-requests/:id/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userContext = getAuthContext(request);
        if (!userContext || !userContext.userId) {
          return reply.code(401).send({
            success: false,
            message: 'Unauthorized',
          });
        }

        const { id } = request.params as { id: string };

        // Validate body
        const body = CancelSwapRequestBodySchema.parse(request.body);

        const result = await service.cancelSwapRequest(userContext, {
          requestId: id,
          propertyId: body.propertyId,
        });

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          'status' in error &&
          (error as { status: number }).status === 409
        ) {
          return reply.code(409).send({
            success: false,
            message: error.message,
          });
        }

        if (
          error instanceof Error &&
          'status' in error &&
          (error as { status: number }).status === 403
        ) {
          return reply.code(403).send({
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
    }
  );

  /**
   * GET /api/scheduling/v2/requests
   * List scheduling requests (manager view)
   */
  fastify.get('/requests', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate query params
      const query = ListRequestsQuerySchema.parse(request.query);

      const requests = await service.listRequests(userContext, query);

      return reply.code(200).send({
        success: true,
        data: requests,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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
   * POST /api/scheduling/v2/requests/:id/approve
   * Approve a scheduling request (manager action)
   */
  fastify.post('/requests/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { id } = request.params as { id: string };

      // Validate body
      const body = ApproveRequestBodySchema.parse(request.body);

      const result = await service.approveRequest(userContext, id, body);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 409
      ) {
        return reply.code(409).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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
   * POST /api/scheduling/v2/requests/:id/deny
   * Deny a scheduling request (manager action)
   */
  fastify.post('/requests/:id/deny', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { id } = request.params as { id: string };

      // Validate body
      const body = DenyRequestBodySchema.parse(request.body);

      const result = await service.denyRequest(userContext, id, body);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 409
      ) {
        return reply.code(409).send({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return reply.code(403).send({
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

  // ========== AVAILABILITY ROUTES ==========

  /**
   * GET /api/scheduling/v2/availability
   * List availability entries for self or (with permission) another employee
   * Query: propertyId (required), employeeId?, start?, end?
   */
  fastify.get('/availability', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate query params
      const query = AvailabilityListQuerySchema.parse(request.query);

      const entries = await service.listAvailability(userContext, query);

      return reply.code(200).send({
        success: true,
        data: entries,
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
   * POST /api/scheduling/v2/availability
   * Create availability entry for self or (with permission) another employee
   * Body: propertyId, employeeId?, date, startTime, endTime, type?, recurrenceRule?
   */
  fastify.post('/availability', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Validate body
      const body = AvailabilityCreateBodySchema.parse(request.body);

      const entry = await service.createAvailability(userContext, body);

      return reply.code(201).send({
        success: true,
        data: entry,
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
  });

  /**
   * DELETE /api/scheduling/v2/availability/:id
   * Delete availability entry (self or manager with permission)
   * Query: propertyId
   */
  fastify.delete('/availability/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = getAuthContext(request);
      if (!userContext || !userContext.userId) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { id } = request.params as { id: string };

      // Validate query params
      const query = AvailabilityDeleteQuerySchema.parse(request.query);

      const result = await service.deleteAvailability(userContext, {
        id,
        propertyId: query.propertyId,
      });

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

  // Placeholder health check
  fastify.get('/health', async () => ({
    status: 'ok',
    version: 'v2',
    message: 'Scheduling V2 API',
  }));
}
