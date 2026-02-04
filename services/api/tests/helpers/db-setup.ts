import { PrismaClient } from '@prisma/client';

/**
 * Get the test database URL
 * Uses the same database as dev but with explicit configuration
 */
export function getTestDatabaseUrl(): string {
  // Use DATABASE_URL from environment or fall back to default
  return (
    process.env.DATABASE_URL ||
    'postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev'
  );
}

/**
 * Setup a test database connection
 * Attempts to connect to database. If it fails, returns a mocked client for dry-run testing.
 */
export async function setupTestDatabase(): Promise<PrismaClient> {
  const databaseUrl = getTestDatabaseUrl();

  // Create a new Prisma client with the test database URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  // Test the connection
  try {
    await prisma.$connect();
    console.log('✅ Connected to test database');
  } catch (error) {
    console.error('⚠️  Database connection failed:', error);
    console.error('Please ensure the database is running. You can start it with:');
    console.error('  cd /workspaces/Unifocus-Simple');
    console.error('  docker compose up -d postgres');
    console.error('  cd services/api && pnpm db:migrate:dev');
    throw error;
  }

  return prisma;
}

/**
 * Clean up test database connection
 */
export async function teardownTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Reset all data in the test database
 * Deletes all data in reverse order of foreign key dependencies
 */
export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  // Delete all data in reverse order of foreign key dependencies
  try {
    await prisma.auditLog.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.idempotencyRecord.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.exception.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.punch.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.shift.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.schedule.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.employee.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.userRoleAssignment.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.user.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.department.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.property.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }

  try {
    await prisma.tenant.deleteMany();
  } catch (e) {
    // Table might not exist yet
  }
}
