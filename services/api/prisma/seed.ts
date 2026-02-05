import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a demo tenant
  console.log('Creating demo tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Tenant',
      slug: 'demo-tenant',
    },
  });
  console.log(`✓ Created tenant: ${tenant.name} (${tenant.id})`);

  // Create properties
  console.log('Creating properties...');
  const property1 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Hyatt Regency Times Square',
      address: '1633 Broadway',
      city: 'New York',
      state: 'NY',
      zipCode: '10019',
    },
  });
  console.log(`✓ Created property: ${property1.name}`);

  const property2 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Beverly Hills Hotel',
      address: '9641 Sunset Boulevard',
      city: 'Beverly Hills',
      state: 'CA',
      zipCode: '90210',
    },
  });
  console.log(`✓ Created property: ${property2.name}`);

  const property3 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'The Fairmont Chicago',
      address: '200 North Columbus Drive',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
    },
  });
  console.log(`✓ Created property: ${property3.name}`);

  const property4 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'The Plaza Hotel Miami',
      address: '168 East Flagler Street',
      city: 'Miami',
      state: 'FL',
      zipCode: '33131',
    },
  });
  console.log(`✓ Created property: ${property4.name}`);

  const property5 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Brown Palace Hotel',
      address: '321 17th Street',
      city: 'Denver',
      state: 'CO',
      zipCode: '80202',
    },
  });
  console.log(`✓ Created property: ${property5.name}`);

  // Create departments
  console.log('Creating departments...');
  const dept1 = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      name: 'Engineering',
      code: 'ENG',
    },
  });
  console.log(`✓ Created department: ${dept1.name}`);

  const dept2 = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      name: 'Sales',
      code: 'SALES',
    },
  });
  console.log(`✓ Created department: ${dept2.name}`);

  // Create roles
  console.log('Creating roles...');
  const platformAdminRole = await prisma.role.create({
    data: {
      name: 'Platform Administrator',
      description: 'Full system access across all tenants',
      permissions: ['*'],
    },
  });
  console.log(`✓ Created role: ${platformAdminRole.name}`);

  const propertyAdminRole = await prisma.role.create({
    data: {
      name: 'Property Administrator',
      description: 'Full property-level configuration and operations',
      permissions: [
        'read:*',
        'write:*',
        'delete:*',
        'manage:property',
        'manage:departments',
        'manage:schedules',
        'approve:timecards',
      ],
    },
  });
  console.log(`✓ Created role: ${propertyAdminRole.name}`);

  const hrManagerRole = await prisma.role.create({
    data: {
      name: 'HR Manager',
      description: 'Manage employee lifecycle and compliance',
      permissions: [
        'read:employees',
        'write:employees',
        'delete:employees',
        'manage:onboarding',
        'manage:certifications',
        'manage:documents',
        'read:compliance',
        'write:compliance',
      ],
    },
  });
  console.log(`✓ Created role: ${hrManagerRole.name}`);

  const departmentManagerRole = await prisma.role.create({
    data: {
      name: 'Department Manager',
      description: 'Manage department schedules and timecards',
      permissions: [
        'read:employees',
        'read:schedules',
        'write:schedules',
        'read:punches',
        'approve:timecards',
        'read:exceptions',
        'write:exceptions',
        'approve:pto',
      ],
    },
  });
  console.log(`✓ Created role: ${departmentManagerRole.name}`);

  const employeeRole = await prisma.role.create({
    data: {
      name: 'Employee',
      description: 'Basic employee self-service access',
      permissions: ['read:own_punches', 'write:own_punches', 'read:own_schedule', 'request:pto'],
    },
  });
  console.log(`✓ Created role: ${employeeRole.name}`);

  // Create users
  console.log('Creating users...');
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.unifocus.com',
      name: 'Ava Developer',
      isActive: true,
    },
  });
  console.log(`✓ Created user: ${adminUser.name}`);

  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      departmentId: dept1.id,
      email: 'manager@demo.unifocus.com',
      name: 'John Manager',
      isActive: true,
    },
  });
  console.log(`✓ Created user: ${managerUser.name}`);

  // Create user role assignments
  console.log('Creating user role assignments...');
  await prisma.userRoleAssignment.create({
    data: {
      tenantId: tenant.id,
      userId: adminUser.id,
      roleId: platformAdminRole.id,
      isActive: true,
    },
  });
  console.log('✓ Assigned Platform Administrator role to admin user');

  await prisma.userRoleAssignment.create({
    data: {
      tenantId: tenant.id,
      userId: managerUser.id,
      roleId: departmentManagerRole.id,
      propertyId: property1.id,
      departmentId: dept1.id,
      isActive: true,
    },
  });
  console.log('✓ Assigned Department Manager role to manager user');

  // Create employees
  console.log('Creating employees...');
  const employee1 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@demo.unifocus.com',
      phone: '555-0101',
      hireDate: new Date('2023-01-15'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee1.firstName} ${employee1.lastName}`);

  const employee2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob.smith@demo.unifocus.com',
      phone: '555-0102',
      hireDate: new Date('2023-03-20'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee2.firstName} ${employee2.lastName}`);

  const employee3 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      firstName: 'Carol',
      lastName: 'White',
      email: 'carol.white@demo.unifocus.com',
      phone: '555-0103',
      hireDate: new Date('2023-06-01'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee3.firstName} ${employee3.lastName}`);

  const employee4 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      firstName: 'David',
      lastName: 'Martinez',
      email: 'david.martinez@demo.unifocus.com',
      phone: '555-0104',
      hireDate: new Date('2022-11-10'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee4.firstName} ${employee4.lastName}`);

  const employee5 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      firstName: 'Emma',
      lastName: 'Davis',
      email: 'emma.davis@demo.unifocus.com',
      phone: '555-0105',
      hireDate: new Date('2024-01-05'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee5.firstName} ${employee5.lastName}`);

  const employee6 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      firstName: 'Frank',
      lastName: 'Wilson',
      email: 'frank.wilson@demo.unifocus.com',
      phone: '555-0106',
      hireDate: new Date('2023-08-15'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee6.firstName} ${employee6.lastName}`);

  const employee7 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      firstName: 'Grace',
      lastName: 'Taylor',
      email: 'grace.taylor@demo.unifocus.com',
      phone: '555-0107',
      hireDate: new Date('2023-09-20'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee7.firstName} ${employee7.lastName}`);

  const employee8 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      firstName: 'Henry',
      lastName: 'Anderson',
      email: 'henry.anderson@demo.unifocus.com',
      phone: '555-0108',
      hireDate: new Date('2024-02-01'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee8.firstName} ${employee8.lastName}`);

  const employee9 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      firstName: 'Isabel',
      lastName: 'Thomas',
      email: 'isabel.thomas@demo.unifocus.com',
      phone: '555-0109',
      hireDate: new Date('2023-07-10'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee9.firstName} ${employee9.lastName}`);

  const employee10 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      firstName: 'Jack',
      lastName: 'Moore',
      email: 'jack.moore@demo.unifocus.com',
      phone: '555-0110',
      hireDate: new Date('2023-04-12'),
      isActive: true,
    },
  });
  console.log(`✓ Created employee: ${employee10.firstName} ${employee10.lastName}`);

  // Create employee job assignments
  console.log('Creating employee job assignments...');
  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      jobTitle: 'Software Engineer',
      department: dept1.name,
      startDate: new Date('2023-01-15'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Alice Johnson');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      jobTitle: 'Sales Representative',
      department: dept2.name,
      startDate: new Date('2023-03-20'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Bob Smith');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee3.id,
      jobTitle: 'Operations Coordinator',
      department: 'Operations',
      startDate: new Date('2023-06-01'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Carol White');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee4.id,
      jobTitle: 'Warehouse Supervisor',
      department: 'Logistics',
      startDate: new Date('2022-11-10'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to David Martinez');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee5.id,
      jobTitle: 'Inventory Specialist',
      department: 'Logistics',
      startDate: new Date('2024-01-05'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Emma Davis');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee6.id,
      jobTitle: 'Distribution Manager',
      department: 'Distribution',
      startDate: new Date('2023-08-15'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Frank Wilson');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee7.id,
      jobTitle: 'Logistics Coordinator',
      department: 'Distribution',
      startDate: new Date('2023-09-20'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Grace Taylor');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee8.id,
      jobTitle: 'Retail Manager',
      department: 'Retail',
      startDate: new Date('2024-02-01'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Henry Anderson');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee9.id,
      jobTitle: 'Sales Associate',
      department: 'Retail',
      startDate: new Date('2023-07-10'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Isabel Thomas');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee10.id,
      jobTitle: 'Senior Developer',
      department: dept1.name,
      startDate: new Date('2023-04-12'),
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Jack Moore');

  // Create schedules
  console.log('Creating schedules...');
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const schedule1 = await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: employee1.id,
      name: 'Weekly Schedule - Alice',
      startDate: today,
      endDate: nextWeek,
      isActive: true,
    },
  });
  console.log('✓ Created schedule for Alice');

  const schedule2 = await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: employee2.id,
      name: 'Weekly Schedule - Bob',
      startDate: today,
      endDate: nextWeek,
      isActive: true,
    },
  });
  console.log('✓ Created schedule for Bob');

  // Create shifts
  console.log('Creating shifts...');
  // Monday - Friday 9am - 5pm for Alice
  for (let day = 1; day <= 5; day++) {
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule1.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
      },
    });
  }
  console.log('✓ Created shifts for Alice (Mon-Fri 9am-5pm)');

  // Monday - Friday 8am - 4pm for Bob
  for (let day = 1; day <= 5; day++) {
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule2.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 30,
      },
    });
  }
  console.log('✓ Created shifts for Bob (Mon-Fri 8am-4pm)');

  // Create some sample punches
  console.log('Creating sample punches...');

  // Create punches for the past 7 days for multiple employees
  const daysAgo7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Alice - Full week with breaks
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(9, 0, 0);

    const breakStart = new Date(punchDate);
    breakStart.setHours(12, 30, 0);

    const breakEnd = new Date(punchDate);
    breakEnd.setHours(13, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(17, 0, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'break_start',
        timestamp: breakStart,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'break_end',
        timestamp: breakEnd,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-001',
      },
    });
  }
  console.log('✓ Created 5 days of punches for Alice');

  // Bob - Regular schedule
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(8, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(16, 0, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee2.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-002',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee2.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-002',
      },
    });
  }
  console.log('✓ Created 5 days of punches for Bob');

  // David - Warehouse shifts (earlier start)
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(6, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(14, 30, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee4.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-003',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee4.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-003',
      },
    });
  }
  console.log('✓ Created 5 days of punches for David');

  // Today's punches for multiple employees
  const todayClockIn1 = new Date(today);
  todayClockIn1.setHours(9, 5, 0); // Alice slightly late

  const todayClockIn2 = new Date(today);
  todayClockIn2.setHours(7, 55, 0); // Bob early

  const todayClockIn3 = new Date(today);
  todayClockIn3.setHours(10, 0, 0); // Henry on time

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      type: 'in',
      timestamp: todayClockIn1,
      deviceId: 'device-001',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      type: 'in',
      timestamp: todayClockIn2,
      deviceId: 'device-002',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee8.id,
      type: 'in',
      timestamp: todayClockIn3,
      deviceId: 'device-005',
    },
  });
  console.log("✓ Created today's punches");

  // Create a sample exception
  console.log('Creating sample exceptions...');
  await prisma.exception.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      type: 'absence',
      reason: 'Sick leave',
      date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  });
  console.log('✓ Created sample exception for Bob');

  // Create audit log entries
  console.log('Creating audit log entries...');
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: adminUser.id,
      action: 'created',
      entity: 'Tenant',
      changes: JSON.stringify({ name: 'Demo Tenant', slug: 'demo-tenant' }),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: adminUser.id,
      action: 'created',
      entity: 'Employee',
      employeeId: employee1.id,
      changes: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@demo.unifocus.com',
      }),
    },
  });
  console.log('✓ Created audit log entries');

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
