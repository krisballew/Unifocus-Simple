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
  scheduleId: z.string().uuid().describe('Schedule ID'),
  employeeId: z.string().uuid().describe('Employee ID'),
  departmentId: z.string().uuid().describe('Department ID'),
  jobRoleId: z.string().uuid().describe('Job role ID'),
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
  scheduleId: z.string().uuid().optional().describe('Filter by schedule ID'),
  employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
  departmentId: z.string().uuid().optional().describe('Filter by department ID'),
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
  employeeId: z.string().uuid().describe('Employee ID'),
  dayOfWeek: z.number().int().min(0).max(6).describe('Day of week (0=Sunday, 6=Saturday)'),
  startTime: z.string().regex(TIME_REGEX).describe('Start time (HH:MM)'),
  endTime: z.string().regex(TIME_REGEX).describe('End time (HH:MM)'),
  isAvailable: z.boolean().describe('Whether employee is available'),
});

/**
 * Create shift swap request validator
 */
export const CreateShiftSwapSchema = z.object({
  shiftId: z.string().uuid().describe('Shift to swap'),
  targetEmployeeId: z.string().uuid().describe('Employee to swap with'),
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
