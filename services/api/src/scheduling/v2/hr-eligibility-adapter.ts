/**
 * HR Eligibility Adapter
 * Provides employee eligibility checking for job assignments
 * Isolates HR business logic from scheduling concerns
 */

import type { PrismaClient } from '@prisma/client';
import type { AuthorizationContext } from '../../auth/rbac.js';

export interface EmployeeEligibilityParams {
  propertyId: string;
  employeeId: string;
  jobRoleId: string;
}

/**
 * Check if an employee is eligible for assignment to a specific job role
 *
 * Rules:
 * - Employee must be active at the property
 * - Employee must be eligible for the job role (has assignment or eligibility record)
 *
 * @param userContext - Authorization context
 * @param params - Eligibility check parameters
 * @param prisma - Prisma client
 * @param strict - If true, require explicit job assignment; if false, allow open roles
 * @returns true if employee is eligible, false otherwise
 */
export async function isEmployeeEligibleForJob(
  userContext: AuthorizationContext,
  params: EmployeeEligibilityParams,
  prisma: PrismaClient,
  strict: boolean = false
): Promise<boolean> {
  const { propertyId, employeeId, jobRoleId } = params;

  // Check employee exists and is active at property
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      tenantId: userContext.tenantId,
      propertyId,
      isActive: true,
    },
  });

  if (!employee) {
    return false;
  }

  // Check if employee has active job role assignment
  // Look for any job assignment for this role at this property that is currently active
  const now = new Date();
  const hasActiveJobAssignment = await prisma.employeeJobAssignment.findFirst({
    where: {
      tenantId: userContext.tenantId,
      employeeId,
      jobRoleId,
      isActive: true,
      // Start date in past or today
      startDate: {
        lte: now,
      },
      // End date in future or null (no end date means ongoing)
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
  });

  if (hasActiveJobAssignment) {
    return true;
  }

  // In strict mode (for swap requests), require explicit assignment
  if (strict) {
    return false;
  }

  // Alternative: Check if job role has no specific requirements (open role)
  // This allows more flexible assignment workflows
  const jobRole = await prisma.jobRole.findFirst({
    where: {
      id: jobRoleId,
      tenantId: userContext.tenantId,
      propertyId,
    },
  });

  // If job role exists, consider employee eligible unless there's explicit exclusion
  // (could be enhanced with eligibility matrix tables if needed)
  return jobRole !== null;
}

/**
 * Check if employee can be scheduled (helper for assignment workflows)
 * Extends eligibility to check scheduling constraints
 *
 * @param userContext - Authorization context
 * @param employeeId - Employee ID to check
 * @param propertyId - Property ID
 * @param prisma - Prisma client
 * @returns true if employee can be scheduled
 */
export async function canEmployeeBeScheduled(
  userContext: AuthorizationContext,
  employeeId: string,
  propertyId: string,
  prisma: PrismaClient
): Promise<boolean> {
  // Check employee is active at property
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      tenantId: userContext.tenantId,
      propertyId,
      isActive: true,
    },
  });

  return employee !== null;
}
