/**
 * Scheduling V2 Input Validators
 * Zod schemas for request validation
 */

import { z } from 'zod';

/**
 * Time validation regex (HH:MM format)
 */
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * ISO date validation regex (YYYY-MM-DD)
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shift status enum
 */
export const ShiftStatusSchema = z.enum([
  'draft',
  'published',
  'confirmed',
  'completed',
  'cancelled',
]);

/**
 * Schedule status enum
 */
export const ScheduleStatusSchema = z.enum(['draft', 'published', 'locked', 'archived']);

/**
 * Create shift request validator
 */
export const CreateShiftRequestSchema = z.object({
  scheduleId: z.string().describe('Schedule ID'),
  employeeId: z.string().describe('Employee ID'),
  departmentId: z.string().describe('Department ID'),
  jobRoleId: z.string().describe('Job role ID'),
  date: z.string().regex(DATE_REGEX).describe('Shift date (YYYY-MM-DD)'),
  startTime: z.string().regex(TIME_REGEX).describe('Start time (HH:MM)'),
  endTime: z.string().regex(TIME_REGEX).describe('End time (HH:MM)'),
  breakMinutes: z.number().int().min(0).max(480).optional().describe('Break duration in minutes'),
  notes: z.string().max(1000).optional().describe('Shift notes'),
});

/**
 * Update shift request validator
 */
export const UpdateShiftRequestSchema = z.object({
  startTime: z.string().regex(TIME_REGEX).optional().describe('Start time (HH:MM)'),
  endTime: z.string().regex(TIME_REGEX).optional().describe('End time (HH:MM)'),
  breakMinutes: z.number().int().min(0).max(480).optional().describe('Break duration in minutes'),
  status: ShiftStatusSchema.optional().describe('Shift status'),
  notes: z.string().max(1000).optional().describe('Shift notes'),
});

/**
 * Query shifts request validator
 */
export const QueryShiftsSchema = z.object({
  scheduleId: z.string().optional().describe('Filter by schedule ID'),
  employeeId: z.string().optional().describe('Filter by employee ID'),
  departmentId: z.string().optional().describe('Filter by department ID'),
  startDate: z.string().regex(DATE_REGEX).optional().describe('Start date filter (YYYY-MM-DD)'),
  endDate: z.string().regex(DATE_REGEX).optional().describe('End date filter (YYYY-MM-DD)'),
  status: ShiftStatusSchema.optional().describe('Filter by status'),
  limit: z.number().int().min(1).max(500).default(100).describe('Result limit'),
  offset: z.number().int().min(0).default(0).describe('Result offset'),
});

/**
 * Create availability request validator
 */
export const CreateAvailabilitySchema = z.object({
  employeeId: z.string().describe('Employee ID'),
  dayOfWeek: z.number().int().min(0).max(6).describe('Day of week (0=Sunday, 6=Saturday)'),
  startTime: z.string().regex(TIME_REGEX).describe('Start time (HH:MM)'),
  endTime: z.string().regex(TIME_REGEX).describe('End time (HH:MM)'),
  isAvailable: z.boolean().describe('Whether employee is available'),
});

/**
 * Create shift swap request validator
 */
export const CreateShiftSwapSchema = z.object({
  shiftId: z.string().describe('Shift to swap'),
  targetEmployeeId: z.string().describe('Employee to swap with'),
  reason: z.string().max(500).optional().describe('Swap reason'),
});

/**
 * Create time-off request validator
 */
export const CreateTimeOffSchema = z.object({
  startDate: z.string().regex(DATE_REGEX).describe('Time-off start date (YYYY-MM-DD)'),
  endDate: z.string().regex(DATE_REGEX).describe('Time-off end date (YYYY-MM-DD)'),
  reason: z.string().max(500).describe('Time-off reason'),
});

/**
 * Bulk shift creation validator
 */
export const BulkCreateShiftsSchema = z.object({
  shifts: z.array(CreateShiftRequestSchema).min(1).max(100).describe('Array of shifts to create'),
});

