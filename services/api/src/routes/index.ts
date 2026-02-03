import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';
import { settingsRoutes } from './settings.js';
import { taRoutes } from './ta.js';
import { tenantRoutes } from './tenants.js';
import { userRoutes } from './users.js';

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
