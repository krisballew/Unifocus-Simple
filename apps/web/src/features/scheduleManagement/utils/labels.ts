/**
 * Schedule Management Label Utilities
 * Helpers for formatting display labels
 */

import type { EmployeeLookup } from '../api/lookups';

/**
 * Format employee label as "Last, First (Employee #)"
 * Falls back to displayName if first/last names are missing
 */
export function formatEmployeeLabel(employee: EmployeeLookup): string {
  const { firstName, lastName, employeeNumber, displayName } = employee;

  // Use first and last name if available
  if (firstName && lastName) {
    const base = `${lastName}, ${firstName}`;
    if (employeeNumber) {
      return `${base} (${employeeNumber})`;
    }
    return base;
  }

  // Fall back to displayName if available
  if (displayName) {
    return displayName;
  }

  // Last resort: use employee ID
  return employee.id;
}
