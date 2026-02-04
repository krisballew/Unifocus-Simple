# Readiness Gate Documentation

## Overview

The `/ready` endpoint is a strict production readiness gate designed for ALB/ECS health checks. It ensures that only instances ready to handle production traffic receive requests.

## Endpoint Semantics

### Request

```
GET /ready
```

### Response

#### 200 OK - Service is Ready

The instance is ready to receive production traffic. All critical checks have passed.

```json
{
  "status": "ready",
  "timestamp": "2026-02-04T12:00:00.000Z",
  "checks": {
    "database_connection": "ok",
    "database_migrations": "ok",
    "required_env_vars": "ok",
    "redis": "ok"
  }
}
```

#### 503 Service Unavailable - Service is Not Ready

The instance should NOT receive traffic. One or more critical checks have failed.

```json
{
  "status": "not_ready",
  "timestamp": "2026-02-04T12:00:00.000Z",
  "checks": {
    "database_connection": "error",
    "database_migrations": "ok",
    "required_env_vars": "ok",
    "redis": "optional"
  },
  "details": {
    "missing_env_vars": ["JWT_SECRET", "COGNITO_USER_POOL_ID"]
  }
}
```

## Readiness Checks

### 1. Database Connection (`database_connection`)

**Status**: `ok` | `error`

**What it checks**:

- DATABASE_URL environment variable is configured
- PostgreSQL server is reachable and responding
- A simple query (`SELECT 1`) executes successfully

**When it fails** (503 returned):

- DATABASE_URL is not set or empty
- Network connectivity to database is lost
- PostgreSQL is down or not responding
- Authentication credentials are incorrect
- Connection timeout or I/O error

**Why it matters**:
Database connectivity is critical. Without it, the application cannot function.

### 2. Database Migrations (`database_migrations`)

**Status**: `ok` | `error`

**What it checks**:

- The `_prisma_migrations` table exists
- All migrations have been applied (finished_at is NOT NULL for all rows)
- No pending migrations exist

**When it fails** (503 returned):

- Database connection is not available (automatically fails)
- Pending migrations exist that haven't been applied
- The migrations table cannot be queried

**Why it matters**:
Prevents traffic routing to instances with outdated schema. This is crucial for deployments where migration timing matters. If migrations fail, the instance will crash when trying to query tables that don't exist.

**Expected behavior**:

