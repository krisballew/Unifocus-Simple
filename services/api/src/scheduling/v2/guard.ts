/**
 * Scheduling V2 Authorization Guard
 *
 * This module enforces BOTH RBAC permissions and organizational scope for scheduling operations.
 *
 * **Authorization Model:**
 * - RBAC answers: "Can you perform this action?" (permission check)
 * - Org-scope answers: "On which employees/departments can you perform it?" (access boundary)
 * - Both must pass for an operation to be authorized
 *
 * **Usage in Routes:**
 * Guards throw SchedulingAuthError with HTTP status codes. Route handlers should catch
 * these errors and convert them to appropriate HTTP responses.
 *
 * @example
 * ```typescript
 * try {
 *   const context = getAuthContext(request);
 *   requireSchedulingPermission(context, SCHEDULING_PERMISSIONS.EDIT_SHIFTS);
 *   await requireDepartmentAccess(context, propertyId, departmentId);
 *   // Proceed with authorized operation
 * } catch (error) {
 *   if (error instanceof SchedulingAuthError) {
 *     return reply.code(error.statusCode).send({
 *       success: false,
 *       message: error.message
 *     });
 *   }
 *   throw error;
 * }
 * ```
 */

import type { PrismaClient, WfmSchedulePeriod } from '@prisma/client';

import type { AuthorizationContext } from '../../auth/rbac.js';
import { hasScope } from '../../auth/rbac.js';

import type { UserWithContext } from './org-scope-adapter.js';
import { canAccessDepartment, canAccessEmployee } from './org-scope-adapter.js';
import type { SchedulingPermission } from './permissions.js';
import { SCHEDULING_PERMISSIONS } from './permissions.js';

/**
 * Custom error class for scheduling authorization failures
 * Includes HTTP status code for easy conversion to HTTP responses
 */
export class SchedulingAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'SchedulingAuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Require user has a specific scheduling permission
 *
 * @param userContext - Authorization context from getAuthContext()
 * @param permissionKey - Scheduling permission key to check
 * @throws {SchedulingAuthError} 403 if permission not found
 */
export function requireSchedulingPermission(
  userContext: AuthorizationContext,
  permissionKey: SchedulingPermission
): void {
  if (!hasScope(userContext, permissionKey)) {
    throw new SchedulingAuthError(
      `Forbidden: Required permission '${permissionKey}' not found`,
      403
    );
  }
}

/**
 * Require user has access to a specific department for scheduling
 *
 * @param userContext - User context with role assignments
 * @param propertyId - Property ID where department belongs
 * @param departmentId - Department ID to check access for
 * @throws {SchedulingAuthError} 403 if department access denied
 */
export async function requireDepartmentAccess(
  userContext: UserWithContext,
  propertyId: string,
  departmentId: string
): Promise<void> {
  const hasAccess = await canAccessDepartment(userContext, propertyId, departmentId);
  if (!hasAccess) {
    throw new SchedulingAuthError(
      `Forbidden: No access to department '${departmentId}' in property '${propertyId}'`,
      403
    );
  }
}

/**
 * Require user has access to a specific employee for scheduling
 *
 * @param userContext - User context with role assignments
 * @param propertyId - Property ID where employee works
 * @param employeeId - Employee ID to check access for
 * @throws {SchedulingAuthError} 403 if employee access denied
 */
export async function requireEmployeeAccess(
  userContext: UserWithContext,
  propertyId: string,
  employeeId: string
): Promise<void> {
  const hasAccess = await canAccessEmployee(userContext, propertyId, employeeId);
  if (!hasAccess) {
    throw new SchedulingAuthError(
      `Forbidden: No access to employee '${employeeId}' in property '${propertyId}'`,
      403
    );
  }
}

/**
 * Require schedule period is writable (not locked) or user has override permission
 * Loads the period from the database with tenant scoping.
 *
 * @param userContext - Authorization context with user permissions and tenant ID
 * @param schedulePeriodId - Schedule period ID to check
 * @param prisma - Prisma client for database access
 * @throws {SchedulingAuthError} 403 if period is locked and no override permission
 * @throws {SchedulingAuthError} 404 if period not found
 * @returns The loaded WfmSchedulePeriod if writable
 */
export async function requireWritablePeriod(
  userContext: AuthorizationContext,
  schedulePeriodId: string,
  prisma: PrismaClient
): Promise<WfmSchedulePeriod> {
  // Load period with tenant scoping
  const period = await prisma.wfmSchedulePeriod.findFirst({
    where: {
      id: schedulePeriodId,
      tenantId: userContext.tenantId,
    },
  });

  if (!period) {
    throw new SchedulingAuthError(
      `Schedule period '${schedulePeriodId}' not found`,
      404
    );
  }

  // Check if period is locked
  if (period.status === 'LOCKED') {
    // Allow write access only if user has override permission
    if (!hasScope(userContext, SCHEDULING_PERMISSIONS.OVERRIDE)) {
      throw new SchedulingAuthError(
        'Forbidden: Schedule period is locked. Override permission required.',
        403
      );
    }
  }

  return period;
}
