# Labor Compliance Rules System - Manual Testing Guide

## Overview

This guide provides step-by-step instructions for manually testing the Labor Compliance Rules system. It covers:

- Feature flag configuration
- Rule compilation workflow
- Rule validation execution
- LLM integration testing (when OpenAI API is configured)
- UI testing in the web application
- Enforcement hook validation

**Prerequisites:**

- Access to admin account in Unifocus application
- Docker containers running (if testing locally)
- Postman or similar API testing tool (for API endpoints)
- OPENAI_API_KEY set in environment (for LLM compilation tests)

---

## Part 1: Feature Flag Configuration

### Enable Compliance Rules Feature

1. **Set Environment Variables:**

   ```bash
   # In services/api/.env or your deployment environment
   COMPLIANCE_RULES_ENABLED=true
   OPENAI_API_KEY=sk-your-actual-key-here  # Only needed for LLM compilation
   OPENAI_MODEL=gpt-4-turbo                # Default model
   ```

2. **Verify Configuration:**

   ```bash
   # Check that config loads correctly
   curl -X GET http://localhost:3000/api/health
   # Should respond with 200 OK
   ```

3. **Disable Feature (Backward Compatibility Test):**
   ```bash
   # Set to false to test feature flag check
   COMPLIANCE_RULES_ENABLED=false
   ```

   - Attempt to compile rules
   - Should receive 403 Forbidden response with message: "Labor compliance rules feature is not enabled"

---

## Part 2: Rule Compilation Testing

### Manual Compilation via API (Postman)

**Test Case 1: Basic Compilation**

1. **Request:**

   ```http
   POST /api/compliance/compile
   Content-Type: application/json
   Authorization: Bearer {admin-token}

   {
     "complianceText": "• 11-hour minimum rest period between shifts\n• 30-minute meal break required for 5+ hour shifts\n• 8-hour daily limit before overtime",
     "name": "Sample Labor Laws",
     "context": "California labor law standards"
   }
   ```

2. **Expected Response (201 Created):**
   ```json
   {
     "success": true,
     "rulePackageId": "pkg_abc123",
     "rules": [
       {
         "id": "rule_001",
         "ruleId": "MIN_REST_BETWEEN_SHIFTS",
         "name": "Minimum Rest Between Shifts",
         "description": "Enforces minimum rest period...",
         "enabled": true,
         "severity": "ERROR",
         "params": {
           "minimumRestHours": 11
         }
       },
       {
         "id": "rule_002",
         "ruleId": "MEAL_BREAK_REQUIRED",
         "name": "Meal Break Required",
         "enabled": true,
         "severity": "ERROR",
         "params": {
           "minimumShiftHours": 5,
           "breakMinutes": 30
         }
       },
       {
         "id": "rule_003",
         "ruleId": "DAILY_OVERTIME",
         "name": "Daily Overtime",
         "enabled": true,
         "severity": "WARNING",
         "params": {
           "dailyHourThreshold": 8
         }
       }
     ],
     "message": "Successfully created rule package with 3 rules"
   }
   ```

**Test Case 2: Compilation with Non-Admin User**

1. **Using non-admin token** in Authorization header
2. **Expected Response (403 Forbidden):**
   ```json
   {
     "success": false,
     "message": "Forbidden"
   }
   ```

**Test Case 3: Invalid Input**

1. **Request with too-short text:**

   ```json
   {
     "complianceText": "Too short"
   }
   ```

2. **Expected Response (400 Bad Request):**
   ```json
   {
     "success": false,
     "message": "Validation failed - complianceText must be at least 10 characters"
   }
   ```

**Test Case 4: Feature Flag Disabled**

1. **With COMPLIANCE_RULES_ENABLED=false**
2. **Any compilation request should return (403):**
   ```json
   {
     "success": false,
     "message": "Labor compliance rules feature is not enabled"
   }
   ```

---

## Part 3: Rule Publishing Testing

### Publishing Draft Rule Packages

**Test Case 1: Successful Publishing**

1. **First, create a rule package** (use Test Case 1 from Part 2)
   - Note the `rulePackageId` from response

2. **Request:**

   ```http
   POST /api/compliance/publish/{rulePackageId}
   Authorization: Bearer {admin-token}

   {
     "message": "Published v1 of California labor law standards"
   }
   ```

3. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "version": 2,
     "message": "Rule package published successfully"
   }
   ```

**Test Case 2: Verify Status Change**

1. **List all packages:**

   ```http
   GET /api/compliance/packages
   Authorization: Bearer {admin-token}
   ```

2. **Verify that first package now shows:**
   ```json
   {
     "id": "pkg_abc123",
     "status": "PUBLISHED",
     "version": 2,
     "publishedAt": "2025-01-15T14:30:00Z"
   }
   ```

**Test Case 3: Multiple Versions**

1. Create a new DRAFT by compiling different text
2. Publish it - version should increment
3. Verify both packages exist with different versions

---

## Part 4: Rule List/Retrieve Testing

### List and View Rule Packages

**Test Case 1: List All Packages**

1. **Request:**

   ```http
   GET /api/compliance/packages
   Authorization: Bearer {admin-token}
   ```

2. **Expected Response (200):**
   ```json
   {
     "packages": [
       {
         "id": "pkg_abc123",
         "tenantId": "tenant_xyz",
         "name": "Sample Labor Laws",
         "status": "PUBLISHED",
         "version": 2,
         "sourceText": "...",
         "compiledRules": [
           {
             /* rule objects */
           }
         ],
         "createdBy": "user_123",
         "createdAt": "2025-01-15T10:00:00Z",
         "publishedAt": "2025-01-15T14:30:00Z",
         "publishedBy": "user_456"
       }
     ],
     "total": 1
   }
   ```

**Test Case 2: Retrieve Specific Package**

1. **Request:**

   ```http
   GET /api/compliance/packages/{rulePackageId}
   Authorization: Bearer {admin-token}
   ```

2. **Expected Response (200):**
   - Full package with all compiled rules

3. **With Invalid ID:**
   - Expected Response (404 Not Found)

**Test Case 3: Pagination/Scope**

- Only packages for the authenticated user's tenant should be returned
- Cross-tenant leakage should be prevented

---

## Part 5: Rule Validation Testing

### Running Compliance Validation

**Test Case 1: Validate Compliant Shifts**

1. **Setup:**
   - Publish a rule package (if not already done)
   - Create shifts in system that comply with all rules:
     - 11+ hours rest between days
     - 30-minute break on 5+ hour shifts
     - Less than 8 hours per day

2. **Request:**

   ```http
   POST /api/compliance/validate
   Authorization: Bearer {admin-token}
   Content-Type: application/json

   {
     "rulePackageId": "pkg_abc123",
     "dateStart": "2025-01-01T00:00:00Z",
     "dateEnd": "2025-01-31T23:59:59Z"
   }
   ```

3. **Expected Response (200):**
   ```json
   {
     "success": true,
     "rulePackageId": "pkg_abc123",
     "dateRange": {
       "start": "2025-01-01T00:00:00Z",
       "end": "2025-01-31T23:59:59Z"
     },
     "results": [],
     "totalViolations": 0
   }
   ```

**Test Case 2: Validate Non-Compliant Shifts**

1. **Setup:**
   - Create shifts that violate rules:
     - Less than 11 hours between shifts
     - Insufficient break on long shift
     - More than 8 hours worked in a day

2. **Validation results should show violations:**
   ```json
   {
     "success": true,
     "results": [
       {
         "employeeId": "emp_001",
         "violationCount": 2,
         "hasErrors": true,
         "hasWarnings": false,
         "violations": [
           {
             "ruleId": "MIN_REST_BETWEEN_SHIFTS",
             "ruleName": "Minimum Rest Between Shifts",
             "severity": "ERROR",
             "date": "2025-01-02",
             "details": {
               "days": "2025-01-01 and 2025-01-02",
               "restHours": 10,
               "minimumRequired": 11
             }
           }
         ]
       }
     ],
     "totalViolations": 2
   }
   ```

**Test Case 3: Single Employee Validation**

1. **Request with `employeeId` parameter:**

   ```json
   {
     "rulePackageId": "pkg_abc123",
     "employeeId": "emp_001",
     "dateStart": "2025-01-01T00:00:00Z",
     "dateEnd": "2025-01-31T23:59:59Z"
   }
   ```

2. **Should only validate shifts for specified employee**

**Test Case 4: Invalid Date Range**

1. **Request with end date before start date:**
   - Expected: 400 Bad Request

2. **Request with future dates:**
   - Should work but may have no data to validate

---

## Part 6: Rule Clarification Testing

### Getting LLM Clarifications (Requires OPENAI_API_KEY)

**Test Case 1: Clarify Rule**

1. **Request:**

   ```http
   POST /api/compliance/clarify
   Authorization: Bearer {any-auth-token}
   Content-Type: application/json

   {
     "ruleName": "Minimum Rest Between Shifts",
     "ruleDescription": "Enforces minimum rest period between consecutive shifts",
     "sourceText": "Employees must have minimum 11 hours rest between shifts"
   }
   ```

2. **Expected Response (200):**
   ```json
   {
     "success": true,
     "ruleName": "Minimum Rest Between Shifts",
     "clarification": "This rule ensures that employees receive adequate rest between work periods. An 11-hour rest period includes sleeping time and personal time. Exceptions may apply for emergency situations or voluntary shift extensions..."
   }
   ```

**Test Case 2: Clarify Without Source Text**

1. **Request without `sourceText` field:**
   - Should still provide clarification based on name and description

---

## Part 7: UI Testing in Web Application

### Navigating Compliance Rules in Settings

**Test Case 1: Access Compliance Rules Modal**

1. Login as admin user
2. Navigate to Settings page
3. Look for "Labor Compliance Rules" card in the settings grid
4. Click the card to open the modal

**Test Case 2: Compile Tab**

1. In the "Compile" tab:
   - Paste sample compliance text:
     ```
     • All employees must receive a minimum of 11 consecutive hours off duty between shifts
     • A meal break of at least 30 minutes is required for all shifts longer than 5 hours
     • No employee may work more than 8 hours in a single day without overtime compensation
     ```
   - Enter a name (e.g., "Company Policy v2.1")
   - Click "Compile Rules via LLM"
   - Observe loading state and results
   - Rules should appear with extracted parameters

2. **Expected:**
   - 3 rules extracted and displayed
   - Success toast notification
   - Rules show in a list format

**Test Case 3: Manage Tab**

1. In the "Manage" tab:
   - **Draft Section:** Should show rules created in Compile tab
   - Click "Publish" button next to draft
   - Observe status change to PUBLISHED
   - **Published Section:** Should now show published rules

2. **Expected:**
   - Both draft and published packages visible
   - Clear visual distinction between statuses
   - Published shows version number

**Test Case 4: Validate Tab**

1. In the "Validate" tab:
   - Select a published rule package from dropdown
   - Select a date range (or use default last 30 days)
   - Optionally enter an employee ID
   - Click "Run Validation"

2. **Expected:**
   - Results display showing violation count
   - Errors and warnings highlighted differently
   - Details about specific violations (if any)

**Test Case 5: Modal Close**

1. Click the X or outside modal to close
2. Modal should dismiss cleanly
3. Settings page should remain visible

---

## Part 8: Enforcement Hook Testing

### Verify Compliance Validation on Shift Creation

**Test Case 1: Shift Creation with Feature Enabled**

1. **Ensure:**

   ```
   COMPLIANCE_RULES_ENABLED=true
   Rule package exists and is PUBLISHED
   ```

2. **Create a shift via API or UI:**

   ```http
   POST /api/schedules/{scheduleId}/shifts
   {
     "dayOfWeek": 1,
     "startTime": "09:00",
     "endTime": "17:00",
     "breakMinutes": 30
   }
   ```

3. **Expected:**
   - Shift created successfully (201)
   - Background validation triggered (may not see immediate results)
   - Check server logs for: "Compliance validation queued for shift"

4. **Verify in logs:**
   ```
   DEBUG: Compliance validation queued for shift shift_123
   ```

**Test Case 2: Shift Creation with Feature Disabled**

1. **Ensure:**

   ```
   COMPLIANCE_RULES_ENABLED=false
   ```

2. **Create a shift (same as Test 1)**

3. **Expected:**
   - Shift created successfully (201)
   - NO validation logging
   - No impact to shift creation

**Test Case 3: Multiple Shifts**

1. Create several shifts in the same day/employee schedule
2. Verify validation triggers for each without blocking creation
3. No performance impact on shift API response times

---

## Part 9: Regression Testing

### Ensure No Breaking Changes

**Test Case 1: All Existing Endpoints Still Work**

1. **Test time and attendance endpoints:**
   - POST /api/schedules
   - GET /api/schedules
   - POST /api/punches
   - GET /api/exceptions

2. **Expected:**
   - All endpoints work as before
   - No new required parameters
   - Response formats unchanged

**Test Case 2: RBAC Still Enforced**

1. Test each compliance endpoint with:
   - Admin user → Should work
   - Manager user → Should be forbidden
   - Employee user → Should be forbidden

**Test Case 3: Tenant Isolation**

1. Create rules for Tenant A
2. Login as Tenant B user
3. Attempt to:
   - List packages → Should be empty
   - Access specific package → Should get 404 or empty list

---

## Part 10: Performance & Scale Testing

### Load and Performance Validation

**Test Case 1: Bulk Validation**

1. **Request validation on 100 employees over 30 days:**
   - Should handle gracefully (may take 30-60 seconds)
   - Should not cause API timeout (request timeout > 120 seconds)

2. **Monitor:**
   - Database query times
   - Memory usage
   - CPU usage

**Test Case 2: Large Compliance Text**

1. **Compile with large document (10K chars max):**
   - Should parse and extract rules
   - Should handle near-max size gracefully

**Test Case 3: Concurrent Compilations**

1. **Fire 5 concurrent compilation requests:**
   - All should eventually complete
   - No request should timeout
   - No data corruption

---

## Part 11: Error Handling & Edge Cases

### Test Error Scenarios

**Test Case 1: Missing Required Fields**

1. **Compilation without complianceText:**
   - Expected: 400 Bad Request

2. **Validation without rulePackageId:**
   - Expected: 400 Bad Request

**Test Case 2: Invalid Format**

1. **Compilation with non-string text**
2. **Date validation with invalid ISO format**
3. **Employee ID with invalid UUID format**

**Test Case 3: Resource Not Found**

1. **Publish non-existent package ID**
   - Expected: 404 Not Found

2. **Validate with non-existent rule package**
   - Expected: Not found or empty results

**Test Case 4: Unauthorized Access**

1. **No Authorization header**
   - Expected: 401 Unauthorized

2. **Invalid or expired token**
   - Expected: 401 Unauthorized

**Test Case 5: Unsupported Operations**

1. **Attempt to unpublish a package** (not supported)
   - Expected: 404 or 405 Method Not Allowed

---

## Troubleshooting Guide

### Common Issues

**Issue: "Feature is not enabled" on compilation**

- **Solution:** Check that `COMPLIANCE_RULES_ENABLED=true` in .env
- Restart the API server after changing env vars
- Verify with `curl http://localhost:3000/api/health`

