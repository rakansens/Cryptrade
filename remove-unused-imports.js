#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
console.log('Collecting TypeScript errors...');
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf-8' });

// Parse TS6133 errors (unused variables)
const lines = errors.split('\n');
const fileUnusedMap = new Map();

let totalErrors = 0;
let componentsErrors = 0;

for (const line of lines) {
  const match = line.match(/^(.+?):(\d+),\d+: error TS6133: '(.+?)' is declared but its value is never read\.$/);
  if (match) {
    const [, filePath, lineNum, varName] = match;
    totalErrors++;
    
    // Only process components directory
    if (filePath.includes('components/')) {
      componentsErrors++;
      const absolutePath = path.resolve(filePath);
      if (!fileUnusedMap.has(absolutePath)) {
        fileUnusedMap.set(absolutePath, new Map());
      }
      fileUnusedMap.get(absolutePath).set(parseInt(lineNum), varName);
    }
  }
}

console.log(`Found ${totalErrors} total TS6133 errors`);
console.log(`Processing ${componentsErrors} errors in ${fileUnusedMap.size} files in components/`);

// Process each file
for (const [filePath, unusedVars] of fileUnusedMap) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const modifiedLines = [];
  let removedCount = 0;
  
  // Sort unused vars by line number in descending order to avoid line number shifts
  const sortedUnused = Array.from(unusedVars.entries()).sort((a, b) => b[0] - a[0]);
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const unusedVar = unusedVars.get(lineNum);
    
    if (unusedVar) {
      const line = lines[i];
      
      // Handle import statements
      if (line.includes('import')) {
        // Handle named imports: import { a, b, c } from ...
        if (line.includes('{') && line.includes('}')) {
          const beforeBrace = line.substring(0, line.indexOf('{'));
          const afterBrace = line.substring(line.indexOf('}') + 1);
          const imports = line.substring(line.indexOf('{') + 1, line.indexOf('}')).split(',');
          
          const filteredImports = imports
            .map(imp => imp.trim())
            .filter(imp => !imp.includes(unusedVar));
          
          if (filteredImports.length === 0) {
            // Skip entire import line if no imports left
            removedCount++;
            continue;
          } else {
            // Reconstruct import line
            modifiedLines.push(`${beforeBrace}{ ${filteredImports.join(', ')} }${afterBrace}`);
            removedCount++;
            continue;
          }
        }
        
        // Handle default imports: import Something from ...
        if (new RegExp(`import\\s+${unusedVar}\\s+from`).test(line)) {
          removedCount++;
          continue; // Skip entire line
        }
        
        // Handle React-style imports: import React, { something } from ...
        if (line.includes(`import ${unusedVar},`)) {
          const newLine = line.replace(`${unusedVar}, `, '');
          modifiedLines.push(newLine);
          removedCount++;
          continue;
        }
      }
      
      // Handle destructuring assignments
      if ((line.includes('const') || line.includes('let')) && line.includes('{') && line.includes('}')) {
        const beforeBrace = line.substring(0, line.indexOf('{'));
        const afterBrace = line.substring(line.indexOf('}') + 1);
        const vars = line.substring(line.indexOf('{') + 1, line.indexOf('}')).split(',');
        
        const filteredVars = vars
          .map(v => v.trim())
          .filter(v => !v.includes(unusedVar));
        
        if (filteredVars.length > 0) {
          modifiedLines.push(`${beforeBrace}{ ${filteredVars.join(', ')} }${afterBrace}`);
          removedCount++;
          continue;
        }
      }
    }
    
    modifiedLines.push(lines[i]);
  }
  
  if (removedCount > 0) {
    // Write back to file
    fs.writeFileSync(filePath, modifiedLines.join('\n'));
    console.log(`Processed ${path.relative(process.cwd(), filePath)}: removed ${removedCount} unused variables`);
  }
}

console.log(`\nTotal files processed: ${fileUnusedMap.size}`);