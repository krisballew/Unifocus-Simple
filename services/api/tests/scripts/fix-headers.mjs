import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Comprehensive line-based codemod for all header patterns
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.join(__dirname, '..', 'scheduling-v2.test.ts');
let lines = fs.readFileSync(testFilePath, 'utf-8').split('\n');

let headerReplacements = 0;

console.log('🔧 Comprehensive header replacement codemod...\n');

// Process lines to find and replace header objects
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  
  // Look for "headers: {" pattern (with any indentation and possible ending comma or semicolon)
  if (line.includes('headers: {')) {
    // Capture the prefix (everything before "headers: {")
    const match = line.match(/^(\s*)(.*)headers:\s*\{/);
    if (!match) {
      i++;
      continue;
    }
    
    const indent = match[1];
    const prefix = match[2]; // Should be empty or just whitespace in most cases
    
    // Check closing pattern - should be on a line that starts with "}" possibly followed by comma
    let foundClose = false;
    let closeLineIdx = -1;
    
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const closeLine = lines[j];
      if (closeLine.trim() === '},' || closeLine.trim() === '},') {
        foundClose = true;
        closeLineIdx = j;
        break;
      }
    }
    
    if (foundClose && closeLineIdx > i) {
      // Check if this is a header object (contains 'x-tenant-id' or 'x-user-id')
      let isHeaderObject = false;
      for (let j = i + 1; j < closeLineIdx; j++) {
        if (lines[j].includes("'x-tenant-id'") || lines[j].includes("'x-user-id'")) {
          isHeaderObject = true;
          break;
        }
      }
      
      if (isHeaderObject) {
        // Replace this entire block with single line: headers: adminHeaders,
        // But check if this is for /open-shifts/.../claim (should use employeeHeaders)
        let useEmployeeHeaders = false;
        // Look backwards for the URL to see if it's a claim endpoint
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (lines[j].includes('/open-shifts/') && lines[j].includes('/claim')) {
            useEmployeeHeaders = true;
            break;
          }
        }

        const headerVariable = useEmployeeHeaders ? 'employeeHeaders' : 'adminHeaders';
        const replacement = line.replace(/headers:\s*\{/, `headers: ${headerVariable},`);
        
        lines[i] = replacement;
        // Remove lines from i+1 to closeLineIdx (inclusive)
        lines.splice(i + 1, closeLineIdx - i);
        
        headerReplacements++;
        // Don't increment i - we want to check the same position again if there's another header
        continue;
      }
    }
  }
  
  i++;
}

// Write back
const result = lines.join('\n');
fs.writeFileSync(testFilePath, result, 'utf-8');

console.log(`✓ Header replacements: ${headerReplacements}`);
console.log(`✓ File updated: ${testFilePath}`);
console.log('\n' + '='.repeat(60));
console.log(`✅ Codemod complete!`);
console.log(`Next: npm run format tests/scheduling-v2.test.ts && npm test tests/scheduling-v2.test.ts`);
console.log('='.repeat(60) + '\n');
