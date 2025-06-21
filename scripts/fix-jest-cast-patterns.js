#!/usr/bin/env node

/**
 * Fix (module as jest.Mock) patterns
 * Add proper jest.mocked() or use the mocked versions
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('**/*.test.{ts,tsx}', {
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**']
});

console.log(`Found ${testFiles.length} test files to check...`);

let totalFixed = 0;
const filesFixed = [];

testFiles.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern: (ImportedModule as jest.Mock).mockReturnValue -> jest.mocked(ImportedModule).mockReturnValue
  content = content.replace(
    /\((\w+) as jest\.Mock\)/g,
    'jest.mocked($1)'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    filesFixed.push(file);
    console.log(`✓ Fixed cast patterns in ${file}`);
  }
});

console.log(`\nFixed ${totalFixed} files total`);
if (filesFixed.length > 0) {
  console.log('\nFiles fixed:');
  filesFixed.forEach(file => console.log(`  - ${file}`));
}