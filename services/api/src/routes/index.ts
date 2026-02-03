import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth';
import { healthRoutes } from './health';
import { tenantRoutes } from './tenants';

export async function registerRoutes(server: FastifyInstance) {
  // Register health routes (no prefix)
  await server.register(healthRoutes);

  // Register API routes
  await server.register(authRoutes);
  await server.register(tenantRoutes);

  // TODO: Add more route modules as needed:
  // - properties
  // - employees
  // - scheduling
  // - time tracking
  // - housekeeping
}
