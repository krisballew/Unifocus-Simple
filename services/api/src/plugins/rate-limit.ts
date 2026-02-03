// eslint-disable-next-line import/no-named-as-default
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Rate limiting plugin with sensible defaults
 * Prevents abuse and DDoS attacks
 *
 * Default: 100 requests per 15 minutes per IP
 * Can be customized via environment variables
 */
async function rateLimitPlugin(server: FastifyInstance) {
  const max = parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10);
  const timeWindow = process.env['RATE_LIMIT_WINDOW'] ?? '15 minutes';

  await server.register(fastifyRateLimit, {
    max,
    timeWindow,
    cache: 10000, // Number of records to store
    allowList: ['127.0.0.1'], // Localhost always allowed
  });

  // Skip rate limiting for health checks using a hook
  server.addHook('preHandler', async (request) => {
    if (request.url === '/health' || request.url === '/ready') {
      // Mark request as not subject to rate limiting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).rateLimitBypass = true;
    }
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
});
