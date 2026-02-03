# End-to-End Smoke Test Report

## Test Environment Status

### ❌ **Test Execution: BLOCKED**

The end-to-end smoke test **cannot be executed** in the current environment due to missing Docker support in the dev container.

---

## Missing Prerequisites

### 1. Docker Not Available

- **Issue**: The dev container does not have Docker installed or accessible
- **Impact**: Cannot start Postgres and Redis containers required for the application
- **Evidence**:

  ```bash
  $ docker version
  bash: docker: command not found

  $ dockerd
  sudo: dockerd: command not found
  ```

### 2. Database Services Not Running

- **Issue**: PostgreSQL (port 5432) and Redis (port 6379) are not accessible
- **Impact**: Cannot run migrations, seed data, or start the API server
- **Evidence**:

  ```bash
  $ pg_isready -h localhost -p 5432
  bash: pg_isready: command not found

  $ netstat -tln | grep -E "5432|6379"
  (no output - ports not listening)
  ```

---

## What Was Prepared

### ✅ 1. End-to-End Test Script Created

Created comprehensive test script: `scripts/e2e-smoke-test.sh`

**Features**:

- Dependency checking (curl, jq, psql, redis-cli)
- Service health verification
- Database data setup
- Complete Time & Attendance flow:
  - Clock in
  - Break start
  - Break end
  - Clock out
- Exception generation and resolution
- Audit log verification
- Detailed reporting

### ✅ 2. Environment Configuration

Created `.env` file from `.env.example` with default configuration:

```env
DATABASE_URL=postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev
REDIS_URL=redis://:unifocus_dev_redis@localhost:6379
API_URL=http://localhost:3001
PORT=3001
```

### ✅ 3. Dependencies Installed

```bash
$ pnpm install
✓ All workspace dependencies installed successfully
```

---

## Complete Test Plan (Ready to Execute)

Once Docker is available, run the following commands:

### Step 1: Start Dependencies

```bash
# Start Postgres and Redis
docker compose up -d

# Verify services are running
docker compose ps
```

**Expected Output**:

```
NAME                 IMAGE                 STATUS
unifocus-postgres    postgres:16-alpine    Up (healthy)
unifocus-redis       redis:7-alpine        Up (healthy)
```

### Step 2: Run Database Migrations

```bash
cd services/api
pnpm prisma migrate deploy
```

**Expected Output**:

```
✓ Migration applied successfully
```

### Step 3: Seed Demo Data

```bash
cd services/api
pnpm prisma db seed
```

**Expected Output**:

```
🌱 Starting database seed...
✓ Created tenant: Demo Tenant
✓ Created property: Downtown Office
✓ Created employee: Alice Johnson
✓ Created employee: Bob Smith
... (more seed data)
```

### Step 4: Start API Server

```bash
# In terminal 1
cd services/api
pnpm dev
```

**Expected Output**:

```
Server listening on http://localhost:3001
```

### Step 5: Start Web App (Optional)

```bash
# In terminal 2
cd apps/web
pnpm dev
```

**Expected Output**:

```
VITE ready in XXXms
➜  Local:   http://localhost:3000/
```

### Step 6: Verify API Health Endpoints

```bash
# Test /health endpoint
curl http://localhost:3001/health

# Expected: {"status":"ok"}

# Test database connectivity
curl http://localhost:3001/api/tenants

# Expected: JSON array of tenants
```

### Step 7: Run E2E Smoke Test

```bash
cd /workspaces/Unifocus-Simple
./scripts/e2e-smoke-test.sh
```

**Expected Output**:

```
================================
Unifocus E2E Smoke Test
================================

[STEP] Checking dependencies...
[✓] All dependencies available

[STEP] Checking if services are running...
[✓] PostgreSQL is running
[✓] Redis is running
[✓] API is running

[STEP] Testing API health endpoints...
[✓] /health endpoint: OK

[STEP] Fetching demo data from database...
[✓] Found demo tenant: <tenant-id>
[✓] Found demo employee: <employee-id>
[✓] Found/created schedule: <schedule-id>
[✓] Found/created shift: <shift-id>

[STEP] Executing Time & Attendance flow...
[INFO] 1. Clocking in...
[✓] Clocked in: <punch-id>
[✓] Clock in verified in database

[INFO] 2. Starting break...
[✓] Break started: <punch-id>

[INFO] 3. Ending break...
[✓] Break ended: <punch-id>

[INFO] 4. Clocking out...
[✓] Clocked out: <punch-id>
[✓] All 4 punches verified in database

[STEP] Checking for exceptions...
[INFO] Found 0 pending exception(s)

[STEP] Test Summary

Punch Records:
 id | type | timestamp | shiftId
----+------+-----------+---------
 ... | in   | 2026-02-03 09:05:00 | ...
 ... | break_start | 2026-02-03 12:00:00 | ...
 ... | break_end | 2026-02-03 12:30:00 | ...
 ... | out  | 2026-02-03 17:00:00 | ...

[✓] End-to-end smoke test completed successfully!
```

