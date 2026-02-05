import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get the demo tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'demo-tenant' },
    });

    if (!tenant) {
      console.log('❌ Demo tenant not found');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: 'kballew@unifocus.com' } },
    });

    if (existingUser) {
      console.log('⚠️  User kballew@unifocus.com already exists (ID: ' + existingUser.id + ')');
      process.exit(0);
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'kballew@unifocus.com',
        name: 'Kris Ballew',
        isActive: true,
      },
    });
    console.log('✅ Created user: kballew@unifocus.com');

    // Get the Platform Administrator role
    const platformAdminRole = await prisma.role.findUnique({
      where: { name: 'Platform Administrator' },
    });

    if (!platformAdminRole) {
      console.log('❌ Platform Administrator role not found');
      process.exit(1);
    }

    // Assign the role to the user
    await prisma.userRoleAssignment.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: platformAdminRole.id,
        isActive: true,
      },
    });
    console.log('✅ Assigned Platform Administrator role');
    console.log('');
    console.log('✨ Account ready! You can now log in with:');
    console.log('   Email: kballew@unifocus.com');
    console.log('   Role: Platform Administrator');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