/**
 * Publish schedule request validator
 */
export const PublishScheduleSchema = z.object({
  notifyEmployees: z.boolean().default(true).describe('Send notifications to employees'),
  effectiveDate: z.string().regex(DATE_REGEX).optional().describe('Effective date for publication'),
});

/**
 * Lock schedule request validator
 */
export const LockScheduleSchema = z.object({
  reason: z.string().max(500).optional().describe('Reason for locking'),
});

// ============================================================================
// SCHEDULE PERIOD (V2) VALIDATORS
// ============================================================================

/**
 * List schedule periods query validator
 */
export const ListSchedulePeriodsQuerySchema = z.object({
  propertyId: z.string().describe('Property ID (required)'),
  start: z.string().datetime().optional().describe('Start date filter (ISO datetime)'),
  end: z.string().datetime().optional().describe('End date filter (ISO datetime)'),
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED'])
    .optional()
    .describe('Filter by status'),
});

/**
 * Create schedule period request validator
 */
export const CreateSchedulePeriodBodySchema = z
  .object({
    propertyId: z.string().describe('Property ID'),
    startDate: z.string().datetime().describe('Start date (ISO datetime)'),
    endDate: z.string().datetime().describe('End date (ISO datetime)'),
    name: z.string().max(255).optional().describe('Period name'),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'startDate must be before endDate',
    path: ['startDate'],
  });

/**
 * Publish schedule period request validator
 */
export const PublishSchedulePeriodBodySchema = z.object({
  notes: z.string().max(1000).optional().describe('Publication notes'),
});

/**
 * Lock schedule period request validator
 */
export const LockSchedulePeriodBodySchema = z.object({});
// ============================================================================
// SHIFT PLAN (V2) VALIDATORS
// ============================================================================

/**
 * List shifts query validator
 * propertyId is required, other filters are optional
 */
export const ListShiftsQuerySchema = z.object({
  propertyId: z.string().describe('Property ID (required)'),
  departmentId: z.string().optional().describe('Filter by department ID'),
  jobRoleId: z.string().optional().describe('Filter by job role ID'),
  start: z.string().datetime().optional().describe('Start datetime filter (ISO datetime)'),
  end: z.string().datetime().optional().describe('End datetime filter (ISO datetime)'),
});

/**
 * Create shift request validator
 * Uses ISO datetime format for precision (startDateTime, endDateTime)
 */
export const CreateShiftBodySchema = z
  .object({
    schedulePeriodId: z.string().describe('Schedule period ID'),
    propertyId: z.string().describe('Property ID'),
    departmentId: z.string().describe('Department ID'),
    jobRoleId: z.string().describe('Job role ID'),
    startDateTime: z.string().datetime().describe('Shift start (ISO datetime)'),
    endDateTime: z.string().datetime().describe('Shift end (ISO datetime)'),
    breakMinutes: z.number().int().min(0).max(480).optional().describe('Break duration in minutes'),
    isOpenShift: z.boolean().optional().describe('Whether this is an open shift'),
    notes: z.string().max(1000).optional().describe('Shift notes'),
  })
  .refine((data) => new Date(data.startDateTime) < new Date(data.endDateTime), {
    message: 'startDateTime must be before endDateTime',
    path: ['startDateTime'],
  });

/**
 * Update shift request validator
 */
export const UpdateShiftBodySchema = z
  .object({
    propertyId: z.string().describe('Property ID'),
    departmentId: z.string().optional().describe('Department ID'),
    jobRoleId: z.string().optional().describe('Job role ID'),
    startDateTime: z.string().datetime().optional().describe('Shift start (ISO datetime)'),
    endDateTime: z.string().datetime().optional().describe('Shift end (ISO datetime)'),
    breakMinutes: z.number().int().min(0).max(480).optional().describe('Break duration in minutes'),
    isOpenShift: z.boolean().optional().describe('Whether this is an open shift'),
    notes: z.string().max(1000).optional().describe('Shift notes'),
  })
  .refine(
    (data) => {
      // If both times provided, validate ordering
      if (data.startDateTime && data.endDateTime) {
        return new Date(data.startDateTime) < new Date(data.endDateTime);
      }
      return true;
    },
    {
      message: 'startDateTime must be before endDateTime',
      path: ['startDateTime'],
    }
  );

