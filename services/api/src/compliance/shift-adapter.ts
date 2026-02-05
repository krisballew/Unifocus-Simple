/**
 * Shift adapter: Normalizes database records into canonical work day format
 * Handles Schedule, Shift, Punch, and Exception records from Prisma
 */

import { type CanonicalWorkedDay, type Punch, type Exception } from './types';

/**
 * Builds a canonical worked day from database records
 * Combines scheduled shifts with actual punches and exceptions
 */
export function buildCanonicalWorkedDay(params: {
  employee: {
    id: string;
    tenantId: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
  };
  date: Date;
  schedules?: Array<{
    shifts: Array<{
      startTime: string;
      endTime: string;
      breakMinutes: number;
      dayOfWeek: number;
    }>;
  }>;
  punches?: Array<{
    type: 'in' | 'out' | 'break_start' | 'break_end';
    timestamp: Date;
  }>;
  exceptions?: Array<{
    type: string;
    date?: Date;
    startTime?: string;
    endTime?: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
}): CanonicalWorkedDay {
  const { employee, date, schedules, punches, exceptions } = params;

  // Determine the day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = date.getDay();

  // Find the scheduled shift for this day of week, if any
  let scheduledShift;
  if (schedules && schedules.length > 0) {
    const schedule = schedules[0]; // Usually only one schedule per employee
    if (schedule.shifts && schedule.shifts.length > 0) {
      const shiftForDay = schedule.shifts.find((s) => s.dayOfWeek === dayOfWeek);
      if (shiftForDay) {
        scheduledShift = {
          startTime: shiftForDay.startTime,
          endTime: shiftForDay.endTime,
          breakMinutes: shiftForDay.breakMinutes,
        };
      }
    }
  }

  // Normalize punches for this date
  const normalizedPunches: Punch[] = [];
  if (punches && punches.length > 0) {
    // Filter punches to only this date
    const sameDay = punches.filter((p) => {
      const punchDate = new Date(p.timestamp);
      return (
        punchDate.getFullYear() === date.getFullYear() &&
        punchDate.getMonth() === date.getMonth() &&
        punchDate.getDate() === date.getDate()
      );
    });

    // Sort by timestamp
    sameDay.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const punch of sameDay) {
      normalizedPunches.push({
        type: punch.type,
        timestamp: new Date(punch.timestamp),
      });
    }
  }

  // Normalize exceptions for this date
  const normalizedExceptions: Exception[] = [];
  if (exceptions && exceptions.length > 0) {
    // Filter exceptions to only this date
    const sameDay = exceptions.filter((e) => {
      if (e.date) {
        const exceptionDate = new Date(e.date);
        return (
          exceptionDate.getFullYear() === date.getFullYear() &&
          exceptionDate.getMonth() === date.getMonth() &&
          exceptionDate.getDate() === date.getDate()
        );
      }
      return false;
    });

    for (const exception of sameDay) {
      // Only include approved exceptions (pending/rejected don't count)
      if (exception.status === 'approved') {
        normalizedExceptions.push({
          type: exception.type,
          startTime: exception.startTime,
          endTime: exception.endTime,
          approved: true,
        });
      }
    }
  }

  return {
    employee,
    date,
    scheduledShift,
    punches: normalizedPunches,
    exceptions: normalizedExceptions,
  };
}

/**
 * Builds canonical worked days for a date range
 */
export function buildCanonicalWorkedDays(params: {
  employee: {
    id: string;
    tenantId: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
  };
  dateStart: Date;
  dateEnd: Date;
  schedules?: Array<{
    shifts: Array<{
      startTime: string;
      endTime: string;
      breakMinutes: number;
      dayOfWeek: number;
    }>;
  }>;
  punches?: Array<{
    type: 'in' | 'out' | 'break_start' | 'break_end';
    timestamp: Date;
  }>;
  exceptions?: Array<{
    type: string;
    date?: Date;
    startTime?: string;
    endTime?: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
}): CanonicalWorkedDay[] {
  const { employee, dateStart, dateEnd, schedules, punches, exceptions } = params;

  const canonicalDays: CanonicalWorkedDay[] = [];

  // Iterate through each day in the range
  const current = new Date(dateStart);
  while (current <= dateEnd) {
    const day = buildCanonicalWorkedDay({
      employee,
      date: new Date(current),
      schedules,
      punches,
      exceptions,
    });

    canonicalDays.push(day);

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return canonicalDays;
}

/**
 * Extracts the time portion from a timestamp in HH:MM format
 */
export function extractTimeFromTimestamp(timestamp: Date): string {
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Helper to check if a day is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Helper to get business days between two dates (excluding weekends)
 */
export function getBusinessDaysBetween(dateStart: Date, dateEnd: Date): Date[] {
  const businessDays: Date[] = [];
  const current = new Date(dateStart);

  while (current <= dateEnd) {
    if (!isWeekend(current)) {
      businessDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}
