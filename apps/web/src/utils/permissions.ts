import type { User } from '../services/api-client';

/**
 * Check if a user has a specific permission scope.
 *
 * @param user - The current authenticated user
 * @param scope - The permission scope to check (e.g., "scheduling.publish")
 * @returns true if the user has the permission scope, false otherwise
 */
export function hasPermission(user: User | null | undefined, scope: string): boolean {
  if (!user || !user.scopes) {
    return false;
  }
  return user.scopes.includes(scope);
}

/**
 * Check if a user has any of the specified permission scopes.
 *
 * @param user - The current authenticated user
 * @param scopes - Array of permission scopes to check
 * @returns true if the user has at least one of the permission scopes, false otherwise
 */
export function hasAnyPermission(user: User | null | undefined, scopes: string[]): boolean {
  if (!user || !user.scopes) {
    return false;
  }
  return scopes.some((scope) => user.scopes.includes(scope));
}

/**
 * Check if a user has all of the specified permission scopes.
 *
 * @param user - The current authenticated user
 * @param scopes - Array of permission scopes to check
 * @returns true if the user has all of the permission scopes, false otherwise
 */
export function hasAllPermissions(user: User | null | undefined, scopes: string[]): boolean {
  if (!user || !user.scopes) {
    return false;
  }
  return scopes.every((scope) => user.scopes.includes(scope));
}

/**
 * Scheduling permission scopes
 */
export const SCHEDULING_PERMISSIONS = {
  EDIT_SHIFTS: 'scheduling.edit.shifts',
  ASSIGN: 'scheduling.assign',
  PUBLISH: 'scheduling.publish',
  LOCK: 'scheduling.lock',
  VIEW: 'scheduling.view',
  MANAGE_REQUESTS: 'scheduling.manage.requests',
  MANAGE_AVAILABILITY: 'scheduling.manage.availability',
} as const;
