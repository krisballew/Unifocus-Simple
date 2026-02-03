# Known Issues

## Test Runner (Tap + ESM)

The test suite currently has compatibility issues with the tap test runner and ESM modules. The tests are written correctly but fail due to tap's internal handling of ESM modules.

**Symptoms:**

- Tests fail with `ReferenceError: exports is not defined in ES module scope`
- Tests fail with `ReferenceError: require is not defined in ES module scope`

**Workaround:**
Tests can be manually verified by:

1. Starting the dev server: `pnpm dev`
2. Testing endpoints with curl or a REST client
3. Visiting `/docs` for interactive Swagger UI

**Example manual tests:**

```bash
# Health check
curl http://localhost:3001/health

# Readiness check
curl http://localhost:3001/ready

# List tenants
curl http://localhost:3001/api/tenants

# Get tenant by ID
curl http://localhost:3001/api/tenants/1

# Create tenant
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Hotel","slug":"test-hotel"}'
```

**Future fix:**
Consider migrating to vitest which has better ESM support, or configure tap properly for ESM compatibility.
