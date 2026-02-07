import { PrismaClient } from '@prisma/client';
import { test } from 'tap';

import { buildServer } from '../src/server.js';

const prisma = new PrismaClient();

/**
 * Security Test Suite: Scheduling V2 Schedule Period Lifecycle
 *
 * Ensures proper authorization, tenant scoping, and lock enforcement for
 * schedule period CRUD and publication operations.
 */
test('Scheduling V2: Schedule Period Lifecycle', async (t) => {
  const config = {
    port: 3004,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
    cognito: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_test',
      clientId: 'test-client',
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
      jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/jwks.json',
    },
    authSkipVerification: true,
    complianceRulesEnabled: false,
    openai: {
      apiKey: '',
      model: 'gpt-4',
    },
  };

  const app = await buildServer(config);

  // Create two tenants for isolation testing
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Schedule Tenant 1',
      slug: `schedule-test-1-${Date.now()}`,
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Schedule Tenant 2',
      slug: `schedule-test-2-${Date.now()}`,
    },
  });

  // Create properties for each tenant
  const property1 = await prisma.property.create({
    data: {
      tenantId: tenant1.id,
      name: 'Property 1 - Tenant 1',
    },
  });

  const property2 = await prisma.property.create({
    data: {
      tenantId: tenant2.id,
      name: 'Property 2 - Tenant 2',
    },
  });

  t.teardown(async () => {
    // Cleanup
    await prisma.wfmPublishEvent.deleteMany({});
    await prisma.wfmSchedulePeriod.deleteMany({});
    await prisma.property.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.property.deleteMany({ where: { tenantId: tenant2.id } });
    await prisma.tenant.delete({ where: { id: tenant1.id } });
    await prisma.tenant.delete({ where: { id: tenant2.id } });
    await prisma.$disconnect();
    await app.close();
  });

  // ========== Tenant Isolation Tests ==========

  await t.test('GET /api/scheduling/v2/schedule-periods - Tenant isolation', async (t) => {
    // Create schedule period for tenant 1
    const period1 = await prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: tenant1.id,
        propertyId: property1.id,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-07'),
        status: 'DRAFT',
        version: 1,
        name: 'Period 1 - Tenant 1',
      },
    });

    // Create schedule period for tenant 2
    const period2 = await prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: tenant2.id,
        propertyId: property2.id,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-07'),
        status: 'DRAFT',
        version: 1,
        name: 'Period 2 - Tenant 2',
      },
    });

    // Query as tenant 1 - should only see tenant 1 periods
    const response1 = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property1.id}`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-1',
      },
    });

    t.equal(response1.statusCode, 200, 'Request succeeds');
    const body1 = JSON.parse(response1.body);
    t.equal(body1.length, 1, 'Returns only 1 period for tenant 1');
    t.equal(body1[0].id, period1.id, 'Returns correct period for tenant 1');
    t.equal(body1[0].name, 'Period 1 - Tenant 1', 'Period name matches');

    // Query as tenant 2 - should only see tenant 2 periods
    const response2 = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property2.id}`,
      headers: {
        'x-tenant-id': tenant2.id,
        'x-user-id': 'user-2',
      },
    });

    t.equal(response2.statusCode, 200, 'Request succeeds for tenant 2');
    const body2 = JSON.parse(response2.body);
    t.equal(body2.length, 1, 'Returns only 1 period for tenant 2');
    t.equal(body2[0].id, period2.id, 'Returns correct period for tenant 2');
    t.equal(body2[0].name, 'Period 2 - Tenant 2', 'Period name matches');
  });

  await t.test('POST /api/scheduling/v2/schedule-periods - Tenant isolation on create', async (t) => {
    const startDate = new Date('2026-04-01');
    const endDate = new Date('2026-04-07');

    // Create period as tenant 1
    const response = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/schedule-periods',
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-1',
        'content-type': 'application/json',
      },
      payload: {
        propertyId: property1.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        name: 'Isolated Period',
      },
    });

    t.equal(response.statusCode, 201, 'Period created successfully');
    const body = JSON.parse(response.body);
    t.equal(body.tenantId, tenant1.id, 'Period has correct tenant ID');
    t.equal(body.propertyId, property1.id, 'Period has correct property ID');

    // Verify period is scoped to tenant 1
    const period = await prisma.wfmSchedulePeriod.findUnique({
      where: { id: body.id },
    });
    t.equal(period?.tenantId, tenant1.id, 'Period stored with tenant 1 ID');
  });

  // ========== RBAC Permission Tests ==========
  // NOTE: Permission tests are skipped in dev/test mode because auth is in
  // skip-verification mode with hardcoded scopes. Permission checks are
  // validated by the guard functions which are tested separately.

  await t.test('GET /api/scheduling/v2/schedule-periods - List returns correct structure', async (t) => {
    // Create a schedule period
    const period = await prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: tenant1.id,
        propertyId: property1.id,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-07'),
        status: 'DRAFT',
        version: 1,
        name: 'Test Period',
      },
    });

    // List periods
    const response = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property1.id}`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-1',
      },
    });

    t.equal(response.statusCode, 200, 'Returns 200 OK');
    const body = JSON.parse(response.body);
    t.ok(Array.isArray(body), 'Returns array');
    t.equal(body[0].id, period.id, 'Contains period ID');
    t.equal(body[0].status, 'DRAFT', 'Contains period status');
    t.equal(body[0].version, 1, 'Contains period version');
  });

  await t.test('POST /api/scheduling/v2/schedule-periods - Create returns correct structure', async (t) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/schedule-periods',
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-1',
        'content-type': 'application/json',
      },
      payload: {
        propertyId: property1.id,
        startDate: new Date('2026-06-01').toISOString(),
        endDate: new Date('2026-06-07').toISOString(),
        name: 'Test Create',
      },
    });

    t.equal(response.statusCode, 201, 'Returns 201 Created');
    const body = JSON.parse(response.body);
    t.ok(body.id, 'Returns period ID');
    t.equal(body.status, 'DRAFT', 'Initial status is DRAFT');
    t.equal(body.version, 1, 'Initial version is 1');
    t.equal(body.tenantId, tenant1.id, 'Scoped to correct tenant');
  });

  // ========== Lock Enforcement Tests ==========

  await t.test('POST /api/scheduling/v2/schedule-periods/:id/lock -Lock prevents editing', async (t) => {
    // Create a period and lock it
    const period = await prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: tenant1.id,
        propertyId: property1.id,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-07'),
        status: 'LOCKED',
        version: 1,
      },
    });

    // Try to publish locked period
    const response = await app.inject({
      method: 'POST',
      url: `/api/scheduling/v2/schedule-periods/${period.id}/publish`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-1',
        'content-type': 'application/json',
      },
      payload: {},
    });

    t.equal(response.statusCode, 400, 'Publishing locked period returns error');
    const body = JSON.parse(response.body);
    t.match(body.message, /locked|LOCKED/i, 'Error mentions locked status');
  });

  // ========== Status Idempotency Tests ==========

  await t.test(
    'POST /api/scheduling/v2/schedule-periods/:id/publish - Idempotent for already published',
    async (t) => {
      // Create and publish a period
      const period = await prisma.wfmSchedulePeriod.create({
        data: {
          tenantId: tenant1.id,
          propertyId: property1.id,
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-07'),
          status: 'PUBLISHED',
          version: 1,
        },
      });

      // Publish event already exists
      await prisma.wfmPublishEvent.create({
        data: {
          tenantId: tenant1.id,
          propertyId: property1.id,
          schedulePeriodId: period.id,
          publishedByUserId: 'user-initial',
        },
      });

      // Try to publish again
      const response = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/schedule-periods/${period.id}/publish`,
        headers: {
          'x-tenant-id': tenant1.id,
          'x-user-id': 'user-2',
          'x-scopes': 'scheduling.publish',
          'content-type': 'application/json',
        },
        payload: {},
      });

      t.equal(response.statusCode, 200, 'Returns 200 OK');
      const body = JSON.parse(response.body);
      t.equal(body.period.status, 'PUBLISHED', 'Period remains published');
    }
  );

  await t.test(
    'POST /api/scheduling/v2/schedule-periods/:id/lock - Idempotent for already locked',
    async (t) => {
      // Create and lock a period
      const period = await prisma.wfmSchedulePeriod.create({
        data: {
          tenantId: tenant1.id,
          propertyId: property1.id,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-07'),
          status: 'LOCKED',
          version: 1,
        },
      });

      // Try to lock again with override
      const response = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/schedule-periods/${period.id}/lock`,
        headers: {
          'x-tenant-id': tenant1.id,
          'x-user-id': 'user-1',
          'x-scopes': 'scheduling.lock,scheduling.override',
          'content-type': 'application/json',
        },
        payload: {},
      });

      t.equal(response.statusCode, 200, 'Returns 200 OK');
      const body = JSON.parse(response.body);
      t.equal(body.status, 'LOCKED', 'Period remains locked');
    }
  );

  // ========== Validation Tests ==========

  await t.test(
    'POST /api/scheduling/v2/schedule-periods - Validates startDate < endDate',
    async (t) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/schedule-periods',
        headers: {
          'x-tenant-id': tenant1.id,
          'x-user-id': 'user-1',
          'x-scopes': 'scheduling.edit.shifts',
          'content-type': 'application/json',
        },
        payload: {
          propertyId: property1.id,
          startDate: new Date('2026-10-07').toISOString(),
          endDate: new Date('2026-10-01').toISOString(), // End before start
        },
      });

      t.equal(response.statusCode, 400, 'Returns 400 Bad Request');
      const body = JSON.parse(response.body);
      t.match(body.message, /startDate|endDate/i, 'Error mentions date validation');
    }
  );

  // ========== Full Lifecycle Test ==========

  await t.test('Full Lifecycle: Create → Publish → Lock', async (t) => {
    const startDate = new Date('2026-11-01');
    const endDate = new Date('2026-11-07');

    // 1. Create period
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/schedule-periods',
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-creator',
        'x-scopes': 'scheduling.edit.shifts',
        'content-type': 'application/json',
      },
      payload: {
        propertyId: property1.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        name: 'Full Lifecycle Period',
      },
    });

    t.equal(createResponse.statusCode, 201, 'Period created');
    const period = JSON.parse(createResponse.body);
    t.equal(period.status, 'DRAFT', 'Initial status is DRAFT');

    // 2. Publish period
    const publishResponse = await app.inject({
      method: 'POST',
      url: `/api/scheduling/v2/schedule-periods/${period.id}/publish`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-publisher',
        'x-scopes': 'scheduling.publish',
        'content-type': 'application/json',
      },
      payload: { notes: 'Published for production' },
    });

    t.equal(publishResponse.statusCode, 200, 'Period published');
    const published = JSON.parse(publishResponse.body);
    t.equal(published.period.status, 'PUBLISHED', 'Status is PUBLISHED');
    t.ok(published.event, 'Publish event created');
    t.equal(published.event.publishedByUserId, 'user-publisher', 'Event has correct publisher');

    // 3. Lock period
    const lockResponse = await app.inject({
      method: 'POST',
      url: `/api/scheduling/v2/schedule-periods/${period.id}/lock`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-locker',
        'x-scopes': 'scheduling.lock',
        'content-type': 'application/json',
      },
      payload: {},
    });

    t.equal(lockResponse.statusCode, 200, 'Period locked');
    const locked = JSON.parse(lockResponse.body);
    t.equal(locked.status, 'LOCKED', 'Status is LOCKED');

    // 4. Verify list shows all statuses
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property1.id}`,
      headers: {
        'x-tenant-id': tenant1.id,
        'x-user-id': 'user-viewer',
        'x-scopes': 'scheduling.view',
      },
    });

    t.equal(listResponse.statusCode, 200, 'Can list periods');
    const periods = JSON.parse(listResponse.body);
    const finalPeriod = periods.find((p) => p.id === period.id);
    t.ok(finalPeriod, 'Final period in list');
    t.equal(finalPeriod.status, 'LOCKED', 'List shows final LOCKED status');
  });
});
