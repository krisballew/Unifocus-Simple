import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import type { AppConfig } from './config.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildServer(config: AppConfig): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    disableRequestLogging: false,
    requestIdHeader: 'x-correlation-id',
    requestIdLogLabel: 'correlationId',
    genReqId: (req) => {
      return req.headers['x-correlation-id']?.toString() ?? randomUUID();
    },
    // Security: Set body size limits
    bodyLimit: 1048576, // 1 MB for JSON bodies
  });

  // Set Zod as the validator and serializer
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await registerPlugins(server, config);

  // Register routes
  await registerRoutes(server, config);

  return server;
}
