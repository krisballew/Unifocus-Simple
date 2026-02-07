/**
 * Scheduling V2 Data Transfer Objects
 * Type-safe DTOs for API request/response payloads
 */

/**
 * Base schedule information
 */
export interface ScheduleDTO {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'locked' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Shift assignment details
 */
export interface ShiftDTO {
  id: string;
  scheduleId: string;
  employeeId: string;
  departmentId: string;
  jobRoleId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: 'draft' | 'published' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

/**
 * Request to create a new shift
 */
export interface CreateShiftDTO {
  scheduleId: string;
  employeeId: string;
  departmentId: string;
  jobRoleId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  notes?: string;
}

/**
 * Request to update an existing shift
 */
export interface UpdateShiftDTO {
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  status?: 'draft' | 'published' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

/**
 * Employee availability window
 */
export interface AvailabilityDTO {
  id: string;
  employeeId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

/**
 * Shift swap request
 */
export interface ShiftSwapRequestDTO {
  id: string;
  requesterId: string;
  targetEmployeeId: string;
  shiftId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  resolvedAt?: string;
}

/**
 * Time-off request
 */
export interface TimeOffRequestDTO {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  resolvedAt?: string;
}

/**
 * Scheduling conflict detection result
 */
export interface SchedulingConflictDTO {
  type: 'overlap' | 'availability' | 'overtime' | 'rest_period' | 'certification';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedShiftIds: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResultDTO {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: Array<{
    index: number;
    message: string;
    data?: unknown;
  }>;
}

/**
 * Schedule Period (WFM V2)
 */
export interface SchedulePeriodDTO {
  id: string;
  tenantId: string;
  propertyId: string;
  startDate: string; // ISO datetime
  endDate: string; // ISO datetime
  status: 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';
  version: number;
  name?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Publish Event (WFM V2)
 */
export interface PublishEventDTO {
  id: string;
  tenantId: string;
  propertyId: string;
  schedulePeriodId: string;
  publishedByUserId: string;
  publishedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
