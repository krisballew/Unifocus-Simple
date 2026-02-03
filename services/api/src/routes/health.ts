import { z } from '@unifocus/contracts';
import type { FastifyInstance } from 'fastify';

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
});

const ReadyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  timestamp: z.string(),
  checks: z.object({
    database: z.enum(['ok', 'error']),
    redis: z.enum(['ok', 'error']),
  }),
});

export async function healthRoutes(server: FastifyInstance) {
  // Liveness probe - simple health check
  server.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        description: 'Liveness probe - checks if the service is running',
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => {
      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  );

  // Readiness probe - checks if service is ready to accept traffic
  server.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        description: 'Readiness probe - checks if the service can handle requests',
        response: {
          200: ReadyResponseSchema,
          503: ReadyResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const checks: {
        database: 'ok' | 'error';
        redis: 'ok' | 'error';
      } = {
        database: 'ok',
        redis: 'ok',
      };

      // TODO: Add actual database check when DB client is integrated
      // For now, just check if DATABASE_URL is configured
      if (!server.config.databaseUrl) {
        checks.database = 'error';
      }

      // TODO: Add actual Redis check when Redis client is integrated
      // For now, just check if REDIS_URL is configured
      if (!server.config.redisUrl) {
        checks.redis = 'error';
      }

      const isReady = checks.database === 'ok' && checks.redis === 'ok';
      const statusCode = isReady ? 200 : 503;

      reply.status(statusCode).send({
        status: isReady ? ('ready' as const) : ('not_ready' as const),
        timestamp: new Date().toISOString(),
        checks,
      });
    }
  );
}
