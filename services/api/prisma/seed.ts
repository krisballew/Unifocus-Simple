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
      name: 'Downtown Office',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
    },
  });
  console.log(`✓ Created property: ${property1.name}`);

  const property2 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Uptown Office',
      address: '456 Park Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10022',
    },
  });
  console.log(`✓ Created property: ${property2.name}`);

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
  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      description: 'Full system access',
      permissions: ['read:*', 'write:*', 'delete:*'],
    },
  });
  console.log(`✓ Created role: ${adminRole.name}`);

  const managerRole = await prisma.role.create({
    data: {
      name: 'Manager',
      description: 'Manager access to assigned property/department',
      permissions: [
        'read:employees',
        'read:schedules',
        'write:schedules',
        'read:punches',
        'read:exceptions',
        'write:exceptions',
      ],
    },
  });
  console.log(`✓ Created role: ${managerRole.name}`);

  const employeeRole = await prisma.role.create({
    data: {
      name: 'Employee',
      description: 'Basic employee access',
      permissions: ['read:own_punches', 'write:own_punches', 'read:own_schedule'],
    },
  });
  console.log(`✓ Created role: ${employeeRole.name}`);

  // Create users
  console.log('Creating users...');
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.unifocus.com',
      name: 'Admin User',
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
      roleId: adminRole.id,
      isActive: true,
    },
  });
  console.log('✓ Assigned Admin role to admin user');

  await prisma.userRoleAssignment.create({
    data: {
      tenantId: tenant.id,
      userId: managerUser.id,
      roleId: managerRole.id,
      propertyId: property1.id,
      departmentId: dept1.id,
      isActive: true,
    },
  });
  console.log('✓ Assigned Manager role to manager user');

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
  const punchTime1 = new Date(today);
  punchTime1.setHours(9, 0, 0);

  const punchTime2 = new Date(today);
  punchTime2.setHours(12, 30, 0);

  const punchTime3 = new Date(today);
  punchTime3.setHours(17, 0, 0);

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      type: 'in',
      timestamp: punchTime1,
      deviceId: 'device-001',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      type: 'break_start',
      timestamp: punchTime2,
      deviceId: 'device-001',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      type: 'out',
      timestamp: punchTime3,
      deviceId: 'device-001',
    },
  });
  console.log('✓ Created sample punches for Alice');

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
