import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth';
import { healthRoutes } from './health';
import { settingsRoutes } from './settings';
import { taRoutes } from './ta';
import { tenantRoutes } from './tenants';
import { userRoutes } from './users';

export async function registerRoutes(server: FastifyInstance) {
  // Register health routes (no prefix)
  await server.register(healthRoutes);

  // Register API routes
  await server.register(authRoutes);
  await server.register(userRoutes, { prefix: '/api' });
  await server.register(settingsRoutes, { prefix: '/api' });
  await server.register(tenantRoutes);
  await server.register(taRoutes);

  // TODO: Add more route modules as needed:
  // - employees
  // - housekeeping
}