---

## Manual Test Procedures

If the automated script cannot run, follow these manual tests:

### Test 1: Create Employee Punch (Clock In)

```bash
# Get tenant and employee IDs from seed data
TENANT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Tenant\" LIMIT 1;" | xargs)
EMPLOYEE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Employee\" LIMIT 1;" | xargs)

# Create clock in punch
curl -X POST http://localhost:3001/api/punches \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"type\": \"in\",
    \"deviceId\": \"test-device-001\"
  }"

# Verify in database
psql "$DATABASE_URL" -c "SELECT * FROM \"Punch\" WHERE \"employeeId\" = '$EMPLOYEE_ID' ORDER BY timestamp DESC LIMIT 1;"
```

**Expected**: Punch record created with type='in'

### Test 2: Create Break Punches

```bash
# Start break
curl -X POST http://localhost:3001/api/punches \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"type\": \"break_start\",
    \"deviceId\": \"test-device-001\"
  }"

# End break
curl -X POST http://localhost:3001/api/punches \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"type\": \"break_end\",
    \"deviceId\": \"test-device-001\"
  }"
```

**Expected**: Two punch records created (break_start, break_end)

### Test 3: Create Clock Out Punch

```bash
curl -X POST http://localhost:3001/api/punches \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"type\": \"out\",
    \"deviceId\": \"test-device-001\"
  }"
```

**Expected**: Punch record created with type='out'

### Test 4: Check for Exceptions

```bash
# Query exceptions
curl -X GET "http://localhost:3001/api/exceptions?employeeId=$EMPLOYEE_ID" \
  -H "X-Tenant-ID: $TENANT_ID"

# Check database
psql "$DATABASE_URL" -c "SELECT id, type, status, \"employeeId\" FROM \"Exception\" WHERE \"employeeId\" = '$EMPLOYEE_ID';"
```

**Expected**: Exceptions generated if punches violate business rules (e.g., early in, late out, long break)

### Test 5: Resolve Exception

```bash
# Get exception ID
EXCEPTION_ID=$(curl -s "http://localhost:3001/api/exceptions?employeeId=$EMPLOYEE_ID&status=pending" \
  -H "X-Tenant-ID: $TENANT_ID" | jq -r '.[0].id')

# Resolve exception
curl -X PATCH "http://localhost:3001/api/exceptions/$EXCEPTION_ID/resolve" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "status": "approved",
    "notes": "Approved during testing"
  }'

# Verify audit log
psql "$DATABASE_URL" -c "SELECT * FROM \"AuditLog\" WHERE \"entityType\" = 'Exception' AND \"entityId\" = '$EXCEPTION_ID';"
```

**Expected**:

- Exception status updated to 'approved'
- AuditLog entry created with action='resolve'

---

## Web App Authentication Test

### Missing: Cognito Configuration

The web app requires AWS Cognito configuration for authentication. The following environment variables are missing:

```env
# Required for Cognito authentication
VITE_COGNITO_USER_POOL_ID=<your-pool-id>
VITE_COGNITO_CLIENT_ID=<your-client-id>
VITE_COGNITO_REGION=us-east-1
```

### How to Configure Cognito (from COGNITO_SETUP.md):

1. **Create Cognito User Pool** (via AWS Console or Terraform):

   ```bash
   cd infra/terraform/environments/dev
   terraform apply
   ```

2. **Get Cognito IDs**:

   ```bash
   # From Terraform outputs
   terraform output cognito_user_pool_id
   terraform output cognito_client_id

   # Or from AWS Console
   # Cognito > User Pools > <your-pool> > App Integration > App clients
   ```

