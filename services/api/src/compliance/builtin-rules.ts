/**
 * Builtin compliance rules
 * Three starter rule implementations for common labor compliance scenarios
 */

import {
  type RuleEvaluator,
  type RuleContext,
  type ComplianceViolation,
  getMinutesBetween,
  hadPunches,
  getActualShiftTimes,
  getActualBreakMinutes,
} from './types';

/**
 * MIN_REST_BETWEEN_SHIFTS: Enforces minimum rest period between consecutive shifts
 * Common requirement: 11+ hours between shifts in many jurisdictions
 */
export const minRestBetweenShiftsRule: RuleEvaluator = {
  ruleId: 'MIN_REST_BETWEEN_SHIFTS',
  name: 'Minimum Rest Between Shifts',
  description:
    'Employees must have minimum rest period (default 11 hours) between end of one shift and start of next shift',
  severity: 'ERROR',

  validateParams(params) {
    // Param: minimumRestHours (default 11)
    if (params.minimumRestHours && typeof params.minimumRestHours !== 'number') {
      return false;
    }
    return true;
  },

  async evaluate(
    context: RuleContext & { ruleParams?: Record<string, unknown> }
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const minimumRestHours = (context.ruleParams?.minimumRestHours as number) || 11;

    // Find all days with actual punches
    const daysWithWork = context.workedDays.filter((day) => hadPunches(day));

    // Check rest period between consecutive worked days
    for (let i = 0; i < daysWithWork.length - 1; i++) {
      const today = daysWithWork[i];
      const tomorrow = daysWithWork[i + 1];

      const todayTimes = getActualShiftTimes(today);
      const tomorrowTimes = getActualShiftTimes(tomorrow);

      if (!todayTimes || !tomorrowTimes) {
        continue; // Skip if we can't determine shift times
      }

      // Calculate hours between end of today and start of tomorrow
      // We need to account for the date difference
      const todayDate = today.date;
      const tomorrowDate = tomorrow.date;
      const daysDiff = (tomorrowDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);

      // Hours between end of shift today and start of shift tomorrow
      const endTodayHours = parseInt(todayTimes.endTime.split(':')[0]);
      const endTodayMinutes = parseInt(todayTimes.endTime.split(':')[1]);
      const startTomorrowHours = parseInt(tomorrowTimes.startTime.split(':')[0]);
      const startTomorrowMinutes = parseInt(tomorrowTimes.startTime.split(':')[1]);

      const endTodayInMinutes = endTodayHours * 60 + endTodayMinutes;
      const startTomorrowInMinutes = startTomorrowHours * 60 + startTomorrowMinutes;

      const totalMinutesBetween = daysDiff * 24 * 60 + (startTomorrowInMinutes - endTodayInMinutes);
      const hoursBetween = totalMinutesBetween / 60;

      if (hoursBetween < minimumRestHours) {
        violations.push({
          ruleId: this.ruleId,
          ruleName: this.name,
          severity: this.severity,
          violation: `Only ${hoursBetween.toFixed(1)} hours of rest between shifts on ${todayDate.toISOString().split('T')[0]} and ${tomorrowDate.toISOString().split('T')[0]} (required: ${minimumRestHours} hours)`,
          remediation: `Ensure at least ${minimumRestHours} hours between end of one shift and start of next shift. Consider rescheduling one of these shifts.`,
          affectedDates: [todayDate, tomorrowDate],
        });
      }
    }

    return violations;
  },
};

/**
 * MEAL_BREAK_REQUIRED: Enforces that employees take required meal breaks
 * Common requirement: 30-minute unpaid break for shifts over 5 hours
 */
