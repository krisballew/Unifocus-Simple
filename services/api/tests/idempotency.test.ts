import { type PrismaClient } from '@prisma/client';
import { test } from 'tap';

import { buildServer } from '../src/server.js';

import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './helpers/db-setup.js';

let prisma: PrismaClient;

test('Punch Idempotency', async (t) => {
  // Setup test database connection
  prisma = await setupTestDatabase();

  // Clean database before starting tests
  await resetTestDatabase(prisma);

  const config = {
    port: 3001,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
  };

  const app = await buildServer(config);

  // Setup test data
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant Idempotency',
      slug: `test-tenant-idempotency-${Date.now()}`,
    },
  });
  const tenantId = tenant.id;

  const property = await prisma.property.create({
    data: {
      tenantId,
      name: 'Test Property',
    },
  });
  const propertyId = property.id;

  const employee = await prisma.employee.create({
    data: {
      tenantId,
      propertyId,
      firstName: 'John',
      lastName: 'Doe',
      email: `john.doe.${Date.now()}@example.com`,
    },
  });
  const employeeId = employee.id;

  const schedule = await prisma.schedule.create({
    data: {
      tenantId,
      propertyId,
      employeeId,
      name: 'Weekly Schedule',
      startDate: new Date('2026-02-03'),
    },
  });
  const scheduleId = schedule.id;

  const shift = await prisma.shift.create({
    data: {
      tenantId,
      scheduleId,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 30,
    },
  });
  const shiftId = shift.id;

  t.teardown(async () => {
    // Cleanup
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });
    await prisma.punch.deleteMany({ where: { tenantId } });
    await prisma.shift.deleteMany({ where: { tenantId } });
    await prisma.schedule.deleteMany({ where: { tenantId } });
    await prisma.employee.deleteMany({ where: { tenantId } });
    await prisma.property.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await teardownTestDatabase(prisma);
    await app.close();
  });

  await t.test('should create a punch on first request', async (t) => {
    await prisma.punch.deleteMany({ where: { tenantId } });
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'idempotency-key': `test-key-001-${Date.now()}`,
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'in',
        shiftId,
      },
    });

    t.equal(response.statusCode, 201, 'Status code is 201');
    const body = JSON.parse(response.body);
    t.ok(body.id, 'Punch ID exists');
    t.equal(body.type, 'in', 'Punch type is "in"');
    t.equal(body.employeeId, employeeId, 'Employee ID matches');

    // Verify punch was created in DB
    const punch = await prisma.punch.findUnique({
      where: { id: body.id },
    });
    t.ok(punch, 'Punch exists in database');
    t.equal(punch?.type, 'in', 'Punch type in DB is "in"');

    // Verify idempotency record was created
    const idempotencyRecord = await prisma.idempotencyRecord.findFirst({
      where: {
        tenantId,
        endpoint: 'POST /api/punches',
      },
    });
    t.ok(idempotencyRecord, 'Idempotency record exists');
    t.equal(idempotencyRecord?.statusCode, 201, 'Idempotency record status code is 201');
  });

  await t.test(
    'should return same response on duplicate request without creating new punch',
    async (t) => {
      await prisma.punch.deleteMany({ where: { tenantId } });
      await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });

      const idempotencyKey = `test-key-002-${Date.now()}`;

      // First request
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/punches',
        headers: {
          'idempotency-key': idempotencyKey,
          'content-type': 'application/json',
          'x-tenant-id': tenantId,
        },
        payload: {
          employeeId,
          type: 'in',
          shiftId,
        },
      });

      t.equal(firstResponse.statusCode, 201, 'First request status code is 201');
      const firstBody = JSON.parse(firstResponse.body);
      const firstPunchId = firstBody.id;

      // Count punches before duplicate request
      const punchesBeforeDuplicate = await prisma.punch.count({
        where: { tenantId },
      });
      t.equal(punchesBeforeDuplicate, 1, 'One punch exists before duplicate request');

      // Duplicate request with same idempotency key
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/punches',
        headers: {
          'idempotency-key': idempotencyKey,
          'content-type': 'application/json',
          'x-tenant-id': tenantId,
        },
        payload: {
          employeeId,
          type: 'in',
          shiftId,
        },
      });

      // Should return same status code and response
      t.equal(secondResponse.statusCode, 201, 'Second request status code is 201');
      const secondBody = JSON.parse(secondResponse.body);
      t.equal(secondBody.id, firstPunchId, 'Punch IDs are the same');
      t.equal(secondBody.type, 'in', 'Punch type is "in"');

      // Verify no new punch was created
      const punchesAfterDuplicate = await prisma.punch.count({
        where: { tenantId },
      });
      t.equal(punchesAfterDuplicate, 1, 'Still only one punch exists after duplicate request');
    }
  );

  await t.test('should create different punches for different idempotency keys', async (t) => {
    await prisma.punch.deleteMany({ where: { tenantId } });
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });

    // First request with key-003
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'idempotency-key': `test-key-003-${Date.now()}`,
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'in',
        shiftId,
      },
    });

    t.equal(firstResponse.statusCode, 201, 'First request status code is 201');
    const firstBody = JSON.parse(firstResponse.body);
    const firstPunchId = firstBody.id;

    // Clock out with different key
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'idempotency-key': `test-key-004-${Date.now()}`,
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'out',
        shiftId,
      },
    });

    t.equal(secondResponse.statusCode, 201, 'Second request status code is 201');
    const secondBody = JSON.parse(secondResponse.body);
    const secondPunchId = secondBody.id;

    // Should be different punches
    t.not(firstPunchId, secondPunchId, 'Punch IDs are different');

    // Verify both punches exist
    const punches = await prisma.punch.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'asc' },
    });
    t.equal(punches.length, 2, 'Two punches exist');
    t.equal(punches[0].type, 'in', 'First punch type is "in"');
    t.equal(punches[1].type, 'out', 'Second punch type is "out"');
  });

  await t.test('should work without idempotency key (no deduplication)', async (t) => {
    await prisma.punch.deleteMany({ where: { tenantId } });
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });

    // First request without idempotency key
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'in',
        shiftId,
      },
    });

    t.equal(firstResponse.statusCode, 201, 'First request status code is 201');
    const firstBody = JSON.parse(firstResponse.body);

    // Clock out
    await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'out',
        shiftId,
      },
    });

    // Second identical request without idempotency key should create another punch
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
      },
      payload: {
        employeeId,
        type: 'in',
        shiftId,
      },
    });

    t.equal(secondResponse.statusCode, 201, 'Second request status code is 201');
    const secondBody = JSON.parse(secondResponse.body);

    // Should create different punches
    t.not(firstBody.id, secondBody.id, 'Punch IDs are different');

    // Verify no idempotency records were created
    const idempotencyRecords = await prisma.idempotencyRecord.count({
      where: { tenantId },
    });
    t.equal(idempotencyRecords, 0, 'No idempotency records exist');
  });

  await t.test(
    'should handle multiple concurrent requests with same idempotency key',
    async (t) => {
      await prisma.punch.deleteMany({ where: { tenantId } });
      await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });

      const idempotencyKey = `test-key-concurrent-${Date.now()}`;

      // Send multiple concurrent requests with same idempotency key
      const responses = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/punches',
          headers: {
            'idempotency-key': idempotencyKey,
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
          },
          payload: {
            employeeId,
            type: 'in',
            shiftId,
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/punches',
          headers: {
            'idempotency-key': idempotencyKey,
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
          },
          payload: {
            employeeId,
            type: 'in',
            shiftId,
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/punches',
          headers: {
            'idempotency-key': idempotencyKey,
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
          },
          payload: {
            employeeId,
            type: 'in',
            shiftId,
          },
        }),
      ]);

      // All should return 201
      responses.forEach((response, index) => {
        t.equal(response.statusCode, 201, `Response ${index + 1} status code is 201`);
      });

      // All should return the same punch ID
      const bodies = responses.map((r) => JSON.parse(r.body));
      const punchIds = bodies.map((b) => b.id);
      const uniquePunchIds = new Set(punchIds);
      t.equal(uniquePunchIds.size, 1, 'All responses have the same punch ID');

      // Only one punch should be created
      const punches = await prisma.punch.count({
        where: { tenantId },
      });
      t.equal(punches, 1, 'Only one punch was created');
    }
  );
});
