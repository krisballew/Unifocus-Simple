import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding tenant and platform admin role...');

  // Get the demo tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-tenant' },
  });

  if (!tenant) {
    throw new Error('Demo tenant not found');
  }
  console.log(`✓ Found tenant: ${tenant.name}`);

  // Get the Platform Administrator role
  const platformAdminRole = await prisma.role.findFirst({
    where: { name: 'Platform Administrator' },
  });

  if (!platformAdminRole) {
    throw new Error('Platform Administrator role not found');
  }
  console.log(`✓ Found role: ${platformAdminRole.name}`);

  const passwordHash = await bcrypt.hash('password123', 10);

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { email: 'kballew@unifocus.com' },
  });

  if (existingUser) {
    console.log('⚠️  User already exists');
    console.log(`   User ID: ${existingUser.id}`);
    console.log(`   Name: ${existingUser.name}`);
    console.log(`   Email: ${existingUser.email}`);

    // Check if role assignment exists
    const existingAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: existingUser.id,
        roleId: platformAdminRole.id,
      },
    });

    const needsPasswordUpdate =
      !existingUser.password || !(await bcrypt.compare('password123', existingUser.password));

    if (needsPasswordUpdate) {
      console.log('🔄 Updating password...');
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: passwordHash },
      });
      console.log('✓ Password updated');
    }

    if (existingAssignment) {
      console.log('✓ User already has Platform Administrator role');
    } else {
      console.log('🔄 Adding Platform Administrator role...');
      await prisma.userRoleAssignment.create({
        data: {
          tenantId: tenant.id,
          userId: existingUser.id,
          roleId: platformAdminRole.id,
          isActive: true,
        },
      });
      console.log('✓ Assigned Platform Administrator role');
    }
    return;
  }

  // Create the user
  console.log('👤 Creating user: Ava Ballew...');
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'kballew@unifocus.com',
      name: 'Ava Ballew',
      password: passwordHash,
      isActive: true,
    },
  });
  console.log(`✓ Created user: ${user.name} (${user.email})`);

  // Assign Platform Administrator role
  console.log('🔐 Assigning Platform Administrator role...');
  await prisma.userRoleAssignment.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: platformAdminRole.id,
      isActive: true,
    },
  });
  console.log('✓ Assigned Platform Administrator role to Ava Ballew');

  console.log('\n✅ Platform administrator added successfully!');
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
