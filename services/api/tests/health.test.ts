import { test } from 'tap';

import { buildServer } from '../src/server.js';

test('Health Routes', async (t) => {
  const config = {
    port: 3001,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: 'postgresql://localhost:5432/test',
    redisUrl: 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
  };

  const server = await buildServer(config);

  t.teardown(async () => {
    await server.close();
  });

  await t.test('GET /health returns 200', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.equal(body.status, 'ok', 'Status is ok');
    t.ok(body.timestamp, 'Timestamp exists');
    t.ok(typeof body.uptime === 'number', 'Uptime is a number');
  });

  await t.test('GET /ready returns 200 when configured', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/ready',
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.equal(body.status, 'ready', 'Status is ready');
    t.equal(body.checks.database, 'ok', 'Database check is ok');
    t.equal(body.checks.redis, 'ok', 'Redis check is ok');
  });

  await t.test('GET /ready returns 503 when not configured', async (t) => {
    const unconfiguredServer = await buildServer({
      ...config,
      databaseUrl: '',
      redisUrl: '',
    });

    t.teardown(async () => {
      await unconfiguredServer.close();
    });

    const response = await unconfiguredServer.inject({
      method: 'GET',
      url: '/ready',
    });

    t.equal(response.statusCode, 503, 'Status code is 503');
    const body = JSON.parse(response.body);
    t.equal(body.status, 'not_ready', 'Status is not_ready');
    t.equal(body.checks.database, 'error', 'Database check is error');
    t.equal(body.checks.redis, 'error', 'Redis check is error');
  });
});
