import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DepartmentSpec = {
  name: string;
  code: string;
  categoryName: string;
  roles: Array<{ name: string; code: string; jobCategoryHint?: string }>;
};

const departmentSpecs: DepartmentSpec[] = [
  {
    name: 'Front Office',
    code: 'FO',
    categoryName: 'Front Office',
    roles: [
      { name: 'Front Desk Agent', code: 'FDA', jobCategoryHint: 'Front Desk' },
      { name: 'Concierge', code: 'CON', jobCategoryHint: 'Front Desk' },
    ],
  },
  {
    name: 'Housekeeping',
    code: 'HK',
    categoryName: 'Housekeeping',
    roles: [
      { name: 'Room Attendant', code: 'RA', jobCategoryHint: 'Housekeeping' },
      { name: 'Housekeeping Supervisor', code: 'HS', jobCategoryHint: 'Supervisory' },
    ],
  },
  {
    name: 'Food & Beverage',
    code: 'FB',
    categoryName: 'Food & Beverage',
    roles: [
      { name: 'Server', code: 'SRV', jobCategoryHint: 'Food Service' },
      { name: 'Bartender', code: 'BAR', jobCategoryHint: 'Beverage' },
    ],
  },
  {
    name: 'Guest Services',
    code: 'GS',
    categoryName: 'Guest Services',
    roles: [
      { name: 'Bell Attendant', code: 'BELL', jobCategoryHint: 'Guest Services' },
      { name: 'Valet', code: 'VAL', jobCategoryHint: 'Guest Services' },
    ],
  },
  {
    name: 'Maintenance & Engineering',
    code: 'ME',
    categoryName: 'Maintenance & Engineering',
    roles: [
      { name: 'Maintenance Tech', code: 'MT', jobCategoryHint: 'Maintenance' },
      { name: 'Engineer', code: 'ENG', jobCategoryHint: 'Maintenance' },
    ],
  },
  {
    name: 'Security',
    code: 'SEC',
    categoryName: 'Security',
    roles: [
      { name: 'Security Officer', code: 'SO', jobCategoryHint: 'Security' },
      { name: 'Security Supervisor', code: 'SS', jobCategoryHint: 'Security' },
    ],
  },
];

const demoEmployees = [
  { firstName: 'Jordan', lastName: 'Hayes' },
  { firstName: 'Hanna', lastName: 'Dorwart' },
  { firstName: 'Youssef', lastName: 'Walli' },
  { firstName: 'Carly', lastName: 'Liu' },
  { firstName: 'Aiden', lastName: 'Brooks' },
  { firstName: 'Maya', lastName: 'Singh' },
  { firstName: 'Leo', lastName: 'Navarro' },
  { firstName: 'Sofia', lastName: 'Reed' },
  { firstName: 'Marcus', lastName: 'Bell' },
  { firstName: 'Elena', lastName: 'Park' },
  { firstName: 'Noah', lastName: 'Nguyen' },
  { firstName: 'Isla', lastName: 'Foster' },
  { firstName: 'Omar', lastName: 'Khan' },
  { firstName: 'Lena', lastName: 'Bishop' },
  { firstName: 'Kai', lastName: 'Morris' },
  { firstName: 'Riley', lastName: 'Stone' },
  { firstName: 'Nina', lastName: 'Lopez' },
  { firstName: 'Ethan', lastName: 'Price' },
];

const shiftTemplates = [
  { start: '07:00', end: '15:00', breakMinutes: 30 },
  { start: '09:00', end: '17:00', breakMinutes: 30 },
  { start: '11:00', end: '19:00', breakMinutes: 30 },
  { start: '13:00', end: '21:00', breakMinutes: 30 },
  { start: '15:00', end: '23:00', breakMinutes: 30 },
];

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

