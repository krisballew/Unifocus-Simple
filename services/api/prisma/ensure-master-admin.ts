import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'kballew@unifocus.com';
const ADMIN_PASSWORD = 'password123';

async function ensureTenant() {
  const existingTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingTenant) {
    return existingTenant;
  }

  return prisma.tenant.create({
    data: {
      name: 'Unifocus Platform',
      slug: 'unifocus-platform',
    },
  });
}

async function ensurePlatformAdminRole() {
  return prisma.role.upsert({
    where: { name: 'Platform Administrator' },
    update: {
      description: 'Full system access across all tenants',
      permissions: ['*'],
    },
    create: {
      name: 'Platform Administrator',
      description: 'Full system access across all tenants',
      permissions: ['*'],
    },
  });
}

async function ensureAdminUser(tenantId: string) {
  const hashedPassword = await bcryptjs.hash(ADMIN_PASSWORD, 10);

  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: ADMIN_EMAIL,
      },
    },
    update: {
      name: 'Kris Ballew',
      password: hashedPassword,
      isActive: true,
    },
    create: {
      tenantId,
      email: ADMIN_EMAIL,
      name: 'Kris Ballew',
      password: hashedPassword,
      isActive: true,
    },
  });
}

async function ensureRoleAssignment(tenantId: string, userId: string, roleId: string) {
  const existingAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      roleId,
      propertyId: null,
      departmentId: null,
    },
  });

  if (existingAssignment) {
    await prisma.userRoleAssignment.update({
      where: { id: existingAssignment.id },
      data: { isActive: true },
    });
    return;
  }

  await prisma.userRoleAssignment.create({
    data: {
      tenantId,
      userId,
      roleId,
      isActive: true,
    },
  });
}

async function main() {
  console.log('🔐 Ensuring master platform admin user exists...');

  const tenant = await ensureTenant();
  const platformAdminRole = await ensurePlatformAdminRole();
  const adminUser = await ensureAdminUser(tenant.id);

  await ensureRoleAssignment(tenant.id, adminUser.id, platformAdminRole.id);

  console.log(`✓ Master admin ensured: ${adminUser.email}`);
  console.log('✓ Platform Administrator role ensured');
}

main()
  .catch((error) => {
    console.error('❌ Ensure master admin failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
