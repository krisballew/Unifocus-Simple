# Integration Tests Guide

This guide explains how to set up and run the integration tests for the Unifocus API.

## Overview

The integration tests are designed to run against a real PostgreSQL database. They test:

- Idempotency of API operations
- Punch clock in/out functionality
- Data persistence and consistency
- Concurrent request handling

## Prerequisites

Before running the tests, you need to have:

1. PostgreSQL 16 or later running
2. Database migrations applied
3. Prisma client generated

## Setup

### Step 1: Start the Database

Start the PostgreSQL database using docker-compose:

```bash
cd /workspaces/Unifocus-Simple
docker compose up -d postgres
```

Wait for the database to be healthy:

```bash
docker compose ps
```

You should see the postgres service showing a healthy status.

### Step 2: Apply Migrations

From the services/api directory, apply all database migrations:

```bash
cd /workspaces/Unifocus-Simple/services/api
pnpm db:migrate:dev
```

This will:

- Create all necessary database tables
- Apply any pending migrations
- Generate the Prisma client

Alternatively, you can run the automated setup script:

```bash
pnpm test:setup
```

### Step 3: Run the Tests

```bash
cd /workspaces/Unifocus-Simple/services/api
pnpm test
```

This will execute all test files matching `tests/**/*.test.ts`.

#### Run Tests in Watch Mode

To automatically re-run tests when files change:

```bash
pnpm test:watch
```

#### Run a Specific Test File

```bash
pnpm test tests/idempotency.test.ts
```

#### Run Tests with Verbose Output

```bash
pnpm test --reporter=tap
```

## Test Structure

### Idempotency Tests (`tests/idempotency.test.ts`)

The main integration test suite verifies:

1. **Single Request Creation**: A punch is created on the first request
2. **Duplicate Handling**: Duplicate requests with the same idempotency key return the same response without creating new records
3. **Different Keys**: Different idempotency keys create different records
4. **Concurrent Requests**: Multiple concurrent requests with the same key are deduplicated properly
5. **No Idempotency Key**: Requests without idempotency keys are not deduplicated

### Other Tests

- `security-baseline.test.ts` - Security policies
- `punch-validator.test.ts` - Punch validation logic
- `security-rbac.test.ts` - Role-based access control
- `health.test.ts` - Health check endpoints

## Database Cleanup

Tests automatically clean up their data after running through the teardown hooks. However, if you need to manually reset the database:

```bash
cd /workspaces/Unifocus-Simple/services/api
pnpm db:reset
```

**WARNING**: This will delete all data in the database!

## Troubleshooting

### Database Connection Error

If you see: `Can't reach database server at localhost:5432`

1. Check if postgres is running:

   ```bash
   docker compose ps
   ```

2. If not running, start it:

   ```bash
   docker compose up -d postgres
   ```

3. If it's running but tests still fail, try resetting:
   ```bash
   docker compose down postgres
   docker volume rm unifocus-simple_postgres_data
   docker compose up -d postgres
   pnpm db:migrate:dev
   ```

### Migration Conflicts

If you see migration errors, ensure the database is in a clean state:

```bash
cd /workspaces/Unifocus-Simple/services/api
pnpm db:reset
pnpm db:migrate:dev
```

### Test Timeout

If tests timeout (default 30 seconds), you can increase the timeout in `.taprc.json`:

```json
{
  "timeout": 60
}
```

### Tests Skip or Fail

If tests are being skipped:

1. Ensure database migrations are applied: `pnpm db:migrate:dev`
2. Check that the database is accessible: `pnpm test tests/health.test.ts`
3. Clear node_modules and reinstall: `pnpm clean && pnpm install`

## Environment Variables

The tests use these environment variables:

- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev`)
- `REDIS_URL`: Redis connection string (default: `redis://localhost:6379`)
- `NODE_ENV`: Set to 'test' during test runs

## CI/CD Integration

For CI/CD pipelines, ensure the database is set up before running tests:

```yaml
# Example GitHub Actions workflow
- name: Start PostgreSQL
  run: docker compose up -d postgres

- name: Wait for database
  run: docker compose exec -T postgres pg_isready -U unifocus

- name: Apply migrations
  run: cd services/api && pnpm db:migrate:dev

- name: Run tests
  run: cd services/api && pnpm test
```

## Performance Tips

1. **Parallel Test Execution**: TAP runs tests sequentially by default. For faster execution across multiple files, you can modify test configuration.

2. **Database Indexing**: Ensure all migrations have been applied to create proper indexes:

   ```bash
   pnpm db:migrate:dev
   ```

3. **Test Isolation**: Each test creates its own test data and cleans it up, ensuring tests don't interfere with each other.

## Adding New Tests

When adding new integration tests:

1. Create a new file in `tests/` matching the pattern `*.test.ts`
2. Use the `setupTestDatabase()` helper for database setup
3. Always clean up test data in teardown hooks
4. Follow the same pattern as `idempotency.test.ts`

Example:

```typescript
import { test } from 'tap';
import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './helpers/db-setup.js';

test('My new integration test', async (t) => {
  const prisma = await setupTestDatabase();
  await resetTestDatabase(prisma);

  t.teardown(async () => {
    await teardownTestDatabase(prisma);
  });

  // Your test code here
  await t.test('specific behavior', async (t) => {
    // Test implementation
  });
});
```

## See Also

- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [TAP Documentation](https://node-tap.org/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
