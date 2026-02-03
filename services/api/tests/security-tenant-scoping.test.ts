import { PrismaClient } from '@prisma/client';
import { test } from 'tap';

import { buildServer } from '../src/server';

const prisma = new PrismaClient();

/**
 * Security Test Suite: Tenant Scoping
 *
 * Ensures all API routes properly enforce tenant boundaries and fail closed
 * when attempting cross-tenant or unauthorized access.
 */
test('Security: Tenant Scoping and Authorization', async (t) => {
  const config = {
    port: 3002,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
  };

  const app = await buildServer(config);

  // Create two separate tenants with data
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Tenant 1 - Security Test',
      slug: `tenant-1-security-${Date.now()}`,
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Tenant 2 - Security Test',
      slug: `tenant-2-security-${Date.now()}`,
    },
  });

  // Create properties for each tenant
  const property1 = await prisma.property.create({
    data: {
      tenantId: tenant1.id,
      name: 'Property 1',
    },
  });

  const property2 = await prisma.property.create({
    data: {
      tenantId: tenant2.id,
      name: 'Property 2',
    },
  });

  // Create employees for each tenant
  const employee1 = await prisma.employee.create({
    data: {
      tenantId: tenant1.id,
      propertyId: property1.id,
      firstName: 'John',
      lastName: 'Tenant1',
      email: `john.tenant1.${Date.now()}@example.com`,
    },
  });

  const employee2 = await prisma.employee.create({
    data: {
      tenantId: tenant2.id,
      propertyId: property2.id,
      firstName: 'Jane',
      lastName: 'Tenant2',
      email: `jane.tenant2.${Date.now()}@example.com`,
    },
  });

  // Create schedules for each tenant
  const schedule1 = await prisma.schedule.create({
    data: {
      tenantId: tenant1.id,
      propertyId: property1.id,
      employeeId: employee1.id,
      name: 'Schedule 1',
      startDate: new Date('2026-02-01'),
    },
  });

  const schedule2 = await prisma.schedule.create({
    data: {
      tenantId: tenant2.id,
      propertyId: property2.id,
      employeeId: employee2.id,
      name: 'Schedule 2',
      startDate: new Date('2026-02-01'),
    },
  });

  // Create shifts
  const shift1 = await prisma.shift.create({
    data: {
      tenantId: tenant1.id,
      scheduleId: schedule1.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 30,
    },
  });

  const _shift2 = await prisma.shift.create({
    data: {
      tenantId: tenant2.id,
      scheduleId: schedule2.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 30,
    },
  });

  // Create punches
  const _punch1 = await prisma.punch.create({
    data: {
      tenantId: tenant1.id,
      employeeId: employee1.id,
      type: 'in',
      timestamp: new Date(),
    },
  });

  const punch2 = await prisma.punch.create({
    data: {
      tenantId: tenant2.id,
      employeeId: employee2.id,
      type: 'in',
      timestamp: new Date(),
    },
  });

  // Create exceptions
  const _exception1 = await prisma.exception.create({
    data: {
      tenantId: tenant1.id,
      employeeId: employee1.id,
      type: 'late_arrival',
      reason: 'Traffic',
      date: new Date('2026-02-01'),
      status: 'pending',
    },
  });

  const exception2 = await prisma.exception.create({
    data: {
      tenantId: tenant2.id,
      employeeId: employee2.id,
      type: 'early_departure',
      reason: 'Appointment',
      date: new Date('2026-02-01'),
      status: 'pending',
    },
  });

  t.teardown(async () => {
    // Cleanup in reverse order of creation
    await prisma.exception.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.punch.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.shift.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.schedule.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.employee.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.property.deleteMany({ where: { tenantId: { in: [tenant1.id, tenant2.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenant1.id, tenant2.id] } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ========== SCHEDULES - Cross-Tenant Access Tests ==========

  await t.test('GET /api/schedules should only return schedules for user tenant', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/schedules',
      headers: {
        'x-tenant-id': tenant1.id,
      },
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.ok(Array.isArray(body.data), 'Response has data array');

    // Verify all schedules belong to tenant1
    body.data.forEach((schedule: { tenantId: string }) => {
      t.equal(schedule.tenantId, tenant1.id, 'Schedule belongs to correct tenant');
    });

    // Verify tenant2 schedule is NOT in results
    const hasTenant2Schedule = body.data.some((s: { id: string }) => s.id === schedule2.id);
    t.equal(hasTenant2Schedule, false, 'Tenant 2 schedule not in Tenant 1 results');
  });

  await t.test(
    'GET /api/schedules/:scheduleId/shifts should reject cross-tenant access',
    async (t) => {
      // Tenant1 trying to access Tenant2's schedule shifts
      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${schedule2.id}/shifts`,
        headers: {
          'x-tenant-id': tenant1.id,
        },
      });

      t.equal(response.statusCode, 404, 'Returns 404 for cross-tenant schedule access');
      const body = JSON.parse(response.body);
      t.ok(body.message, 'Error message present');
    }
  );

  await t.test(
    'POST /api/schedules/:scheduleId/shifts should reject cross-tenant shift creation',
    async (t) => {
      // Tenant1 trying to create shift in Tenant2's schedule
      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${schedule2.id}/shifts`,
        headers: {
          'x-tenant-id': tenant1.id,
          'content-type': 'application/json',
        },
        payload: {
          scheduleId: schedule2.id,
          dayOfWeek: 2,
          startTime: '10:00',
          endTime: '18:00',
          breakMinutes: 30,
        },
      });

      t.equal(response.statusCode, 404, 'Returns 404 for cross-tenant shift creation');
    }
  );

  // ========== PUNCHES - Cross-Tenant Access Tests ==========

  await t.test('GET /api/punches should only return punches for user tenant', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/punches',
      headers: {
        'x-tenant-id': tenant1.id,
      },
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.ok(Array.isArray(body.data), 'Response has data array');

    // Verify all punches belong to tenant1
    body.data.forEach((punch: { tenantId: string }) => {
      t.equal(punch.tenantId, tenant1.id, 'Punch belongs to correct tenant');
    });

    // Verify tenant2 punch is NOT in results
    const hasTenant2Punch = body.data.some((p: { id: string }) => p.id === punch2.id);
    t.equal(hasTenant2Punch, false, 'Tenant 2 punch not in Tenant 1 results');
  });

  await t.test('POST /api/punches should prevent cross-tenant employee punch', async (t) => {
    // Tenant1 trying to create punch for Tenant2's employee
    const response = await app.inject({
      method: 'POST',
      url: '/api/punches',
      headers: {
        'x-tenant-id': tenant1.id,
        'content-type': 'application/json',
      },
      payload: {
        employeeId: employee2.id, // Tenant2's employee
        type: 'out',
        shiftId: shift1.id,
      },
    });

    // Should fail because employee doesn't belong to tenant1
    t.ok([403, 404].includes(response.statusCode), 'Returns 403 or 404 for cross-tenant employee');
  });

  // ========== EXCEPTIONS - Cross-Tenant Access Tests ==========

  await t.test('GET /api/exceptions should only return exceptions for user tenant', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/exceptions',
      headers: {
        'x-tenant-id': tenant1.id,
      },
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);
    t.ok(Array.isArray(body.data), 'Response has data array');

    // Verify all exceptions belong to tenant1
    body.data.forEach((exc: { tenantId: string }) => {
      t.equal(exc.tenantId, tenant1.id, 'Exception belongs to correct tenant');
    });

    // Verify tenant2 exception is NOT in results
    const hasTenant2Exception = body.data.some((e: { id: string }) => e.id === exception2.id);
    t.equal(hasTenant2Exception, false, 'Tenant 2 exception not in Tenant 1 results');
  });

  await t.test('GET /api/exceptions/:exceptionId should reject cross-tenant access', async (t) => {
    // Tenant1 trying to access Tenant2's exception
    const response = await app.inject({
      method: 'GET',
      url: `/api/exceptions/${exception2.id}`,
      headers: {
        'x-tenant-id': tenant1.id,
      },
    });

    t.equal(response.statusCode, 404, 'Returns 404 for cross-tenant exception access');
  });

  await t.test(
    'PUT /api/exceptions/:exceptionId/resolve should reject cross-tenant resolution',
    async (t) => {
      // Tenant1 trying to resolve Tenant2's exception
      const response = await app.inject({
        method: 'PUT',
        url: `/api/exceptions/${exception2.id}/resolve`,
        headers: {
          'x-tenant-id': tenant1.id,
          'content-type': 'application/json',
        },
        payload: {
          status: 'approved',
          notes: 'Approved',
        },
      });

      t.equal(response.statusCode, 404, 'Returns 404 for cross-tenant exception resolution');
    }
  );

  // ========== TENANTS - Access Control Tests ==========

  await t.test('GET /api/tenants/:id should reject access to different tenant', async (t) => {
    // Tenant1 user trying to access Tenant2's details
    const response = await app.inject({
      method: 'GET',
      url: `/api/tenants/${tenant2.id}`,
      headers: {
        'x-user-id': 'test-user-1',
      },
    });

    t.equal(response.statusCode, 403, 'Returns 403 for cross-tenant access');
    const body = JSON.parse(response.body);
    t.equal(body.code, 'FORBIDDEN', 'Returns FORBIDDEN error code');
  });

  await t.test(
    'GET /api/tenants/:id/properties should reject cross-tenant property list',
    async (t) => {
      // Tenant1 user trying to list Tenant2's properties
      const response = await app.inject({
        method: 'GET',
        url: `/api/tenants/${tenant2.id}/properties`,
        headers: {
          'x-user-id': 'test-user-1',
        },
      });

      t.equal(response.statusCode, 403, 'Returns 403 for cross-tenant property access');
    }
  );

  // ========== Missing Tenant ID Tests ==========

  await t.test('GET /api/schedules should require tenant ID', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/schedules',
      headers: {},
    });

    t.ok([401, 403].includes(response.statusCode), 'Returns 401/403 when tenant ID missing');
  });

  await t.test('GET /api/punches should require tenant ID', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/punches',
      headers: {},
    });

    t.ok([401, 403].includes(response.statusCode), 'Returns 401/403 when tenant ID missing');
  });

  await t.test('GET /api/exceptions should require tenant ID', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/exceptions',
      headers: {},
    });

    t.ok([401, 403].includes(response.statusCode), 'Returns 401/403 when tenant ID missing');
  });

  // ========== Property Scoping Tests ==========

  await t.test('Should filter schedules by property when specified', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/schedules?propertyId=${property1.id}`,
      headers: {
        'x-tenant-id': tenant1.id,
      },
    });

    t.equal(response.statusCode, 200, 'Status code is 200');
    const body = JSON.parse(response.body);

    // All schedules should be for property1
    body.data.forEach((schedule: { propertyId: string }) => {
      t.equal(schedule.propertyId, property1.id, 'Schedule belongs to correct property');
    });
  });
});
