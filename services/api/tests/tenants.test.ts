import { test } from 'tap';

import { buildServer } from '../src/server.js';

test('Tenant Routes', async (t) => {
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

  await t.test('GET /api/tenants returns list of tenants', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tenants',
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.ok(Array.isArray(body), 'Response is an array');
    t.ok(body.length > 0, 'Array has items');
    t.ok(body[0].id, 'First tenant has id');
    t.ok(body[0].name, 'First tenant has name');
  });

  await t.test('GET /api/tenants/:id returns a single tenant', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tenants/1',
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.equal(body.id, '1', 'Tenant id is 1');
    t.ok(body.name, 'Tenant has name');
    t.ok(body.slug, 'Tenant has slug');
  });

  await t.test('GET /api/tenants/:id returns 404 for non-existent tenant', async (t) => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tenants/999',
    });

    t.equal(response.statusCode, 404, 'Status code is 404');
    const body = JSON.parse(response.body);
    t.equal(body.statusCode, 404, 'Error statusCode is 404');
    t.ok(body.message, 'Error has message');
  });

  await t.test('POST /api/tenants creates a new tenant', async (t) => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/tenants',
      payload: {
        name: 'Test Tenant',
        slug: 'test-tenant',
        settings: {
          timezone: 'America/New_York',
          locale: 'en-US',
          currency: 'USD',
        },
      },
    });

    t.equal(response.statusCode, 201, 'Status code is 201');
    const body = JSON.parse(response.body);
    t.ok(body.id, 'New tenant has id');
    t.equal(body.name, 'Test Tenant', 'Name matches');
    t.equal(body.slug, 'test-tenant', 'Slug matches');
  });

  await t.test('POST /api/tenants validates request body', async (t) => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/tenants',
      payload: {
        // Missing required fields
        name: 'Test',
      },
    });

    t.equal(response.statusCode, 400, 'Status code is 400 for invalid payload');
  });
});
