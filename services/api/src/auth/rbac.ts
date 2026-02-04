import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedRequest } from '../plugins/auth.js';

export type Permission = string;

export interface AuthorizationContext {
  userId: string;
  email?: string;
  username?: string;
  tenantId?: string;
  roles: string[];
  scopes: string[];
}

/**
 * Extract authorization context from request
 */
export function getAuthContext(request: FastifyRequest): AuthorizationContext {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    return {
      userId: '',
      email: undefined,
      username: undefined,
      tenantId: undefined,
      roles: [],
      scopes: [],
    };
  }

  return {
    userId: user.userId,
    email: user.email,
    username: user.username,
    tenantId: user.tenantId,
    roles: user.roles,
    scopes: user.scopes,
  };
}

/**
 * Check if user has required role
 */
export function hasRole(context: AuthorizationContext, role: string): boolean {
  return context.roles.includes(role);
}

/**
 * Check if user has required scope
 */
export function hasScope(context: AuthorizationContext, scope: string): boolean {
  return context.scopes.includes(scope);
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(context: AuthorizationContext, roles: string[]): boolean {
  return roles.some((role) => context.roles.includes(role));
}

/**
 * Check if user has all required roles
 */
export function hasAllRoles(context: AuthorizationContext, roles: string[]): boolean {
  return roles.every((role) => context.roles.includes(role));
}

/**
 * Check if user has any of the required scopes
 */
export function hasAnyScope(context: AuthorizationContext, scopes: string[]): boolean {
  return scopes.some((scope) => context.scopes.includes(scope));
}

/**
 * Check if user has all required scopes
 */
export function hasAllScopes(context: AuthorizationContext, scopes: string[]): boolean {
  return scopes.every((scope) => context.scopes.includes(scope));
}

/**
 * Require authentication - throw if not authenticated
 */
export function requireAuth(request: FastifyRequest): AuthenticationContext {
  const user = (request as AuthenticatedRequest).user;
  if (!user || !user.userId) {
    throw new Error('Unauthorized: Missing authentication');
  }
  return {
    userId: user.userId,
    email: user.email,
    username: user.username,
    tenantId: user.tenantId,
    roles: user.roles,
    scopes: user.scopes,
  };
}

export interface AuthenticationContext {
  userId: string;
  email: string;
  username: string;
  tenantId?: string;
  roles: string[];
  scopes: string[];
}

/**
 * Require specific role - throw if user doesn't have role
 */
export function requireRole(context: AuthorizationContext, role: string): void {
  if (!hasRole(context, role)) {
    throw new Error(`Forbidden: Required role '${role}' not found`);
  }
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(context: AuthorizationContext, roles: string[]): void {
  if (!hasAnyRole(context, roles)) {
    throw new Error(`Forbidden: One of these roles required: ${roles.join(', ')}`);
  }
}

/**
 * Require all of the specified roles
 */
export function requireAllRoles(context: AuthorizationContext, roles: string[]): void {
  if (!hasAllRoles(context, roles)) {
    throw new Error(`Forbidden: All of these roles required: ${roles.join(', ')}`);
  }
}

/**
 * Require specific scope
 */
export function requireScope(context: AuthorizationContext, scope: string): void {
  if (!hasScope(context, scope)) {
    throw new Error(`Forbidden: Required scope '${scope}' not found`);
  }
}

/**
 * Check if user has a tenant scope
 */
export function hasTenantScope(
  context: AuthorizationContext
): context is AuthorizationContext & { tenantId: string } {
  return Boolean(context.tenantId);
}

/**
 * Require tenant scoping - ensure user has tenantId
 */
export async function requireTenantScope(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const context = getAuthContext(request);
  if (!context.tenantId) {
    return reply.status(403).send({
      code: 'FORBIDDEN',
      message: 'Tenant scope required',
    });
  }
}

/**
 * Require resource belongs to user's tenant
 */
export function requireTenantMatch(context: AuthorizationContext, resourceTenantId: string): void {
  if (!context.tenantId) {
    throw new Error('Forbidden: No tenant scope');
  }
  if (context.tenantId !== resourceTenantId) {
    throw new Error('Forbidden: Resource does not belong to your tenant');
  }
}

/**
 * RBAC permission check with resource ownership
 */
export interface ResourceOwnershipContext {
  userId: string;
  tenantId?: string;
  roles: string[];
}

export function canAccessResource(
  context: ResourceOwnershipContext,
  requiredRole: string | string[],
  resourceOwnerId?: string,
  resourceTenantId?: string
): boolean {
  // Check role
  const hasRequiredRole = Array.isArray(requiredRole)
    ? hasAnyRole(context as AuthorizationContext, requiredRole)
    : hasRole(context as AuthorizationContext, requiredRole);

  if (!hasRequiredRole) {
    return false;
  }

  // Check tenant scoping if resource has a tenant
  if (resourceTenantId && context.tenantId && context.tenantId !== resourceTenantId) {
    return false;
  }

  // Check resource ownership if specified
  if (resourceOwnerId && resourceOwnerId !== context.userId) {
    // Unless user is an admin
    if (!hasRole(context as AuthorizationContext, 'Admin')) {
      return false;
    }
  }

  return true;
}

/**
 * Helper to create route-level authorization middleware
 */
export function createAuthorizationMiddleware(options: {
  requireRoles?: string | string[];
  requireScopes?: string | string[];
  requireTenant?: boolean;
}) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const context = getAuthContext(request);

      if (!context.userId) {
        await reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Check roles
      if (options.requireRoles) {
        const roles = Array.isArray(options.requireRoles)
          ? options.requireRoles
          : [options.requireRoles];

        if (!hasAnyRole(context, roles)) {
          await reply.status(403).send({
            code: 'FORBIDDEN',
            message: `One of these roles required: ${roles.join(', ')}`,
          });
          return;
        }
      }

      // Check scopes
      if (options.requireScopes) {
        const scopes = Array.isArray(options.requireScopes)
          ? options.requireScopes
          : [options.requireScopes];

        if (!hasAnyScope(context, scopes)) {
          await reply.status(403).send({
            code: 'FORBIDDEN',
            message: `One of these scopes required: ${scopes.join(', ')}`,
          });
          return;
        }
      }

      // Check tenant scoping
      if (options.requireTenant && !context.tenantId) {
        await reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }
    } catch (error) {
      await reply.status(403).send({
        code: 'FORBIDDEN',
        message: error instanceof Error ? error.message : 'Authorization failed',
      });
    }
  };
}