async function ensureDepartmentsAndRoles(params: {
  tenantId: string;
  propertyId: string;
  divisionId: string;
}) {
  const { tenantId, propertyId, divisionId } = params;

  const categories = await prisma.departmentCategory.findMany({
    where: { tenantId },
  });

  const jobCategories = await prisma.jobCategory.findMany({
    where: { tenantId },
  });

  const findCategoryId = (name: string): string | null => {
    return categories.find((cat) => cat.name === name)?.id ?? categories[0]?.id ?? null;
  };

  const findJobCategoryId = (hint?: string): string | null => {
    if (hint) {
      const match = jobCategories.find((cat) =>
        cat.name.toLowerCase().includes(hint.toLowerCase())
      );
      if (match) return match.id;
    }
    return jobCategories[0]?.id ?? null;
  };

  for (const spec of departmentSpecs) {
    const categoryId = findCategoryId(spec.categoryName);
    if (!categoryId) {
      throw new Error('No department categories found. Run prisma seed first.');
    }

    let department = await prisma.department.findFirst({
      where: {
        tenantId,
        propertyId,
        name: spec.name,
      },
    });

    if (!department) {
      department = await prisma.department.create({
        data: {
          tenantId,
          propertyId,
          divisionId,
          departmentCategoryId: categoryId,
          name: spec.name,
          code: spec.code,
          costCenter: `CC-${spec.code}-DEMO`,
          location: 'Main Property',
          reportingGroupId: 'RG-DEMO',
        },
      });
      console.log(`OK: Created department: ${department.name}`);
    }

    for (const role of spec.roles) {
      const roleExists = await prisma.jobRole.findFirst({
        where: {
          tenantId,
          propertyId,
          departmentId: department.id,
          name: role.name,
        },
      });

      if (!roleExists) {
        const jobCategoryId = findJobCategoryId(role.jobCategoryHint);
        if (!jobCategoryId) {
          throw new Error('No job categories found. Run prisma seed first.');
        }

        await prisma.jobRole.create({
          data: {
            tenantId,
            propertyId,
            departmentId: department.id,
            jobCategoryId,
            name: role.name,
            code: role.code,
            payCode: `PC-${role.code}`,
            skillClassification: 'Intermediate',
            flsaStatus: 'NON_EXEMPT',
            unionClassification: 'Non-Union',
            certificationRequirements: [],
            isActive: true,
          },
        });
        console.log(`OK: Created job role: ${role.name}`);
      }
    }
  }
}

