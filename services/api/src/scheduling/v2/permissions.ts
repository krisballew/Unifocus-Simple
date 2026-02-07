/**
 * Scheduling V2 Permission Definitions
 * Defines all permission keys for enterprise scheduling workflows
 */

/**
 * Permission keys for scheduling operations
 * These permissions control access to various scheduling workflows
 */
export const SCHEDULING_PERMISSIONS = {
  /** View schedules and shifts */
  VIEW: 'scheduling.view',

  /** Edit shift assignments and times */
  EDIT_SHIFTS: 'scheduling.edit.shifts',

  /** Assign employees to shifts */
  ASSIGN: 'scheduling.assign',

  /** Publish schedules to employees */
  PUBLISH: 'scheduling.publish',

  /** Lock schedules to prevent further changes */
  LOCK: 'scheduling.lock',

  /** Override scheduling constraints and locked schedules */
  OVERRIDE: 'scheduling.override',

  /** Manage shift swap and time-off requests */
  MANAGE_REQUESTS: 'scheduling.manage.requests',

  /** Manage employee availability windows */
  MANAGE_AVAILABILITY: 'scheduling.manage.availability',

  /** View schedule settings (planning templates) */
  SETTINGS_VIEW: 'scheduling.settings.view',

  /** Edit schedule settings (planning templates) */
  SETTINGS_EDIT: 'scheduling.settings.edit',
} as const;

/**
 * Type-safe permission key
 */
export type SchedulingPermission =
  (typeof SCHEDULING_PERMISSIONS)[keyof typeof SCHEDULING_PERMISSIONS];

/**
 * Array of all scheduling permission keys for validation
 */
export const ALL_SCHEDULING_PERMISSIONS = Object.values(SCHEDULING_PERMISSIONS);
