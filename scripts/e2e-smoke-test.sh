#!/bin/bash
# End-to-End Smoke Test Script for Unifocus Simple
# This script tests the complete Time & Attendance flow

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Unifocus E2E Smoke Test"
echo "================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TEST_TENANT_ID=""
TEST_EMPLOYEE_ID=""
TEST_SHIFT_ID=""

# Helper functions
log_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_step "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed (required for JSON parsing)"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log_error "psql is not installed"
        exit 1
    fi
    
    log_success "All dependencies available"
}

# Check if services are running
check_services() {
    log_step "Checking if services are running..."
    
    # Check Postgres
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        log_error "PostgreSQL is not running on localhost:5432"
        log_info "Run: docker compose up -d postgres"
        exit 1
    fi
    log_success "PostgreSQL is running"
    
    # Check Redis
    if ! redis-cli -h localhost -p 6379 ping &> /dev/null; then
        log_error "Redis is not running on localhost:6379"
        log_info "Run: docker compose up -d redis"
        exit 1
    fi
    log_success "Redis is running"
    
    # Check API
    if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
        log_error "API is not responding at $API_URL"
        log_info "Run: cd services/api && pnpm dev"
        exit 1
    fi
    log_success "API is running"
    
    # Check Web (optional)
    if ! curl -sf "$WEB_URL" > /dev/null 2>&1; then
        log_info "Web app is not running at $WEB_URL (optional)"
    else
        log_success "Web app is running"
    fi
}

# Test API health endpoints
test_api_health() {
    log_step "Testing API health endpoints..."
    
    # Test /health
    HEALTH_RESPONSE=$(curl -s "$API_URL/health")
    if [[ "$HEALTH_RESPONSE" == *"ok"* ]]; then
        log_success "/health endpoint: OK"
    else
        log_error "/health endpoint failed"
        echo "$HEALTH_RESPONSE"
        exit 1
    fi
    
    # Test /ready (if implemented)
    READY_RESPONSE=$(curl -s "$API_URL/ready" || echo '{"status":"not_implemented"}')
    log_info "/ready endpoint: $READY_RESPONSE"
}

# Get demo data from database
get_demo_data() {
    log_step "Fetching demo data from database..."
    
    # Get tenant ID
    TEST_TENANT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Tenant\" WHERE slug = 'demo-tenant' LIMIT 1;" | xargs)
    if [ -z "$TEST_TENANT_ID" ]; then
        log_error "Demo tenant not found. Run: pnpm --filter @unifocus/api db:seed"
        exit 1
    fi
    log_success "Found demo tenant: $TEST_TENANT_ID"
    
    # Get employee ID
    TEST_EMPLOYEE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Employee\" WHERE \"tenantId\" = '$TEST_TENANT_ID' AND \"firstName\" = 'Alice' LIMIT 1;" | xargs)
    if [ -z "$TEST_EMPLOYEE_ID" ]; then
        log_error "Demo employee 'Alice' not found"
        exit 1
    fi
    log_success "Found demo employee: $TEST_EMPLOYEE_ID"
    
    # Get or create schedule
    SCHEDULE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Schedule\" WHERE \"tenantId\" = '$TEST_TENANT_ID' AND \"employeeId\" = '$TEST_EMPLOYEE_ID' LIMIT 1;" | xargs)
    if [ -z "$SCHEDULE_ID" ]; then
        log_info "Creating schedule for employee..."
        SCHEDULE_ID=$(psql "$DATABASE_URL" -t -c "INSERT INTO \"Schedule\" (id, \"tenantId\", \"employeeId\", \"startDate\", \"endDate\", name, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$TEST_TENANT_ID', '$TEST_EMPLOYEE_ID', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'Test Schedule', NOW(), NOW()) RETURNING id;" | xargs)
    fi
    log_success "Found/created schedule: $SCHEDULE_ID"
    
    # Get or create shift
    TEST_SHIFT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Shift\" WHERE \"scheduleId\" = '$SCHEDULE_ID' LIMIT 1;" | xargs)
    if [ -z "$TEST_SHIFT_ID" ]; then
        log_info "Creating shift for schedule..."
        # Monday (1), 9:00-17:00, 60 min break
        TEST_SHIFT_ID=$(psql "$DATABASE_URL" -t -c "INSERT INTO \"Shift\" (id, \"tenantId\", \"scheduleId\", \"dayOfWeek\", \"startTime\", \"endTime\", \"breakMinutes\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$TEST_TENANT_ID', '$SCHEDULE_ID', 1, '09:00', '17:00', 60, NOW(), NOW()) RETURNING id;" | xargs)
    fi
    log_success "Found/created shift: $TEST_SHIFT_ID"
}

