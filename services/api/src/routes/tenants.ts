import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { getAuthContext } from '../auth/rbac';

const prisma = new PrismaClient();

export async function tenantRoutes(server: FastifyInstance) {
  // GET /api/tenants/:id - Get tenant details with tenant scoping
  server.get<{ Params: { id: string } }>(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['tenants'],
        description: 'Get a tenant by ID (must be member of tenant)',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authCtx = getAuthContext(request);
      const tenantId = request.params.id;

      if (!authCtx.userId) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Check if user has access to this tenant
      const userInTenant = await prisma.user.findFirst({
        where: {
          id: authCtx.userId,
          tenantId: tenantId,
        },
      });

      if (!userInTenant) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied to this tenant',
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!tenant) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      return reply.send(tenant);
    }
  );

  // GET /api/tenants/:id/properties - List properties in tenant
  server.get<{ Params: { id: string } }>(
    '/api/tenants/:id/properties',
    {
      schema: {
        tags: ['properties'],
        description: 'List all properties in a tenant',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                address: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                state: { type: 'string', nullable: true },
                zipCode: { type: 'string', nullable: true },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authCtx = getAuthContext(request);
      const tenantId = request.params.id;

      if (!authCtx.userId) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Verify user belongs to tenant
      const userInTenant = await prisma.user.findFirst({
        where: {
          id: authCtx.userId,
          tenantId: tenantId,
        },
      });

      if (!userInTenant) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const properties = await prisma.property.findMany({
        where: { tenantId: tenantId },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
        },
      });

      return reply.send(properties);
    }
  );

  // GET /api/properties - List user's properties (auto-scoped to their tenant)
  server.get(
    '/api/properties',
    {
      schema: {
        tags: ['properties'],
        description: 'List all properties accessible to user',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                tenantId: { type: 'string' },
                address: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authCtx = getAuthContext(request);

      if (!authCtx.userId || !authCtx.tenantId) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication and tenant scope required',
        });
      }

      const properties = await prisma.property.findMany({
        where: { tenantId: authCtx.tenantId },
        select: {
          id: true,
          name: true,
          tenantId: true,
          address: true,
          city: true,
        },
      });

      return reply.send(properties);
    }
  );

  // GET /api/properties/:id - Get property details
  server.get<{ Params: { id: string } }>(
    '/api/properties/:id',
    {
      schema: {
        tags: ['properties'],
        description: "Get a property by ID (must belong to user's tenant)",
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              tenantId: { type: 'string' },
              address: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              zipCode: { type: 'string', nullable: true },
            },
          },
          401: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authCtx = getAuthContext(request);
      const propertyId = request.params.id;

      if (!authCtx.userId || !authCtx.tenantId) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          tenantId: authCtx.tenantId,
        },
        select: {
          id: true,
          name: true,
          tenantId: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
        },
      });

      if (!property) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Property not found',
        });
      }

      return reply.send(property);
    }
  );

  // Note: Tenant settings routes moved to settings.ts to avoid duplication
}