3. **Update .env**:

   ```bash
   echo "VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX" >> .env
   echo "VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx" >> .env
   echo "VITE_COGNITO_REGION=us-east-1" >> .env
   ```

4. **Restart web app**:
   ```bash
   cd apps/web
   pnpm dev
   ```

### Manual Web App Test (with Cognito):

1. Navigate to http://localhost:3000
2. Click "Sign In" button
3. Register new user or sign in with existing credentials
4. Verify:
   - ✓ Redirected to home page after login
   - ✓ User name displayed in header
   - ✓ Can access protected routes (Timecard, Exceptions)
   - ✓ API calls include authentication token

---

## Test Result Summary

### ❌ Blocked Tests

| Test                           | Status     | Reason                                   |
| ------------------------------ | ---------- | ---------------------------------------- |
| Start Docker dependencies      | ❌ Blocked | Docker not available                     |
| Run database migrations        | ❌ Blocked | Database not running                     |
| Seed demo data                 | ❌ Blocked | Database not running                     |
| Start API server               | ❌ Blocked | Database not running                     |
| Test API health endpoints      | ❌ Blocked | API not running                          |
| Execute Time & Attendance flow | ❌ Blocked | API not running                          |
| Test exception generation      | ❌ Blocked | API not running                          |
| Test exception resolution      | ❌ Blocked | API not running                          |
| Verify audit logs              | ❌ Blocked | Database not running                     |
| Test web app authentication    | ❌ Blocked | Cognito not configured + app not running |

### ✅ Completed Preparations

| Task                     | Status      | Notes                     |
| ------------------------ | ----------- | ------------------------- |
| Create .env file         | ✅ Complete | Copied from .env.example  |
| Install dependencies     | ✅ Complete | pnpm install successful   |
| Create E2E test script   | ✅ Complete | scripts/e2e-smoke-test.sh |
| Document test procedures | ✅ Complete | This document             |

---

## How to Resolve Blockers

### Option 1: Use Docker Desktop (Recommended)

1. Install Docker Desktop on host machine
2. Ensure Docker socket is mounted in dev container
3. Restart dev container
4. Run test:
   ```bash
   ./scripts/e2e-smoke-test.sh
   ```

### Option 2: Use External Services

1. Set up Postgres and Redis on host or cloud
2. Update DATABASE_URL and REDIS_URL in .env
3. Run migrations: `cd services/api && pnpm prisma migrate deploy`
4. Run seed: `cd services/api && pnpm prisma db seed`
5. Start API: `cd services/api && pnpm dev`
6. Run test: `./scripts/e2e-smoke-test.sh`

### Option 3: Manual Testing

Follow the "Manual Test Procedures" section above to test each component individually.

---

## Required File Changes for Docker Support

Update `scripts/start-deps.sh` to support both docker-compose v1 and v2:

```bash
#!/bin/bash
# Start Docker Compose services

echo "Starting development dependencies..."

# Try docker compose (v2) first, fall back to docker-compose (v1)
if command -v docker &> /dev/null; then
  if docker compose version &> /dev/null 2>&1; then
    docker compose up -d
  else
    docker-compose up -d
  fi
else
  echo "❌ Docker is not available"
  echo "Please install Docker or run services manually"
  exit 1
fi

echo "Waiting for services to be healthy..."
sleep 5

# Check if services are running
if docker compose ps 2>/dev/null | grep -q "Up" || docker-compose ps 2>/dev/null | grep -q "Up"; then
  echo "✅ Services started successfully!"
  # ... rest of script
fi
```

---

## Next Steps

Once Docker is available:

1. **Start dependencies**: `pnpm deps:start`
2. **Run migrations**: `cd services/api && pnpm prisma migrate deploy`
3. **Seed data**: `cd services/api && pnpm prisma db seed`
4. **Start API**: `cd services/api && pnpm dev`
5. **Start web**: `cd apps/web && pnpm dev`
6. **Run E2E test**: `./scripts/e2e-smoke-test.sh`

**Expected result**: All tests pass with green checkmarks ✅

---

## Conclusion

**Status**: ❌ **E2E testing blocked due to missing Docker support**

**Deliverables**:

- ✅ Comprehensive E2E test script created
- ✅ Test documentation complete
- ✅ Manual test procedures documented
- ✅ Clear instructions for resolving blockers

**To complete testing**: Install Docker in the dev container or use external database services.