**Issue: LLM compilation returns 500 error**

- **Solution:** Verify OPENAI_API_KEY is set and valid
- Check OpenAI API quota and billing
- Review server logs for detailed error message
- Try with simpler compliance text first

**Issue: Validation returns no violations (but should)**

- **Solution:** Verify rule package status is PUBLISHED (not DRAFT)
- Check that date range covers the shifts you created
- Verify shift data exists in database
- Review server logs for validation errors

**Issue: UI modal doesn't open**

- **Solution:** Check browser console for errors
- Verify JavaScript is enabled
- Try hard refresh (Ctrl+Shift+R)
- Check that apiClient functions are defined

**Issue: Shifts not created (blocked by validation)**

- **Solution:** Check COMPLIANCE_RULES_ENABLED is false (validation shouldn't block)
- Review enforcement hook logs
- Verify rule package exists if feature is enabled

---

## Testing Checklist

- [ ] Feature flag enabled correctly
- [ ] Compilation endpoint works with sample text
- [ ] Publishing changes status from DRAFT to PUBLISHED
- [ ] List endpoint shows all packages
- [ ] Retrieve endpoint fetches specific package
- [ ] Validation runs without errors
- [ ] Validation identifies compliant shifts correctly
- [ ] Validation identifies non-compliant shifts correctly
- [ ] Clarification endpoint works (with OpenAI key)
- [ ] UI modal opens from Settings page
- [ ] All three tabs (Compile, Manage, Validate) function
- [ ] Shift creation works with feature enabled
- [ ] Shift creation works with feature disabled
- [ ] RBAC enforced on all endpoints
- [ ] Tenant isolation verified
- [ ] No breaking changes to existing endpoints
- [ ] Error handling works for invalid inputs
- [ ] Performance acceptable for bulk operations

---

## Next Steps for QA

1. **Automated Testing:** Run the E2E tests with `pnpm test`
2. **Browsers:** Test UI in Chrome, Firefox, Safari, Edge
3. **Devices:** Test on desktop, tablet, mobile (responsive)
4. **Languages:** If i18n enabled, test in multiple languages
5. **Accessibility:** Test with screen reader, keyboard navigation

---

## Support & Feedback

For issues or additional test scenarios, please:

1. Document the test case
2. Capture error messages and logs
3. Report with expected vs. actual results
4. Tag as "compliance" or "rules-engine"