async function ensureEmployees(params: { tenantId: string; propertyId: string }) {
  const { tenantId, propertyId } = params;
  const existing = await prisma.employee.findMany({
    where: { tenantId, propertyId },
  });

  if (existing.length >= demoEmployees.length) {
    return existing;
  }

  const toCreate = demoEmployees.slice(existing.length);
  const created = [] as typeof existing;

  for (const [index, employee] of toCreate.entries()) {
    const employeeId = `DEMO-${String(existing.length + index + 1).padStart(3, '0')}`;
    const record = await prisma.employee.create({
      data: {
        tenantId,
        propertyId,
        employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}@demo.unifocus.com`,
        isActive: true,
      },
    });
    created.push(record);
    console.log(`OK: Created employee: ${record.firstName} ${record.lastName}`);
  }

  return [...existing, ...created];
}

async function seedSchedule() {
  console.log('Seeding schedule demo data...');

  let tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-tenant' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Tenant',
        slug: 'demo-tenant',
      },
    });
    console.log(`OK: Created tenant: ${tenant.name}`);
  }

  let property = await prisma.property.findFirst({
    where: { tenantId: tenant.id, name: 'Hyatt Regency Times Square' },
  });

  if (!property) {
    property = await prisma.property.findFirst({
      where: { tenantId: tenant.id },
    });
  }

  if (!property) {
    property = await prisma.property.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Property',
        address: '123 Demo Street',
        city: 'Demo City',
        state: 'DC',
        zipCode: '00000',
        features: { scheduling_v2: true, availability_management: true },
      },
    });
    console.log(`OK: Created property: ${property.name}`);
  }

  let division = await prisma.division.findFirst({
    where: { tenantId: tenant.id, propertyId: property.id },
  });

  if (!division) {
    division = await prisma.division.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        name: 'Operations',
        code: 'OPS',
      },
    });
    console.log(`OK: Created division: ${division.name}`);
  }

  const categoryNames = departmentSpecs.map((spec) => spec.categoryName);
  for (const categoryName of categoryNames) {
    const existingCategory = await prisma.departmentCategory.findFirst({
      where: { tenantId: tenant.id, name: categoryName },
    });
    if (!existingCategory) {
      await prisma.departmentCategory.create({
        data: {
          tenantId: tenant.id,
          name: categoryName,
          code: categoryName
            .split(' ')
            .map((part) => part[0])
            .join(''),
          description: `${categoryName} department category`,
        },
      });
      console.log(`OK: Created department category: ${categoryName}`);
    }
  }

  const jobCategoryNames = [
    'Front Desk',
    'Housekeeping',
    'Food Service',
    'Beverage',
    'Guest Services',
    'Maintenance',
    'Security',
    'Supervisory',
  ];

  for (const jobCategoryName of jobCategoryNames) {
    const existingJobCategory = await prisma.jobCategory.findFirst({
      where: { tenantId: tenant.id, name: jobCategoryName },
    });
    if (!existingJobCategory) {
      await prisma.jobCategory.create({
        data: {
          tenantId: tenant.id,
          name: jobCategoryName,
          code: jobCategoryName
            .split(' ')
            .map((part) => part[0])
            .join(''),
          description: `${jobCategoryName} job category`,
        },
      });
      console.log(`OK: Created job category: ${jobCategoryName}`);
    }
  }

  await ensureDepartmentsAndRoles({
    tenantId: tenant.id,
    propertyId: property.id,
    divisionId: division.id,
  });

  const employees = await ensureEmployees({ tenantId: tenant.id, propertyId: property.id });

  const roles = await prisma.jobRole.findMany({
    where: { tenantId: tenant.id, propertyId: property.id },
    orderBy: { name: 'asc' },
  });

  if (roles.length === 0) {
    throw new Error('No job roles found for demo property.');
  }

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);

  let schedulePeriod = await prisma.wfmSchedulePeriod.findFirst({
    where: {
      tenantId: tenant.id,
      propertyId: property.id,
      startDate: weekStart,
      version: 1,
    },
  });

  if (!schedulePeriod) {
    schedulePeriod = await prisma.wfmSchedulePeriod.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        startDate: weekStart,
        endDate: weekEnd,
        status: 'DRAFT',
        version: 1,
        name: `Demo Week ${weekStart.toLocaleDateString()}`,
      },
    });
  }

  console.log(`OK: Using schedule period: ${schedulePeriod.name ?? schedulePeriod.id}`);

  const shiftsToCreate: Array<{
    roleId: string;
    departmentId: string;
    startDateTime: Date;
    endDateTime: Date;
    breakMinutes: number;
    isOpenShift: boolean;
  }> = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const day = addDays(weekStart, dayIndex);
    roles.forEach((role, roleIndex) => {
      const template = shiftTemplates[(roleIndex + dayIndex) % shiftTemplates.length];
      const startDateTime = new Date(`${day.toISOString().split('T')[0]}T${template.start}:00`);
      const endDateTime = new Date(`${day.toISOString().split('T')[0]}T${template.end}:00`);
      const isOpenShift = (roleIndex + dayIndex) % 5 === 0;

      shiftsToCreate.push({
        roleId: role.id,
        departmentId: role.departmentId,
        startDateTime,
        endDateTime,
        breakMinutes: template.breakMinutes,
        isOpenShift,
      });

      if (dayIndex >= 4 && roleIndex % 2 === 0) {
        const extraTemplate = shiftTemplates[(roleIndex + dayIndex + 2) % shiftTemplates.length];
        const extraStart = new Date(`${day.toISOString().split('T')[0]}T${extraTemplate.start}:00`);
        const extraEnd = new Date(`${day.toISOString().split('T')[0]}T${extraTemplate.end}:00`);

        shiftsToCreate.push({
          roleId: role.id,
          departmentId: role.departmentId,
          startDateTime: extraStart,
          endDateTime: extraEnd,
          breakMinutes: extraTemplate.breakMinutes,
          isOpenShift: roleIndex % 3 === 0,
        });
      }
    });
  }

  console.log(`Creating ${shiftsToCreate.length} shifts...`);

  const createdShiftPlans = [] as { id: string; isOpenShift: boolean }[];

  for (const shift of shiftsToCreate) {
    const shiftPlan = await prisma.wfmShiftPlan.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        schedulePeriodId: schedulePeriod.id,
        departmentId: shift.departmentId,
        jobRoleId: shift.roleId,
        startDateTime: shift.startDateTime,
        endDateTime: shift.endDateTime,
        breakMinutes: shift.breakMinutes,
        isOpenShift: shift.isOpenShift,
      },
    });
    createdShiftPlans.push({ id: shiftPlan.id, isOpenShift: shiftPlan.isOpenShift });
  }

  console.log('Assigning employees to shifts...');
  let employeeIndex = 0;

  for (const shift of createdShiftPlans) {
    if (shift.isOpenShift) continue;
    if (employeeIndex >= employees.length) {
      employeeIndex = 0;
    }

    if (employeeIndex % 3 === 0) {
      employeeIndex += 1;
      continue;
    }

    const employee = employees[employeeIndex];
    employeeIndex += 1;

    await prisma.wfmShiftAssignment.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        shiftPlanId: shift.id,
        employeeId: employee.id,
      },
    });
  }

  console.log('Schedule demo data seeded successfully.');
}

seedSchedule()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
