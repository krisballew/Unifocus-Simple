import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { getAuthContext } from '../auth/rbac';

const prisma = new PrismaClient();

export async function userRoutes(server: FastifyInstance) {
  // GET /api/me - Get current user info
  server.get(
    '/me',
    {
      schema: {
        description: 'Get current authenticated user',
        tags: ['Users'],
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              email: { type: 'string' },
              username: { type: 'string' },
              tenantId: { type: 'string', nullable: true },
              roles: { type: 'array', items: { type: 'string' } },
              scopes: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authCtx = getAuthContext(request);

      if (!authCtx.userId) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
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
  );

  // GET /api/me/tenants - List user's tenants
  server.get(
    '/me/tenants',
    {
      schema: {
        description: 'List all tenants the user belongs to',
        tags: ['Users'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );
}
