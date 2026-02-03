/**
 * Punch validation rules and business logic for Time & Attendance
 */

import { type Punch, type Shift } from '@prisma/client';

export interface PunchValidationError {
  code: string;
  message: string;
}

export interface ShiftWithDetails extends Shift {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface PunchContext {
  employeeId: string;
  tenantId: string;
  punchType: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: Date;
  shift?: ShiftWithDetails;
  recentPunches: Punch[];
}

export class PunchValidator {
  /**
   * Validate punch and return any violations
   */
  static validate(context: PunchContext): PunchValidationError[] {
    const errors: PunchValidationError[] = [];

    // Validate punch sequence
    const sequenceError = this.validatePunchSequence(context);
    if (sequenceError) errors.push(sequenceError);

    // Validate time window (if shift exists)
    if (context.shift) {
      const timeError = this.validateTimeWindow(context);
      if (timeError) errors.push(timeError);

      const breakError = this.validateBreakRules(context);
      if (breakError) errors.push(breakError);
    }

    // Check for duplicate punch within 5 seconds (idempotency)
    const duplicateError = this.checkDuplicatePunch(context);
    if (duplicateError) errors.push(duplicateError);

    return errors;
  }

  /**
   * Validate proper punch sequence: in -> out, break_start -> break_end
   */
  private static validatePunchSequence(context: PunchContext): PunchValidationError | null {
    const lastPunch = context.recentPunches[0]; // Most recent
    if (!lastPunch) {
      // First punch must be "in"
      if (context.punchType !== 'in') {
        return {
          code: 'INVALID_FIRST_PUNCH',
          message: 'First punch of the day must be clock in',
        };
      }
      return null;
    }

    const validSequences: Record<string, string[]> = {
      in: ['out', 'break_start'],
      out: ['in'],
      break_start: ['break_end'],
      break_end: ['out', 'break_start'],
    };

    const allowed = validSequences[lastPunch.type] || [];
    if (!allowed.includes(context.punchType)) {
      return {
        code: 'INVALID_PUNCH_SEQUENCE',
        message: `Cannot punch "${context.punchType}" after "${lastPunch.type}". Expected: ${allowed.join(' or ')}`,
      };
    }

    return null;
  }

  /**
   * Validate punch is within shift time window with grace period
   */
  private static validateTimeWindow(context: PunchContext): PunchValidationError | null {
    if (!context.shift) return null;

    const [shiftStartHour, shiftStartMin] = context.shift.startTime.split(':').map(Number);
    const [shiftEndHour, shiftEndMin] = context.shift.endTime.split(':').map(Number);

    const shiftStart = new Date(context.timestamp);
    shiftStart.setHours(shiftStartHour, shiftStartMin, 0, 0);

    const shiftEnd = new Date(context.timestamp);
    shiftEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);

    const gracePeriodMs = 15 * 60 * 1000; // 15 minute grace period

    // Clock in validation: allow up to 15 min before shift
    if (context.punchType === 'in') {
      const earliestIn = new Date(shiftStart.getTime() - gracePeriodMs);
      if (context.timestamp < earliestIn) {
        return {
          code: 'TOO_EARLY',
          message: `Cannot clock in before ${earliestIn.toLocaleTimeString()}`,
        };
      }
    }

    // Clock out validation: require within shift + grace period
    if (context.punchType === 'out') {
      const latestOut = new Date(shiftEnd.getTime() + gracePeriodMs);
      if (context.timestamp > latestOut) {
        return {
          code: 'TOO_LATE',
          message: `Punch recorded after shift ended at ${shiftEnd.toLocaleTimeString()}`,
        };
      }
    }

    return null;
  }

  /**
   * Validate break rules: total break time doesn't exceed allowed
   */
  private static validateBreakRules(context: PunchContext): PunchValidationError | null {
    if (!context.shift || context.punchType !== 'break_start') {
      return null;
    }

    // Sum up break time taken so far today
    const breakPunches = context.recentPunches.filter((p) =>
      ['break_start', 'break_end'].includes(p.type)
    );

    let totalBreakMs = 0;
    for (let i = 0; i < breakPunches.length; i += 2) {
      const start = breakPunches[i];
      const end = breakPunches[i + 1];
      if (start && end) {
        totalBreakMs += end.timestamp.getTime() - start.timestamp.getTime();
      }
    }

    const allowedBreakMs = context.shift.breakMinutes * 60 * 1000;
    if (totalBreakMs >= allowedBreakMs) {
      return {
        code: 'BREAK_LIMIT_EXCEEDED',
        message: `Break limit of ${context.shift.breakMinutes} minutes already reached today`,
      };
    }

    return null;
  }

  /**
   * Check for duplicate punch within 5 seconds (idempotency key)
   */
  private static checkDuplicatePunch(context: PunchContext): PunchValidationError | null {
    const recentPunch = context.recentPunches[0];
    if (!recentPunch) return null;

    const timeDiffMs = Math.abs(context.timestamp.getTime() - recentPunch.timestamp.getTime());
    const fiveSecondsMs = 5 * 1000;

    if (timeDiffMs < fiveSecondsMs && recentPunch.type === context.punchType) {
      return {
        code: 'DUPLICATE_PUNCH',
        message: 'Duplicate punch detected within 5 seconds',
      };
    }

    return null;
  }

  /**
   * Generate exceptions based on punch history and scheduled shift
   */
  static generateExceptions(
    employeeId: string,
    tenantId: string,
    date: Date,
    punches: Punch[],
    shift: ShiftWithDetails | null
  ): Array<{ type: string; reason: string }> {
    const exceptions: Array<{ type: string; reason: string }> = [];

    if (!shift || punches.length === 0) {
      // No shift scheduled or no punches
      if (shift && punches.length === 0) {
        exceptions.push({
          type: 'absence',
          reason: 'Employee did not punch in',
        });
      }
      return exceptions;
    }

    const inPunches = punches.filter((p) => p.type === 'in');
    const outPunches = punches.filter((p) => p.type === 'out');

    // Check for missed clock out
    if (inPunches.length > outPunches.length) {
      exceptions.push({
        type: 'missed_clock_out',
        reason: 'Employee did not clock out',
      });
    }

    if (inPunches.length > 0) {
      const [shiftStartHour, shiftStartMin] = shift.startTime.split(':').map(Number);
      const [shiftEndHour, shiftEndMin] = shift.endTime.split(':').map(Number);

      const shiftStart = new Date(date);
      shiftStart.setHours(shiftStartHour, shiftStartMin, 0, 0);
      const shiftEnd = new Date(date);
      shiftEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);

      const firstPunch = new Date(inPunches[0].timestamp);
      const lastPunch =
        outPunches.length > 0 ? new Date(outPunches[outPunches.length - 1].timestamp) : new Date();

      // Check for late arrival
      if (firstPunch.getTime() > shiftStart.getTime() + 5 * 60 * 1000) {
        exceptions.push({
          type: 'late_arrival',
          reason: `Employee clocked in ${Math.round((firstPunch.getTime() - shiftStart.getTime()) / 60000)} minutes late`,
        });
      }

      // Check for early departure
      if (outPunches.length > 0 && lastPunch.getTime() < shiftEnd.getTime() - 5 * 60 * 1000) {
        exceptions.push({
          type: 'early_departure',
          reason: `Employee clocked out ${Math.round((shiftEnd.getTime() - lastPunch.getTime()) / 60000)} minutes early`,
        });
      }
    }

    return exceptions;
  }
}
