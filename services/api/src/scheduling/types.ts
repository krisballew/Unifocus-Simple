/**
 * Core TypeScript types and interfaces for the scheduling system
 */

/**
 * Represents a shift assignment for an employee
 */
export interface Shift {
  id: string;
  employeeId: string;
  scheduleId: string;
  date: Date;
  startTime: string; // "HH:MM" format
  endTime: string; // "HH:MM" format
  breakMinutes: number;
  status: 'scheduled' | 'published' | 'confirmed' | 'completed' | 'cancelled';
}

/**
 * Represents a schedule template
 */
export interface Schedule {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'published' | 'archived';
}

/**
 * Request to create a new shift
 */
export interface CreateShiftRequest {
  employeeId: string;
  scheduleId: string;
  date: string; // ISO date string
  startTime: string; // "HH:MM" format
  endTime: string; // "HH:MM" format
  breakMinutes?: number;
}

/**
 * Request to update an existing shift
 */
export interface UpdateShiftRequest {
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  status?: Shift['status'];
}

/**
 * Response for shift queries
 */
export interface ShiftResponse {
  shift: Shift;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Scheduling conflict detected
 */
export interface SchedulingConflict {
  type: 'overlap' | 'insufficient_rest' | 'overtime_threshold' | 'availability';
  message: string;
  affectedShifts: string[];
  severity: 'error' | 'warning';
}

/**
 * Result of a scheduling operation
 */
export interface SchedulingResult {
  success: boolean;
  shifts?: Shift[];
  conflicts?: SchedulingConflict[];
  message?: string;
}
