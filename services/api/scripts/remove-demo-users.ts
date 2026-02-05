import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const emailsToRemove = ['admin@demo.unifocus.com', 'manager@demo.unifocus.com'];

async function main() {
  console.log('Locating users to remove...');
  const users = await prisma.user.findMany({
    where: {
      email: { in: emailsToRemove },
    },
  });

  if (users.length === 0) {
    console.log('No matching users found. Nothing to remove.');
    return;
  }

  const userIds = users.map((user) => user.id);
  console.log(`Found ${users.length} user(s) to remove.`);

  const roleAssignments = await prisma.userRoleAssignment.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const roleAssignmentIds = roleAssignments.map((assignment) => assignment.id);

  console.log('Removing audit logs and idempotency records...');
  const auditLogOrConditions = [{ userId: { in: userIds } }];
  if (roleAssignmentIds.length > 0) {
    auditLogOrConditions.push({ userRoleAssignmentId: { in: roleAssignmentIds } });
  }

  await prisma.auditLog.deleteMany({
    where: {
      OR: auditLogOrConditions,
    },
  });

  await prisma.idempotencyRecord.deleteMany({
    where: { userId: { in: userIds } },
  });

  console.log('Removing role assignments...');
  await prisma.userRoleAssignment.deleteMany({
    where: { userId: { in: userIds } },
  });

  console.log('Removing users...');
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  console.log('Users and related history removed.');
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
