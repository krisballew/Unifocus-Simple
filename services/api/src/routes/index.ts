import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth';
import { healthRoutes } from './health';
import { tenantRoutes } from './tenants';
import { userRoutes } from './users';

export async function registerRoutes(server: FastifyInstance) {
  // Register health routes (no prefix)
  await server.register(healthRoutes);

  // Register API routes
  await server.register(authRoutes);
  await server.register(userRoutes, { prefix: '/api' });
  await server.register(tenantRoutes);

  // TODO: Add more route modules as needed:
  // - employees
  // - scheduling
  // - time tracking
  // - housekeeping
}
