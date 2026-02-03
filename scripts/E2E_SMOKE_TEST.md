# E2E Smoke Test Script

## Overview

The `e2e-dev-smoke.ts` script is a comprehensive end-to-end smoke test for the Unifocus API dev environment. It validates:

1. **Health & Readiness Checks** - Verifies the API is running and healthy
2. **Authentication** - Tests login via `/api/auth/login`
3. **Punch Flow** - Creates employee, schedule, shift, and punch; verifies DB effects
4. **Exception Resolution** - Creates and resolves an exception
5. **Audit Logging** - Verifies audit logs record the operations

## Usage

### Prerequisites

- Node.js 20+
- API running on accessible URL (default: `http://localhost:3000`)
- Database configured and connected (for real data operations)

### Running the Test

```bash
# Using default API URL (http://localhost:3000)
npx tsx scripts/e2e-dev-smoke.ts

# Using custom API URL
npx tsx scripts/e2e-dev-smoke.ts http://api.example.com

# Using custom API URL and tenant ID
npx tsx scripts/e2e-dev-smoke.ts http://api.example.com my-tenant-id
```

### Environment Variables

Set these as environment variables for convenience:

```bash
export API_URL=http://localhost:3000
export TENANT_ID=my-tenant-id

npx tsx scripts/e2e-dev-smoke.ts
```

## Output

The script prints a formatted report with:

```
✓ Passed tests in green
✗ Failed tests in red
! Warnings in yellow (e.g., fallback IDs or optional endpoints not implemented)

Total execution time and pass/fail summary
```

### Exit Codes

- `0` - All tests passed ✅
- `1` - One or more tests failed ❌
- `2` - Configuration error (e.g., invalid URL format)

## Test Details

### Phase 1: Health & Readiness

- **GET /health** - Liveness probe
  - Verifies status=ok
  - Verifies timestamp and uptime fields
- **GET /ready** - Readiness probe
  - Verifies status=ready
  - Verifies database connectivity check

### Phase 2: Authentication

- **POST /api/auth/login** - Test login endpoint
  - Sends: `{ email: "test@example.com", password: "password123" }`
  - Expects: `{ token: string, user: { id, email, name } }`
  - Stores bearer token for subsequent requests
  - Sets default Authorization and X-Tenant-ID headers

**Note**: Current implementation uses mock authentication. For production, replace with Cognito or OAuth2 integration.

### Phase 3: Punch Flow

- **Create Employee** (POST /api/users)
  - Creates test employee with auto-generated email
  - Falls back to mock ID if endpoint not available
- **Create Schedule** (POST /api/schedules)
  - Creates 7-day schedule for employee
  - Verifies ID returned
- **Create Shift** (POST /api/schedules/:id/shifts)
  - Creates shift: 09:00-17:00 with 60-min break
  - Sets to current day of week
- **Create Punch** (POST /api/punches)
  - Records clock-in punch with idempotency key
  - Includes geolocation (lat/long) and device ID
  - Verifies punch ID returned

### Phase 4: Exception Resolution

- **List Exceptions** (GET /api/exceptions)
  - Filters for employee's pending exceptions
  - Uses real exception ID if found, falls back to mock
- **Resolve Exception** (PUT /api/exceptions/:id/resolve)
  - Approves the exception
  - Verifies approvedBy field populated
  - Handles 404 gracefully (no exceptions created yet)

### Phase 5: Audit Logging

- **Verify Audit Logs** (GET /api/audit-logs)
  - Optional endpoint (returns 404 if not implemented)
  - Filters for punch creation events
  - Verifies the specific punch is logged

## Implementation Notes

### No External Dependencies

The script uses only Node.js built-in APIs:

- `fetch()` for HTTP requests (Node 20+ native)
- `URLSearchParams` for query string building
- `JSON` for serialization

### Error Handling

- Catches and reports all HTTP errors
- Provides fallback IDs when operations fail
- Continues testing even if individual tests fail
- Distinguishes between errors and missing/optional features

### Idempotency

- Punch creation uses idempotency key to prevent duplicates
- Each test run generates unique timestamps in IDs
- Safe to run multiple times without causing issues

### Authentication Notes

The script authenticates at the start and reuses the token for all subsequent requests.

**Current Implementation (Mock)**:

- POST /api/auth/login accepts any email/password
- Returns mock JWT token
- Suitable for development/testing only

**For Production**:

1. Implement Cognito authentication
2. Use service account credentials or user credentials
3. Handle token expiration and refresh
4. Implement proper secret/config management

## Example Workflows

### Local Development

```bash
# Start dependencies
./scripts/start-deps.sh

# In another terminal, start API
cd services/api
npm run dev

# In third terminal, run smoke test
npx tsx scripts/e2e-dev-smoke.ts
```

### GitHub Actions / CI/CD

```yaml
- name: Run E2E Smoke Tests
  run: npx tsx scripts/e2e-dev-smoke.ts ${{ env.API_URL }}
  env:
    API_URL: ${{ secrets.DEV_API_URL }}
```

### Pre-Deployment Verification

```bash
# Verify staging environment
npx tsx scripts/e2e-dev-smoke.ts https://api-staging.unifocus.io

# Verify production environment (read-only operations only)
npx tsx scripts/e2e-dev-smoke.ts https://api.unifocus.io
```

## Troubleshooting

### Connection Refused

```
Error: Failed to fetch URL
```

**Solution**: Verify API is running on the specified URL

```bash
curl http://localhost:3000/health
```

### Timeout Errors

```
Error: Request timeout
```

**Solution**: API may be slow. Increase timeout or check logs.

### Authentication Failed

```
Error: Invalid auth response: missing token or user data
```

**Solution**:

- Verify /api/auth/login endpoint exists
- Check auth implementation in services/api/src/routes/auth.ts

### Database Not Ready

```
Error: Database check failed or missing
```

**Solution**:

- Verify database is running and connected
- Check DATABASE_URL environment variable
- Run migrations: `pnpm db:migrate`

## Future Enhancements

- [ ] Add GraphQL query support
- [ ] Support JWT token signing for real auth testing
- [ ] Add performance benchmarking
- [ ] Support read-only mode for production environments
- [ ] Add retry logic for transient failures
- [ ] Support custom headers (API keys, custom auth)
- [ ] Add timeout configuration
- [ ] Generate test reports in JSON/HTML format
