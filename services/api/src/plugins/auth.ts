import { PrismaClient, type User } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify, importSPKI } from 'jose';
import NodeCache from 'node-cache';

import type { AppConfig } from '../config.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email: string;
    username: string;
    tenantId?: string;
    roles: string[];
    scopes: string[];
  };
}

// JWKS cache
const jwksCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

// Cache for dev tenant/user
let devTenantId: string | null = null;
let devUserId: string | null = null;

async function getOrCreateDevUser(prisma: PrismaClient) {
  // Return cached values if available
  if (devTenantId && devUserId) {
    return { tenantId: devTenantId, userId: devUserId };
  }

  try {
    // Get the first tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      // Create a demo tenant if none exists
      tenant = await prisma.tenant.create({
        data: {
          name: 'Demo Tenant',
          slug: 'demo-tenant',
        },
      });
    }

    // PRIORITIZE: First find any user with Platform Administrator role
    let user: User | null = null;
    const adminRoleAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        role: {
          name: 'Platform Administrator',
        },
      },
      include: {
        user: true,
      },
    });

    if (adminRoleAssignment) {
      user = adminRoleAssignment.user;
    }

    // If no Platform Administrator, try the demo admin user
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          email: 'admin@demo.unifocus.com',
        },
      });
    }

    // If still no user, get the first active user
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
      });
    }

    if (!user) {
      // Create a demo admin user if none exists
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: 'admin@demo.unifocus.com',
          name: 'Ava Developer',
          isActive: true,
        },
      });

      // Assign Platform Administrator role
      const adminRole = await prisma.role.findFirst({
        where: { name: 'Platform Administrator' },
      });

      if (adminRole) {
        await prisma.userRoleAssignment.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            roleId: adminRole.id,
            isActive: true,
          },
        });
      }
    }

    // Ensure we have a user at this point
    if (!user) {
      throw new Error('Failed to create or find a user for development mode');
    }

    // Cache the IDs
    devTenantId = tenant.id;
    devUserId = user.id;

    return { tenantId: tenant.id, userId: user.id };
  } catch (error) {
    console.error('Failed to get dev user:', error);
    // Return dummy values if database fails
    return { tenantId: 'dev-tenant-fallback', userId: 'dev-user-fallback' };
  }
}

export async function registerAuthPlugin(
  server: FastifyInstance,
  config: AppConfig
): Promise<void> {
  const prisma = new PrismaClient();
  if (config.authSkipVerification) {
    server.log.warn('⚠️  Auth verification is DISABLED for development');

    // In development mode without auth, inject a dev user from the database
    server.addHook('preHandler', async (request) => {
      if (
        request.url === '/health' ||
        request.url === '/ready' ||
        request.url === '/docs' ||
        request.url.startsWith('/docs/')
      ) {
        return;
      }

      // Try to get user from headers first
      let tenantId = request.headers['x-tenant-id'] as string | undefined;
      let userId = request.headers['x-user-id'] as string | undefined;
      const scopes = request.headers['x-scopes'] as string | undefined;

      // If no headers provided, get dev user from database
      if (!userId || !tenantId) {
        const devUser = await getOrCreateDevUser(prisma);
        userId = devUser.userId;
        tenantId = devUser.tenantId;
      }

      // Ensure we have valid IDs at this point
      if (!userId || !tenantId) {
        throw new Error('Failed to obtain userId and tenantId for authentication');
      }

      // Fetch user's actual roles from database
      const userRoles = await prisma.userRoleAssignment.findMany({
        where: {
          userId: userId,
          isActive: true,
        },
        include: {
          role: true,
        },
      });

      const roleNames = userRoles.map((ra) => ra.role.name);

      // Helper: Derive scheduling scopes from role names
      function deriveSchedulingScopes(roles: string[]): string[] {
        // Map common admin roles to full scheduling access
        const adminRoles = [
          'Admin',
          'Platform Administrator',
          'Scheduling Administrator',
          'Scheduling Admin',
          'Workforce Manager',
        ];

        const managerRoles = [
          'Manager',
          'Property Manager',
          'Property Administrator',
          'HR Manager',
          'Department Manager',
        ];

        // Check if user has admin role - grant all scheduling permissions
        if (roles.some((r) => adminRoles.includes(r))) {
          return [
            'scheduling.view',
            'scheduling.edit.shifts',
            'scheduling.assign',
            'scheduling.publish',
            'scheduling.lock',
            'scheduling.override',
            'scheduling.manage.requests',
            'scheduling.manage.availability',
            'scheduling.settings.view',
            'scheduling.settings.edit',
          ];
        }

        // Check if user has manager role - grant manager permissions
        if (roles.some((r) => managerRoles.includes(r))) {
          return [
            'scheduling.view',
            'scheduling.edit.shifts',
            'scheduling.assign',
            'scheduling.manage.requests',
            'scheduling.settings.view',
          ];
        }

        // Employee role - grant view only
        if (roles.includes('Employee')) {
          return ['scheduling.view'];
        }

        // Default to broad scopes for unrecognized roles
        return ['read:all', 'write:all'];
      }

      // Parse scopes from header (comma or space separated) or derive from roles
      const scopeList = scopes
        ? scopes.split(/[,\s]+/).filter(Boolean)
        : deriveSchedulingScopes(roleNames);

      // Set user object
      (request as AuthenticatedRequest).user = {
        userId: userId,
        email: 'dev@unifocus.local',
        username: 'dev-user',
        tenantId: tenantId,
        roles: roleNames.length > 0 ? roleNames : ['Employee'], // Default to Employee if no roles
        scopes: scopeList,
      };
    });

    // Cleanup on server close
    server.addHook('onClose', async () => {
      await prisma.$disconnect();
    });

    return;
  }

  if (!config.cognito.issuer || !config.cognito.jwksUri) {
    server.log.warn('Cognito config incomplete, JWT validation will be skipped');
    return;
  }

  // Fetch and cache JWKS
  async function getJWKS(): Promise<Record<string, unknown>> {
    const cached = jwksCache.get<Record<string, unknown>>('jwks');
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(config.cognito.jwksUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
      }
      const jwks = (await response.json()) as Record<string, unknown>;
      jwksCache.set('jwks', jwks);
      return jwks;
    } catch (error) {
      server.log.error({ err: error }, 'Failed to fetch JWKS');
      throw new Error('Failed to fetch JWKS');
    }
  }

  // JWT Verification Hook
  server.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const jwks = await getJWKS();

      // Get the first RSA key from JWKS (Cognito uses RS256)
      const keys = (jwks as { keys: Array<{ alg?: string; use?: string; x5c?: string[] }> }).keys;
      const key = keys.find((k) => k.alg === 'RS256' && k.use === 'sig');
      if (!key || !key.x5c?.[0]) {
        throw new Error('No signing key found in JWKS');
      }

      // Import the public key
      const publicKey = await importSPKI(
        `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`,
        'RS256'
      );

      const verified = await jwtVerify(token, publicKey, {
        issuer: config.cognito.issuer,
        audience: config.cognito.clientId,
      });

      // Extract auth data
      const claims = verified.payload;
      (request as AuthenticatedRequest).user = {
        userId: (claims.sub as string) ?? '',
        email: (claims['email'] as string) ?? '',
        username: (claims['cognito:username'] as string) ?? '',
        tenantId: claims['custom:tenant_id'] as string,
        roles: (claims['cognito:groups'] as string[]) ?? [],
        scopes: (claims['scope'] as string)?.split(' ') ?? [],
      };
    } catch (error) {
      server.log.error({ err: error }, 'JWT verification failed');
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }
  });
}
