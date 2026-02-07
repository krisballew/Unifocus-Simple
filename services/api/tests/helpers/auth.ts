import type { PrismaClient, User } from '@prisma/client';
import type { LightMyRequestResponse } from 'fastify';

/**
 * Test Auth Helpers
 * Provides utilities for creating authenticated test requests with proper scopes and org-scope
 */

/**
 * Scheduling permission constants (duplicated from permissions.ts for test convenience)
 */
export const SCHEDULING_SCOPES = {
  VIEW: 'scheduling.view',
  EDIT_SHIFTS: 'scheduling.edit.shifts',
  ASSIGN: 'scheduling.assign',
  PUBLISH: 'scheduling.publish',
  LOCK: 'scheduling.lock',
  OVERRIDE: 'scheduling.override',
  MANAGE_REQUESTS: 'scheduling.manage.requests',
  MANAGE_AVAILABILITY: 'scheduling.manage.availability',
  SETTINGS_VIEW: 'scheduling.settings.view',
  SETTINGS_EDIT: 'scheduling.settings.edit',
} as const;

/**
 * Standard persona configurations for testing
 */
export const TEST_PERSONAS = {
  /** Full scheduling admin - all permissions */
  schedulingAdmin: {
    scopes: [
      SCHEDULING_SCOPES.VIEW,
      SCHEDULING_SCOPES.EDIT_SHIFTS,
      SCHEDULING_SCOPES.ASSIGN,
      SCHEDULING_SCOPES.PUBLISH,
      SCHEDULING_SCOPES.LOCK,
      SCHEDULING_SCOPES.OVERRIDE,
      SCHEDULING_SCOPES.MANAGE_REQUESTS,
      SCHEDULING_SCOPES.MANAGE_AVAILABILITY,
      SCHEDULING_SCOPES.SETTINGS_VIEW,
      SCHEDULING_SCOPES.SETTINGS_EDIT,
    ],
  },

  /** Department manager - view, edit, assign within their department */
  departmentManager: {
    scopes: [
      SCHEDULING_SCOPES.VIEW,
      SCHEDULING_SCOPES.EDIT_SHIFTS,
      SCHEDULING_SCOPES.ASSIGN,
      SCHEDULING_SCOPES.MANAGE_REQUESTS,
    ],
  },

  /** Employee - can view schedules and claim open shifts */
  employee: {
    scopes: [SCHEDULING_SCOPES.VIEW],
  },
} as const;

/**
 * Build auth headers for test requests
 */
export function buildAuthHeaders(options: {
  tenantId: string;
  userId: string;
  scopes?: string[];
  propertyId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'x-tenant-id': options.tenantId,
    'x-user-id': options.userId,
  };

  if (options.scopes && options.scopes.length > 0) {
    headers['x-scopes'] = options.scopes.join(',');
  }

  return headers;
}

/**
 * Build auth headers for a pre-configured persona
 */
export function buildPersonaHeaders(
  persona: keyof typeof TEST_PERSONAS,
  context: {
    tenantId: string;
    userId: string;
  }
): Record<string, string> {
  return buildAuthHeaders({
    tenantId: context.tenantId,
    userId: context.userId,
    scopes: TEST_PERSONAS[persona].scopes,
  });
}

/**
 * Create a test user with org-scope access to specific departments
 * This ensures the user passes org-scope checks in the API
 */
export async function createTestUser(
  prisma: PrismaClient,
  options: {
    tenantId: string;
    propertyId: string;
    email?: string;
    name?: string;
    /** Department IDs the user should have access to (for org-scope) */
    departmentIds?: string[];
  }
): Promise<User> {
  const user = await prisma.user.create({
    data: {
      tenantId: options.tenantId,
      email: options.email || `test-user-${Date.now()}@test.com`,
      name: options.name || 'Test User',
      isActive: true,
    },
  });

  // If department access is specified, create role assignments for org-scope
  if (options.departmentIds && options.departmentIds.length > 0) {
    // Get or create a test role (roles table may not exist in all environments)
    let testRole;
    try {
      testRole = await prisma.role.findFirst({
        where: { name: 'Test User' },
      });

      if (!testRole) {
        testRole = await prisma.role.create({
          data: {
            name: 'Test User',
            description: 'Test role for integration tests',
            isActive: true,
          },
        });
      }
    } catch (error) {
      // Role table might not exist, skip role assignments
      console.warn('Could not create role assignment for test user:', error);
      return user;
    }

    // Create role assignments for each department to grant org-scope access
    for (const departmentId of options.departmentIds) {
      try {
        await prisma.userRoleAssignment.create({
          data: {
            tenantId: options.tenantId,
            userId: user.id,
            roleId: testRole.id,
            propertyId: options.propertyId,
            departmentId: departmentId,
            isActive: true,
          },
        });
      } catch (error) {
        console.warn('Could not create department role assignment:', error);
      }
    }
  }

  return user;
}

/**
 * Helper to assert successful response
 */
export function assertSuccess(response: LightMyRequestResponse, expectedStatus = 200): void {
  if (response.statusCode !== expectedStatus) {
    console.error('Response failed:', {
      status: response.statusCode,
      body: response.body,
    });
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}: ${response.body}`
    );
  }
}

/**
 * Helper to parse JSON response body
 */
export function parseResponseBody<T = unknown>(response: LightMyRequestResponse): T {
  try {
    return JSON.parse(response.body) as T;
  } catch (error) {
    throw new Error(`Failed to parse response body: ${response.body}`);
  }
}

/**
 * Extract data from wrapped API responses
 * Handles both wrapped responses ({ success, data }) and direct responses
 */
export function getData<T = unknown>(response: LightMyRequestResponse): T {
  const parsed = parseResponseBody(response);
  // If it's a wrapped response with data property, extract it
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return (parsed as { data: T }).data;
  }
  // If it's an array response or direct object, return as is
  return parsed as T;
}

/**
 * Assert successful response with optional status code check
 */
export function expectOk(response: LightMyRequestResponse, expectedStatus = 200): unknown {
  const parsed = parseResponseBody(response);

  if (response.statusCode !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}: ${JSON.stringify(parsed)}`
    );
  }

  // If wrapped response, validate success flag if present
  if (parsed && typeof parsed === 'object' && 'success' in parsed && !parsed.success) {
    throw new Error(`Response marked as failure: ${parsed.message || JSON.stringify(parsed)}`);
  }

  return getData(response);
}