- During rolling deployments, new instances won't receive traffic until migrations are applied
- Migration failures are caught before any requests are processed
- Rollbacks are prevented (instance won't claim readiness until schema is correct)

### 3. Required Environment Variables (`required_env_vars`)

**Status**: `ok` | `error`

**What it checks** (in production mode only):

- `JWT_SECRET` is set and not the default dev value
- `COGNITO_REGION` is configured
- `COGNITO_USER_POOL_ID` is configured
- `COGNITO_CLIENT_ID` is configured
- `COGNITO_ISSUER` is configured

**When it fails** (503 returned):

- Any required environment variable is missing
- Environment variable is set to an empty string
- Environment variable is set to the development default value
- NODE_ENV is "production"

**Why it matters**:
Authentication is required for production. Missing auth configuration would cause all requests to fail. This check catches misconfigurations before traffic is routed.

**Development behavior**:

- In non-production environments (development, test), missing env vars do NOT fail the readiness check
- Allows developers to run with default values
- Applications can use `AUTH_SKIP_VERIFICATION=true` for development

**Production behavior**:

- Strict validation in production
- Deployment fails readiness if auth is misconfigured
- Forces configuration before rollout completes

### 4. Redis (`redis`)

**Status**: `ok` | `error` | `optional`

**What it checks**:

- REDIS_URL environment variable is configured
- If configured, Redis is assumed to be accessible

**When it returns each status**:

- `ok` - REDIS_URL is configured
- `optional` - REDIS_URL is not configured (development mode)
- `error` - Not currently used, but reserved for future actual Redis health checks

**Why it matters**:
Redis is used for caching and session management. It's optional for development but recommended for production. The check ensures configuration awareness.

**Future enhancement**:
Could be upgraded to actually ping Redis and verify connectivity.

## Overall Readiness Decision

The service is considered **ready** (200) ONLY if:

1. `database_connection` == `ok` AND
2. `database_migrations` == `ok` AND
3. `required_env_vars` == `ok` AND
4. (`redis` == `ok` OR `redis` == `optional`)

If ANY of the first three checks fails, the response is **not ready** (503).

## Production Deployment Flow

### Typical ECS/ALB Flow with /ready Gate

```
1. New instance starts
2. Application initializes
3. Prisma connects to database
4. Instance starts listening on port 3001
5. ALB begins health checks
   - /health returns 200 (liveness) ✓
   - /ready returns 503 (readiness) - checking...
6. Migrations detected as pending
   - /ready still returns 503
7. Deployment/Init container runs migrations
8. Migrations complete
9. ALB retries /ready
   - /ready returns 200 ✓
10. ALB registers instance as healthy
11. Traffic routed to instance

If migrations fail at step 7:
- Old instance continues handling traffic
- New instance never receives traffic
- Deployment can be rolled back safely
```

### Benefits

- **Safety**: Bad deployments are caught before traffic
- **Automation**: ECS can wait for readiness instead of guessing
- **Debugging**: Checks reveal what's broken
- **Confidence**: 200 response guarantees production readiness

## Testing the Readiness Gate

### Test Scenarios Covered

1. **Database Connection Available**
   - /ready returns 200
   - All checks pass

2. **Database Configuration Missing**
   - DATABASE_URL not set
   - /ready returns 503
   - database_connection check is "error"

3. **Database Unreachable**
   - Invalid host/port
   - /ready returns 503
   - database_connection check is "error"

4. **Environment Variables Missing (Production)**
   - NODE_ENV=production
   - JWT_SECRET not set
   - /ready returns 503
   - required_env_vars check is "error"
   - Response includes details.missing_env_vars array

5. **Redis Unconfigured**
   - REDIS_URL not set
   - /ready returns 200 (if other checks pass)
   - redis check is "optional"

## Integration with Load Balancers

### AWS Application Load Balancer (ALB)

ALB configuration for /ready gate:

```
Health Check Configuration:
- Protocol: HTTP
- Path: /ready
- Port: 3001
- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2
- Unhealthy threshold: 3

Expected behavior:
- 200-299: Instance healthy, traffic routed
- 300-399: Redirect (not expected)
- 400-499: Client error (instance unhealthy)
- 500-599: Server error (instance unhealthy) ✓ Used for /ready failures
```

### ECS Task Health

ECS will consider a task unhealthy if /ready returns 503 repeatedly. The task may be stopped and replaced depending on deployment strategy.

## Response Schema

```typescript
interface ReadyResponse {
  status: 'ready' | 'not_ready';
  timestamp: string; // ISO 8601 timestamp
  checks: {
    database_connection: 'ok' | 'error';
    database_migrations: 'ok' | 'error';
    required_env_vars: 'ok' | 'error';
    redis: 'ok' | 'error' | 'optional';
  };
  details?: {
    missing_env_vars?: string[]; // Only present if env vars check fails
  };
}
```

## Timeout Considerations

The /ready check executes:

1. Database query (~1-10ms if available, ~5s timeout)
2. Migration query (~1-10ms if available, ~5s timeout)
3. Env var validation (~<1ms)

**Total time**: Typically <20ms, worst case ~10s if database timeout

ALB health check timeout is 5 seconds, which is sufficient for most scenarios. If database is completely unreachable, the timeout will trigger and ALB will mark unhealthy.

## Monitoring and Alerting

Recommend monitoring:

1. **Rate of /ready 503s**
   - Sudden spike indicates infrastructure issue
   - Gradual increase indicates degradation

2. **/ready response time**
   - Should be <100ms under normal conditions
   - > 1000ms indicates database or network issues

3. **Deployment readiness time**
   - How long until new instances pass readiness
   - Indicates migration performance

4. **Instance replacement rate**
   - Frequently replaced instances suggest config issues
   - Track which checks fail most often

## Troubleshooting

### /ready returns 503 - Database Connection Error

```bash
# Check connectivity
psql postgresql://user:pass@host:5432/db -c "SELECT 1"

# Check configuration
echo $DATABASE_URL

# Verify network
nc -zv host 5432
```

### /ready returns 503 - Pending Migrations

```bash
# Check migration status
prisma migrate status

# Apply pending migrations
prisma migrate deploy
```

### /ready returns 503 - Missing Environment Variables

```bash
# Check required vars
echo "JWT_SECRET: $JWT_SECRET"
echo "COGNITO_REGION: $COGNITO_REGION"
echo "COGNITO_USER_POOL_ID: $COGNITO_USER_POOL_ID"

# Set missing vars
export JWT_SECRET="your-secret"
export COGNITO_USER_POOL_ID="your-pool-id"
```

## Code Comments

The `/ready` endpoint implementation includes extensive code comments explaining:

- Overall semantics and production use
- Each individual check and why it matters
- The readiness decision logic
- Future enhancement opportunities

See [src/routes/health.ts](../src/routes/health.ts) for detailed inline documentation.
