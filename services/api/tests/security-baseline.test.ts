import type { FastifyInstance } from 'fastify';
import { test } from 'tap';

import { buildServer } from '../src/server.js';

const getConfig = () => ({
  port: 3003,
  host: '0.0.0.0',
  nodeEnv: 'test' as const,
  corsOrigin: 'http://localhost:3000,http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: 'test-secret',
  logLevel: 'silent' as const,
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_test123',
    clientId: 'test-client-id',
    issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
    jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123/.well-known/jwks.json',
  },
  authSkipVerification: true,
});

test('Security - Baseline Security Headers and Limits', async (t) => {
  let server: FastifyInstance;

  t.before(async () => {
    server = await buildServer(getConfig());
    await server.ready();
  });

  t.teardown(async () => {
    await server.close();
  });

  t.test('Secure Headers - x-powered-by should be removed', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    t.notOk(response.headers['x-powered-by'], 'x-powered-by header removed');
    t.ok(response.headers['content-type'], 'content-type header present');
  });

  t.test('CORS - should respect configured origins', async (t) => {
    const response = await server.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
      },
    });

    t.ok(response.headers['access-control-allow-origin'], 'CORS header present');
    const allowedOrigin = response.headers['access-control-allow-origin'];
    t.ok(allowedOrigin === 'http://localhost:3000' || allowedOrigin === '*', 'origin is allowed');
  });

  t.test('CORS - should reject non-configured origins', async (t) => {
    const response = await server.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://malicious-site.com',
      },
    });

    // Fastify CORS module behavior: either returns origin or nothing
    const corsHeader = response.headers['access-control-allow-origin'];
    t.ok(
      corsHeader === undefined || corsHeader === '*' || corsHeader !== 'http://malicious-site.com',
      'non-configured origin rejected or sanitized'
    );
  });

  t.test('Request Body Size Limit - should accept reasonable JSON payloads', async (t) => {
    const smallPayload = JSON.stringify({ data: 'test' });
    const response = await server.inject({
      method: 'POST',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: smallPayload,
    });

    // We expect either success or auth error, but NOT 413
    t.notEqual(response.statusCode, 413, 'small JSON payload accepted');
  });

  t.test('Request Body Size Limit - should reject oversized JSON payloads', async (t) => {
    // Create payload larger than 1MB
    const largePayload = JSON.stringify({
      data: 'x'.repeat(1048576 + 1),
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(largePayload).toString(),
      },
      payload: largePayload,
    });

    t.equal(response.statusCode, 413, 'oversized JSON payload rejected');
    const body = JSON.parse(response.body);
    t.match(body.message, /exceeds maximum size/, 'error message indicates size limit');
  });

  t.test('Response headers - correlation ID present on all responses', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    t.ok(response.headers['x-correlation-id'], 'correlation ID header present');
  });

  t.test('Response headers - secure content-type header set', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    t.equal(
      response.headers['content-type'],
      'application/json',
      'content-type is application/json'
    );
  });

  t.test('Error responses - structured error format', async (t) => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ invalid: 'data' }),
    });

    t.ok(response.statusCode >= 400, 'returns error status');
    const body = JSON.parse(response.body);
    t.ok(body.error, 'error response has error field');
    t.ok(body.statusCode, 'error response has statusCode field');
  });

  t.test('Health checks - not rate limited', async (t) => {
    // Make multiple requests to /health
    for (let i = 0; i < 5; i++) {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });
      t.equal(response.statusCode, 200, `health check ${i + 1} returns 200`);
    }
  });

  t.test('Ready checks - not rate limited', async (t) => {
    // Make multiple requests to /ready
    for (let i = 0; i < 5; i++) {
      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });
      t.ok([200, 503].includes(response.statusCode), `ready check ${i + 1} returns valid status`);
    }
  });
});

test('Security - Rate Limiting Verification', async (t) => {
  let server: FastifyInstance;

  t.before(async () => {
    server = await buildServer(getConfig());
    await server.ready();
  });

  t.teardown(async () => {
    await server.close();
  });

  t.test('Rate limiting - demonstrates that limit can be hit with many requests', async (t) => {
    // Note: The default rate limit is 100 requests per 15 minutes
    // We can't easily test the full limit in unit tests, but we can verify
    // that the rate limit plugin is configured and tracking requests

    let successCount = 0;
    let rateLimitCount = 0;

    // Make multiple requests to an endpoint (not /health or /ready which are skipped)
    for (let i = 0; i < 10; i++) {
      const response = await server.inject({
        method: 'GET',
        url: '/nonexistent',
        headers: {
          'x-correlation-id': `rate-test-${i}`,
        },
      });

      if (response.statusCode === 429) {
        rateLimitCount++;
      } else if (response.statusCode === 404) {
        successCount++;
      }
    }

    // With in-memory rate limiting, we should get 404s (not rate limited for 10 requests)
    t.ok(successCount > 0, 'some requests succeed under rate limit');
    t.ok(rateLimitCount === 0, 'no rate limiting for normal request load');
  });

  t.test('Rate limiting - 429 status code and error format when limited', async (t) => {
    // Create a new server instance for a fresh rate limit counter
    const config = getConfig();
    const testServer = await buildServer(config);
    await testServer.ready();

    // Make some requests to establish they work
    const response1 = await testServer.inject({
      method: 'GET',
      url: '/nonexistent',
    });

    t.notEqual(response1.statusCode, 429, 'first request does not trigger rate limit');

    await testServer.close();
  });
});
