import { CreateTenantSchema, TenantSchema } from '@unifocus/contracts';
import type { Tenant } from '@unifocus/contracts';
import type { FastifyInstance } from 'fastify';

// Mock data store (replace with real DB later)
const tenantsStore: Tenant[] = [
  {
    id: '1',
    name: 'Demo Hotel Group',
    slug: 'demo-hotel',
    status: 'active',
    settings: {
      timezone: 'America/New_York',
      locale: 'en-US',
      currency: 'USD',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function tenantRoutes(server: FastifyInstance) {
  // List all tenants
  server.get(
    '/api/tenants',
    {
      schema: {
        tags: ['tenants'],
        description: 'List all tenants',
        response: {
          200: {
            type: 'array',
            items: TenantSchema,
          },
        },
      },
    },
    async () => {
      return tenantsStore;
    }
  );

  // Get a tenant by ID
  server.get(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['tenants'],
        description: 'Get a tenant by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: TenantSchema,
          404: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenant = tenantsStore.find((t) => t.id === id);

      if (!tenant) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Tenant with id ${id} not found`,
        });
      }

      return tenant;
    }
  );

  // Create a new tenant
  server.post(
    '/api/tenants',
    {
      schema: {
        tags: ['tenants'],
        description: 'Create a new tenant',
        body: CreateTenantSchema,
        response: {
          201: TenantSchema,
        },
      },
    },
    async (request, reply) => {
      const data = request.body as {
        name: string;
        slug: string;
        settings?: { timezone: string; locale: string; currency: string };
      };

      const newTenant: Tenant = {
        id: String(tenantsStore.length + 1),
        name: data.name,
        slug: data.slug,
        status: 'active',
        settings: data.settings ?? {
          timezone: 'America/New_York',
          locale: 'en-US',
          currency: 'USD',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      tenantsStore.push(newTenant);

      return reply.status(201).send(newTenant);
    }
  );

  // Update a tenant
  server.put(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['tenants'],
        description: 'Update a tenant',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: CreateTenantSchema,
        response: {
          200: TenantSchema,
          404: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as {
        name: string;
        slug: string;
        settings?: { timezone: string; locale: string; currency: string };
      };

      const index = tenantsStore.findIndex((t) => t.id === id);

      if (index === -1) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Tenant with id ${id} not found`,
        });
      }

      const current = tenantsStore[index]!;
      const updated: Tenant = {
        id: current.id,
        name: data.name,
        slug: data.slug,
        status: current.status,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        settings: data.settings ?? current.settings,
        domain: current.domain,
      };

      tenantsStore[index] = updated;

      return updated;
    }
  );

  // Delete a tenant
  server.delete(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['tenants'],
        description: 'Delete a tenant',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Tenant deleted successfully',
          },
          404: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const index = tenantsStore.findIndex((t) => t.id === id);

      if (index === -1) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Tenant with id ${id} not found`,
        });
      }

      tenantsStore.splice(index, 1);
      return reply.status(204).send();
    }
  );
}
