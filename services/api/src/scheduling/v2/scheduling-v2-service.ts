/**
 * Scheduling V2 Service
 * Enterprise-grade scheduling business logic with org-aware access control
 */

import type { PrismaClient, WfmPublishEvent, WfmSchedulePeriod } from '@prisma/client';

import type { AuthorizationContext } from '../../auth/rbac.js';

import type {
  BulkOperationResultDTO,
  CreateShiftDTO,
  PublishEventDTO,
  SchedulePeriodDTO,
  SchedulingConflictDTO,
  ShiftDTO,
  UpdateShiftDTO,
} from './dtos.js';
import { requireDepartmentAccess, requireEmployeeAccess } from './guard.js';
import type { UserWithContext } from './org-scope-adapter.js';
import { getAccessibleDepartmentIds } from './org-scope-adapter.js';

/**
 * Service class for V2 scheduling operations
 * Implements enterprise scheduling with organizational scope enforcement
 */
export class SchedulingV2Service {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get shifts for a schedule with org-scope filtering
   * @param user - User context with role assignments
   * @param scheduleId - Schedule ID to query
   * @param propertyId - Property ID for scope checking
   * @returns Array of shifts the user can access
   */
  async getShifts(
    user: UserWithContext,
    _scheduleId: string,
    propertyId: string
  ): Promise<ShiftDTO[]> {
    // TODO: Implement with org-scope filtering
    const _accessibleDepartments = await getAccessibleDepartmentIds(user, propertyId);

    // Placeholder: return empty array
    return [];
  }

  /**
   * Create a new shift with org-scope validation
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param request - Shift creation request
   * @returns Created shift
   */
  async createShift(
    user: UserWithContext,
    propertyId: string,
    request: CreateShiftDTO
  ): Promise<ShiftDTO> {
    // Validate user has access to department and employee using guard helpers
    await requireDepartmentAccess(user, propertyId, request.departmentId);
    await requireEmployeeAccess(user, propertyId, request.employeeId);

    // TODO: Implement shift creation with conflict detection
    throw new Error('Not implemented');
  }

  /**
   * Update an existing shift with org-scope validation
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param shiftId - Shift ID to update
   * @param request - Update request
   * @returns Updated shift
   */
  async updateShift(
    _user: UserWithContext,
    _propertyId: string,
    _shiftId: string,
    _request: UpdateShiftDTO
  ): Promise<ShiftDTO> {
    // TODO: Implement shift update with org-scope check
    throw new Error('Not implemented');
  }

  /**
   * Delete a shift with org-scope validation
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param shiftId - Shift ID to delete
   */
  async deleteShift(_user: UserWithContext, _propertyId: string, _shiftId: string): Promise<void> {
    // TODO: Implement shift deletion with org-scope check
    throw new Error('Not implemented');
  }

  /**
   * Bulk create shifts with conflict detection
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param shifts - Array of shift creation requests
   * @returns Bulk operation result with errors
   */
  async bulkCreateShifts(
    user: UserWithContext,
    propertyId: string,
    shifts: CreateShiftDTO[]
  ): Promise<BulkOperationResultDTO> {
    // TODO: Implement bulk shift creation with conflict detection
    return {
      success: false,
      successCount: 0,
      errorCount: shifts.length,
      errors: shifts.map((_, index) => ({
        index,
        message: 'Not implemented',
      })),
    };
  }

  /**
   * Detect scheduling conflicts for a proposed shift
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param request - Shift creation request to validate
   * @returns Array of detected conflicts
   */
  async detectConflicts(
    _user: UserWithContext,
    _propertyId: string,
    _request: CreateShiftDTO
  ): Promise<SchedulingConflictDTO[]> {
    // TODO: Implement conflict detection
    // - Check for overlapping shifts
    // - Check availability windows
    // - Check overtime thresholds
    // - Check rest period requirements
    // - Check certifications
    return [];
  }

  /**
   * Publish a schedule to employees
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param scheduleId - Schedule ID to publish
   * @param notifyEmployees - Whether to send notifications
   */
  async publishSchedule(
    _user: UserWithContext,
    _propertyId: string,
    _scheduleId: string,
    _notifyEmployees: boolean
  ): Promise<void> {
    // TODO: Implement schedule publishing
    // - Update schedule status to published
    // - Send notifications if requested
    // - Create audit log entry
    throw new Error('Not implemented');
  }

  // ========== SCHEDULE PERIOD (V2) OPERATIONS ==========

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
    const periods = await this.prisma.wfmSchedulePeriod.findMany({
      where: {
        tenantId: userContext.tenantId,
        propertyId,
        ...(filters?.start && { startDate: { gte: filters.start } }),
        ...(filters?.end && { endDate: { lte: filters.end } }),
        ...(filters?.status && {
          status: filters.status as 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED',
        }),
      },
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

  // ========== HELPER METHODS ==========

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
   * Lock a schedule to prevent further changes
   * @param user - User context with role assignments
   * @param propertyId - Property ID for scope checking
   * @param scheduleId - Schedule ID to lock
   * @param reason - Optional reason for locking
   */
  async lockSchedule(
    _user: UserWithContext,
    _propertyId: string,
    _scheduleId: string,
    _reason?: string
  ): Promise<void> {
    // TODO: Implement schedule locking
    // - Update schedule status to locked
    // - Create audit log entry with reason
    throw new Error('Not implemented');
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
