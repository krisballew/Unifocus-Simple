import { PrismaClient } from '@prisma/client';
import { test } from 'tap';

import { buildServer } from '../src/server.js';

import { buildPersonaHeaders, createTestUser, getData } from './helpers/auth.js';

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
  // Create test users for different personas
  const adminUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'admin@test.com',
    name: 'Admin User',
  });

  // Note: managerUser and employeeUser created for potential future use
  const _managerUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'manager@test.com',
    name: 'Manager User',
  });

  const _employeeUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'employee@test.com',
    name: 'Employee User',
  });

  // Build auth headers for each persona
  const adminHeaders = {
    ...buildPersonaHeaders('schedulingAdmin', {
      tenantId: tenant1.id,
      userId: adminUser.id,
    }),
    'content-type': 'application/json',
  };

  t.teardown(async () => {
    // Cleanup - delete in correct order to respect foreign keys
    await prisma.wfmPublishEvent.deleteMany({});
    await prisma.wfmSchedulePeriod.deleteMany({});
    await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@test.com', 'manager@test.com', 'employee@test.com'] } },
    });
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
    // Note: We'll test tenant isolation by trying to access it with tenant1 headers
    await prisma.wfmSchedulePeriod.create({
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
      headers: adminHeaders,
    });

    t.equal(response1.statusCode, 200, 'Request succeeds');
    const body1 = getData(response1);
    t.equal(body1.length, 1, 'Returns only 1 period for tenant 1');
    t.equal(body1[0].id, period1.id, 'Returns correct period for tenant 1');
    t.equal(body1[0].name, 'Period 1 - Tenant 1', 'Period name matches');

    // Query as tenant 2 - should only see tenant 2 periods
    // Note: adminHeaders are for tenant1, so this query won't see tenant2 periods
    // Testing that tenant isolation works - query with tenant1 headers should return empty for property2
    const response2 = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property2.id}`,
      headers: adminHeaders,
    });

    t.equal(response2.statusCode, 200, 'Request succeeds for tenant 2');
    const body2 = getData(response2);
    // Since we're using tenant1 headers but querying property2 (tenant2's property),
    // the service should return empty due to tenant isolation
    t.equal(body2.length, 0, 'Returns 0 periods (tenant isolation working)');
    // Skip remaining assertions since body2 is empty due to tenant isolation
  });

  await t.test(
    'POST /api/scheduling/v2/schedule-periods - Tenant isolation on create',
    async (t) => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-07');

      // Create period as tenant 1
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/schedule-periods',
        headers: adminHeaders,
        payload: {
          propertyId: property1.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          name: 'Isolated Period',
        },
      });

      t.equal(response.statusCode, 201, 'Period created successfully');
      const body = getData(response);
      t.equal(body.tenantId, tenant1.id, 'Period has correct tenant ID');
      t.equal(body.propertyId, property1.id, 'Period has correct property ID');

      // Verify period is scoped to tenant 1
      const period = await prisma.wfmSchedulePeriod.findUnique({
        where: { id: body.id },
      });
      t.equal(period?.tenantId, tenant1.id, 'Period stored with tenant 1 ID');
    }
  );

  // ========== RBAC Permission Tests ==========
  // NOTE: Permission tests are skipped in dev/test mode because auth is in
  // skip-verification mode with hardcoded scopes. Permission checks are
  // validated by the guard functions which are tested separately.

  await t.test(
    'GET /api/scheduling/v2/schedule-periods - List returns correct structure',
    async (t) => {
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
        headers: adminHeaders,
      });

      t.equal(response.statusCode, 200, 'Returns 200 OK');
      const body = getData(response);
      t.ok(Array.isArray(body), 'Returns array');
      const testPeriod = body.find((p) => p.id === period.id);
      t.ok(testPeriod, 'Contains period ID');
      t.equal(testPeriod.status, 'DRAFT', 'Contains period status');
      t.equal(testPeriod.version, 1, 'Contains period version');
    }
  );

  await t.test(
    'POST /api/scheduling/v2/schedule-periods - Create returns correct structure',
    async (t) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/schedule-periods',
        headers: adminHeaders,
        payload: {
          propertyId: property1.id,
          startDate: new Date('2026-06-01').toISOString(),
          endDate: new Date('2026-06-07').toISOString(),
          name: 'Test Create',
        },
      });

      t.equal(response.statusCode, 201, 'Returns 201 Created');
      const body = getData(response);
      t.ok(body?.id, 'Returns period ID');
      t.equal(body.status, 'DRAFT', 'Initial status is DRAFT');
      t.equal(body.version, 1, 'Initial version is 1');
      t.equal(body.tenantId, tenant1.id, 'Scoped to correct tenant');
    }
  );

  // ========== Lock Enforcement Tests ==========

  await t.test(
    'POST /api/scheduling/v2/schedule-periods/:id/lock -Lock prevents editing',
    async (t) => {
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
        headers: adminHeaders,
        payload: {},
      });

      t.equal(response.statusCode, 400, 'Publishing locked period returns error');
      const body = getData(response);
      t.match(body.message, /locked|LOCKED/i, 'Error mentions locked status');
    }
  );

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
          publishedByUserId: adminUser.id,
        },
      });

      // Try to publish again
      const response = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/schedule-periods/${period.id}/publish`,
        headers: adminHeaders,
        payload: {},
      });

      t.equal(response.statusCode, 200, 'Returns 200 OK');
      const body = getData(response);
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
        headers: adminHeaders,
        payload: {},
      });

      t.equal(response.statusCode, 200, 'Returns 200 OK');
      const body = getData(response);
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
        headers: adminHeaders,
        payload: {
          propertyId: property1.id,
          startDate: new Date('2026-10-07').toISOString(),
          endDate: new Date('2026-10-01').toISOString(), // End before start
        },
      });

      t.equal(response.statusCode, 400, 'Returns 400 Bad Request');
      const body = getData(response);
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
      headers: adminHeaders,
      payload: {
        propertyId: property1.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        name: 'Full Lifecycle Period',
      },
    });

    t.equal(createResponse.statusCode, 201, 'Period created');
    const period = getData(createResponse);
    t.equal(period.status, 'DRAFT', 'Initial status is DRAFT');

    // 2. Publish period
    const publishResponse = await app.inject({
      method: 'POST',
      url: `/api/scheduling/v2/schedule-periods/${period.id}/publish`,
      headers: adminHeaders,
      payload: { notes: 'Published for production' },
    });

    t.equal(publishResponse.statusCode, 200, 'Period published');
    const published = getData(publishResponse);
    t.equal(published.period.status, 'PUBLISHED', 'Status is PUBLISHED');
    t.ok(published.event, 'Publish event created');
    t.equal(published.event.publishedByUserId, adminUser.id, 'Event has correct publisher');
    // 3. Lock period
    const lockResponse = await app.inject({
      method: 'POST',
      url: `/api/scheduling/v2/schedule-periods/${period.id}/lock`,
      headers: adminHeaders,
      payload: {},
    });

    t.equal(lockResponse.statusCode, 200, 'Period locked');
    const locked = getData(lockResponse);
    t.equal(locked.status, 'LOCKED', 'Status is LOCKED');

    // 4. Verify list shows all statuses
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/schedule-periods?propertyId=${property1.id}`,
      headers: adminHeaders,
    });

    t.equal(listResponse.statusCode, 200, 'Can list periods');
    const periods = getData(listResponse);
    const finalPeriod = periods.find((p) => p.id === period.id);
    t.ok(finalPeriod, 'Final period in list');
    t.equal(finalPeriod.status, 'LOCKED', 'List shows final LOCKED status');
  });
});

/**
 * Security Test Suite: Scheduling V2 Employee Swap Requests
 *
 * Tests employee-to-employee swap request functionality including:
 * - Employee can create swap request only for their own assigned shift
 * - Target employee eligibility and overlap checks
 * - Employee can cancel pending request
 * - Manager approval reassigns shift transactionally
 * - Approval fails if requestor no longer assigned
 */
test('Scheduling V2: Employee Swap Requests', async (t) => {
  const config = {
    port: 3005,
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

  // Create tenant and property
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Swap Test Tenant',
      slug: `swap-test-${Date.now()}`,
    },
  });

  const property = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Swap Test Property',
    },
  });

  // Create division and department category
  const division = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      name: 'Operations',
      code: 'OPS',
    },
  });

  const departmentCategory = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Food & Beverage',
      code: 'FB',
      description: 'Food and beverage services',
    },
  });

  // Create department
  const department = await prisma.department.create({
    data: {
      tenant: { connect: { id: tenant.id } },
      property: { connect: { id: property.id } },
      division: { connect: { id: division.id } },
      departmentCategory: { connect: { id: departmentCategory.id } },
      name: 'Swap Test Department',
      code: `DEPT-${Date.now()}`,
    },
  });

  // Create job category
  const jobCategory = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Service',
      code: 'SVC',
      description: 'Service positions',
    },
  });

  // Create job role
  const jobRole = await prisma.jobRole.create({
    data: {
      tenant: { connect: { id: tenant.id } },
      property: { connect: { id: property.id } },
      department: { connect: { id: department.id } },
      jobCategory: { connect: { id: jobCategory.id } },
      code: `SERVER-${Date.now()}`,
      name: 'Server',
    },
  });

  // Create test users
  const employee1 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      firstName: 'Employee',
      lastName: 'One',
      email: 'employee1@test.com',
      isActive: true,
    },
  });

  const employee2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      firstName: 'Employee',
      lastName: 'Two',
      email: 'employee2@test.com',
      isActive: true,
    },
  });

  const employee3 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      firstName: 'Employee',
      lastName: 'Three',
      email: 'employee3@test.com',
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      email: 'manager@test.com',
      name: 'Manager User',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'Swap Test Manager' },
    update: {},
    create: {
      name: 'Swap Test Manager',
      description: 'Swap request test role',
      permissions: [],
    },
  });

  await prisma.userRoleAssignment.create({
    data: {
      tenantId: tenant.id,
      userId: manager.id,
      roleId: managerRole.id,
      propertyId: property.id,
      departmentId: department.id,
      isActive: true,
    },
  });

  // Build auth headers
  const employee1Headers = {
    ...buildPersonaHeaders('employee', {
      tenantId: tenant.id,
      userId: employee1.id,
    }),
  };

  const employee2Headers = {
    ...buildPersonaHeaders('employee', {
      tenantId: tenant.id,
      userId: employee2.id,
    }),
  };

  const managerHeaders = {
    ...buildPersonaHeaders('departmentManager', {
      tenantId: tenant.id,
      userId: manager.id,
    }),
  };

  // Create employee job role assignments (eligibility)
  await prisma.employeeJobAssignment.createMany({
    data: [
      {
        tenantId: tenant.id,
        employeeId: employee1.id,
        jobRoleId: jobRole.id,
        startDate: new Date('2026-01-01'),
      },
      {
        tenantId: tenant.id,
        employeeId: employee2.id,
        jobRoleId: jobRole.id,
        startDate: new Date('2026-01-01'),
      },
      // Note: employee3 is NOT assigned to jobRole (ineligible)
    ],
  });

  // Create schedule period
  const period = await prisma.wfmSchedulePeriod.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-07'),
      status: 'PUBLISHED',
      version: 1,
    },
  });

  // Create shift assigned to employee1
  const shift1 = await prisma.wfmShiftPlan.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      schedulePeriodId: period.id,
      departmentId: department.id,
      jobRoleId: jobRole.id,
      startDateTime: new Date('2026-12-02T09:00:00Z'),
      endDateTime: new Date('2026-12-02T17:00:00Z'),
      breakMinutes: 30,
      isOpenShift: false,
    },
  });

  await prisma.wfmShiftAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      shiftPlanId: shift1.id,
      employeeId: employee1.id,
      assignedByUserId: manager.id,
      assignedAt: new Date(),
    },
  });

  const ensureEmployee1Assignment = async () => {
    const existingAssignment = await prisma.wfmShiftAssignment.findFirst({
      where: {
        tenantId: tenant.id,
        shiftPlanId: shift1.id,
        employeeId: employee1.id,
      },
    });

    if (!existingAssignment) {
      await prisma.wfmShiftAssignment.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          shiftPlanId: shift1.id,
          employeeId: employee1.id,
          assignedByUserId: manager.id,
          assignedAt: new Date(),
        },
      });
    }
  };

  t.beforeEach(async () => {
    await ensureEmployee1Assignment();
  });

  // Create a shift that will cause overlap for employee2
  const conflictShift = await prisma.wfmShiftPlan.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      schedulePeriodId: period.id,
      departmentId: department.id,
      jobRoleId: jobRole.id,
      startDateTime: new Date('2026-12-02T10:00:00Z'), // Overlaps with shift1
      endDateTime: new Date('2026-12-02T18:00:00Z'),
      breakMinutes: 30,
      isOpenShift: false,
    },
  });

  await prisma.wfmShiftAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      shiftPlanId: conflictShift.id,
      employeeId: employee2.id,
      assignedByUserId: manager.id,
      assignedAt: new Date(),
    },
  });

  // ========== Swap Request Creation Tests ==========

  await t.test(
    'POST /api/scheduling/v2/swap-requests - Employee can create swap request for their own shift',
    async (t) => {
      // Create a shift for employee1 to swap
      const swapShift = await prisma.wfmShiftPlan.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          schedulePeriodId: period.id,
          departmentId: department.id,
          jobRoleId: jobRole.id,
          startDateTime: new Date('2026-12-03T09:00:00Z'),
          endDateTime: new Date('2026-12-03T17:00:00Z'),
          breakMinutes: 30,
          isOpenShift: false,
        },
      });

      await prisma.wfmShiftAssignment.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          shiftPlanId: swapShift.id,
          employeeId: employee1.id,
          assignedByUserId: manager.id,
          assignedAt: new Date(),
        },
      });

      // Create another employee without conflict
      const employee4 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Four',
          email: 'employee4@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee4.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: swapShift.id,
          toEmployeeId: employee4.id,
        },
      });

      t.equal(response.statusCode, 201, 'Returns 201 Created');
      const body = getData(response);
      t.equal(body.status, 'PENDING', 'Request is pending');
      t.equal(body.requestorEmployeeId, employee1.id, 'Requestor is employee1');
      t.equal(body.toEmployeeId, employee4.id, 'Target is employee4');
      t.equal(body.fromShiftPlanId, swapShift.id, 'Correct shift ID');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { fromShiftPlanId: swapShift.id },
      });
      await prisma.wfmShiftAssignment.deleteMany({
        where: { shiftPlanId: swapShift.id },
      });
      await prisma.wfmShiftPlan.delete({ where: { id: swapShift.id } });
      await prisma.employee.delete({ where: { id: employee4.id } });
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests - Cannot create swap request for shift not assigned to requester',
    async (t) => {
      // Try to create swap request for a shift assigned to employee2
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: conflictShift.id, // Assigned to employee2, not employee1
          toEmployeeId: employee2.id,
        },
      });

      t.equal(response.statusCode, 403, 'Returns 403 Forbidden');
      const body = getData(response);
      t.match(body.message, /not assigned to you/i, 'Error indicates not assigned');
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests - Cannot create swap if target employee not eligible',
    async (t) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee3.id, // employee3 is not assigned to jobRole
        },
      });

      t.equal(response.statusCode, 409, 'Returns 409 Conflict');
      const body = getData(response);
      t.match(body.message, /not eligible/i, 'Error indicates ineligibility');
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests - Cannot create if target employee has overlap',
    async (t) => {
      // employee2 has conflictShift that overlaps with shift1
      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee2.id, // employee2 has overlapping shift
        },
      });

      t.equal(response.statusCode, 409, 'Returns 409 Conflict');
      const body = getData(response);
      t.match(body.message, /overlap|assigned to shift/i, 'Error indicates overlap');
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests - Idempotent: returns existing pending request',
    async (t) => {
      // Create a new employee without conflicts
      const employee5 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Five',
          email: 'employee5@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee5.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      // First request
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee5.id,
        },
      });

      t.equal(response1.statusCode, 201, 'First request created');
      const request1 = getData(response1);

      // Second identical request
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee5.id,
        },
      });

      t.equal(response2.statusCode, 201, 'Second request succeeds');
      const request2 = getData(response2);
      t.equal(request2.id, request1.id, 'Returns same request ID (idempotent)');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request1.id },
      });
      await prisma.employee.delete({ where: { id: employee5.id } });
    }
  );

  // ========== Swap Request Cancellation Tests ==========

  await t.test(
    'POST /api/scheduling/v2/swap-requests/:id/cancel - Employee can cancel own pending request',
    async (t) => {
      // Create a new employee
      const employee6 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Six',
          email: 'employee6@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee6.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      // Create swap request
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee6.id,
        },
      });

      const request = getData(createResponse);

      // Cancel the request
      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/swap-requests/${request.id}/cancel`,
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(cancelResponse.statusCode, 200, 'Returns 200 OK');
      const canceled = getData(cancelResponse);
      t.equal(canceled.status, 'CANCELED', 'Status is CANCELED');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request.id },
      });
      await prisma.employee.delete({ where: { id: employee6.id } });
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests/:id/cancel - Cannot cancel request after approval',
    async (t) => {
      // Create a new employee
      const employee7 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Seven',
          email: 'employee7@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee7.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      // Create swap request
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee7.id,
        },
      });

      const request = getData(createResponse);

      // Manager approves the request
      const approveResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/requests/${request.id}/approve`,
        headers: managerHeaders,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(approveResponse.statusCode, 200, 'Manager approves request');

      // Try to cancel after approval
      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/swap-requests/${request.id}/cancel`,
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(cancelResponse.statusCode, 409, 'Returns 409 Conflict');
      const body = getData(cancelResponse);
      t.match(body.message, /already decided/i, 'Error indicates already decided');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request.id },
      });
      await prisma.wfmShiftAssignment.deleteMany({
        where: { shiftPlanId: shift1.id, employeeId: employee7.id },
      });
      await prisma.employee.delete({ where: { id: employee7.id } });
    }
  );

  await t.test(
    'POST /api/scheduling/v2/swap-requests/:id/cancel - Cannot cancel another employee\'s request',
    async (t) => {
      // Create a new employee
      const employee8 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Eight',
          email: 'employee8@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee8.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      // employee1 creates swap request
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee8.id,
        },
      });

      const request = getData(createResponse);

      // employee2 tries to cancel employee1's request
      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/swap-requests/${request.id}/cancel`,
        headers: employee2Headers,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(cancelResponse.statusCode, 403, 'Returns 403 Forbidden');
      const body = getData(cancelResponse);
      t.match(body.message, /only cancel your own/i, 'Error indicates ownership required');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request.id },
      });
      await prisma.employee.delete({ where: { id: employee8.id } });
    }
  );

  // ========== Manager Approval Tests ==========

  await t.test(
    'POST /api/scheduling/v2/requests/:id/approve - Manager approval reassigns shift transactionally',
    async (t) => {
      // Create a new employee
      const employee9 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Nine',
          email: 'employee9@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee9.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      await ensureEmployee1Assignment();

      // Create swap request
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee9.id,
        },
      });

      const request = getData(createResponse);

      // Manager approves the request
      const approveResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/requests/${request.id}/approve`,
        headers: managerHeaders,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(approveResponse.statusCode, 200, 'Returns 200 OK');
      const result = getData(approveResponse);
      t.equal(result.request.status, 'APPROVED', 'Request is approved');
      t.equal(result.shift.assignmentEmployeeIds.length, 1, 'Shift has one assignment');
      t.equal(result.shift.assignmentEmployeeIds[0], employee9.id, 'Shift assigned to employee9');

      // Verify employee1 is no longer assigned
      const assignmentsAfter = await prisma.wfmShiftAssignment.findMany({
        where: {
          shiftPlanId: shift1.id,
          tenantId: tenant.id,
        },
      });

      t.equal(assignmentsAfter.length, 1, 'Only one assignment exists');
      t.equal(assignmentsAfter[0].employeeId, employee9.id, 'Assignment is to employee9');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request.id },
      });
      await prisma.wfmShiftAssignment.deleteMany({
        where: { shiftPlanId: shift1.id, employeeId: employee9.id },
      });
      await prisma.employee.delete({ where: { id: employee9.id } });

      // Restore original assignment
      await prisma.wfmShiftAssignment.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          shiftPlanId: shift1.id,
          employeeId: employee1.id,
          assignedByUserId: manager.id,
          assignedAt: new Date(),
        },
      });
    }
  );

  await t.test(
    'POST /api/scheduling/v2/requests/:id/approve - Approval fails if requestor no longer assigned',
    async (t) => {
      // Create a new employee
      const employee10 = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          firstName: 'Employee',
          lastName: 'Ten',
          email: 'employee10@test.com',
          isActive: true,
        },
      });

      await prisma.employeeJobAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee10.id,
          jobRoleId: jobRole.id,
          startDate: new Date('2026-01-01'),
        },
      });

      await ensureEmployee1Assignment();

      // Create swap request
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduling/v2/swap-requests',
        headers: employee1Headers,
        payload: {
          propertyId: property.id,
          fromShiftPlanId: shift1.id,
          toEmployeeId: employee10.id,
        },
      });

      const request = getData(createResponse);

      // Manually remove employee1's assignment (simulating race condition)
      await prisma.wfmShiftAssignment.deleteMany({
        where: {
          shiftPlanId: shift1.id,
          employeeId: employee1.id,
        },
      });

      // Manager tries to approve
      const approveResponse = await app.inject({
        method: 'POST',
        url: `/api/scheduling/v2/requests/${request.id}/approve`,
        headers: managerHeaders,
        payload: {
          propertyId: property.id,
        },
      });

      t.equal(approveResponse.statusCode, 409, 'Returns 409 Conflict');
      const body = getData(approveResponse);
      t.match(body.message, /no longer assigned/i, 'Error indicates requestor not assigned');

      // Cleanup
      await prisma.wfmSwapRequest.deleteMany({
        where: { id: request.id },
      });
      await prisma.employee.delete({ where: { id: employee10.id } });

      // Restore original assignment
      await prisma.wfmShiftAssignment.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          shiftPlanId: shift1.id,
          employeeId: employee1.id,
          assignedByUserId: manager.id,
          assignedAt: new Date(),
        },
      });
    }
  );

  // ========== Cleanup ==========

  await t.teardown(async () => {
    await app.close();

    // Cleanup in reverse FK dependency order
    await prisma.wfmSwapRequest.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.wfmShiftAssignment.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.wfmShiftPlan.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.wfmSchedulePeriod.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.employeeJobAssignment.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.employee.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.user.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.jobRole.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.jobCategory.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.department.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.division.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.departmentCategory.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.property.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.role.deleteMany({
      where: { name: 'Swap Test Manager' },
    });
    await prisma.tenant.delete({
      where: { id: tenant.id },
    });
  });
});

