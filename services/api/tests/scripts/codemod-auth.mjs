import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Codemod: Update scheduling-v2.test.ts to use auth harness
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.join(__dirname, '..', 'scheduling-v2.test.ts');
let content = fs.readFileSync(testFilePath, 'utf-8');

let totalReplacements = 0;

function replace(pattern, replacement, description) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = (content.match(regex) || []).length;
  if (matches > 0) {
    content = content.replace(regex, replacement);
    console.log(`✓ ${description}: ${matches} replacement(s)`);
    totalReplacements += matches;
  }
  return matches;
}

console.log('🔧 Starting auth harness codemod...\n');

// ============ Step 1: Add imports ============
console.log('Step 1: Adding imports...');

const importCheck = "import { buildServer } from '../src/server.js';";
if (content.includes(importCheck) && !content.includes("buildPersonaHeaders")) {
  const importAddition = `import { buildServer } from '../src/server.js';
import { buildPersonaHeaders, TEST_PERSONAS, createTestUser } from './helpers/auth.js';
import { createTestDepartment, createTestJobRole } from './helpers/fixtures.js';`;
  
  content = content.replace(importCheck, importAddition);
  console.log('✓ Added auth and fixtures imports');
}

// ============ Step 2: Add test user setup ============
console.log('\nStep 2: Adding test user setup...');

const setupPattern = /const property2 = await prisma\.property\.create\(\{[\s\S]*?\n  \}\);\n/;
const setupMatch = content.match(setupPattern);

if (setupMatch && !content.includes('const adminUser = await createTestUser')) {
  const userSetup = `
  // Create test users for different personas
  const adminUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'admin@test.com',
    name: 'Admin User',
  });

  const managerUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'manager@test.com',
    name: 'Manager User',
  });

  const employeeUser = await createTestUser(prisma, {
    tenantId: tenant1.id,
    propertyId: property1.id,
    email: 'employee@test.com',
    name: 'Employee User',
  });

  // Build auth headers for each persona
  const adminHeaders = buildPersonaHeaders('schedulingAdmin', {
    tenantId: tenant1.id,
    userId: adminUser.id,
  });

  const managerHeaders = buildPersonaHeaders('departmentManager', {
    tenantId: tenant1.id,
    userId: managerUser.id,
  });

  const employeeHeaders = buildPersonaHeaders('employee', {
    tenantId: tenant1.id,
    userId: employeeUser.id,
  });`;

  content = content.replace(setupMatch[0], setupMatch[0] + userSetup + '\n');
  console.log('✓ Added test user creation and header variables');
}

// ============ Step 3: Update teardown ============
console.log('\nStep 3: Updating teardown...');

const teardownPattern = /t\.teardown\(async \(\) => \{\s+\/\/ Cleanup\s+await prisma\.wfmPublishEvent\.deleteMany/;
if (content.match(teardownPattern) && !content.includes('userRoleAssignment.deleteMany')) {
  const replacement = `t.teardown(async () => {
    // Cleanup
    await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.user.deleteMany({ where: { email: { in: ['admin@test.com', 'manager@test.com', 'employee@test.com'] } } });
    await prisma.wfmPublishEvent.deleteMany`;
  
  content = content.replace(teardownPattern, replacement);
  console.log('✓ Updated teardown to clean up test users');
}

// ============ Step 4: Replace header patterns (multi-line) ============
console.log('\nStep 4: Replacing header patterns...');

// Pattern 1: Multi-line headers with scopes
// headers: {\n        'x-tenant-id': tenant\d+\.id,\n        'x-user-id': '...',\n        'x-scopes': '...'\n      }
replace(
  /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*',\s*'x-scopes':\s*'[^']*'\s*\}/,
  'headers: adminHeaders',
  'Replace multi-line headers with scopes'
);

// Pattern 2: Multi-line headers without scopes
// headers: {\n        'x-tenant-id': tenant\d+\.id,\n        'x-user-id': '...'\n      }
replace(
  /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*'\s*\}/,
  'headers: adminHeaders',
  'Replace multi-line headers without scopes (with tenant digit)'
);

// Pattern 3: Multi-line headers with plain tenant (no digit)
replace(
  /headers:\s*\{\s*'x-tenant-id':\s*tenant\.id,\s*'x-user-id':\s*'[^']*'\s*\}/,
  'headers: adminHeaders',
  'Replace multi-line headers with plain tenant.id'
);

// ============ Step 5: Specific endpoint replacements for employee headers ============
console.log('\nStep 5: Handling endpoint-specific personas...');

// For /open-shifts/{id}/claim endpoints, use employeeHeaders instead
// Match pattern: url: `...open-shifts/${..}/claim`, ... headers: adminHeaders
// Replace the adminHeaders with employeeHeaders
const claimEndpointPattern = /url:\s*`.*?\/open-shifts\/\$\{[^}]+\}\/claim`[\s\S]*?headers:\s*adminHeaders/g;
let claimMatches = 0;
content = content.replace(claimEndpointPattern, (match) => {
  claimMatches++;
  return match.replace(/headers:\s*adminHeaders$/, 'headers: employeeHeaders');
});
if (claimMatches > 0) {
  console.log(`✓ Use employeeHeaders for /open-shifts/:id/claim: ${claimMatches} endpoint(s)`);
  totalReplacements += claimMatches;
}

// ============ Step 6: Write file ============
console.log('\nStep 6: Writing updated file...');

fs.writeFileSync(testFilePath, content, 'utf-8');
console.log(`✓ File updated: ${testFilePath}`);

// ============ Summary ============
console.log('\n' + '='.repeat(60));
console.log(`✅ Codemod complete!`);
console.log(`Total header replacements: ${totalReplacements}`);
console.log(`\nNext steps:`);
console.log(`1. Format:  cd services/api && npm run format tests/scheduling-v2.test.ts`);
console.log(`2. Test:    npm test tests/scheduling-v2.test.ts`);
console.log('='.repeat(60) + '\n');
