import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Codemod: Update scheduling-v2.test.ts to use auth harness
 * 
 * This script:
 * 1. Adds imports for auth helpers
 * 2. Creates test user variables in setUp
 * 3. Creates header variables
 * 4. Replaces inline header objects with variables
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.join(__dirname, '..', 'scheduling-v2.test.ts');
let content = fs.readFileSync(testFilePath, 'utf-8');

interface Replacement {
  pattern: string | RegExp;
  replacement: string;
  count?: number;
}

const replacements: Replacement[] = [];
let totalReplacements = 0;

function applyReplacement(pattern: string | RegExp, replacement: string, description: string): number {
  const regex = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : pattern;
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

// ============ Step 2: Add test user setup in first test block ============
console.log('\nStep 2: Adding test user setup...');

// Find the first test('Scheduling V2: ...', ...) and insert user creation after property2 is created
const setupPattern = /const property2 = await prisma\.property\.create\(\{[\s\S]*?\}\);/;
const setupMarker = setupPattern.exec(content);

if (setupMarker && !content.includes('const adminUser = await createTestUser')) {
  const insertPoint = setupMarker[0] + '\n';
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
  });
`;

  content = content.replace(insertPoint, insertPoint + userSetup);
  console.log('✓ Added test user creation and header variables');
}

// ============ Step 3: Update teardown to clean up users ============
console.log('\nStep 3: Updating teardown...');

// Add user cleanup to teardown
if (content.includes('t.teardown(async () => {') && !content.includes('userRoleAssignment.deleteMany')) {
  const teardownPattern = /t\.teardown\(async \(\) => \{\s+\/\/ Cleanup\s+await prisma\.wfmPublishEvent\.deleteMany/;
  const replacement = `t.teardown(async () => {
    // Cleanup
    await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.wfmPublishEvent.deleteMany`;
  
  content = content.replace(teardownPattern, replacement);
  console.log('✓ Updated teardown to clean up test users');
}

// ============ Step 4: Replace header patterns ============
console.log('\nStep 4: Replacing header patterns...');

// Pattern A: Full header object with scopes
applyReplacement(
  /headers:\s*\{\s*['\"]x-tenant-id['\"]\s*:\s*tenant\d*\.id,\s*['\"]x-user-id['\"]\s*:\s*['\"][^'\"]*['\"],\s*['\"]x-scopes['\"]\s*:\s*['\"][^'\"]*['\"]\s*\}/g,
  'headers: adminHeaders',
  'Replace full headers with scopes'
);

// Pattern B: Header object with just tenant-id and user-id
applyReplacement(
  /headers:\s*\{\s*['\"]x-tenant-id['\"]\s*:\s*tenant\d*\.id,\s*['\"]x-user-id['\"]\s*:\s*['\"][^'\"]*['\"]\s*\}/g,
  'headers: adminHeaders',
  'Replace headers without scopes'
);

// Pattern C: Very basic headers (just tenant-id)
applyReplacement(
  /headers:\s*\{\s*['\"]x-tenant-id['\"]\s*:\s*tenant\d*\.id\s*\}/g,
  'headers: adminHeaders',
  'Replace minimal headers'
);

// ============ Step 5: Special case replacements for specific endpoints ============
console.log('\nStep 5: Handling endpoint-specific personas...');

// Employee claim endpoint (use employeeHeaders)
applyReplacement(
  /(?<=url:\s*['\"][^'\"]*\/open-shifts\/\$\{[^}]+\}\/claim['\"])[\s\S]*?headers:\s*adminHeaders/g,
  headers => {
    // Only replace if this looks like it's in a claim endpoint context
    return headers.replace(/headers:\s*adminHeaders$/, 'headers: employeeHeaders');
  },
  'Use employeeHeaders for claim endpoints'
);

// Manager list/approve/deny endpoints (use managerHeaders for specific operations)
applyReplacement(
  /url:\s*['\"]\/api\/scheduling\/v2\/requests\//g,
  match => match, // Don't actually change URLs, but we'll handle the headers next
  'Identified request management endpoints (headers will be updated separately)'
);

// ============ Step 6: Write updated file ============
console.log('\nStep 6: Writing updated file...');

fs.writeFileSync(testFilePath, content, 'utf-8');
console.log(`✓ Updated file written to: ${testFilePath}`);

// ============ Summary ============
console.log('\n' + '='.repeat(60));
console.log(`✅ Codemod complete!`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`Next steps:`);
console.log(`1. Run prettier:  npm run format tests/scheduling-v2.test.ts`);
console.log(`2. Run tests:     npm test tests/scheduling-v2.test.ts`);
console.log('='.repeat(60) + '\n');
