#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
  console.log('🌱 Seeding comprehensive test data...\n');

  // Get the existing user and tenant
  const user = await prisma.user.findFirst({
    where: { email: 'kballew@unifocus.com' },
  });

  if (!user) {
    console.log('❌ User kballew@unifocus.com not found!');
    process.exit(1);
  }

  const tenantId = user.tenantId;
  console.log(`📋 Tenant ID: ${tenantId}\n`);

  // Clean up existing test data (keep the user and tenant)
  console.log('🧹 Cleaning existing data...');
  await prisma.wfmShiftAssignment.deleteMany({ where: { tenantId } });
  await prisma.wfmShiftPlan.deleteMany({ where: { tenantId } });
  await prisma.wfmSchedulePeriod.deleteMany({ where: { tenantId } });
  await prisma.wfmAvailability.deleteMany({ where: { tenantId } });
  await prisma.shift.deleteMany({ where: { tenantId } });
  await prisma.schedule.deleteMany({ where: { tenantId } });
  await prisma.punch.deleteMany({ where: { tenantId } });
  await prisma.exception.deleteMany({ where: { tenantId } });
  await prisma.employee.deleteMany({ where: { tenantId } });
  await prisma.jobAssignment.deleteMany({ where: { tenantId } });
  await prisma.jobRole.deleteMany({ where: { tenantId } });
  await prisma.department.deleteMany({ where: { tenantId } });
  await prisma.division.deleteMany({ where: { tenantId } });
  await prisma.property.deleteMany({ where: { tenantId } });
  await prisma.jobCategory.deleteMany({ where: { tenantId } });
  await prisma.departmentCategory.deleteMany({ where: { tenantId } });

  // Create Properties
  console.log('\n🏨 Creating properties...');

  // All feature flags enabled for test properties
  const allFeatures = {
    scheduling_v2: true,
    time_clock: true,
    timecard: true,
    exceptions_queue: true,
    hr_management: true,
    org_structure: true,
    user_administration: true,
    properties_management: true,
    advanced_reporting: true,
    mobile_access: true,
    labor_compliance: true,
    shift_swaps: true,
    availability_management: true,
    schedule_templates: true,
    auto_scheduling: true,
  };

  const properties = await Promise.all([
    prisma.property.create({
      data: {
        tenantId,
        name: 'Grand Hotel San Francisco',
        address: '123 Market Street',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        features: allFeatures,
      },
    }),
    prisma.property.create({
      data: {
        tenantId,
        name: 'Coastal Resort',
        address: '456 Ocean Avenue',
        city: 'Santa Monica',
        state: 'CA',
        zipCode: '90401',
        features: allFeatures,
      },
    }),
    prisma.property.create({
      data: {
        tenantId,
        name: 'Downtown Plaza Hotel',
        address: '789 Broadway',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90012',
        features: allFeatures,
      },
    }),
  ]);
  console.log(`   ✓ Created ${properties.length} properties with all features enabled`);

  const [grandHotel, coastalResort, _downtownPlaza] = properties;

  // Create Department and Job Categories
  console.log('\n🏢 Creating organizational structure...');
  const departmentCategories = await Promise.all([
    prisma.departmentCategory.create({
      data: { tenantId, name: 'Rooms', code: 'ROOMS', isActive: true },
    }),
    prisma.departmentCategory.create({
      data: { tenantId, name: 'Food & Beverage', code: 'F&B', isActive: true },
    }),
    prisma.departmentCategory.create({
      data: { tenantId, name: 'Administration', code: 'ADMIN', isActive: true },
    }),
  ]);

  const jobCategories = await Promise.all([
    prisma.jobCategory.create({
      data: { tenantId, name: 'Housekeeping', code: 'HSKP', isActive: true },
    }),
    prisma.jobCategory.create({
      data: { tenantId, name: 'Front Desk', code: 'FD', isActive: true },
    }),
    prisma.jobCategory.create({
      data: { tenantId, name: 'Restaurant', code: 'REST', isActive: true },
    }),
    prisma.jobCategory.create({
      data: { tenantId, name: 'Management', code: 'MGMT', isActive: true },
    }),
  ]);

  // Create Divisions and Departments for Grand Hotel
  console.log('   Creating divisions and departments...');
  const roomsDivision = await prisma.division.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      name: 'Rooms Division',
      code: 'ROOMS',
    },
  });

  const fnbDivision = await prisma.division.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      name: 'Food & Beverage Division',
      code: 'FNB',
    },
  });

  const housekeepingDept = await prisma.department.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      divisionId: roomsDivision.id,
      departmentCategoryId: departmentCategories[0].id,
      name: 'Housekeeping',
      code: 'HSKP',
      costCenter: '1100',
    },
  });

  const frontDeskDept = await prisma.department.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      divisionId: roomsDivision.id,
      departmentCategoryId: departmentCategories[0].id,
      name: 'Front Desk',
      code: 'FD',
      costCenter: '1200',
    },
  });

  const restaurantDept = await prisma.department.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      divisionId: fnbDivision.id,
      departmentCategoryId: departmentCategories[1].id,
      name: 'Restaurant',
      code: 'REST',
      costCenter: '2100',
    },
  });

  // Create Job Roles
  console.log('   Creating job roles...');
  const _roomAttendantRole = await prisma.jobRole.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      departmentId: housekeepingDept.id,
      jobCategoryId: jobCategories[0].id,
      name: 'Room Attendant',
      code: 'RA',
      isActive: true,
      flsaStatus: 'non-exempt',
      payCode: 'HOURLY',
    },
  });

  const _housekeepingSupervisorRole = await prisma.jobRole.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      departmentId: housekeepingDept.id,
      jobCategoryId: jobCategories[0].id,
      name: 'Housekeeping Supervisor',
      code: 'HSKP-SUP',
      isActive: true,
      flsaStatus: 'exempt',
      payCode: 'SALARY',
    },
  });

  const _frontDeskAgentRole = await prisma.jobRole.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      departmentId: frontDeskDept.id,
      jobCategoryId: jobCategories[1].id,
      name: 'Front Desk Agent',
      code: 'FDA',
      isActive: true,
      flsaStatus: 'non-exempt',
      payCode: 'HOURLY',
    },
  });

  const _serverRole = await prisma.jobRole.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      departmentId: restaurantDept.id,
      jobCategoryId: jobCategories[2].id,
      name: 'Server',
      code: 'SRV',
      isActive: true,
      flsaStatus: 'non-exempt',
      payCode: 'HOURLY',
    },
  });

  const _bartenderRole = await prisma.jobRole.create({
    data: {
      tenantId,
      propertyId: grandHotel.id,
      departmentId: restaurantDept.id,
      jobCategoryId: jobCategories[2].id,
      name: 'Bartender',
      code: 'BAR',
      isActive: true,
      flsaStatus: 'non-exempt',
      payCode: 'HOURLY',
    },
  });

  console.log(`   ✓ Created organizational structure`);

  // Create Employees
  console.log('\n👥 Creating employees...');
  const employees = await Promise.all([
    // Housekeeping Staff
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP001',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.garcia@example.test',
        phone: '415-555-0101',
        hireDate: new Date('2023-06-15'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP002',
        firstName: 'James',
        lastName: 'Wilson',
        email: 'james.wilson@example.test',
        phone: '415-555-0102',
        hireDate: new Date('2023-07-20'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP003',
        firstName: 'Lisa',
        lastName: 'Chen',
        email: 'lisa.chen@example.test',
        phone: '415-555-0103',
        hireDate: new Date('2022-03-10'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP004',
        firstName: 'Carlos',
        lastName: 'Rodriguez',
        email: 'carlos.rodriguez@example.test',
        phone: '415-555-0104',
        hireDate: new Date('2024-01-05'),
        isActive: true,
      },
    }),
    // Front Desk Staff
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP005',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.test',
        phone: '415-555-0105',
        hireDate: new Date('2023-09-12'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP006',
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'michael.brown@example.test',
        phone: '415-555-0106',
        hireDate: new Date('2023-11-01'),
        isActive: true,
      },
    }),
    // Restaurant Staff
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP007',
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@example.test',
        phone: '415-555-0107',
        hireDate: new Date('2023-05-20'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP008',
        firstName: 'David',
        lastName: 'Martinez',
        email: 'david.martinez@example.test',
        phone: '415-555-0108',
        hireDate: new Date('2024-02-14'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP009',
        firstName: 'Jessica',
        lastName: 'Taylor',
        email: 'jessica.taylor@example.test',
        phone: '415-555-0109',
        hireDate: new Date('2022-08-30'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP010',
        firstName: 'Robert',
        lastName: 'Anderson',
        email: 'robert.anderson@example.test',
        phone: '415-555-0110',
        hireDate: new Date('2023-10-15'),
        isActive: true,
      },
    }),
    // Supervisor
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: 'EMP011',
        firstName: 'Jennifer',
        lastName: 'White',
        email: 'jennifer.white@example.test',
        phone: '415-555-0111',
        hireDate: new Date('2021-04-01'),
        isActive: true,
      },
    }),
    // Coastal Resort employees
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: coastalResort.id,
        employeeId: 'EMP101',
        firstName: 'Alex',
        lastName: 'Thompson',
        email: 'alex.thompson@example.test',
        phone: '310-555-0201',
        hireDate: new Date('2023-03-15'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        tenantId,
        propertyId: coastalResort.id,
        employeeId: 'EMP102',
        firstName: 'Sophia',
        lastName: 'Lee',
        email: 'sophia.lee@example.test',
        phone: '310-555-0202',
        hireDate: new Date('2023-06-20'),
        isActive: true,
      },
    }),
  ]);
  console.log(`   ✓ Created ${employees.length} employees`);

  // Create Schedules for employees
  console.log('\n📅 Creating schedules...');
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const schedules = await Promise.all([
    // Maria Garcia - Room Attendant schedule
    prisma.schedule.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: employees[0].id,
        startDate: oneMonthAgo.toISOString(),
        name: 'Standard Housekeeping Schedule',
        isActive: true,
        shifts: {
          create: [
            { tenantId, dayOfWeek: 1, startTime: '08:00', endTime: '16:30', breakMinutes: 30 },
            { tenantId, dayOfWeek: 2, startTime: '08:00', endTime: '16:30', breakMinutes: 30 },
            { tenantId, dayOfWeek: 3, startTime: '08:00', endTime: '16:30', breakMinutes: 30 },
            { tenantId, dayOfWeek: 4, startTime: '08:00', endTime: '16:30', breakMinutes: 30 },
            { tenantId, dayOfWeek: 5, startTime: '08:00', endTime: '16:30', breakMinutes: 30 },
          ],
        },
      },
    }),
    // Sarah Johnson - Front Desk schedule (includes weekends)
    prisma.schedule.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: employees[4].id,
        startDate: oneMonthAgo.toISOString(),
        name: 'Front Desk Morning Shift',
        isActive: true,
        shifts: {
          create: [
            { tenantId, dayOfWeek: 0, startTime: '07:00', endTime: '15:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 2, startTime: '07:00', endTime: '15:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 4, startTime: '07:00', endTime: '15:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 6, startTime: '07:00', endTime: '15:00', breakMinutes: 30 },
          ],
        },
      },
    }),
    // Emily Davis - Server schedule
    prisma.schedule.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        employeeId: employees[6].id,
        startDate: oneMonthAgo.toISOString(),
        name: 'Evening Server Schedule',
        isActive: true,
        shifts: {
          create: [
            { tenantId, dayOfWeek: 3, startTime: '17:00', endTime: '23:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 4, startTime: '17:00', endTime: '23:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 5, startTime: '17:00', endTime: '01:00', breakMinutes: 30 },
            { tenantId, dayOfWeek: 6, startTime: '17:00', endTime: '01:00', breakMinutes: 30 },
          ],
        },
      },
    }),
  ]);
  console.log(`   ✓ Created ${schedules.length} schedules`);

  // Create Time Punches
  console.log('\n⏰ Creating time punches...');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayMorning = new Date(yesterday);
  yesterdayMorning.setHours(7, 58, 0, 0);

  const yesterdayNoon = new Date(yesterday);
  yesterdayNoon.setHours(12, 0, 0, 0);

  const yesterdayNoonEnd = new Date(yesterday);
  yesterdayNoonEnd.setHours(12, 30, 0, 0);

  const yesterdayEvening = new Date(yesterday);
  yesterdayEvening.setHours(16, 35, 0, 0);

  const todayMorning = new Date(today);
  todayMorning.setHours(6, 55, 0, 0);

  const punches = await Promise.all([
    // Maria Garcia - worked yesterday
    prisma.punch.create({
      data: {
        tenantId,
        employeeId: employees[0].id,
        type: 'in',
        timestamp: yesterdayMorning,
      },
    }),
    prisma.punch.create({
      data: {
        tenantId,
        employeeId: employees[0].id,
        type: 'break_start',
        timestamp: yesterdayNoon,
      },
    }),
    prisma.punch.create({
      data: {
        tenantId,
        employeeId: employees[0].id,
        type: 'break_end',
        timestamp: yesterdayNoonEnd,
      },
    }),
    prisma.punch.create({
      data: {
        tenantId,
        employeeId: employees[0].id,
        type: 'out',
        timestamp: yesterdayEvening,
      },
    }),
    // Sarah Johnson - working today
    prisma.punch.create({
      data: {
        tenantId,
        employeeId: employees[4].id,
        type: 'in',
        timestamp: todayMorning,
      },
    }),
  ]);
  console.log(`   ✓ Created ${punches.length} time punches`);

  // Create Exceptions
  console.log('\n⚠️  Creating exceptions...');
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const exceptions = await Promise.all([
    prisma.exception.create({
      data: {
        tenantId,
        employeeId: employees[1].id,
        type: 'late_arrival',
        reason: 'Traffic delay',
        date: new Date(yesterday),
        status: 'pending',
      },
    }),
    prisma.exception.create({
      data: {
        tenantId,
        employeeId: employees[2].id,
        type: 'time_off_request',
        reason: 'Medical appointment',
        date: nextWeek,
        status: 'pending',
      },
    }),
    prisma.exception.create({
      data: {
        tenantId,
        employeeId: employees[6].id,
        type: 'overtime',
        reason: 'Busy evening service',
        date: twoDaysAgo,
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    }),
  ]);
  console.log(`   ✓ Created ${exceptions.length} exceptions`);

  // Create Schedule Periods (for Scheduling V2)
  console.log('\n📋 Creating schedule periods...');
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextPeriodStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextPeriodEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const schedulePeriods = await Promise.all([
    // Current period - Published
    prisma.wfmSchedulePeriod.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'PUBLISHED',
        name: `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`,
        createdByUserId: user.id,
      },
    }),
    // Next period - Draft
    prisma.wfmSchedulePeriod.create({
      data: {
        tenantId,
        propertyId: grandHotel.id,
        startDate: nextPeriodStart,
        endDate: nextPeriodEnd,
        status: 'DRAFT',
        name: `${nextPeriodStart.toLocaleString('default', { month: 'long' })} ${nextPeriodStart.getFullYear()}`,
        createdByUserId: user.id,
      },
    }),
    // Coastal Resort - Published period
    prisma.wfmSchedulePeriod.create({
      data: {
        tenantId,
        propertyId: coastalResort.id,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'PUBLISHED',
        name: `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`,
        createdByUserId: user.id,
      },
    }),
  ]);
  console.log(`   ✓ Created ${schedulePeriods.length} schedule periods`);

  // Summary
  console.log('\n✅ Test data seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`   • Properties: ${properties.length}`);
  console.log(`   • Employees: ${employees.length}`);
  console.log(`   • Departments: 3`);
  console.log(`   • Job Roles: 5`);
  console.log(`   • Schedules: ${schedules.length}`);
  console.log(`   • Time Punches: ${punches.length}`);
  console.log(`   • Exceptions: ${exceptions.length}`);
  console.log(`   • Schedule Periods: ${schedulePeriods.length}`);
  console.log('\n🎯 Test Data by Property:');
  console.log(
    `   • Grand Hotel San Francisco: ${employees.filter((e) => e.propertyId === grandHotel.id).length} employees`
  );
  console.log(
    `   • Coastal Resort: ${employees.filter((e) => e.propertyId === coastalResort.id).length} employees`
  );
  console.log(`   • Downtown Plaza Hotel: 0 employees (available for testing)`);
  console.log('\n🔄 Refresh your browser to see all the test data!');

  await prisma.$disconnect();
}

seedTestData().catch((error) => {
  console.error('❌ Error seeding test data:', error);
  process.exit(1);
});
