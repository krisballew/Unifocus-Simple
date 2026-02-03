import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config';

import { registerAuthPlugin } from './auth';
import errorHandler from './error-handler';
import { registerCors, registerSwagger } from './external';

export async function registerPlugins(server: FastifyInstance, config: AppConfig) {
  // Add config to server instance for access in error handler
  server.decorate('config', config);

  // Register error handling first
  await server.register(errorHandler);

  // Register CORS
  await registerCors(server, config);

  // Register Auth/JWT validation
  await registerAuthPlugin(server, config);

  // Register Swagger
  await registerSwagger(server);
}
