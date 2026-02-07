import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { getAuthContext } from '../auth/rbac.js';
import type { AppConfig } from '../config.js';

const prisma = new PrismaClient();

export async function userRoutes(server: FastifyInstance, config: AppConfig) {
  // GET /api/me - Get current user info
  server.get('/me', async (request, reply) => {
    const authCtx = getAuthContext(request);

    // In dev mode with auth disabled, allow unauthenticated access
    if (config.authSkipVerification && !authCtx.userId) {
      // Create a temporary logged-in user for dev/testing
      const devUser = await prisma.user.findFirst({
        where: {
          isActive: true,
        },
        include: {
          roleAssignments: {
            where: { isActive: true },
            include: { role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (devUser) {
        const roles = devUser.roleAssignments.map((ra) => ra.role.name);
        return reply.send({
          userId: devUser.id,
          email: devUser.email || '',
          username: devUser.email || '',
          name: devUser.name || '',
          tenantId: devUser.tenantId,
          roles: roles.length > 0 ? roles : ['Employee'],
          scopes: ['read:all', 'write:all'],
        });
      }

      // Fallback dev user
      return reply.send({
        userId: 'dev-user-id',
        email: 'dev@unifocus.local',
        username: 'dev-user',
        name: 'Dev User',
        tenantId: 'dev-tenant-id',
        roles: ['Employee'],
        scopes: ['read:all', 'write:all'],
      });
    }

    if (!authCtx.userId) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // In dev mode with auth disabled, try to hydrate user info from database
    if (config.authSkipVerification) {
      if (authCtx.userId && authCtx.tenantId) {
        const user = await prisma.user.findFirst({
          where: {
            id: authCtx.userId,
            tenantId: authCtx.tenantId,
          },
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        });

        if (user && user.isActive) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          return reply.send({
            userId: authCtx.userId,
            email: user.email || authCtx.email || '',
            username: authCtx.username || '',
            name: user.name || '',
            tenantId: authCtx.tenantId || null,
            roles: authCtx.roles,
            scopes: authCtx.scopes,
          });
        }
      }

      return reply.send({
        userId: authCtx.userId,
        email: authCtx.email || '',
        username: authCtx.username || '',
        tenantId: authCtx.tenantId || null,
        roles: authCtx.roles,
        scopes: authCtx.scopes,
      });
    }

    // Optionally fetch full user data from database if needed
    if (authCtx.tenantId) {
      const user = await prisma.user.findFirst({
        where: {
          id: authCtx.userId,
          tenantId: authCtx.tenantId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return reply.send({
        userId: authCtx.userId,
        email: authCtx.email || user.email || '',
        username: authCtx.username || '',
        name: user.name || '',
        tenantId: authCtx.tenantId || null,
        roles: authCtx.roles,
        scopes: authCtx.scopes,
      });
    }

    return reply.send({
      userId: authCtx.userId,
      email: authCtx.email || '',
      username: authCtx.username || '',
      tenantId: authCtx.tenantId || null,
      roles: authCtx.roles,
      scopes: authCtx.scopes,
    });
  });

  // GET /api/me/tenants - List user's tenants
  server.get('/me/tenants', async (request, reply) => {
    const authCtx = getAuthContext(request);

    if (!authCtx.userId) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Get unique tenants where user exists
    const tenants = await prisma.user.findMany({
      where: {
        id: authCtx.userId,
      },
      select: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const uniqueTenants = [...new Map(tenants.map((t) => [t.tenant.id, t.tenant])).values()];

    return reply.send(uniqueTenants);
  });

  // GET /api/me/locale - Get current user's locale preferences
  server.get('/me/locale', async (request, reply) => {
    const authCtx = getAuthContext(request);

    // In dev mode with auth disabled, return default locale without requiring auth context
    if (config.authSkipVerification) {
      return reply.send({
        locale: 'en-US',
        timezone: 'UTC',
        weekStartDay: 0,
        currency: 'USD',
        defaultLocale: 'en-US',
      });
    }

    if (!authCtx.userId || !authCtx.tenantId) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: authCtx.userId,
        tenantId: authCtx.tenantId,
      },
      select: {
        locale: true,
        timezone: true,
        tenant: {
          select: {
            weekStartDay: true,
            defaultLocale: true,
            defaultTimezone: true,
            defaultCurrency: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return reply.send({
      locale: user.locale || user.tenant.defaultLocale,
      timezone: user.timezone || user.tenant.defaultTimezone,
      weekStartDay: user.tenant.weekStartDay,
      currency: user.tenant.defaultCurrency,
      defaultLocale: user.tenant.defaultLocale,
    });
  });

  // PATCH /api/me/locale - Update user locale preferences
  server.patch('/me/locale', async (request, reply) => {
    const authCtx = getAuthContext(request);

    if (!authCtx.userId || !authCtx.tenantId) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const { locale, timezone } = request.body as { locale?: string; timezone?: string };

    const updated = await prisma.user.updateMany({
      where: {
        id: authCtx.userId,
        tenantId: authCtx.tenantId,
      },
      data: {
        ...(locale && { locale }),
        ...(timezone && { timezone }),
      },
    });

    if (updated.count === 0) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return reply.send({
      locale: locale || null,
      timezone: timezone || null,
      updated: true,
    });
  });
}
