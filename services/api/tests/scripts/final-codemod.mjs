import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Final codemod - uses string replacement instead of line manipulation
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.join(__dirname, '..', 'scheduling-v2.test.ts');
let content = fs.readFileSync(testFilePath, 'utf-8');

console.log('🔧 Final comprehensive codemod...\n');

// ============ Step 1: Add imports ============
console.log('Step 1: Adding imports...');
const importLine = "import { buildServer } from '../src/server.js';";
if (content.includes(importLine) && !content.includes('buildPersonaHeaders')) {
  content = content.replace(
    importLine,
    `import { buildServer } from '../src/server.js';
import { buildPersonaHeaders, TEST_PERSONAS, createTestUser } from './helpers/auth.js';
import { createTestDepartment, createTestJobRole } from './helpers/fixtures.js';`
  );
  console.log('✓ Added imports');
}

// ============ Step 2: Add user setup after properties are created ============
console.log('\nStep 2: Adding test user setup...');
const afterProperty2Pattern = /const property2 = await prisma\.property\.create\(\{[\s\S]*?\}\);\n\n  t\.teardown/;
const afterProperty2Match = content.match(afterProperty2Pattern);

if (afterProperty2Match && !content.includes('const adminUser = await createTestUser')) {
  const userAndHeadersSetup = `
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
  
  content = content.replace(afterProperty2Pattern, (match) => {
    return match.replace(/\n\n  t\.teardown/, userAndHeadersSetup + 't.teardown');
  });
  console.log('✓ Added user setup and headers');
}

// ============ Step 3: Update teardown to clean users ============
console.log('\nStep 3: Updating teardown...');
if (!content.includes('userRoleAssignment.deleteMany')) {
  content = content.replace(
    /t\.teardown\(async \(\) => \{\s+\/\/ Cleanup\s+await prisma\.wfmPublishEvent/,
    `t.teardown(async () => {
    // Cleanup
    await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.user.deleteMany({ where: { email: { in: ['admin@test.com', 'manager@test.com', 'employee@test.com'] } } });
    await prisma.wfmPublishEvent`
  );
  console.log('✓ Updated teardown');
}

// ============ Step 4: Replace header patterns with variables ============
console.log('\nStep 4: Replacing inline headers with variables...');

// Count replacements
let replacements = 0;

// Pattern 1: Multi-line headers with scopes - most complete pattern
const pattern1 = /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*',\s*'x-scopes':\s*'[^']*'\s*\}/g;
replacements += (content.match(pattern1) || []).length;
content = content.replace(pattern1, 'headers: adminHeaders');

// Pattern 2: Multi-line headers without scopes (with tenant digit)
const pattern2 = /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*'\s*\}/g;
replacements += (content.match(pattern2) || []).length;
content = content.replace(pattern2, 'headers: adminHeaders');

// Pattern 3: Plain tenant.id  
const pattern3 = /headers:\s*\{\s*'x-tenant-id':\s*tenant\.id,\s*'x-user-id':\s*'[^']*'\s*\}/g;
replacements += (content.match(pattern3) || []).length;
content = content.replace(pattern3, 'headers: adminHeaders');

console.log(`✓ Replaced ${replacements} inline header objects`);

// ============ Step 5: Special case - employee headers for claim endpoints ============
console.log('\nStep 5: Updating claim endpoint headers...');
// Find /open-shifts/.../claim followed by adminHeaders and replace with employeeHeaders
const claimPattern = /url:\s*`[^`]*\/open-shifts\/\$\{[^}]+\}\/claim`[\s\S]*?headers:\s*adminHeaders/g;
let claimReplacements = 0;
content = content.replace(claimPattern, (match) => {
  claimReplacements++;
  return match.replace(/headers:\s*adminHeaders$/, 'headers: employeeHeaders');
});
if (claimReplacements > 0) {
  console.log(`✓ Updated ${claimReplacements} claim endpoint(s) to use employeeHeaders`);
}

// ============ Step 6: Write and report ============
console.log('\nStep 6: Writing file...');
fs.writeFileSync(testFilePath, content, 'utf-8');
console.log(`✓ File updated: ${testFilePath}`);

console.log('\n' + '='.repeat(60));
console.log(`✅ Codemod complete!`);
console.log(`Total header replacements: ${replacements}`);
console.log(`Claim endpoint updates: ${claimReplacements}`);
console.log(`\nNext: npm run format tests/scheduling-v2.test.ts`);
console.log(`Then:  npm test tests/scheduling-v2.test.ts`);
console.log('='.repeat(60) + '\n');
