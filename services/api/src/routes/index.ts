import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { schedulingRoutes } from '../scheduling/routes.js';

import { authRoutes } from './auth.js';
import { complianceRoutes } from './compliance.js';
import { employeeRoutes } from './employees.js';
import { geocodingRoutes } from './geocoding.js';
import { healthRoutes } from './health.js';
import { settingsRoutes } from './settings.js';
import { taRoutes } from './ta.js';
import { tenantRoutes } from './tenants.js';
import { userAdminRoutes } from './user-admin.js';
import { userRoutes } from './users.js';

export async function registerRoutes(server: FastifyInstance, config: AppConfig) {
  // Register health routes (no prefix)
  await server.register(healthRoutes);

  // Register API routes
  await server.register(authRoutes);
  await server.register(geocodingRoutes, { prefix: '/api' });
  await server.register(async (srv) => userRoutes(srv, config), { prefix: '/api' });
  await server.register(settingsRoutes, { prefix: '/api' });
  await server.register(userAdminRoutes, { prefix: '/api' });
  await server.register(employeeRoutes, { prefix: '/api' });
  await server.register(complianceRoutes, { prefix: '/api/compliance' });
  await server.register(schedulingRoutes, { prefix: '/api/scheduling' });
  await server.register(async (srv) => tenantRoutes(srv, config));
  await server.register(taRoutes);

  // TODO: Add more route modules as needed:
  // - housekeeping
}
