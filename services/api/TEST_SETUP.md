# API Integration Tests Setup & Execution

This document explains the integration test infrastructure for the Unifocus API.

## Quick Start

### Prerequisites

You need a running PostgreSQL database. The easiest way is:

```bash
cd /workspaces/Unifocus-Simple
docker compose up -d postgres
```

### Setup Database

```bash
cd /workspaces/Unifocus-Simple/services/api
pnpm db:migrate:dev
```

### Run Tests

```bash
pnpm test
```

## Architecture

### Database Setup Helper (`tests/helpers/db-setup.ts`)

Provides utilities for test database management:

- `getTestDatabaseUrl()` - Returns the test database connection URL
- `setupTestDatabase()` - Creates and connects to the test database
- `teardownTestDatabase()` - Closes the database connection
- `resetTestDatabase()` - Deletes all test data

**Why**: Centralizes database setup logic so tests don't need to manage connections individually.

### TAP Configuration (`.taprc.json`)

Configures the TAP test runner:

```json
{
  "node-arg": ["--loader=tsx"],
  "ts": true,
  "timeout": 30,
  "files": ["tests/**/*.test.ts"],
  "exclude": ["tests/helpers/**"]
}
```

**Settings**:

- `node-arg: ["--loader=tsx"]` - Run TypeScript files directly without compilation
- `ts: true` - Enable TypeScript support
- `timeout: 30` - 30 second timeout per test
- `files` - Glob pattern for test files
- `exclude` - Exclude helper files from test discovery

### Package Scripts

```bash
pnpm test              # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:setup       # Setup test database (runs db:migrate:dev)
pnpm db:reset         # Reset database (removes all data)
pnpm db:migrate:dev   # Apply migrations
```

## Test Flow

```
1. Test starts
   ↓
2. Call setupTestDatabase()
   ↓
3. Connect to PostgreSQL
   ↓
4. Create test data (tenants, employees, etc.)
   ↓
5. Run test assertions
   ↓
6. Cleanup in teardown hook
   ↓
7. Call teardownTestDatabase()
   ↓
8. Close database connection
```

## Example: Writing Integration Tests

```typescript
import { test } from 'tap';
import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './helpers/db-setup.js';
import { buildServer } from '../src/server.js';

test('My Feature', async (t) => {
  // Setup
  const prisma = await setupTestDatabase();
  await resetTestDatabase(prisma);

  const app = await buildServer({
    port: 3001,
    nodeEnv: 'test',
    databaseUrl: process.env.DATABASE_URL,
    // ... other config
  });

  // Cleanup
  t.teardown(async () => {
    await teardownTestDatabase(prisma);
    await app.close();
  });

  // Test
  await t.test('should do something', async (t) => {
    // Create test data
    const tenant = await prisma.tenant.create({
      data: { name: 'Test', slug: 'test-' + Date.now() },
    });

    // Make request
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    // Assert
    t.equal(response.statusCode, 200);
  });
});
```

## Idempotency Tests

The main integration test suite (`tests/idempotency.test.ts`) verifies:

### Test Cases

1. **Basic Punch Creation**
   - First request with idempotency key creates a punch
   - Punch is stored in database
   - Idempotency record is created

2. **Idempotent Duplicate Requests**
   - Second request with same key returns same punch
   - No duplicate punch is created
   - Idempotency record is reused

3. **Different Keys**
   - Different idempotency keys create different punches
   - Each key gets its own record

4. **Concurrent Requests**
   - Multiple concurrent requests with same key
   - Only one punch is created
   - All requests return the same punch ID

5. **No Idempotency Key**
   - Requests without key are not deduplicated
   - No idempotency records are created
   - Duplicate requests create duplicate punches

### Database Tables Involved

- `Tenant` - Test organization
- `Property` - Tenant's property
- `Employee` - Property's employee
- `Schedule` - Employee's schedule
- `Shift` - Shift within schedule
- `Punch` - Clock in/out record
- `IdempotencyRecord` - Idempotency cache

### Data Dependencies

```
Tenant
  ↓
Property (requires tenantId)
  ↓
Employee (requires tenantId, propertyId)
  ↓
Schedule (requires tenantId, propertyId, employeeId)
  ↓
Shift (requires tenantId, scheduleId)
  ↓
Punch (requires tenantId, employeeId, shiftId)
```

Cleanup happens in reverse order (see `resetTestDatabase()` in db-setup.ts).

## Troubleshooting

### Tests Fail with "Cannot connect to database"

**Problem**: Database is not running

**Solution**:

```bash
docker compose up -d postgres
docker compose ps  # Verify it's healthy
```

### Tests Fail with "migration not found"

**Problem**: Migrations not applied

**Solution**:

```bash
cd services/api
pnpm db:migrate:dev
```

### Tests Timeout

**Problem**: Queries are slow or database is overloaded

**Solution**:

1. Increase timeout in `.taprc.json` (default 30s)
2. Clear database: `pnpm db:reset`
3. Check database performance: `docker logs unifocus-postgres`

### Test Data Persists Between Runs

**Problem**: Teardown hook didn't run

**Solution**:

```bash
cd services/api
pnpm db:reset  # Delete all data
```

### "Missing Prisma Client" Error

**Problem**: Prisma client not generated

**Solution**:

```bash
cd services/api
pnpm prisma:generate
```

## CI/CD Integration

GitHub Actions workflow (`.github/workflows/integration-tests.yml`) automatically:

1. Starts PostgreSQL service container
2. Installs dependencies
3. Applies migrations
4. Runs all tests
5. Uploads test results as artifacts

Run locally with similar setup:

```bash
# Simulate CI environment
export DATABASE_URL="postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev"
export NODE_ENV="test"

cd services/api
pnpm install
pnpm prisma:generate
pnpm db:migrate:dev
pnpm test
```

## Performance Notes

- Tests run sequentially (TAP default)
- Each test creates isolated test data
- Database indexes are created during migration
- Cleanup happens in test teardown (not in afterAll hook)

For faster local iteration:

```bash
# Run specific test file
pnpm test tests/idempotency.test.ts

# Run with minimal logging
NODE_ENV=test pnpm test
```

## See Also

- [Prisma Testing Documentation](https://www.prisma.io/docs/guides/testing)
- [TAP Test Runner](https://node-tap.org/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres/)
- [Integration Tests Guide](./INTEGRATION_TESTS.md)