/**
 * Security Test Suite: Scheduling V2 Availability Workflows
 *
 * Ensures proper authorization, tenant scoping, and access control for
 * employee self-service availability and manager-scoped visibility.
 */
test('Scheduling V2: Availability Workflows', async (t) => {
  const config = {
    port: 3005,
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

  // Create tenant and property
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Availability Test Tenant',
      slug: `availability-test-${Date.now()}`,
    },
  });

  const property = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Test Property',
    },
  });

  // Create test employees
  const employee2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      firstName: 'Employee',
      lastName: 'Two',
      isActive: true,
    },
  });

  // Create test users
  const employeeUser = await createTestUser(prisma, {
    tenantId: tenant.id,
    propertyId: property.id,
    email: 'availability-employee@test.com',
    name: 'Availability Employee',
  });

  const managerUser = await createTestUser(prisma, {
    tenantId: tenant.id,
    propertyId: property.id,
    email: 'availability-manager@test.com',
    name: 'Availability Manager',
  });

  // Build auth headers for personas
  const employeeHeaders = buildPersonaHeaders('employee', {
    tenantId: tenant.id,
    userId: employeeUser.id,
  });

  const managerHeaders = buildPersonaHeaders('departmentManager', {
    tenantId: tenant.id,
    userId: managerUser.id,
  });

  t.teardown(async () => {
    await app.close();
    await prisma.wfmAvailability.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.employee.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['availability-employee@test.com', 'availability-manager@test.com'] } },
    });
    await prisma.property.deleteMany({
      where: { tenantId: tenant.id },
    });
    await prisma.tenant.delete({
      where: { id: tenant.id },
    });
  });

  // ========== Employee Self-Service Tests ==========

  await t.test('Employee can create and list own availability', async (t) => {
    const availDate = new Date('2026-03-15');

    // Create availability entry as self
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0], // YYYY-MM-DD
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
      },
    });

    t.equal(createResponse.statusCode, 201, 'Create availability returns 201');
    const createData = getData(createResponse);
    t.ok(createData.id, 'Response includes availability ID');
    t.equal(createData.startTime, '09:00', 'Start time matches');
    t.equal(createData.endTime, '17:00', 'End time matches');
    t.equal(createData.type, 'AVAILABLE', 'Type matches');

    // List own availability
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/availability?propertyId=${property.id}&start=${new Date('2026-03-01').toISOString()}&end=${new Date('2026-03-31').toISOString()}`,
      headers: employeeHeaders,
    });

    t.equal(listResponse.statusCode, 200, 'List availability returns 200');
    const listData = getData(listResponse);
    t.ok(Array.isArray(listData), 'Response is array');
    t.equal(listData.length, 1, 'Returns 1 availability entry');
    t.equal(listData[0].id, createData.id, 'Listed entry matches created entry');
  });

  await t.test('Employee cannot list another employee\'s availability without permission', async (t) => {
    // Employee tries to list another employee's availability
    const response = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/availability?propertyId=${property.id}&employeeId=${employee2.id}`,
      headers: employeeHeaders,
    });

    t.equal(response.statusCode, 403, 'Returns 403 Forbidden');
    const body = getData(response);
    t.match(body.message, /Forbidden|permission/i, 'Error indicates forbidden action');
  });

  await t.test('Invalid time range (startTime >= endTime) returns 400', async (t) => {
    const availDate = new Date('2026-03-15');

    // Create with invalid time range
    const response = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '17:00',
        endTime: '09:00', // Before start time
        type: 'AVAILABLE',
      },
    });

    t.equal(response.statusCode, 400, 'Returns 400 Bad Request');
    const body = getData(response);
    t.match(body.message, /startTime|before/i, 'Error indicates time validation failure');
  });

  await t.test('Employee can delete their own availability', async (t) => {
    const availDate = new Date('2026-03-16');

    // Create availability
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
      },
    });

    const createdId = getData(createResponse).id;

    // Delete it
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/scheduling/v2/availability/${createdId}?propertyId=${property.id}`,
      headers: employeeHeaders,
    });

    t.equal(deleteResponse.statusCode, 200, 'Delete returns 200');
    const deleteData = getData(deleteResponse);
    t.equal(deleteData.success, true, 'Success flag is true');

    // Verify it's deleted
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/availability?propertyId=${property.id}`,
      headers: employeeHeaders,
    });

    const listData = getData(listResponse);
    t.ok(!listData.some((a: { id: string }) => a.id === createdId), 'Availability entry is deleted');
  });

  // ========== Manager Access Control Tests ==========

  await t.test('Manager with scheduling.view can list employee availability', async (t) => {
    const availDate = new Date('2026-03-17');

    // First, employee creates availability
    await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '18:00',
        type: 'UNAVAILABLE',
      },
    });

    // Manager lists employee's availability (manager has scheduling.view)
    const response = await app.inject({
      method: 'GET',
      url: `/api/scheduling/v2/availability?propertyId=${property.id}&employeeId=${employeeUser.id}`,
      headers: managerHeaders,
    });

    t.equal(response.statusCode, 200, 'Manager can list employee availability');
    const data = getData(response);
    t.ok(data.length > 0, 'Returns availability entries');
  });

  await t.test('Manager can create availability for scoped employee with scheduling.manage.availability', async (t) => {
    const availDate = new Date('2026-03-18');

    // Create availability for another employee as manager
    const response = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: managerHeaders,
      payload: {
        propertyId: property.id,
        employeeId: employeeUser.id, // Different employee
        date: availDate.toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '16:00',
        type: 'PREFERRED',
      },
    });

    t.equal(response.statusCode, 201, 'Manager can create availability for employee');
    const data = getData(response);
    t.equal(data.type, 'PREFERRED', 'Type set correctly');
  });

  await t.test('Manager can delete employee availability with permission', async (t) => {
    const availDate = new Date('2026-03-19');

    // Employee creates availability
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
      },
    });

    const createdId = getData(createResponse).id;

    // Manager deletes it
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/scheduling/v2/availability/${createdId}?propertyId=${property.id}`,
      headers: managerHeaders,
    });

    t.equal(deleteResponse.statusCode, 200, 'Manager can delete employee availability');
  });

  // ========== Tenant Isolation Tests ==========

  await t.test('Availability entries are tenant-scoped', async (t) => {
    const availDate = new Date('2026-03-20');

    // Create availability as employee
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
      },
    });

    t.equal(createResponse.statusCode, 201, 'Created availability');

    // Verify entry was created with correct tenant ID
    const entries = await prisma.wfmAvailability.findMany({
      where: { tenantId: tenant.id },
    });

    t.ok(entries.length > 0, 'Availability entry stored in database');
    t.equal(entries[0].tenantId, tenant.id, 'Entry has correct tenant ID');
  });

  // ========== Recurrence Rule Storage Tests ==========

  await t.test('Recurrence rule is stored as-is (not expanded)', async (t) => {
    const availDate = new Date('2026-03-21');
    const recurrenceRule = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: employeeHeaders,
      payload: {
        propertyId: property.id,
        date: availDate.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
        recurrenceRule,
      },
    });

    t.equal(createResponse.statusCode, 201, 'Created availability with recurrence rule');
    const data = getData(createResponse);
    t.equal(data.recurrenceRule, recurrenceRule, 'Recurrence rule returned as-is');

    // Verify in database
    const entry = await prisma.wfmAvailability.findUnique({
      where: { id: data.id },
    });

    t.equal(entry?.recurrenceRule, recurrenceRule, 'Recurrence rule stored in database as-is');
  });

  // ========== Missing Employee Error Tests ==========

  await t.test('Create availability for non-existent employee returns 404', async (t) => {
    const availDate = new Date('2026-03-22');
    const fakeEmployeeId = 'nonexistent-employee-id';

    const response = await app.inject({
      method: 'POST',
      url: '/api/scheduling/v2/availability',
      headers: managerHeaders,
      payload: {
        propertyId: property.id,
        employeeId: fakeEmployeeId,
        date: availDate.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        type: 'AVAILABLE',
      },
    });

    t.equal(response.statusCode, 404, 'Returns 404 for non-existent employee');
    const body = getData(response);
    t.match(body.message, /not found|Employee/i, 'Error indicates employee not found');
  });

  // ========== Delete Non-Existent Entry Tests ==========

  await t.test('Delete non-existent availability returns 404', async (t) => {
    const fakeId = 'nonexistent-id';

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/scheduling/v2/availability/${fakeId}?propertyId=${property.id}`,
      headers: employeeHeaders,
    });

    t.equal(response.statusCode, 404, 'Returns 404 for non-existent availability');
  });

  // ========== Cleanup ==========

  await t.teardown(async () => {
    await app.close();
  });
});

