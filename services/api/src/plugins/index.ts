import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';

import { registerAuthPlugin } from './auth.js';
import errorHandler from './error-handler.js';
import { registerCors, registerSwagger } from './external.js';
import rateLimit from './rate-limit.js';
import requestSizeLimits from './request-limits.js';
import security from './security.js';

export async function registerPlugins(server: FastifyInstance, config: AppConfig) {
  // Add config to server instance for access in error handler
  server.decorate('config', config);

  // Register security plugins FIRST
  // These should be registered before other plugins to ensure headers are properly set
  await server.register(security);
  await server.register(requestSizeLimits);
  // Register rate limit plugin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await server.register(rateLimit as any);

  // Register error handling early
  await server.register(errorHandler);

  // Register CORS
  await registerCors(server, config);

  // Register Auth/JWT validation
  await registerAuthPlugin(server, config);

  // Register Swagger
  await registerSwagger(server);
}
