import { PrismaClient } from '@prisma/client';
import { test } from 'tap';

import { buildServer } from '../src/server';

const prisma = new PrismaClient();

/**
 * Security Test Suite: RBAC (Role-Based Access Control)
 *
 * Ensures proper role-based authorization for manager/admin workflows
 */
test('Security: RBAC Authorization', async (t) => {
  const config = {
    port: 3003,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
  };

  const app = await buildServer(config);

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'RBAC Test Tenant',
      slug: `rbac-test-${Date.now()}`,
    },
  });

  // Create property and employee
  const property = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Test Property',
    },
  });

  const employee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      firstName: 'Test',
      lastName: 'Employee',
      email: `test.employee.${Date.now()}@example.com`,
    },
  });

  // Create exception for testing
  const exception = await prisma.exception.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      type: 'late_arrival',
      reason: 'Traffic',
      date: new Date('2026-02-01'),
      status: 'pending',
    },
  });

  t.teardown(async () => {
    await prisma.exception.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.property.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
    await app.close();
  });

  // ========== Exception Resolution - RBAC Tests ==========

  await t.test(
    'PUT /api/exceptions/:id/resolve should reject employee without manager role',
    async (t) => {
      // Simulate regular employee (no manager/admin role)
      const response = await app.inject({
        method: 'PUT',
        url: `/api/exceptions/${exception.id}/resolve`,
        headers: {
          'x-tenant-id': tenant.id,
          'x-user-id': 'employee-user-id',
          'content-type': 'application/json',
        },
        payload: {
          status: 'approved',
          notes: 'Approved',
        },
      });

      t.equal(response.statusCode, 403, 'Returns 403 for non-manager');
      const body = JSON.parse(response.body);
      t.equal(body.code, 'FORBIDDEN', 'Returns FORBIDDEN error code');
      t.match(
        body.message,
        /Manager or Admin role required/i,
        'Error message mentions role requirement'
      );
    }
  );

  await t.test('PUT /api/exceptions/:id/resolve should allow manager role', async (t) => {
    // Note: This test would need proper JWT token generation with Manager role
    // For now, we're documenting the expected behavior
    t.skip('Requires JWT token generation with Manager role - mock auth not implemented');
  });

  await t.test('PUT /api/exceptions/:id/resolve should allow admin role', async (t) => {
    // Note: This test would need proper JWT token generation with Admin role
    t.skip('Requires JWT token generation with Admin role - mock auth not implemented');
  });

  // ========== Tenant Settings - RBAC Tests ==========

  await t.test('PUT /api/tenants/:id/settings should reject non-admin user', async (t) => {
    // Simulate regular user (no admin role)
    const response = await app.inject({
      method: 'PUT',
      url: `/api/tenants/${tenant.id}/settings`,
      headers: {
        'x-user-id': 'regular-user-id',
        'content-type': 'application/json',
      },
      payload: {
        weekStartDay: 1,
      },
    });

    t.equal(response.statusCode, 403, 'Returns 403 for non-admin');
    const body = JSON.parse(response.body);
    t.equal(body.code, 'FORBIDDEN', 'Returns FORBIDDEN error code');
    t.match(body.message, /Admin role required/i, 'Error message mentions admin requirement');
  });

  // ========== Property-Level Scoping Tests ==========

  await t.test('Should enforce property-level access for property managers', async (t) => {
    t.skip('Property-level RBAC not yet implemented');
  });

  // ========== Department-Level Scoping Tests ==========

  await t.test('Should enforce department-level access for department managers', async (t) => {
    t.skip('Department-level RBAC not yet implemented');
  });
});

/**
 * Security Test Suite: Fail-Closed Defaults
 *
 * Ensures routes fail closed (deny by default) when authorization is unclear
 */
test('Security: Fail-Closed Authorization', async (t) => {
  const config = {
    port: 3004,
    host: '0.0.0.0',
    nodeEnv: 'test',
    corsOrigin: '*',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: 'test-secret',
    logLevel: 'silent',
  };

  const app = await buildServer(config);

  t.teardown(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  await t.test('Routes should reject requests with no authentication', async (t) => {
    const endpoints = [
      { method: 'GET', url: '/api/schedules' },
      { method: 'POST', url: '/api/schedules' },
      { method: 'GET', url: '/api/punches' },
      { method: 'POST', url: '/api/punches' },
      { method: 'GET', url: '/api/exceptions' },
    ];

    for (const endpoint of endpoints) {
      const response = await app.inject({
        method: endpoint.method as 'GET' | 'POST',
        url: endpoint.url,
        headers: {},
      });

      t.ok(
        [401, 403].includes(response.statusCode),
        `${endpoint.method} ${endpoint.url} returns 401/403 without auth`
      );
    }
  });

  await t.test('Routes should reject malformed tenant IDs', async (t) => {
    const endpoints = [
      { method: 'GET', url: '/api/schedules' },
      { method: 'GET', url: '/api/punches' },
      { method: 'GET', url: '/api/exceptions' },
    ];

    for (const endpoint of endpoints) {
      const response = await app.inject({
        method: endpoint.method as 'GET',
        url: endpoint.url,
        headers: {
          'x-tenant-id': 'invalid-tenant-id-format',
        },
      });

      // Should either reject invalid ID or return empty results (fail closed)
      t.ok(
        [401, 403, 404].includes(response.statusCode) ||
          (response.statusCode === 200 && JSON.parse(response.body).data?.length === 0),
        `${endpoint.method} ${endpoint.url} handles invalid tenant ID safely`
      );
    }
  });

  await t.test('Routes should reject SQL injection attempts in tenant ID', async (t) => {
    const sqlInjectionAttempts = [
      "1' OR '1'='1",
      '1; DROP TABLE tenants;--',
      "1' UNION SELECT * FROM users--",
    ];

    for (const maliciousInput of sqlInjectionAttempts) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules',
        headers: {
          'x-tenant-id': maliciousInput,
        },
      });

      // Should safely handle and reject SQL injection attempts
      t.ok(
        [400, 401, 403, 404].includes(response.statusCode) ||
          (response.statusCode === 200 && JSON.parse(response.body).data?.length === 0),
        'SQL injection attempt handled safely'
      );
    }
  });
});
