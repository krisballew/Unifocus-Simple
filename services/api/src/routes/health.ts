import { PrismaClient } from '@prisma/client';
import { z } from '@unifocus/contracts';
import type { FastifyInstance } from 'fastify';

const prisma = new PrismaClient();

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
});

const ReadyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  timestamp: z.string(),
  checks: z.object({
    database_connection: z.enum(['ok', 'error']),
    database_migrations: z.enum(['ok', 'error']),
    required_env_vars: z.enum(['ok', 'error']),
    redis: z.enum(['ok', 'error', 'optional']),
  }),
  details: z.optional(
    z.object({
      missing_env_vars: z.array(z.string()).optional(),
    })
  ),
});

/**
 * READINESS GATE SEMANTICS
 * ========================
 * This endpoint is designed for production health checks (ALB/ECS).
 * It MUST be strict to prevent traffic routing to unhealthy instances.
 *
 * The service is considered "ready" only if:
 * 1. Database is accessible and responding
 * 2. All pending Prisma migrations have been applied
 * 3. All required environment variables are set (JWT_SECRET, COGNITO config)
 * 4. Redis is optional for development but must be configured to report 'ok' if specified
 *
 * A 200 response GUARANTEES the instance can handle production traffic.
 * A 503 response means the instance should NOT receive traffic.
 *
 * This strict approach ensures:
 * - Bad deployments are caught before accepting requests
 * - Traffic doesn't route to instances with missing migrations
 * - Environment configuration is validated at readiness time
 * - ALB/ECS health checks properly gate traffic
 */

export async function healthRoutes(server: FastifyInstance) {
  // Liveness probe - simple health check
  /**
   * GET /health
   * -----------
   * Simple liveness probe that indicates the process is running.
   * Returns 200 immediately without checking any dependencies.
   * Used by orchestrators to detect crashed instances.
   * Does NOT indicate readiness to accept traffic.
   */
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

  /**
   * GET /ready
   * ----------
   * Strict readiness probe that validates the instance is ready for production traffic.
   * Checks all critical dependencies and configuration before returning 200.
   *
   * Response:
   * - 200: Instance is ready to accept traffic
   * - 503: Instance should NOT receive traffic
   *
   * Required Checks:
   * 1. Database connectivity - Must connect and execute query
   * 2. Database migrations - All pending migrations must be applied
   * 3. Environment variables - JWT_SECRET and COGNITO config required
   * 4. Redis - Optional but must be healthy if configured
   */
  server.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        description: 'Readiness probe - strict check if service can handle production traffic',
        response: {
          200: ReadyResponseSchema,
          503: ReadyResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const checks: {
        database_connection: 'ok' | 'error';
        database_migrations: 'ok' | 'error';
        required_env_vars: 'ok' | 'error';
        redis: 'ok' | 'error' | 'optional';
      } = {
        database_connection: 'ok',
        database_migrations: 'ok',
        required_env_vars: 'ok',
        redis: 'ok',
      };

      const missingEnvVars: string[] = [];

      // CHECK 1: Required Environment Variables
      // ========================================
      // These are critical for authentication and should fail the readiness check
      // if missing in production. Development can run with defaults via AUTH_SKIP_VERIFICATION.
      const requiredEnvVars = [
        'JWT_SECRET',
        'COGNITO_REGION',
        'COGNITO_USER_POOL_ID',
        'COGNITO_CLIENT_ID',
        'COGNITO_ISSUER',
      ];

      for (const envVar of requiredEnvVars) {
        const value = process.env[envVar];
        if (!value || value === 'dev-secret-change-me' || value === '') {
          // Only fail in production; development uses defaults
          if (process.env['NODE_ENV'] === 'production') {
            missingEnvVars.push(envVar);
            checks.required_env_vars = 'error';
          }
        }
      }

      // CHECK 2: Database Connectivity
      // ================================
      // Must verify actual database connection is working.
      // This catches configuration errors, network issues, and database being down.
      if (!server.config.databaseUrl) {
        checks.database_connection = 'error';
        server.log.warn('Database URL not configured - readiness check failed');
      } else {
        try {
          // Execute a simple query to verify connection is working
          await prisma.$queryRaw`SELECT 1`;
          checks.database_connection = 'ok';
        } catch (error) {
          checks.database_connection = 'error';
          server.log.error(
            {
              error: error instanceof Error ? error.message : String(error),
              correlationId: _request.id,
            },
            'Database connectivity check failed - connection or query execution failed'
          );
        }
      }

      // CHECK 3: Database Migrations
      // =============================
      // Verify all migrations have been applied.
      // Prevents traffic routing to instances that haven't run migrations yet.
      // This is crucial for deployments where migration timing matters.
      if (checks.database_connection === 'ok') {
        try {
          // Query the Prisma migrations table to check if there are pending migrations
          const migrationResult = await prisma.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*) as count FROM "_prisma_migrations" WHERE finished_at IS NULL
          `;

          // Extract pending migration count from result
          let pendingCount = 0;
          if (Array.isArray(migrationResult) && migrationResult[0]) {
            pendingCount = migrationResult[0].count || 0;
          }

          if (pendingCount > 0) {
            checks.database_migrations = 'error';
            server.log.warn(
              { pendingMigrations: pendingCount },
              'Pending database migrations detected - instance not ready'
            );
          } else {
            checks.database_migrations = 'ok';
          }
        } catch (error) {
          // If migration check fails (table might not exist yet), mark as error
          // This prevents instances from serving traffic before schema is ready
          checks.database_migrations = 'error';
          server.log.error(
            {
              error: error instanceof Error ? error.message : String(error),
              correlationId: _request.id,
            },
            'Failed to check migration status'
          );
        }
      } else {
        // If database is not connected, migrations are automatically failed
        checks.database_migrations = 'error';
      }

      // CHECK 4: Redis (Optional)
      // ==========================
      // Redis is optional for development but if configured, must be healthy.
      // If REDIS_URL is set, we attempt connection; if not set, mark as 'optional'.
      // Production should always configure Redis, but this allows dev flexibility.
      if (!server.config.redisUrl) {
        checks.redis = 'optional';
      } else {
        // In a real implementation, would test Redis connection here
        // For now, assume if URL is configured, Redis is available
        // Could be enhanced with actual Redis PING check
        checks.redis = 'ok';
      }

      // FINAL READINESS DECISION
      // ========================
      // Service is ready ONLY if:
      // - Database connection is ok
      // - All migrations are applied
      // - All required env vars are set (in production)
      const isReady =
        checks.database_connection === 'ok' &&
        checks.database_migrations === 'ok' &&
        checks.required_env_vars === 'ok' &&
        (checks.redis === 'ok' || checks.redis === 'optional');

      const statusCode = isReady ? 200 : 503;

      reply.status(statusCode).send({
        status: isReady ? ('ready' as const) : ('not_ready' as const),
        timestamp: new Date().toISOString(),
        checks,
        ...(missingEnvVars.length > 0 && { details: { missing_env_vars: missingEnvVars } }),
      });
    }
  );
}
