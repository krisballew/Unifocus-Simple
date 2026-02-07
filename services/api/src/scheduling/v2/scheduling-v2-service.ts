/**
 * Scheduling V2 Service
 * Enterprise-grade scheduling business logic with org-aware access control
 */

import type { PrismaClient, WfmPublishEvent, WfmSchedulePeriod, WfmShiftPlan, WfmSwapRequest } from '@prisma/client';

import type { AuthorizationContext } from '../../auth/rbac.js';

import type {
  PublishEventDTO,
  SchedulePeriodDTO,
  SchedulingRequestDTO,
  ShiftPlanDTO,
} from './dtos.js';
import { hasScope } from '../../auth/rbac.js';
import { requireDepartmentAccess, requireEmployeeAccess, requireWritablePeriod, SchedulingAuthError, requireSchedulingPermission, hasSchedulingViewScope } from './guard.js';
import { SCHEDULING_PERMISSIONS } from './permissions.js';
import { isEmployeeEligibleForJob } from './hr-eligibility-adapter.js';

type SwapRequestRecord = Omit<WfmSwapRequest, 'notes'> & { notes?: string | null };

const SWAP_REQUEST_SELECT = {
  id: true,
  tenantId: true,
  propertyId: true,
  status: true,
  requestorEmployeeId: true,
  fromShiftPlanId: true,
  toEmployeeId: true,
  managerUserId: true,
  decisionAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Service class for V2 scheduling operations
 * Implements enterprise scheduling with organizational scope enforcement
 */
export class SchedulingV2Service {
  constructor(private prisma: PrismaClient) {}

  /**
   * List schedule periods for a property
   * @param userContext - Authentication context with permissions
   * @param propertyId - Property ID to list periods for
   * @param filters - Optional start/end date filters
   * @returns Array of schedule periods
   */
  async listSchedulePeriods(
    userContext: AuthorizationContext,
    propertyId: string,
    filters?: { start?: Date; end?: Date; status?: string }
  ): Promise<SchedulePeriodDTO[]> {
    // Determine if user can see all periods (manager) or only published (employee)
    const isManager = hasSchedulingViewScope(userContext);

    const where: any = {
      tenantId: userContext.tenantId,
      propertyId,
      ...(filters?.start && { startDate: { gte: filters.start } }),
      ...(filters?.end && { endDate: { lte: filters.end } }),
    };

    // If explicit status filter provided by manager, use it
    if (filters?.status) {
      where.status = filters.status as 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';
    } else if (!isManager) {
      // Employees can only see PUBLISHED and LOCKED periods
      where.status = {
        in: ['PUBLISHED', 'LOCKED'],
      };
    }

    const periods = await this.prisma.wfmSchedulePeriod.findMany({
      where,
      orderBy: [{ startDate: 'asc' }, { version: 'desc' }],
    });

    return periods.map((p) => this.periodToDTO(p));
  }

  /**
   * Create a new schedule period in DRAFT status
   * @param userContext - Authentication context with user ID
   * @param propertyId - Property ID for the period
   * @param startDate - Period start date
   * @param endDate - Period end date
   * @param name - Optional period name
   * @returns Created schedule period
   */
  async createSchedulePeriod(
    userContext: AuthorizationContext,
    propertyId: string,
    startDate: Date,
    endDate: Date,
    name?: string
  ): Promise<SchedulePeriodDTO> {
    if (!userContext.tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Enforce uniqueness at application level (Prisma constraint will also catch)
    const existing = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        tenantId: userContext.tenantId,
        propertyId,
        startDate,
        version: 1,
      },
    });

    if (existing) {
      throw new Error(
        `Schedule period for tenant ${userContext.tenantId}, property ${propertyId}, ` +
          `and start date ${startDate.toISOString()} already exists`
      );
    }

    const period = await this.prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: userContext.tenantId,
        propertyId,
        startDate,
        endDate,
        name,
        status: 'DRAFT',
        version: 1,
        createdByUserId: userContext.userId || undefined,
      },
    });

    return this.periodToDTO(period);
  }

  /**
   * Publish a schedule period
   * @param userContext - Authentication context
   * @param schedulePeriodId - Period ID to publish
   * @param notes - Optional publication notes
   * @returns Published schedule period and publish event
   */
  async publishSchedulePeriod(
    userContext: AuthorizationContext,
    schedulePeriodId: string,
    notes?: string
  ): Promise<{ period: SchedulePeriodDTO; event: PublishEventDTO }> {
    if (!userContext.tenantId) {
      throw new Error('Tenant ID is required');
    }

    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period '${schedulePeriodId}' not found`);
    }

    // Handle idempotency: if already published, return success
    if (period.status === 'PUBLISHED') {
      const event = await this.prisma.wfmPublishEvent.findFirst({
        where: {
          schedulePeriodId,
          tenantId: userContext.tenantId,
        },
      });
      return {
        period: this.periodToDTO(period),
        event: event ? this.eventToDTO(event) : ({} as PublishEventDTO),
      };
    }

    // If locked, require override permission (but we don't check it here - caller should)
    if (period.status === 'LOCKED') {
      throw new Error('Cannot publish a locked schedule period');
    }

    // Update period status to PUBLISHED
    const updated = await this.prisma.wfmSchedulePeriod.update({
      where: { id: schedulePeriodId },
      data: { status: 'PUBLISHED' },
    });

    // Create publish event
    const event = await this.prisma.wfmPublishEvent.create({
      data: {
        tenantId: userContext.tenantId,
        propertyId: period.propertyId,
        schedulePeriodId,
        publishedByUserId: userContext.userId,
        notes,
      },
    });

    return {
      period: this.periodToDTO(updated),
      event: this.eventToDTO(event),
    };
  }

  /**
   * Lock a schedule period to prevent edits
   * @param userContext - Authentication context
   * @param schedulePeriodId - Period ID to lock
   * @returns Locked schedule period
   */
  async lockSchedulePeriod(
    userContext: AuthorizationContext,
    schedulePeriodId: string
  ): Promise<SchedulePeriodDTO> {
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period '${schedulePeriodId}' not found`);
    }

    // Handle idempotency: if already locked, return success
    if (period.status === 'LOCKED') {
      return this.periodToDTO(period);
    }

    const updated = await this.prisma.wfmSchedulePeriod.update({
      where: { id: schedulePeriodId },
      data: { status: 'LOCKED' },
    });

    return this.periodToDTO(updated);
  }

  /**
   * List schedule period lifecycle events (publish/lock)
   * For MVP v1, returns publish events only
   * @param userContext - Auth context with user ID and tenant ID
   * @param schedulePeriodId - Schedule period ID to get events for
   * @returns Array of schedule events in chronological order
   */
  async listSchedulePeriodEvents(
    userContext: AuthorizationContext,
    schedulePeriodId: string
  ): Promise<any[]> {
    // Verify the period exists and user has access to it
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period '${schedulePeriodId}' not found`);
    }

    // For MVP v1, query only publish events
    // Lock events can be added in v2 with dedicated tracking
    const publishEvents = await this.prisma.wfmPublishEvent.findMany({
      where: {
        schedulePeriodId,
        tenantId: userContext.tenantId,
      },
      include: {
        publishedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { publishedAt: 'asc' },
    });

    // Map to unified event format
    return publishEvents.map((event) => ({
      id: event.id,
      type: 'PUBLISHED',
      at: event.publishedAt.toISOString(),
      byUserId: event.publishedByUserId,
      byDisplayName: event.publishedByUser?.name || event.publishedByUser?.email || undefined,
    }));
  }

  // ========== SHIFT PLAN (V2) OPERATIONS ==========

  /**
   * List shifts for a schedule period with org-scope filtering
   * @param userContext - Auth context with permissions and tenant ID
   * @param schedulePeriodId - Schedule period to query
   * @param propertyId - Property ID for scope validation
   * @param filters - Optional department, job role, and date filters
   * @returns Array of shifts the user can access
   */
  async listShifts(
    userContext: AuthorizationContext,
    schedulePeriodId: string,
    propertyId: string,
    filters?: {
      departmentId?: string;
      jobRoleId?: string;
      start?: Date;
      end?: Date;
    }
  ): Promise<ShiftPlanDTO[]> {
    // Determine if user is manager (has scheduling.view) or employee
    const isManager = hasSchedulingViewScope(userContext);

    // For employees, verify the schedule period is PUBLISHED or LOCKED
    if (!isManager) {
      const period = await this.prisma.wfmSchedulePeriod.findFirst({
        where: {
          id: schedulePeriodId,
          tenantId: userContext.tenantId,
          propertyId,
        },
      });

      if (!period) {
        throw new SchedulingAuthError('Schedule period not found', 404);
      }

      if (period.status === 'DRAFT' || period.status === 'ARCHIVED') {
        throw new SchedulingAuthError(
          `Cannot view shifts from ${period.status} schedule period`,
          403
        );
      }
    }

    // Build filter conditions
    const where: any = {
      tenantId: userContext.tenantId,
      propertyId,
      schedulePeriodId,
    };

    // Apply optional department filter if provided (managers only)
    if (filters?.departmentId) {
      if (!isManager) {
        throw new SchedulingAuthError('Employees cannot filter by department', 403);
      }
      where.departmentId = filters.departmentId;
    }

    // Apply optional job role filter (managers only)
    if (filters?.jobRoleId) {
      if (!isManager) {
        throw new SchedulingAuthError('Employees cannot filter by job role', 403);
      }
      where.jobRoleId = filters.jobRoleId;
    }

    // Apply date range filters
    if (filters?.start || filters?.end) {
      where.startDateTime = {};
      if (filters.start) {
        where.startDateTime.gte = filters.start;
      }
      if (filters.end) {
        where.startDateTime.lte = filters.end;
      }
    }

    // Query with assignments
    const shifts = await this.prisma.wfmShiftPlan.findMany({
      where,
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    });

    // For employees, filter to only their assigned shifts
    let result = shifts;
    if (!isManager) {
      result = shifts.filter((shift) =>
        shift.assignments.some((assignment) => assignment.employeeId === userContext.userId)
      );
    }

    return result.map((shift) => this.shiftToDTO(shift));
  }

  /**
   * List open shifts for marketplace (employees and managers)
   * @param userContext - Auth context with permissions and tenant ID
   * @param query - Query object with propertyId, start, end, and optional filters
   * @returns Array of open shifts the user can access
   */
  async listOpenShifts(
    userContext: AuthorizationContext,
    query: {
      propertyId: string;
      start: string; // ISO datetime
      end: string; // ISO datetime
      departmentId?: string;
      jobRoleId?: string;
      includeIneligible?: string; // 'true' or 'false'
    }
  ): Promise<ShiftPlanDTO[]> {
    const isManager = hasSchedulingViewScope(userContext);
    const includeIneligible = query.includeIneligible === 'true';

    // Parse dates
    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    // Build base where clause with tenant/property scoping
    const where: any = {
      tenantId: userContext.tenantId,
      propertyId: query.propertyId,
      isOpenShift: true,
      startDateTime: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Apply department filter (managers only)
    if (query.departmentId) {
      if (!isManager) {
        throw new SchedulingAuthError('Employees cannot filter by department', 403);
      }
      where.departmentId = query.departmentId;
    }

    // Apply job role filter (managers only)
    if (query.jobRoleId) {
      if (!isManager) {
        throw new SchedulingAuthError('Employees cannot filter by job role', 403);
      }
      where.jobRoleId = query.jobRoleId;
    }

    // For employees, restrict to PUBLISHED/LOCKED periods
    if (!isManager) {
      // Join with schedule period and filter by status
      const shifts = await this.prisma.wfmShiftPlan.findMany({
        where,
        include: {
          assignments: {
            select: {
              employeeId: true,
            },
          },
          period: {
            select: {
              status: true,
            },
          },
        },
        orderBy: {
          startDateTime: 'asc',
        },
      });

      // Filter to published/locked periods
      let result = shifts.filter(
        (shift) => shift.period?.status === 'PUBLISHED' || shift.period?.status === 'LOCKED'
      );

      // If includeIneligible is false (default), filter out ineligible shifts
      if (!includeIneligible) {
        result = await Promise.all(
          result.map(async (shift) => {
            // Check eligibility: employee must be eligible for job role
            const isEligible = await isEmployeeEligibleForJob(
              userContext,
              {
                propertyId: query.propertyId,
                employeeId: userContext.userId,
                jobRoleId: shift.jobRoleId,
              },
              this.prisma,
              true // strict mode
            );

            if (!isEligible) {
              return null;
            }

            // Check for overlap with existing assignments
            const hasOverlap = await this.hasOverlapWithExistingAssignments(
              userContext,
              userContext.userId,
              query.propertyId,
              shift.startDateTime,
              shift.endDateTime
            );

            if (hasOverlap) {
              return null;
            }

            return shift;
          })
        );

        // Filter out null values
        result = result.filter((shift) => shift !== null);
      }

      return result.map((shift) => this.shiftToDTO(shift));
    }

    // For managers, query without period restriction
    const shifts = await this.prisma.wfmShiftPlan.findMany({
      where,
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    });

    return shifts.map((shift) => this.shiftToDTO(shift));
  }

  /**
   * Create a new shift with validation
   * @param userContext - Auth context
   * @param body - Shift creation request
   * @returns Created shift
   */
  async createShift(
    userContext: AuthorizationContext,
    body: {
      schedulePeriodId: string;
      propertyId: string;
      departmentId: string;
      jobRoleId: string;
      startDateTime: string;
      endDateTime: string;
      breakMinutes?: number;
      isOpenShift?: boolean;
      notes?: string;
    }
  ): Promise<ShiftPlanDTO> {
    // Check scheduling.edit.shifts permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.EDIT_SHIFTS)) {
      throw new Error('Forbidden: scheduling.edit.shifts permission required');
    }

    // Verify period exists and is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: body.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period '${body.schedulePeriodId}' not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot create shift in locked schedule period');
    }

    // Verify department exists and is accessible
    const department = await this.prisma.department.findFirst({
      where: {
        id: body.departmentId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!department) {
      throw new Error(`Department '${body.departmentId}' not found or not accessible`);
    }

    // Verify job role exists
    const jobRole = await this.prisma.jobRole.findFirst({
      where: {
        id: body.jobRoleId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!jobRole) {
      throw new Error(`Job role '${body.jobRoleId}' not found`);
    }

    // Verify shift times are valid
    const startTime = new Date(body.startDateTime);
    const endTime = new Date(body.endDateTime);
    if (startTime >= endTime) {
      throw new Error('Validation: startDateTime must be before endDateTime');
    }

    // Verify break minutes is valid
    if (body.breakMinutes !== undefined && (body.breakMinutes < 0 || body.breakMinutes > 480)) {
      throw new Error('Validation: breakMinutes must be between 0 and 480');
    }

    // Create shift
    const shift = await this.prisma.wfmShiftPlan.create({
      data: {
        tenantId: userContext.tenantId!,
        propertyId: body.propertyId,
        schedulePeriodId: body.schedulePeriodId,
        departmentId: body.departmentId,
        jobRoleId: body.jobRoleId,
        startDateTime: startTime,
        endDateTime: endTime,
        breakMinutes: body.breakMinutes ?? 0,
        isOpenShift: body.isOpenShift ?? false,
        notes: body.notes,
      },
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    return this.shiftToDTO(shift);
  }

  /**
   * Update an existing shift
   * @param userContext - Auth context
   * @param shiftId - Shift ID to update
   * @param body - Update request
   * @returns Updated shift
   */
  async updateShift(
    userContext: AuthorizationContext,
    shiftId: string,
    body: {
      propertyId: string;
      departmentId?: string;
      jobRoleId?: string;
      startDateTime?: string;
      endDateTime?: string;
      breakMinutes?: number;
      isOpenShift?: boolean;
      notes?: string;
    }
  ): Promise<ShiftPlanDTO> {
    // Check scheduling.edit.shifts permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.EDIT_SHIFTS)) {
      throw new Error('Forbidden: scheduling.edit.shifts permission required');
    }

    // Load existing shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
    });

    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    // Verify period is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: shift.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot update shift in locked schedule period');
    }

    // Validate department access for existing department
    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        id: shift.departmentId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!existingDepartment) {
      throw new Error(`Department access denied`);
    }

    // If department is being changed, validate access to new department
    if (body.departmentId && body.departmentId !== shift.departmentId) {
      const newDepartment = await this.prisma.department.findFirst({
        where: {
          id: body.departmentId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
      });

      if (!newDepartment) {
        throw new Error(`Department '${body.departmentId}' not found or not accessible`);
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (body.departmentId !== undefined) {
      updateData.departmentId = body.departmentId;
    }

    if (body.jobRoleId !== undefined) {
      updateData.jobRoleId = body.jobRoleId;
    }

    if (body.startDateTime !== undefined) {
      updateData.startDateTime = new Date(body.startDateTime);
    }

    if (body.endDateTime !== undefined) {
      updateData.endDateTime = new Date(body.endDateTime);
    }

    if (body.breakMinutes !== undefined) {
      updateData.breakMinutes = body.breakMinutes;
    }

    if (body.isOpenShift !== undefined) {
      updateData.isOpenShift = body.isOpenShift;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Validate time ordering if times are being set
    if (updateData.startDateTime || updateData.endDateTime) {
      const startTime = updateData.startDateTime ?? shift.startDateTime;
      const endTime = updateData.endDateTime ?? shift.endDateTime;
      if (startTime >= endTime) {
        throw new Error('Validation: startDateTime must be before endDateTime');
      }
    }

    // Validate break minutes
    if (updateData.breakMinutes !== undefined) {
      if (updateData.breakMinutes < 0 || updateData.breakMinutes > 480) {
        throw new Error('Validation: breakMinutes must be between 0 and 480');
      }
    }

    // Update shift
    const updated = await this.prisma.wfmShiftPlan.update({
      where: { id: shiftId },
      data: updateData,
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    return this.shiftToDTO(updated);
  }

  /**
   * Delete a shift
   * @param userContext - Auth context
   * @param shiftId - Shift ID to delete
   * @param propertyId - Property ID for scope validation
   */
  async deleteShift(
    userContext: AuthorizationContext,
    shiftId: string,
    propertyId: string
  ): Promise<void> {
    // Check scheduling.edit.shifts permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.EDIT_SHIFTS)) {
      throw new Error('Forbidden: scheduling.edit.shifts permission required');
    }

    // Load shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
    });

    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    // Verify property ID matches (additional safety check)
    if (shift.propertyId !== propertyId) {
      throw new Error('Forbidden: Shift does not belong to requested property');
    }

    // Verify period is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: shift.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot delete shift in locked schedule period');
    }

    // Verify department access
    const department = await this.prisma.department.findFirst({
      where: {
        id: shift.departmentId,
        tenantId: userContext.tenantId,
        propertyId: propertyId,
      },
    });

    if (!department) {
      throw new Error(`Department access denied`);
    }

    // Delete shift (cascade delete will handle assignments)
    await this.prisma.wfmShiftPlan.delete({
      where: { id: shiftId },
    });
  }

  // ========== SHIFT ASSIGNMENT (V2) OPERATIONS ==========

  /**
   * Check for overlapping assignments for an employee
   * @param userContext - Auth context
   * @param employeeId - Employee ID
   * @param propertyId - Property ID
   * @param startDateTime - Candidate shift start time
   * @param endDateTime - Candidate shift end time
   * @param ignoreShiftPlanId - Shift ID to exclude (for updates)
   * @throws Error with 409 status if overlap exists
   */
  private async assertNoOverlap(
    userContext: AuthorizationContext,
    employeeId: string,
    propertyId: string,
    startDateTime: Date,
    endDateTime: Date,
    ignoreShiftPlanId?: string
  ): Promise<void> {
    // Find any existing assignments for this employee that overlap
    const overlappingShifts = await this.prisma.wfmShiftPlan.findMany({
      where: {
        tenantId: userContext.tenantId,
        propertyId,
        assignments: {
          some: {
            employeeId,
          },
        },
        // Find shifts that overlap the candidate time window
        // Overlap occurs if: existingStart < candidateEnd AND existingEnd > candidateStart
        AND: [
          { startDateTime: { lt: endDateTime } },
          { endDateTime: { gt: startDateTime } },
        ],
        // Exclude the shift being updated
        ...(ignoreShiftPlanId && {
          NOT: {
            id: ignoreShiftPlanId,
          },
        }),
      },
      select: {
        id: true,
        startDateTime: true,
        endDateTime: true,
        departmentId: true,
      },
    });

    if (overlappingShifts.length > 0) {
      const conflict = overlappingShifts[0];
      const error = new Error(
        `Conflict: Employee already assigned to shift from ${conflict.startDateTime.toISOString()} to ${conflict.endDateTime.toISOString()}`
      );
      (error as any).status = 409;
      throw error;
    }
  }

  /**
   * Assign an employee to a shift
   * @param userContext - Auth context
   * @param body - Assignment request
   * @param shiftId - Shift ID to assign to
   * @returns Updated shift with assignments
   */
  async assignEmployeeToShift(
    userContext: AuthorizationContext,
    shiftId: string,
    body: {
      propertyId: string;
      employeeId: string;
    }
  ): Promise<ShiftPlanDTO> {
    // Check scheduling.assign permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.ASSIGN)) {
      throw new Error('Forbidden: scheduling.assign permission required');
    }

    // Load shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
    });

    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    // Verify property matches
    if (shift.propertyId !== body.propertyId) {
      throw new Error('Forbidden: Shift does not belong to requested property');
    }

    // Verify period is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: shift.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot assign to shift in locked schedule period');
    }

    // Verify manager has access to shift's department
    const department = await this.prisma.department.findFirst({
      where: {
        id: shift.departmentId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!department) {
      throw new Error(`Department access denied`);
    }

    // Verify manager has access to employee
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: body.employeeId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
        isActive: true,
      },
    });

    if (!employee) {
      throw new Error(`Employee not found or not active`);
    }

    // Check employee eligibility for job role
    const isEligible = await isEmployeeEligibleForJob(
      userContext,
      {
        propertyId: body.propertyId,
        employeeId: body.employeeId,
        jobRoleId: shift.jobRoleId,
      },
      this.prisma
    );

    if (!isEligible) {
      const error = new Error(
        `Employee is not eligible for job role '${shift.jobRoleId}'`
      );
      (error as any).status = 409;
      throw error;
    }

    // Check for overlapping assignments
    await this.assertNoOverlap(
      userContext,
      body.employeeId,
      body.propertyId,
      shift.startDateTime,
      shift.endDateTime
    );

    // Create assignment (idempotent: check if already exists)
    const existingAssignment = await this.prisma.wfmShiftAssignment.findFirst({
      where: {
        tenantId: userContext.tenantId!,
        shiftPlanId: shiftId,
        employeeId: body.employeeId,
      },
    });

    if (!existingAssignment) {
      await this.prisma.wfmShiftAssignment.create({
        data: {
          tenantId: userContext.tenantId!,
          propertyId: body.propertyId,
          shiftPlanId: shiftId,
          employeeId: body.employeeId,
          assignedByUserId: userContext.userId,
          assignedAt: new Date(),
        },
      });
    }

    // Return updated shift DTO
    const updatedShift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    if (!updatedShift) {
      throw new Error(`Failed to retrieve updated shift`);
    }

    return this.shiftToDTO(updatedShift);
  }

  /**
   * Unassign an employee from a shift
   * @param userContext - Auth context
   * @param shiftId - Shift ID to unassign from
   * @param body - Unassignment request
   * @returns Updated shift with assignments
   */
  async unassignEmployeeFromShift(
    userContext: AuthorizationContext,
    shiftId: string,
    body: {
      propertyId: string;
      employeeId: string;
    }
  ): Promise<ShiftPlanDTO> {
    // Check scheduling.assign permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.ASSIGN)) {
      throw new Error('Forbidden: scheduling.assign permission required');
    }

    // Load shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
    });

    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    // Verify property matches
    if (shift.propertyId !== body.propertyId) {
      throw new Error('Forbidden: Shift does not belong to requested property');
    }

    // Verify period is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: shift.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot unassign from shift in locked schedule period');
    }

    // Verify manager has access to shift's department
    const department = await this.prisma.department.findFirst({
      where: {
        id: shift.departmentId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!department) {
      throw new Error(`Department access denied`);
    }

    // Verify manager has access to employee
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: body.employeeId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!employee) {
      throw new Error(`Employee not found`);
    }

    // Delete assignment if exists (idempotent)
    await this.prisma.wfmShiftAssignment.deleteMany({
      where: {
        tenantId: userContext.tenantId!,
        shiftPlanId: shiftId,
        employeeId: body.employeeId,
      },
    });

    // Return updated shift DTO
    const updatedShift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
      },
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    if (!updatedShift) {
      throw new Error(`Failed to retrieve updated shift`);
    }

    return this.shiftToDTO(updatedShift);
  }

  // ========== OPEN SHIFT CLAIM (V2) OPERATIONS ==========

  /**
   * Claim an open shift (employee self-service)
   * @param userContext - Auth context (employee)
   * @param shiftId - Shift ID to claim
   * @param body - Claim request
   * @returns Created or existing request DTO
   */
  async claimOpenShift(
    userContext: AuthorizationContext,
    shiftId: string,
    body: {
      propertyId: string;
    }
  ): Promise<SchedulingRequestDTO> {
    // Load shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: shiftId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    // Verify shift is open
    if (!shift.isOpenShift) {
      const error = new Error('Shift is not an open shift');
      (error as any).status = 400;
      throw error;
    }

    // Verify employee exists and is active
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: userContext.userId, // Employee claiming is the requesting user
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
        isActive: true,
      },
    });

    if (!employee) {
      throw new Error('Employee not found or not active');
    }

    // Check employee eligibility for job role
    const isEligible = await isEmployeeEligibleForJob(
      userContext,
      {
        propertyId: body.propertyId,
        employeeId: userContext.userId,
        jobRoleId: shift.jobRoleId,
      },
      this.prisma
    );

    if (!isEligible) {
      const error = new Error(`Employee is not eligible for job role '${shift.jobRoleId}'`);
      (error as any).status = 409;
      throw error;
    }

    // Check for overlapping assignments
    await this.assertNoOverlap(
      userContext,
      userContext.userId,
      body.propertyId,
      shift.startDateTime,
      shift.endDateTime
    );

    // Check if identical pending request already exists (idempotent)
    const existingRequest = await this.prisma.wfmSwapRequest.findFirst({
      where: {
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
        requestorEmployeeId: userContext.userId,
        fromShiftPlanId: shiftId,
        toEmployeeId: null, // Open shift claim indicator
        status: 'PENDING',
      },
      select: SWAP_REQUEST_SELECT,
    });

    if (existingRequest) {
      return this.requestToDTO(existingRequest);
    }

    // Create new request
    const request = await this.prisma.wfmSwapRequest.create({
      data: {
        tenantId: userContext.tenantId!,
        propertyId: body.propertyId,
        requestorEmployeeId: userContext.userId,
        fromShiftPlanId: shiftId,
        toEmployeeId: null, // Indicates open shift claim (not a swap)
        status: 'PENDING',
      },
      select: SWAP_REQUEST_SELECT,
    });

    return this.requestToDTO(request);
  }

  /**
   * List scheduling requests (manager view)
   * @param userContext - Auth context (manager)
   * @param filters - Property and status filters
   * @returns Array of requests in manager's scope
   */
  async listRequests(
    userContext: AuthorizationContext,
    filters: {
      propertyId: string;
      status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELED';
    }
  ): Promise<SchedulingRequestDTO[]> {
    // Check scheduling.manage.requests permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.MANAGE_REQUESTS)) {
      throw new Error('Forbidden: scheduling.manage.requests permission required');
    }

    // Build where clause
    const where: any = {
      tenantId: userContext.tenantId,
      propertyId: filters.propertyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    // Query requests with shift details for UI
    const requests = await this.prisma.wfmSwapRequest.findMany({
      where,
      select: {
        ...SWAP_REQUEST_SELECT,
        fromShiftPlan: {
          select: {
            departmentId: true,
            jobRoleId: true,
            startDateTime: true,
            endDateTime: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter to only requests for shifts in manager's accessible departments
    // TODO: In production, this should use getAccessibleDepartmentIds for actual org-scope filtering
    // For now, return all requests (manager sees all at property)
    return requests.map((req) => this.requestToDTO(req, req.fromShiftPlan));
  }

  /**
   * Approve a scheduling request (manager action)
   * @param userContext - Auth context (manager)
   * @param requestId - Request ID to approve
   * @param body - Approval request
   * @returns Updated request and shift data
   */
  async approveRequest(
    userContext: AuthorizationContext,
    requestId: string,
    body: {
      propertyId: string;
    }
  ): Promise<{ request: SchedulingRequestDTO; shift: ShiftPlanDTO }> {
    // Check scheduling.manage.requests permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.MANAGE_REQUESTS)) {
      throw new Error('Forbidden: scheduling.manage.requests permission required');
    }

    // Use transaction to prevent race conditions
    return await this.prisma.$transaction(async (tx) => {
      // Load request with tenant scoping
      const request = await tx.wfmSwapRequest.findFirst({
        where: {
          id: requestId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
        select: SWAP_REQUEST_SELECT,
      });

      if (!request) {
        throw new Error(`Request '${requestId}' not found`);
      }

      // Only pending requests can be approved
      if (request.status !== 'PENDING') {
        const error = new Error(`Request is not pending (current status: ${request.status})`);
        (error as any).status = 409;
        throw error;
      }

      // Determine request type: swap or open-shift claim
      const isSwapRequest = request.toEmployeeId !== null;
      const targetEmployeeId = isSwapRequest ? request.toEmployeeId! : request.requestorEmployeeId;

      // Load shift with assignments
      const shift = await tx.wfmShiftPlan.findFirst({
        where: {
          id: request.fromShiftPlanId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
        include: {
          assignments: {
            select: {
              employeeId: true,
            },
          },
        },
      });

      if (!shift) {
        throw new Error(`Shift not found`);
      }

      await requireWritablePeriod(userContext, shift.schedulePeriodId, tx);

      // Verify shift state based on request type
      if (isSwapRequest) {
        // For swap requests: verify requestor is still assigned to the shift
        const requestorAssignment = await tx.wfmShiftAssignment.findFirst({
          where: {
            tenantId: userContext.tenantId,
            shiftPlanId: shift.id,
            employeeId: request.requestorEmployeeId,
          },
        });
        if (!requestorAssignment) {
          const error = new Error('Requestor is no longer assigned to the shift');
          (error as any).status = 409;
          throw error;
        }
      } else {
        // For open-shift claims: verify shift is still open
        if (!shift.isOpenShift) {
          const error = new Error('Shift is no longer open');
          (error as any).status = 409;
          throw error;
        }

        // Check if shift is already assigned
        const existingAssignment = await tx.wfmShiftAssignment.findFirst({
          where: {
            tenantId: userContext.tenantId,
            shiftPlanId: shift.id,
          },
        });

        if (existingAssignment) {
          const error = new Error('Shift is already assigned');
          (error as any).status = 409;
          throw error;
        }
      }

      const manager = await tx.user.findFirst({
        where: {
          id: userContext.userId,
          tenantId: userContext.tenantId,
        },
        include: {
          roleAssignments: {
            select: {
              propertyId: true,
              departmentId: true,
            },
          },
        },
      });

      if (!manager) {
        throw new Error('Manager not found');
      }

      // Verify manager has access to shift's department
      const department = await tx.department.findFirst({
        where: {
          id: shift.departmentId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
      });

      if (!department) {
        throw new Error(`Department access denied`);
      }

      await requireDepartmentAccess(manager, body.propertyId, shift.departmentId);

      // Verify manager has access to requestor employee
      const requestorEmployee = await tx.employee.findFirst({
        where: {
          id: request.requestorEmployeeId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
      });

      if (!requestorEmployee) {
        throw new Error(`Requestor employee not found`);
      }

      await requireEmployeeAccess(manager, body.propertyId, request.requestorEmployeeId);

      // For swap requests: verify manager has access to target employee
      if (isSwapRequest) {
        const targetEmployee = await tx.employee.findFirst({
          where: {
            id: targetEmployeeId,
            tenantId: userContext.tenantId,
            propertyId: body.propertyId,
          },
        });

        if (!targetEmployee) {
          throw new Error(`Target employee not found`);
        }

        await requireEmployeeAccess(manager, body.propertyId, targetEmployeeId);
      }

      // Re-check eligibility at approval time for target employee
      const isEligible = await isEmployeeEligibleForJob(
        userContext,
        {
          propertyId: body.propertyId,
          employeeId: targetEmployeeId,
          jobRoleId: shift.jobRoleId,
        },
        tx as any
      );

      if (!isEligible) {
        const error = new Error(`Employee is no longer eligible for job role`);
        (error as any).status = 409;
        throw error;
      }

      // Re-check overlap at approval time for target employee
      const overlappingShifts = await tx.wfmShiftPlan.findMany({
        where: {
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
          assignments: {
            some: {
              employeeId: targetEmployeeId,
            },
          },
          AND: [
            { startDateTime: { lt: shift.endDateTime } },
            { endDateTime: { gt: shift.startDateTime } },
          ],
          NOT: {
            id: shift.id,
          },
        },
      });

      if (overlappingShifts.length > 0) {
        const error = new Error('Employee now has overlapping assignments');
        (error as any).status = 409;
        throw error;
      }

      // Execute approval transaction based on request type
      if (isSwapRequest) {
        // SWAP REQUEST: Remove requestor assignment, add target employee assignment
        // Delete requestor's assignment
        await tx.wfmShiftAssignment.deleteMany({
          where: {
            tenantId: userContext.tenantId,
            shiftPlanId: shift.id,
            employeeId: request.requestorEmployeeId,
          },
        });

        // Create target employee assignment
        await tx.wfmShiftAssignment.create({
          data: {
            tenantId: userContext.tenantId!,
            propertyId: body.propertyId,
            shiftPlanId: shift.id,
            employeeId: targetEmployeeId,
            assignedByUserId: userContext.userId,
            assignedAt: new Date(),
          },
        });
      } else {
        // OPEN SHIFT CLAIM: Create assignment and close shift
        await tx.wfmShiftAssignment.create({
          data: {
            tenantId: userContext.tenantId!,
            propertyId: body.propertyId,
            shiftPlanId: shift.id,
            employeeId: targetEmployeeId,
            assignedByUserId: userContext.userId,
            assignedAt: new Date(),
          },
        });

        // Close the shift (no longer open)
        await tx.wfmShiftPlan.updateMany({
          where: {
            id: shift.id,
            tenantId: userContext.tenantId,
            propertyId: body.propertyId,
          },
          data: { isOpenShift: false },
        });
      }

      // Update request status
      const updateResult = await tx.wfmSwapRequest.updateMany({
        where: {
          id: requestId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
        data: {
          status: 'APPROVED',
          managerUserId: userContext.userId,
          decisionAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error(`Request '${requestId}' not found`);
      }

      const updatedRequest = await tx.wfmSwapRequest.findFirst({
        where: {
          id: requestId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
        select: SWAP_REQUEST_SELECT,
      });

      if (!updatedRequest) {
        throw new Error(`Request '${requestId}' not found`);
      }

      // Load updated shift with assignments
      const updatedShift = await tx.wfmShiftPlan.findFirst({
        where: {
          id: shift.id,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
        },
        include: {
          assignments: {
            select: {
              employeeId: true,
            },
          },
        },
      });

      if (!updatedShift) {
        throw new Error('Failed to retrieve updated shift');
      }

      return {
        request: this.requestToDTO(updatedRequest),
        shift: this.shiftToDTO(updatedShift),
      };
    });
  }

  /**
   * Deny a scheduling request (manager action)
   * @param userContext - Auth context (manager)
   * @param requestId - Request ID to deny
   * @param body - Denial request with optional reason
   * @returns Updated request
   */
  async denyRequest(
    userContext: AuthorizationContext,
    requestId: string,
    body: {
      propertyId: string;
      reason?: string;
    }
  ): Promise<SchedulingRequestDTO> {
    // Check scheduling.manage.requests permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.MANAGE_REQUESTS)) {
      throw new Error('Forbidden: scheduling.manage.requests permission required');
    }

    // Load request with tenant scoping
    const request = await this.prisma.wfmSwapRequest.findFirst({
      where: {
        id: requestId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
      select: SWAP_REQUEST_SELECT,
    });

    if (!request) {
      throw new Error(`Request '${requestId}' not found`);
    }

    // Only pending requests can be denied
    if (request.status !== 'PENDING') {
      const error = new Error(`Request is not pending (current status: ${request.status})`);
      (error as any).status = 409;
      throw error;
    }

    // Load shift to verify period lock
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: request.fromShiftPlanId,
        tenantId: userContext.tenantId,
      },
    });

    if (!shift) {
      throw new Error(`Shift not found`);
    }

    // Verify period is writable
    const period = await this.prisma.wfmSchedulePeriod.findFirst({
      where: {
        id: shift.schedulePeriodId,
        tenantId: userContext.tenantId,
      },
    });

    if (!period) {
      throw new Error(`Schedule period not found`);
    }

    if (period.status === 'LOCKED') {
      throw new Error('Forbidden: Cannot deny request for locked schedule period');
    }

    // Verify manager has access to shift's department
    const department = await this.prisma.department.findFirst({
      where: {
        id: shift.departmentId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
    });

    if (!department) {
      throw new Error(`Department access denied`);
    }

    // Update request status
    const updatedRequest = await this.prisma.wfmSwapRequest.update({
      where: { id: requestId },
      data: {
        status: 'DENIED',
        managerUserId: userContext.userId,
        decisionAt: new Date(),
        ...(body.reason && { notes: body.reason }),
      },
    });

    return this.requestToDTO(updatedRequest);
  }

  /**
   * Create a swap request (employee self-service)
   * @param userContext - Auth context (employee)
   * @param body - Swap request details
   * @returns Created or existing swap request DTO
   */
  async createSwapRequest(
    userContext: AuthorizationContext,
    body: {
      propertyId: string;
      fromShiftPlanId: string;
      toEmployeeId: string;
    }
  ): Promise<SchedulingRequestDTO> {
    // Load shift with tenant scoping
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: body.fromShiftPlanId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
      },
      include: {
        assignments: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    if (!shift) {
      throw new Error(`Shift '${body.fromShiftPlanId}' not found`);
    }

    // Ensure period is writable before creating swap request
    await requireWritablePeriod(userContext, shift.schedulePeriodId, this.prisma);

    // Verify shift is assigned to the requestor (they can only swap their own shifts)
    const isAssignedToRequestor = shift.assignments.some((a) => a.employeeId === userContext.userId);
    if (!isAssignedToRequestor) {
      const error = new Error('Cannot create swap request: shift is not assigned to you');
      (error as any).status = 403;
      throw error;
    }

    // Verify target employee exists and is active
    const targetEmployee = await this.prisma.employee.findFirst({
      where: {
        id: body.toEmployeeId,
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
        isActive: true,
      },
    });

    if (!targetEmployee) {
      throw new Error('Target employee not found or not active');
    }

    // Check target employee eligibility for job role
    const isEligible = await isEmployeeEligibleForJob(
      userContext,
      {
        propertyId: body.propertyId,
        employeeId: body.toEmployeeId,
        jobRoleId: shift.jobRoleId,
      },
      this.prisma,
      true // strict mode: require explicit assignment
    );

    if (!isEligible) {
      const error = new Error(`Target employee is not eligible for job role '${shift.jobRoleId}'`);
      (error as any).status = 409;
      throw error;
    }

    // Check for overlapping assignments for target employee
    await this.assertNoOverlap(
      userContext,
      body.toEmployeeId,
      body.propertyId,
      shift.startDateTime,
      shift.endDateTime
    );

    // Check if identical pending request already exists (idempotent)
    const existingRequest = await this.prisma.wfmSwapRequest.findFirst({
      where: {
        tenantId: userContext.tenantId,
        propertyId: body.propertyId,
        requestorEmployeeId: userContext.userId,
        fromShiftPlanId: body.fromShiftPlanId,
        toEmployeeId: body.toEmployeeId,
        status: 'PENDING',
      },
      select: SWAP_REQUEST_SELECT,
    });

    if (existingRequest) {
      return this.requestToDTO(existingRequest);
    }

    // Create new swap request
    const request = await this.prisma.wfmSwapRequest.create({
      data: {
        tenantId: userContext.tenantId!,
        propertyId: body.propertyId,
        requestorEmployeeId: userContext.userId,
        fromShiftPlanId: body.fromShiftPlanId,
        toEmployeeId: body.toEmployeeId,
        status: 'PENDING',
      },
      select: SWAP_REQUEST_SELECT,
    });

    return this.requestToDTO(request);
  }

  /**
   * Cancel a swap request (employee self-service)
   * @param userContext - Auth context (employee)
   * @param params - Request ID and property ID
   * @returns Updated request DTO
   */
  async cancelSwapRequest(
    userContext: AuthorizationContext,
    params: {
      requestId: string;
      propertyId: string;
    }
  ): Promise<SchedulingRequestDTO> {
    // Load request with tenant scoping
    const request = await this.prisma.wfmSwapRequest.findFirst({
      where: {
        id: params.requestId,
        tenantId: userContext.tenantId,
        propertyId: params.propertyId,
      },
      select: SWAP_REQUEST_SELECT,
    });

    if (!request) {
      throw new Error(`Request '${params.requestId}' not found`);
    }

    // Only requester can cancel their own request
    if (request.requestorEmployeeId !== userContext.userId) {
      const error = new Error('Forbidden: Can only cancel your own requests');
      (error as any).status = 403;
      throw error;
    }

    // Only pending requests can be canceled
    if (request.status !== 'PENDING') {
      const error = new Error(`Request is already decided (current status: ${request.status})`);
      (error as any).status = 409;
      throw error;
    }

    // Load shift to verify period is writable
    const shift = await this.prisma.wfmShiftPlan.findFirst({
      where: {
        id: request.fromShiftPlanId,
        tenantId: userContext.tenantId,
        propertyId: params.propertyId,
      },
    });

    if (!shift) {
      throw new Error('Shift not found');
    }

    await requireWritablePeriod(userContext, shift.schedulePeriodId, this.prisma);

    // Update request status
    const updateResult = await this.prisma.wfmSwapRequest.updateMany({
      where: {
        id: params.requestId,
        tenantId: userContext.tenantId,
        propertyId: params.propertyId,
      },
      data: {
        status: 'CANCELED',
      },
    });

    if (updateResult.count === 0) {
      throw new Error(`Request '${params.requestId}' not found`);
    }

    const updatedRequest = await this.prisma.wfmSwapRequest.findFirst({
      where: {
        id: params.requestId,
        tenantId: userContext.tenantId,
        propertyId: params.propertyId,
      },
      select: SWAP_REQUEST_SELECT,
    });

    if (!updatedRequest) {
      throw new Error(`Request '${params.requestId}' not found`);
    }

    return this.requestToDTO(updatedRequest);
  }

  // ========== AVAILABILITY ENDPOINTS ==========

  /**
   * List availability entries for an employee or self
   * @param userContext - Auth context
   * @param query - Query params: propertyId, employeeId (optional), start?, end?
   * @returns Array of availability entries
   */
  async listAvailability(
    userContext: AuthorizationContext,
    query: {
      propertyId: string;
      employeeId?: string;
      start?: string;
      end?: string;
    }
  ): Promise<{ id: string; employeeId: string; date: string; startTime: string; endTime: string; type?: string; recurrenceRule?: string | null; createdAt: string; updatedAt: string }[]> {
    try {
      // Determine whose availability to fetch
      const targetEmployeeId = query.employeeId || userContext.userId;

      // If requesting other employee's availability, require permission + org scope
      if (query.employeeId && query.employeeId !== userContext.userId) {
        requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.VIEW);
        await requireEmployeeAccess(userContext, query.propertyId, query.employeeId);
      }

      // Build date filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Record<string, any> = {
        tenantId: userContext.tenantId,
        propertyId: query.propertyId,
        employeeId: targetEmployeeId,
      };

      if (query.start || query.end) {
        filters.date = {};
        if (query.start) {
          filters.date.gte = new Date(query.start);
        }
        if (query.end) {
          filters.date.lte = new Date(query.end);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = await this.prisma.wfmAvailability.findMany({
        where: filters as any,
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });

      return entries.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        date: e.date.toISOString(),
        startTime: e.startTime,
        endTime: e.endTime,
        type: e.type || undefined,
        recurrenceRule: e.recurrenceRule,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }));
    } catch (error) {
      if (error instanceof SchedulingAuthError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Create availability entry for self or (with permission) another employee
   * @param userContext - Auth context
   * @param body - Request body: propertyId, employeeId?, date, startTime, endTime, type?, recurrenceRule?
   * @returns Created availability entry
   */
  async createAvailability(
    userContext: AuthorizationContext,
    body: {
      propertyId: string;
      employeeId?: string;
      date: string;
      startTime: string;
      endTime: string;
      type?: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
      recurrenceRule?: string;
    }
  ): Promise<{ id: string; employeeId: string; date: string; startTime: string; endTime: string; type?: string; recurrenceRule?: string | null; createdAt: string; updatedAt: string }> {
    try {
      // Determine whose availability to create
      const targetEmployeeId = body.employeeId || userContext.userId;

      // If creating for another employee, require permission + org scope
      if (body.employeeId && body.employeeId !== userContext.userId) {
        requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.MANAGE_AVAILABILITY);
        await requireEmployeeAccess(userContext, body.propertyId, body.employeeId);
      }

      // Verify target employee exists and is active
      const targetEmployee = await this.prisma.employee.findFirst({
        where: {
          id: targetEmployeeId,
          tenantId: userContext.tenantId,
          propertyId: body.propertyId,
          isActive: true,
        },
      });

      if (!targetEmployee) {
        throw new Error('Employee not found or not active');
      }

      // Create availability entry
      const entry = await this.prisma.wfmAvailability.create({
        data: {
          tenantId: userContext.tenantId!,
          propertyId: body.propertyId,
          employeeId: targetEmployeeId,
          date: new Date(body.date),
          startTime: body.startTime,
          endTime: body.endTime,
          type: body.type,
          recurrenceRule: body.recurrenceRule,
        },
      });

      return {
        id: entry.id,
        employeeId: entry.employeeId,
        date: entry.date.toISOString(),
        startTime: entry.startTime,
        endTime: entry.endTime,
        type: entry.type || undefined,
        recurrenceRule: entry.recurrenceRule,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof SchedulingAuthError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Delete availability entry
   * @param userContext - Auth context
   * @param params - { id: string, propertyId: string }
   * @returns Success response
   */
  async deleteAvailability(
    userContext: AuthorizationContext,
    params: {
      id: string;
      propertyId: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Load availability entry to check ownership
      const entry = await this.prisma.wfmAvailability.findFirst({
        where: {
          id: params.id,
          tenantId: userContext.tenantId,
          propertyId: params.propertyId,
        },
      });

      if (!entry) {
        throw new SchedulingAuthError('Availability entry not found', 404);
      }

      // Check ownership: employee can delete their own, manager needs permission + scope
      const isOwner = entry.employeeId === userContext.userId;
      if (!isOwner) {
        requireSchedulingPermission(userContext, SCHEDULING_PERMISSIONS.MANAGE_AVAILABILITY);
        await requireEmployeeAccess(userContext, params.propertyId, entry.employeeId);
      }

      // Delete entry
      await this.prisma.wfmAvailability.delete({
        where: {
          id: params.id,
        },
      });

      return {
        success: true,
        message: 'Availability entry deleted successfully',
      };
    } catch (error) {
      if (error instanceof SchedulingAuthError) {
        throw error;
      }
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Check if employee has overlapping assignments with a candidate shift
   * Returns true if there is OVERLAP, false if the shift is available (no overlap)
   *
   * @param userContext - Authorization context
   * @param employeeId - Employee ID
   * @param propertyId - Property ID
   * @param startDateTime - Candidate shift start
   * @param endDateTime - Candidate shift end
   * @returns true if overlap exists, false otherwise
   */
  private async hasOverlapWithExistingAssignments(
    userContext: AuthorizationContext,
    employeeId: string,
    propertyId: string,
    startDateTime: Date,
    endDateTime: Date
  ): Promise<boolean> {
    const overlappingShifts = await this.prisma.wfmShiftPlan.findMany({
      where: {
        tenantId: userContext.tenantId,
        propertyId,
        assignments: {
          some: {
            employeeId,
          },
        },
        // Find shifts that overlap the candidate time window
        AND: [
          { startDateTime: { lt: endDateTime } },
          { endDateTime: { gt: startDateTime } },
        ],
      },
      select: {
        id: true,
      },
      take: 1, // Only need to know if one exists
    });

    return overlappingShifts.length > 0;
  }

  /**
   * Convert WfmShiftPlan to ShiftPlanDTO
   */
  private shiftToDTO(shift: WfmShiftPlan & { assignments?: Array<{ employeeId: string }> }): ShiftPlanDTO {
    return {
      id: shift.id,
      tenantId: shift.tenantId,
      propertyId: shift.propertyId,
      schedulePeriodId: shift.schedulePeriodId,
      departmentId: shift.departmentId,
      jobRoleId: shift.jobRoleId,
      startDateTime: shift.startDateTime.toISOString(),
      endDateTime: shift.endDateTime.toISOString(),
      breakMinutes: shift.breakMinutes,
      isOpenShift: shift.isOpenShift,
      notes: shift.notes || undefined,
      assignmentEmployeeIds: shift.assignments?.map((a) => a.employeeId) ?? [],
      createdAt: shift.createdAt.toISOString(),
      updatedAt: shift.updatedAt.toISOString(),
    };
  }

  /**
   * Convert WfmSchedulePeriod to DTO
   */
  private periodToDTO(period: WfmSchedulePeriod): SchedulePeriodDTO {
    return {
      id: period.id,
      tenantId: period.tenantId,
      propertyId: period.propertyId,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      status: period.status,
      version: period.version,
      name: period.name || undefined,
      createdByUserId: period.createdByUserId || undefined,
      createdAt: period.createdAt.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
    };
  }

  /**
   * Convert WfmPublishEvent to DTO
   */
  private eventToDTO(event: WfmPublishEvent): PublishEventDTO {
    return {
      id: event.id,
      tenantId: event.tenantId,
      propertyId: event.propertyId,
      schedulePeriodId: event.schedulePeriodId,
      publishedByUserId: event.publishedByUserId,
      publishedAt: event.publishedAt.toISOString(),
      notes: event.notes || undefined,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  /**
   * Convert WfmSwapRequest to SchedulingRequestDTO
   */
  private requestToDTO(
    request: SwapRequestRecord,
    shift?: {
      departmentId: string;
      jobRoleId: string;
      startDateTime: Date;
      endDateTime: Date;
    }
  ): SchedulingRequestDTO {
    return {
      id: request.id,
      tenantId: request.tenantId,
      propertyId: request.propertyId,
      status: request.status as 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELED',
      requestorEmployeeId: request.requestorEmployeeId,
      fromShiftPlanId: request.fromShiftPlanId,
      toEmployeeId: request.toEmployeeId,
      managerUserId: request.managerUserId,
      decisionAt: request.decisionAt?.toISOString() ?? null,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      ...(shift && {
        shift: {
          departmentId: shift.departmentId,
          jobRoleId: shift.jobRoleId,
          startDateTime: shift.startDateTime.toISOString(),
          endDateTime: shift.endDateTime.toISOString(),
        },
      }),
    };
  }
}

/**
 * Factory function to create scheduling service instance
 * @param prisma - Prisma client instance
 * @returns New SchedulingV2Service instance
 */
export function createSchedulingV2Service(prisma: PrismaClient): SchedulingV2Service {
  return new SchedulingV2Service(prisma);
}
