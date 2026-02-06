import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toDateString = (value?: Date | null): string => {
  if (!value) return new Date().toISOString().split('T')[0];
  return value.toISOString().split('T')[0];
};

const pickRandom = <T>(items: T[]): T | undefined => {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
};

const isSalaryRole = (flsaStatus?: string | null): boolean => {
  if (!flsaStatus) return false;
  const normalized = flsaStatus.toLowerCase();
  return normalized.includes('salary') || normalized.includes('exempt');
};

const buildJobRecord = (options: {
  jobRole: { id: string; name: string; code?: string | null; flsaStatus?: string | null };
  department: { id: string; name: string; location?: string | null };
  startDate: string;
  jobStatus: 'active' | 'inactive' | 'on-leave';
  isPrimary: boolean;
  payType: 'hourly' | 'salary';
  rate: string;
  annualAmount: string;
  payGroup: string;
}) => ({
  jobRoleId: options.jobRole.id,
  departmentId: options.department.id,
  jobCode: options.jobRole.code ?? '',
  jobTitle: options.jobRole.name,
  department: options.department.name,
  location: options.department.location ?? '',
  payType: options.payType,
  rate: options.rate,
  jobDate: options.startDate,
  jobStatus: options.jobStatus,
  payGroup: options.payGroup,
  isPrimary: options.isPrimary,
  subOnly: !options.isPrimary,
  annualAmount: options.annualAmount,
});

const buildEmploymentDetails = (startDate: string, jobs: Record<string, unknown>[]) => ({
  jobCompensationRecords: [
    {
      effectiveStartDate: startDate,
      effectiveEndDate: 'Present',
      jobs,
    },
  ],
  selectedEffectiveRangeIndex: 0,
});

async function main() {
  const jobRoles = await prisma.jobRole.findMany({
    include: {
      department: true,
    },
  });

  const jobRolesByProperty = new Map<string, typeof jobRoles>();
  jobRoles.forEach((jobRole) => {
    if (!jobRole.propertyId || !jobRole.department) return;
    const existing = jobRolesByProperty.get(jobRole.propertyId) ?? [];
    existing.push(jobRole);
    jobRolesByProperty.set(jobRole.propertyId, existing);
  });

  const employees = await prisma.employee.findMany();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const employee of employees) {
    const details = (employee.employmentDetails ?? {}) as Record<string, unknown>;
    const existingJobs = (details.jobCompensationRecords as unknown[] | undefined) ?? [];
    if (existingJobs.length > 0) {
      skippedCount += 1;
      continue;
    }

    const jobPool = jobRolesByProperty.get(employee.propertyId) ?? [];
    const primaryJob = pickRandom(jobPool);
    if (!primaryJob || !primaryJob.department) {
      skippedCount += 1;
      continue;
    }

    const startDate = toDateString(employee.hireDate);
    const payType: 'hourly' | 'salary' = isSalaryRole(primaryJob.flsaStatus) ? 'salary' : 'hourly';
    const baseRate =
      payType === 'salary'
        ? String(55000 + Math.floor(Math.random() * 35001))
        : (16 + Math.random() * 12).toFixed(2);
    const annualAmount =
      payType === 'salary' ? baseRate : String(Math.round(Number(baseRate) * 2080));
    const payGroup = payType === 'salary' ? 'Biweekly' : 'Weekly';
    const jobStatus: 'active' | 'inactive' | 'on-leave' = employee.isActive ? 'active' : 'inactive';

    const jobRecords = [
      buildJobRecord({
        jobRole: primaryJob,
        department: primaryJob.department,
        startDate,
        jobStatus,
        isPrimary: true,
        payType,
        rate: baseRate,
        annualAmount,
        payGroup,
      }),
    ];

    if (jobPool.length > 1 && Math.random() < 0.35) {
      const secondaryJob = pickRandom(jobPool.filter((job) => job.id !== primaryJob.id));
      if (secondaryJob && secondaryJob.department) {
        const secondaryPayType: 'hourly' | 'salary' = isSalaryRole(secondaryJob.flsaStatus)
          ? 'salary'
          : 'hourly';
        const secondaryRate =
          secondaryPayType === 'salary'
            ? String(45000 + Math.floor(Math.random() * 25001))
            : (15 + Math.random() * 10).toFixed(2);
        const secondaryAnnualAmount =
          secondaryPayType === 'salary'
            ? secondaryRate
            : String(Math.round(Number(secondaryRate) * 1040));
        const secondaryPayGroup = secondaryPayType === 'salary' ? 'Biweekly' : 'Weekly';

        jobRecords.push(
          buildJobRecord({
            jobRole: secondaryJob,
            department: secondaryJob.department,
            startDate,
            jobStatus: 'active',
            isPrimary: false,
            payType: secondaryPayType,
            rate: secondaryRate,
            annualAmount: secondaryAnnualAmount,
            payGroup: secondaryPayGroup,
          })
        );
      }
    }

    const employmentDetails = buildEmploymentDetails(startDate, jobRecords);
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        employmentDetails: employmentDetails as Prisma.InputJsonValue,
      },
    });

    updatedCount += 1;
  }

  console.log(`Backfill complete. Updated ${updatedCount} employee(s), skipped ${skippedCount}.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