# Execute Time & Attendance flow
execute_ta_flow() {
    log_step "Executing Time & Attendance flow..."
    
    # Clean up any existing punches for today
    log_info "Cleaning up existing test punches..."
    psql "$DATABASE_URL" -c "DELETE FROM \"Punch\" WHERE \"employeeId\" = '$TEST_EMPLOYEE_ID' AND DATE(timestamp) = CURRENT_DATE;" > /dev/null
    
    # 1. Clock In
    log_info "1. Clocking in..."
    PUNCH_IN_RESPONSE=$(curl -s -X POST "$API_URL/api/punches" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TEST_TENANT_ID" \
        -d "{
            \"employeeId\": \"$TEST_EMPLOYEE_ID\",
            \"type\": \"in\",
            \"shiftId\": \"$TEST_SHIFT_ID\",
            \"deviceId\": \"test-device-001\",
            \"idempotencyKey\": \"test-punch-in-$(date +%s)\"
        }")
    
    PUNCH_IN_ID=$(echo "$PUNCH_IN_RESPONSE" | jq -r '.id // empty')
    if [ -z "$PUNCH_IN_ID" ]; then
        log_error "Failed to create clock in punch"
        echo "$PUNCH_IN_RESPONSE"
        exit 1
    fi
    log_success "Clocked in: $PUNCH_IN_ID"
    
    # Verify in database
    PUNCH_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"Punch\" WHERE \"employeeId\" = '$TEST_EMPLOYEE_ID' AND type = 'in' AND DATE(timestamp) = CURRENT_DATE;" | xargs)
    if [ "$PUNCH_COUNT" -eq "1" ]; then
        log_success "Clock in verified in database"
    else
        log_error "Clock in not found in database"
        exit 1
    fi
    
    # Wait a moment
    sleep 2
    
    # 2. Start Break
    log_info "2. Starting break..."
    PUNCH_BREAK_START=$(curl -s -X POST "$API_URL/api/punches" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TEST_TENANT_ID" \
        -d "{
            \"employeeId\": \"$TEST_EMPLOYEE_ID\",
            \"type\": \"break_start\",
            \"shiftId\": \"$TEST_SHIFT_ID\",
            \"deviceId\": \"test-device-001\",
            \"idempotencyKey\": \"test-break-start-$(date +%s)\"
        }")
    
    BREAK_START_ID=$(echo "$PUNCH_BREAK_START" | jq -r '.id // empty')
    if [ -z "$BREAK_START_ID" ]; then
        log_error "Failed to start break"
        echo "$PUNCH_BREAK_START"
        exit 1
    fi
    log_success "Break started: $BREAK_START_ID"
    
    sleep 2
    
    # 3. End Break
    log_info "3. Ending break..."
    PUNCH_BREAK_END=$(curl -s -X POST "$API_URL/api/punches" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TEST_TENANT_ID" \
        -d "{
            \"employeeId\": \"$TEST_EMPLOYEE_ID\",
            \"type\": \"break_end\",
            \"shiftId\": \"$TEST_SHIFT_ID\",
            \"deviceId\": \"test-device-001\",
            \"idempotencyKey\": \"test-break-end-$(date +%s)\"
        }")
    
    BREAK_END_ID=$(echo "$PUNCH_BREAK_END" | jq -r '.id // empty')
    if [ -z "$BREAK_END_ID" ]; then
        log_error "Failed to end break"
        echo "$PUNCH_BREAK_END"
        exit 1
    fi
    log_success "Break ended: $BREAK_END_ID"
    
    sleep 2
    
    # 4. Clock Out
    log_info "4. Clocking out..."
    PUNCH_OUT_RESPONSE=$(curl -s -X POST "$API_URL/api/punches" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TEST_TENANT_ID" \
        -d "{
            \"employeeId\": \"$TEST_EMPLOYEE_ID\",
            \"type\": \"out\",
            \"shiftId\": \"$TEST_SHIFT_ID\",
            \"deviceId\": \"test-device-001\",
            \"idempotencyKey\": \"test-punch-out-$(date +%s)\"
        }")
    
    PUNCH_OUT_ID=$(echo "$PUNCH_OUT_RESPONSE" | jq -r '.id // empty')
    if [ -z "$PUNCH_OUT_ID" ]; then
        log_error "Failed to create clock out punch"
        echo "$PUNCH_OUT_RESPONSE"
        exit 1
    fi
    log_success "Clocked out: $PUNCH_OUT_ID"
    
    # Verify all punches in database
    TOTAL_PUNCHES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"Punch\" WHERE \"employeeId\" = '$TEST_EMPLOYEE_ID' AND DATE(timestamp) = CURRENT_DATE;" | xargs)
    if [ "$TOTAL_PUNCHES" -eq "4" ]; then
        log_success "All 4 punches verified in database (in, break_start, break_end, out)"
    else
        log_error "Expected 4 punches, found $TOTAL_PUNCHES"
        exit 1
    fi
}

# Check for exceptions
check_exceptions() {
    log_step "Checking for exceptions..."
    
    # Get exceptions for employee
    EXCEPTIONS_RESPONSE=$(curl -s "$API_URL/api/exceptions?employeeId=$TEST_EMPLOYEE_ID&status=pending" \
        -H "X-Tenant-ID: $TEST_TENANT_ID")
    
    EXCEPTION_COUNT=$(echo "$EXCEPTIONS_RESPONSE" | jq '. | length')
    log_info "Found $EXCEPTION_COUNT pending exception(s)"
    
    if [ "$EXCEPTION_COUNT" -gt "0" ]; then
        EXCEPTION_ID=$(echo "$EXCEPTIONS_RESPONSE" | jq -r '.[0].id')
        log_info "First exception ID: $EXCEPTION_ID"
        
        # Try to resolve it
        log_info "Resolving exception..."
        RESOLVE_RESPONSE=$(curl -s -X PATCH "$API_URL/api/exceptions/$EXCEPTION_ID/resolve" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: $TEST_TENANT_ID" \
            -d '{
                "status": "approved",
                "notes": "Approved via automated test"
            }')
        
        RESOLVED_ID=$(echo "$RESOLVE_RESPONSE" | jq -r '.id // empty')
        if [ -n "$RESOLVED_ID" ]; then
            log_success "Exception resolved: $RESOLVED_ID"
            
            # Check for audit log
            AUDIT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"AuditLog\" WHERE \"entityType\" = 'Exception' AND \"entityId\" = '$EXCEPTION_ID' AND action = 'resolve';" | xargs)
            if [ "$AUDIT_COUNT" -ge "1" ]; then
                log_success "Audit log entry created for exception resolution"
            else
                log_error "No audit log entry found for exception resolution"
            fi
        else
            log_error "Failed to resolve exception"
            echo "$RESOLVE_RESPONSE"
        fi
    else
        log_info "No exceptions generated (this may be expected if punches are within schedule)"
    fi
}

# Display test summary
show_summary() {
    log_step "Test Summary"
    echo ""
    
    # Punch summary
    echo "Punch Records:"
    psql "$DATABASE_URL" -c "SELECT id, type, timestamp, \"shiftId\" FROM \"Punch\" WHERE \"employeeId\" = '$TEST_EMPLOYEE_ID' AND DATE(timestamp) = CURRENT_DATE ORDER BY timestamp;"
    
    echo ""
    echo "Exception Records:"
    psql "$DATABASE_URL" -c "SELECT id, type, status, \"createdAt\" FROM \"Exception\" WHERE \"employeeId\" = '$TEST_EMPLOYEE_ID' AND DATE(\"createdAt\") = CURRENT_DATE ORDER BY \"createdAt\";"
    
    echo ""
    echo "Recent Audit Logs:"
    psql "$DATABASE_URL" -c "SELECT id, \"entityType\", action, \"userId\", timestamp FROM \"AuditLog\" WHERE \"tenantId\" = '$TEST_TENANT_ID' ORDER BY timestamp DESC LIMIT 10;"
    
    echo ""
    log_success "End-to-end smoke test completed successfully!"
}

# Main execution
main() {
    check_dependencies
    check_services
    test_api_health
    get_demo_data
    execute_ta_flow
    check_exceptions
    show_summary
}

# Run main function
main
