#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'tests/scheduling-v2.test.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const patterns = [
  {
    // Pattern 1: headers with x-tenant-id, x-user-id, content-type (most common)
    regex: /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*',\s*'content-type':\s*'application\/json',\s*\}/g,
    replacement: 'headers: adminHeaders',
  },
  {
    // Pattern 2: headers with content-type last
    regex: /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*',\s*'content-type':\s*'application\/json',\s*\},/g,
    replacement: 'headers: adminHeaders,',
  },
];

let replacementCount = 0;
for (const { regex, replacement } of patterns) {
  const matches = content.match(regex);
  if (matches) {
    replacementCount += matches.length;
    content = content.replace(regex, replacement);
  }
}

// Spread approach: replace headers block with spread of adminHeaders + content-type
const spreadPattern = /headers:\s*\{\s*'x-tenant-id':\s*tenant\d*\.id,\s*'x-user-id':\s*'[^']*',\s*'content-type':\s*'application\/json',?\s*\}/g;
const spreadMatches = content.match(spreadPattern);
if (spreadMatches) {
  replacementCount += spreadMatches.length;
  content = content.replace(spreadPattern, "headers: { ...adminHeaders, 'content-type': 'application/json' }");
}

// Actually, let's use a different approach - line based replacement
const lines = content.split('\n');
let inHeaderBlock = false;
let headerBlockStart = -1;
let resultLines = [];
let headerReplacements = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('headers: {') && !inHeaderBlock) {
    inHeaderBlock = true;
    headerBlockStart = i;
    const indentation = line.match(/^(\s*)/)[1];
    
    // Check if this is the specific pattern we want to replace
    let j = i + 1;
    let isTargetPattern = false;
    let endLine = i;
    
    while (j < lines.length && !lines[j].includes('}')) {
      if (lines[j].includes("'x-tenant-id':") && lines[j].includes("tenant")) {
        isTargetPattern = true;
      }
      j++;
    }
    
    if (j < lines.length && lines[j].includes('}')) {
      endLine = j;
    }
    
    if (isTargetPattern && endLine > i) {
      // Replace the entire block with adminHeaders
      resultLines.push(`${indentation}headers: adminHeaders,`);
      i = endLine; // Skip to end of block
      headerReplacements++;
      inHeaderBlock = false;
      continue;
    }
  }
  
  resultLines.push(line);
}

console.log(`Fixed ${headerReplacements} header blocks`);
fs.writeFileSync(filePath, resultLines.join('\n'), 'utf-8');
console.log(`Updated ${filePath}`);
