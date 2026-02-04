import { test } from 'tap';

import { buildServer } from '../src/server.js';

test('Health Routes', async (t) => {
  const baseConfig = {
    port: 3001,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: 'postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev',
    redisUrl: 'redis://localhost:6379',
    jwtSecret: 'test-secret-key-123456',
    logLevel: 'silent',
    cognito: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_test123',
      clientId: 'test-client-id',
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
      jwksUri:
        'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123/.well-known/jwks.json',
    },
    authSkipVerification: false,
  };

  await t.test('Liveness Probe: GET /health', async (t) => {
    const server = await buildServer(baseConfig);
    t.teardown(async () => {
      await server.close();
    });

    await t.test('returns 200 immediately without checking dependencies', async (t) => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      t.equal(response.statusCode, 200, 'Status code is 200');
      const body = JSON.parse(response.body);
      t.equal(body.status, 'ok', 'Status is ok');
      t.ok(body.timestamp, 'Timestamp exists');
      t.ok(typeof body.uptime === 'number', 'Uptime is a number');
      t.ok(body.uptime > 0, 'Uptime is positive');
    });
  });

  await t.test('Readiness Probe: GET /ready', async (t) => {
    await t.test('returns 200 when all checks pass', async (t) => {
      const server = await buildServer(baseConfig);
      t.teardown(async () => {
        await server.close();
      });

      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      // Note: Will be 503 if DB is not available, so we check the response
      const body = JSON.parse(response.body);

      t.ok(
        response.statusCode === 200 || response.statusCode === 503,
        `Status code is 200 or 503 (depends on DB availability): ${response.statusCode}`
      );

      if (response.statusCode === 200) {
        t.equal(body.status, 'ready', 'Status is ready');
        t.equal(body.checks.database_connection, 'ok', 'Database connection check is ok');
        t.equal(body.checks.database_migrations, 'ok', 'Database migrations check is ok');
        t.equal(body.checks.required_env_vars, 'ok', 'Environment variables check is ok');
      }

      t.ok(body.timestamp, 'Timestamp exists');
      t.ok(body.checks, 'Checks object exists');
      t.ok('database_connection' in body.checks, 'Has database_connection check');
      t.ok('database_migrations' in body.checks, 'Has database_migrations check');
      t.ok('required_env_vars' in body.checks, 'Has required_env_vars check');
      t.ok('redis' in body.checks, 'Has redis check');
    });

    await t.test('returns 503 when database is not configured', async (t) => {
      const server = await buildServer({
        ...baseConfig,
        databaseUrl: '',
      });
      t.teardown(async () => {
        await server.close();
      });

      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      t.equal(response.statusCode, 503, 'Status code is 503');
      const body = JSON.parse(response.body);
      t.equal(body.status, 'not_ready', 'Status is not_ready');
      t.equal(body.checks.database_connection, 'error', 'Database connection check is error');
    });

    await t.test('returns 503 when database connection fails', async (t) => {
      // Use an invalid database URL that will cause connection to fail
      const server = await buildServer({
        ...baseConfig,
        databaseUrl: 'postgresql://invalid:invalid@localhost:9999/nonexistent',
      });
      t.teardown(async () => {
        await server.close();
      });

      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      t.equal(response.statusCode, 503, 'Status code is 503');
      const body = JSON.parse(response.body);
      t.equal(body.status, 'not_ready', 'Status is not_ready');
      t.equal(body.checks.database_connection, 'error', 'Database connection check is error');
    });

    await t.test(
      'returns 503 when required environment variables are missing in production',
      async (t) => {
        const server = await buildServer({
          ...baseConfig,
          nodeEnv: 'production',
          jwtSecret: '', // Empty JWT_SECRET
          cognito: {
            ...baseConfig.cognito,
            userPoolId: '', // Empty COGNITO_USER_POOL_ID
          },
        });
        t.teardown(async () => {
          await server.close();
        });

        const response = await server.inject({
          method: 'GET',
          url: '/ready',
        });

        t.equal(response.statusCode, 503, 'Status code is 503');
        const body = JSON.parse(response.body);
        t.equal(body.status, 'not_ready', 'Status is not_ready');
        t.equal(body.checks.required_env_vars, 'error', 'Environment variables check is error');

        if (body.details && body.details.missing_env_vars) {
          t.ok(
            body.details.missing_env_vars.length > 0,
            'Details include missing environment variables'
          );
        }
      }
    );

    await t.test('marks Redis as optional when not configured', async (t) => {
      const server = await buildServer({
        ...baseConfig,
        redisUrl: '',
      });
      t.teardown(async () => {
        await server.close();
      });

      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      const body = JSON.parse(response.body);
      t.equal(body.checks.redis, 'optional', 'Redis is marked as optional');
    });

    await t.test('includes check results in response', async (t) => {
      const server = await buildServer(baseConfig);
      t.teardown(async () => {
        await server.close();
      });

      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      const body = JSON.parse(response.body);

      // Verify all checks are present in response
      t.ok('database_connection' in body.checks, 'Response includes database_connection check');
      t.ok('database_migrations' in body.checks, 'Response includes database_migrations check');
      t.ok('required_env_vars' in body.checks, 'Response includes required_env_vars check');
      t.ok('redis' in body.checks, 'Response includes redis check');

      // Verify check values are valid
      const validValues = ['ok', 'error'];
      const validRedisValues = ['ok', 'error', 'optional'];

      t.ok(
        validValues.includes(body.checks.database_connection),
        `database_connection has valid value: ${body.checks.database_connection}`
      );
      t.ok(
        validValues.includes(body.checks.database_migrations),
        `database_migrations has valid value: ${body.checks.database_migrations}`
      );
      t.ok(
        validValues.includes(body.checks.required_env_vars),
        `required_env_vars has valid value: ${body.checks.required_env_vars}`
      );
      t.ok(
        validRedisValues.includes(body.checks.redis),
        `redis has valid value: ${body.checks.redis}`
      );
    });
  });
});
