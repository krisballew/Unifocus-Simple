#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'tests/scheduling-v2.test.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Parse response.body and extract data property explicitly where it's used
// Pattern: const body = JSON.parse(response.body); t.ok(body.id, ...)
// Should be: const { data: body } = JSON.parse(response.body); t.ok(body.id, ...)
// OR: const body = JSON.parse(response.body); t.ok(body.data.id, ...)

const replacements = [
  // Fix for "Returns 201 Created" test
  {
    pattern: /const body = JSON\.parse\(response\.body\);\s+t\.ok\(body\.id, 'Returns period ID'\);/g,
    replacement: `const { data: body } = JSON.parse(response.body);
      t.ok(body.id, 'Returns period ID');`,
  },
  // Fix for lifetime test - parse and extract data
  {
    pattern: /const period = JSON\.parse\(createResponse\.body\);\s+t\.equal\(period\.status, 'DRAFT', 'Initial status is DRAFT'\);/,
    replacement: `const createData = JSON.parse(createResponse.body);
    const period = createData.data || createData;
    t.equal(period.status, 'DRAFT', 'Initial status is DRAFT');`,
  },
  // Fix for publish response
  {
    pattern: /const published = JSON\.parse\(publishResponse\.body\);\s+t\.equal\(published\.period\.status, 'PUBLISHED', 'Status is PUBLISHED'\);/g,
    replacement: `const publishedData = JSON.parse(publishResponse.body);
    const published = publishedData.data || publishedData;
    t.equal(published.period.status, 'PUBLISHED', 'Status is PUBLISHED');`,
  },
  // Fix for lock response
  {
    pattern: /const locked = JSON\.parse\(lockResponse\.body\);\s+t\.equal\(locked\.status, 'LOCKED', 'Status is LOCKED'\);/g,
    replacement: `const lockData = JSON.parse(lockResponse.body);
    const locked = lockData.data || lockData;
    t.equal(locked.status, 'LOCKED', 'Status is LOCKED');`,
  },
  // Fix for periods list
  {
    pattern: /const periods = JSON\.parse\(listResponse\.body\);\s+const finalPeriod = periods\.find/g,
    replacement: `const listData = JSON.parse(listResponse.body);
    const periods = Array.isArray(listData) ? listData : (listData.data || []);
    const finalPeriod = periods.find`,
  },
];

let changes = 0;
for (const { pattern, replacement } of replacements) {
  const testPattern = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
  const matches = content.match(testPattern);
  if (matches) {
    changes += matches.length;
    content = content.replace(testPattern, replacement);
  }
}

console.log(`Fixed ${changes} response parsing issues`);
fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Updated ${filePath}`);