export const mealBreakRequiredRule: RuleEvaluator = {
  ruleId: 'MEAL_BREAK_REQUIRED',
  name: 'Meal Break Required',
  description:
    'Employees working shifts over minimum duration (default 5 hours) must take a meal break (default 30 minutes)',
  severity: 'ERROR',

  validateParams(params) {
    if (params.minimumShiftHours && typeof params.minimumShiftHours !== 'number') {
      return false;
    }
    if (params.minimumBreakMinutes && typeof params.minimumBreakMinutes !== 'number') {
      return false;
    }
    return true;
  },

  async evaluate(
    context: RuleContext & { ruleParams?: Record<string, unknown> }
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const minimumShiftHours = (context.ruleParams?.minimumShiftHours as number) || 5;
    const minimumBreakMinutes = (context.ruleParams?.minimumBreakMinutes as number) || 30;

    for (const day of context.workedDays) {
      if (!hadPunches(day)) {
        continue; // Skip days with no punches
      }

      const shiftTimes = getActualShiftTimes(day);
      if (!shiftTimes) {
        continue;
      }

      // Calculate actual shift length
      const [startHour, startMin] = shiftTimes.startTime.split(':').map(Number);
      const [endHour, endMin] = shiftTimes.endTime.split(':').map(Number);

      const startInMinutes = startHour * 60 + startMin;
      let endInMinutes = endHour * 60 + endMin;

      if (endInMinutes < startInMinutes) {
        endInMinutes += 24 * 60; // Next day
      }

      const totalMinutes = endInMinutes - startInMinutes;
      const totalHours = totalMinutes / 60;

      // Check if shift is long enough to require break
      if (totalHours >= minimumShiftHours) {
        const actualBreakMinutes = getActualBreakMinutes(day);

        if (actualBreakMinutes < minimumBreakMinutes) {
          violations.push({
            ruleId: this.ruleId,
            ruleName: this.name,
            severity: this.severity,
            violation: `Shift on ${day.date.toISOString().split('T')[0]} is ${totalHours.toFixed(1)} hours but only ${actualBreakMinutes} minutes of break was taken (required: ${minimumBreakMinutes} minutes)`,
            remediation: `Ensure employee takes a ${minimumBreakMinutes}-minute unpaid meal break during shifts over ${minimumShiftHours} hours.`,
            affectedDates: [day.date],
          });
        }
      }
    }

    return violations;
  },
};

/**
 * DAILY_OVERTIME: Tracks and flags overtime hours (typically 8+ hours in a day)
 * Can be configured for different thresholds
 */
export const dailyOvertimeRule: RuleEvaluator = {
  ruleId: 'DAILY_OVERTIME',
  name: 'Daily Overtime Tracking',
  description:
    'Flags days where employee works more than the daily threshold (default 8 hours) for overtime tracking',
  severity: 'WARN', // Warning, not error - overtime may be permitted

  validateParams(params) {
    if (params.dailyOvertimeThreshold && typeof params.dailyOvertimeThreshold !== 'number') {
      return false;
    }
    return true;
  },

  async evaluate(
    context: RuleContext & { ruleParams?: Record<string, unknown> }
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const dailyOvertimeThreshold = (context.ruleParams?.dailyOvertimeThreshold as number) || 8;

    for (const day of context.workedDays) {
      if (!hadPunches(day)) {
        continue;
      }

      const shiftTimes = getActualShiftTimes(day);
      if (!shiftTimes) {
        continue;
      }

      // Calculate hours worked, accounting for breaks
      const minutesWorked =
        getMinutesBetween(shiftTimes.startTime, shiftTimes.endTime) - getActualBreakMinutes(day);
      const hoursWorked = minutesWorked / 60;

      if (hoursWorked > dailyOvertimeThreshold) {
        const overtimeHours = hoursWorked - dailyOvertimeThreshold;

        violations.push({
          ruleId: this.ruleId,
          ruleName: this.name,
          severity: this.severity,
          violation: `Employee worked ${hoursWorked.toFixed(1)} hours on ${day.date.toISOString().split('T')[0]}, exceeding daily threshold of ${dailyOvertimeThreshold} hours by ${overtimeHours.toFixed(1)} hours`,
          remediation: `Track overtime hours for payroll. Ensure employee is compensated at applicable overtime rate (typically 1.5x for hours over ${dailyOvertimeThreshold}).`,
          affectedDates: [day.date],
          ruleDetails: {
            hoursWorked,
            overtimeHours,
          },
        });
      }
    }

    return violations;
  },
};

/**
 * Initializes all builtin rules and returns them as an array
 */
export function getBuiltinRules(): RuleEvaluator[] {
  return [minRestBetweenShiftsRule, mealBreakRequiredRule, dailyOvertimeRule];
}
