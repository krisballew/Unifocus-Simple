import { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext, hasRole } from '../auth/rbac';

const prisma = new PrismaClient();

interface UpdateUserPreferencesBody {
  locale?: 'en-US' | 'es-ES';
  timezone?: string;
}

interface TenantSettingsBody {
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  defaultLocale?: 'en-US' | 'es-ES';
  defaultTimezone?: string;
  defaultCurrency?: string;
}

export async function settingsRoutes(server: FastifyInstance) {
  // GET /api/users/me/preferences - Get user preferences
  server.get(
    '/users/me/preferences',
    {
      schema: {
        description: 'Get current user preferences',
        tags: ['Settings'],
        response: {
          200: {
            type: 'object',
            properties: {
              locale: { type: 'string' },
              timezone: { type: 'string' },
              weekStartDay: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.headers['x-user-id'] as string;
        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'User ID required',
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            locale: true,
            timezone: true,
            tenant: {
              select: {
                weekStartDay: true,
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
          locale: user.locale || 'en-US',
          timezone: user.timezone || 'UTC',
          weekStartDay: user.tenant?.weekStartDay || 0,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get preferences',
        });
      }
    }
  );

  // PUT /api/users/me/preferences - Update user preferences
  server.put(
    '/users/me/preferences',
    {
      schema: {
        description: 'Update current user preferences',
        tags: ['Settings'],
        body: {
          type: 'object',
          properties: {
            locale: { type: 'string', enum: ['en-US', 'es-ES'] },
            timezone: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              locale: { type: 'string' },
              timezone: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UpdateUserPreferencesBody }>, reply: FastifyReply) => {
      try {
        const userId = request.headers['x-user-id'] as string;
        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'User ID required',
          });
        }

        const { locale, timezone } = request.body;

        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(locale && { locale }),
            ...(timezone && { timezone }),
          },
          select: {
            locale: true,
            timezone: true,
          },
        });

        return reply.send({
          locale: updated.locale || 'en-US',
          timezone: updated.timezone || 'UTC',
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update preferences',
        });
      }
    }
  );

  // GET /api/tenants/:tenantId/settings - Get tenant settings
  server.get(
    '/tenants/:tenantId/settings',
    {
      schema: {
        description: 'Get tenant settings',
        tags: ['Settings'],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              weekStartDay: { type: 'number' },
              defaultLocale: { type: 'string' },
              defaultTimezone: { type: 'string' },
              defaultCurrency: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
      try {
        const { tenantId } = request.params;
        const userId = request.headers['x-user-id'] as string;

        // Verify user has access to this tenant
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            tenantId: tenantId,
          },
        });

        if (!user) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            weekStartDay: true,
          },
        });

        if (!tenant) {
          return reply.status(404).send({
            code: 'NOT_FOUND',
            message: 'Tenant not found',
          });
        }

        return reply.send({
          weekStartDay: tenant.weekStartDay || 0,
          defaultLocale: 'en-US',
          defaultTimezone: 'UTC',
          defaultCurrency: 'USD',
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get settings',
        });
      }
    }
  );

  // PUT /api/tenants/:tenantId/settings - Update tenant settings (admin only)
  server.put(
    '/tenants/:tenantId/settings',
    {
      schema: {
        description: 'Update tenant settings (admin only)',
        tags: ['Settings'],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            weekStartDay: { type: 'number', minimum: 0, maximum: 6 },
            defaultLocale: { type: 'string', enum: ['en-US', 'es-ES'] },
            defaultTimezone: { type: 'string' },
            defaultCurrency: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              weekStartDay: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { tenantId: string }; Body: TenantSettingsBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;
        const { weekStartDay } = request.body;
        const userId = request.headers['x-user-id'] as string;

        if (!userId) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        // Get auth context for RBAC
        const authContext = getAuthContext(request);

        // Verify user is admin of this tenant
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            tenantId: tenantId,
          },
        });

        if (!user) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        // Require admin role for tenant settings
        if (!hasRole(authContext, 'Admin') && !hasRole(authContext, 'TenantAdmin')) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Admin role required to update tenant settings',
          });
        }

        const updated = await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            ...(typeof weekStartDay === 'number' && { weekStartDay }),
          },
          select: {
            weekStartDay: true,
          },
        });

        return reply.send({
          weekStartDay: updated.weekStartDay || 0,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }
  );
}
