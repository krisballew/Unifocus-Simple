/**
 * Organization Scope Adapter
 * Provides organizational hierarchy navigation for scheduling access control
 * Does not implement traversal logic - delegates to org structure services
 */

import type { User } from '@prisma/client';

/**
 * User context with role assignments
 */
export interface UserWithContext extends User {
  roleAssignments?: Array<{
    propertyId: string | null;
    departmentId: string | null;
  }>;
}

/**
 * Get list of department IDs the user can access for scheduling in a property
 * @param user - User with role assignments
 * @param propertyId - Property ID to check access within
 * @returns Array of department IDs the user can access
 */
export async function getAccessibleDepartmentIds(
  user: UserWithContext,
  propertyId: string
): Promise<string[]> {
  // TODO: Implement org traversal logic
  // For now, return departments from role assignments
  if (!user.roleAssignments) {
    return [];
  }

  const departmentIds = user.roleAssignments
    .filter((ra) => ra.propertyId === propertyId && ra.departmentId)
    .map((ra) => ra.departmentId!)
    .filter((id): id is string => Boolean(id));

  return [...new Set(departmentIds)];
}

/**
 * Check if user can access a specific employee for scheduling purposes
 * @param user - User with role assignments
 * @param propertyId - Property ID where employee works
 * @param employeeId - Employee ID to check access for
 * @returns Whether user has access to schedule this employee
 */
export async function canAccessEmployee(
  user: UserWithContext,
  propertyId: string,
  _employeeId: string
): Promise<boolean> {
  // TODO: Implement employee access check via org hierarchy
  // Placeholder logic: check if user has access to any department in property
  const accessibleDepartments = await getAccessibleDepartmentIds(user, propertyId);
  return accessibleDepartments.length > 0;
}

/**
 * Check if user can access a specific department for scheduling purposes
 * @param user - User with role assignments
 * @param propertyId - Property ID where department belongs
 * @param departmentId - Department ID to check access for
 * @returns Whether user has access to schedule in this department
 */
export async function canAccessDepartment(
  user: UserWithContext,
  propertyId: string,
  departmentId: string
): Promise<boolean> {
  // TODO: Implement department access check via org hierarchy
  // Placeholder logic: check if department is in accessible list
  const accessibleDepartments = await getAccessibleDepartmentIds(user, propertyId);
  return accessibleDepartments.includes(departmentId);
}
