// eslint-disable-next-line import/no-named-as-default
import fastifyCors from '@fastify/cors';
// eslint-disable-next-line import/no-named-as-default
import fastifySwagger from '@fastify/swagger';
// eslint-disable-next-line import/no-named-as-default
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';

export async function registerCors(server: FastifyInstance, config: AppConfig) {
  // Parse configured origins
  const configuredOrigins = config.corsOrigin.split(',').map((o) => o.trim());

  // In development, also allow GitHub Codespaces URLs
  const isDevelopment = config.nodeEnv === 'development';
  const origins = isDevelopment
    ? [
        ...configuredOrigins,
        // Allow GitHub Codespaces domain patterns
        /^https:\/\/[a-z0-9-]+\.github\.dev$/i,
        // Allow localhost on any port
        /^https?:\/\/localhost(:\d+)?$/i,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
      ]
    : configuredOrigins;

  server.log.info({ corsOrigins: origins }, 'CORS configured with origins');
  await server.register(fastifyCors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

export async function registerSwagger(server: FastifyInstance) {
  await server.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Unifocus API',
        description: 'Unifocus workforce management API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'tenants', description: 'Tenant management' },
        { name: 'properties', description: 'Property management' },
        { name: 'employees', description: 'Employee management' },
        { name: 'scheduling', description: 'Shift scheduling' },
        { name: 'time', description: 'Time tracking and punches' },
      ],
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
}