/**
 * Delete shift query validator
 */
export const DeleteShiftQuerySchema = z.object({
  propertyId: z.string().describe('Property ID'),
});

// ============================================================================
// SHIFT ASSIGNMENT (V2) VALIDATORS
// ============================================================================

/**
 * Assign employee to shift request validator
 */
export const AssignShiftBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
  employeeId: z.string().describe('Employee ID to assign'),
});

/**
 * Unassign employee from shift request validator
 */
export const UnassignShiftBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
  employeeId: z.string().describe('Employee ID to unassign'),
});

// ============================================================================
// OPEN SHIFT CLAIM (V2) VALIDATORS
// ============================================================================

/**
 * Claim open shift request validator
 */
export const ClaimOpenShiftBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
});

/**
 * List scheduling requests query validator
 */
export const ListRequestsQuerySchema = z.object({
  propertyId: z.string().describe('Property ID (required)'),
  status: z
    .enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELED'])
    .optional()
    .describe('Filter by status'),
});

/**
 * Approve request body validator
 */
export const ApproveRequestBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
});

/**
 * Deny request body validator
 */
export const DenyRequestBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
  reason: z.string().max(1000).optional().describe('Denial reason'),
});

// ============================================================================
// SHIFT SWAP (V2) VALIDATORS
// ============================================================================

/**
 * Create swap request body validator
 */
export const CreateSwapRequestBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
  fromShiftPlanId: z.string().describe('Shift ID to swap from (owned by requestor)'),
  toEmployeeId: z.string().describe('Employee ID to swap shift to'),
});

/**
 * Cancel swap request body validator
 */
export const CancelSwapRequestBodySchema = z.object({
  propertyId: z.string().describe('Property ID'),
});
// ============================================================================
// AVAILABILITY (V2) VALIDATORS
// ============================================================================

/**
 * List availability query validator
 * Supports date range filtering with optional employee ID
 */
export const AvailabilityListQuerySchema = z.object({
  propertyId: z.string().describe('Property ID (required)'),
  employeeId: z.string().optional().describe('Filter by employee ID (defaults to current user if omitted)'),
  start: z.string().datetime().optional().describe('Start datetime filter (ISO datetime)'),
  end: z.string().datetime().optional().describe('End datetime filter (ISO datetime)'),
});

/**
 * Create availability request validator
 * Supports creating availability entries with optional recurrence
 */
export const AvailabilityCreateBodySchema = z
  .object({
    propertyId: z.string().describe('Property ID'),
    employeeId: z.string().optional().describe('Employee ID (defaults to current user if omitted)'),
    date: z.string().regex(DATE_REGEX).describe('Availability date (YYYY-MM-DD)'),
    startTime: z.string().regex(TIME_REGEX).describe('Start time (HH:MM)'),
    endTime: z.string().regex(TIME_REGEX).describe('End time (HH:MM)'),
    type: z.enum(['AVAILABLE', 'UNAVAILABLE', 'PREFERRED']).optional()
      .describe('Availability type'),
    recurrenceRule: z.string().optional()
      .describe('Recurrence rule (RFC 5545 format, stored as-is, not expanded)'),
  })
  .refine(
    (data) => {
      // Validate startTime < endTime using lexicographic comparison
      return data.startTime < data.endTime;
    },
    {
      message: 'startTime must be before endTime',
      path: ['startTime'],
    }
  );

/**
 * Delete availability query validator
 */
export const AvailabilityDeleteQuerySchema = z.object({
  propertyId: z.string().describe('Property ID'),
});