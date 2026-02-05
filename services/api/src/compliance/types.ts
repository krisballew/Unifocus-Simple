/**
 * Core TypeScript types and interfaces for the labor compliance rules system
 */

/**
 * Canonical representation of a worked day for a single employee
 * Normalizes schedules, shifts, and punches into a single consistent format
 */
export interface CanonicalWorkedDay {
  employee: {
    id: string;
    tenantId: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
  };
  date: Date;

  // Scheduled shift (if any)
  scheduledShift?: {
    startTime: string; // "HH:MM" format
    endTime: string; // "HH:MM" format
    breakMinutes: number;
    type?: string;
  };

  // Actual punches
  punches: Punch[];

  // Exceptions (absences, lates, early outs)
  exceptions: Exception[];
}

export interface Punch {
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: Date;
  note?: string;
}

export interface Exception {
  type: string; // 'illness', 'vacation', 'late', 'early_out', etc.
  startTime?: string; // "HH:MM" format
  endTime?: string; // "HH:MM" format
  approved: boolean;
}

/**
 * Input context for rule evaluation
 */
export interface RuleContext {
  employee: {
    id: string;
    tenantId: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  workedDays: CanonicalWorkedDay[];
}

/**
 * A single compliance violation
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  severity: 'ERROR' | 'WARN'; // ERROR: must fix, WARN: should consider fixing

  // Description of the violation
  violation: string;

  // How to fix the violation (remediation)
  remediation: string;

  // Which the rule specific to (date or date range)
  affectedDates: Date[];

  // Specific rule details
  ruleDetails?: Record<string, unknown>;

  // Source text citation if available
  citation?: {
    sourceText: string;
    section?: string;
    lineNumber?: number;
  };
}

/**
 * Result of evaluating a rule package
 */
export interface RulePackageEvaluationResult {
  rulePackageId: string;
  violations: ComplianceViolation[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Rule evaluator interface - all rules must implement this
 */
export interface RuleEvaluator {
  ruleId: string;
  name: string;
  description: string;
  severity: 'ERROR' | 'WARN';

  // Evaluate the rule against context
  evaluate(context: RuleContext): Promise<ComplianceViolation[]>;

  // Validate rule parameters before evaluation
  validateParams?(params: Record<string, unknown>): boolean;
}

/**
 * Compiled rule with parameters and metadata
 */
export interface CompiledRuleWithParams {
  ruleId: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'ERROR' | 'WARN';
  params: Record<string, unknown>;
  citations?: Array<{
    sourceText: string;
    section?: string;
    lineNumber?: number;
  }>;
  clarifications?: Array<{
    clarification: string;
    context?: string;
  }>;
}

/**
 * Helper function to get hours between two times (HH:MM format)
 */
export function getHoursBetween(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startInMinutes = startHour * 60 + startMin;
  let endInMinutes = endHour * 60 + endMin;

  // If end time is less than start time, assume next day
  if (endInMinutes < startInMinutes) {
    endInMinutes += 24 * 60;
  }

  return (endInMinutes - startInMinutes) / 60;
}

/**
 * Helper function to get minutes between two times (HH:MM format)
 */
export function getMinutesBetween(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startInMinutes = startHour * 60 + startMin;
  let endInMinutes = endHour * 60 + endMin;

  // If end time is less than start time, assume next day
  if (endInMinutes < startInMinutes) {
    endInMinutes += 24 * 60;
  }

  return endInMinutes - startInMinutes;
}

/**
 * Helper function to get actual worked minutes in a shift
 * Accounts for breaks
 */
export function getWorkedMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  return getMinutesBetween(startTime, endTime) - breakMinutes;
}

/**
 * Helper to format time strings for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

/**
 * Helper to format violation for display
 */
export function formatViolation(violation: ComplianceViolation): string {
  return `[${violation.severity}] ${violation.ruleName}: ${violation.violation}`;
}
