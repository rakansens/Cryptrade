#!/usr/bin/env node

/**
 * Fix require(...) as jest.Mock patterns
 * Replace with proper jest.mocked() or type casting
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
  
  // Pattern 1: require('module' as jest.Mock) -> require('module') as jest.Mock
  content = content.replace(
    /require\((['"][^'"]+['"]) as jest\.Mock\)/g,
    'require($1) as jest.Mock'
  );
  
  // Pattern 2: (require('module' as jest.Mock).method) -> (require('module') as jest.Mock).method
  content = content.replace(
    /\(require\((['"][^'"]+['"]) as jest\.Mock\)\.(\w+)\)/g,
    '(require($1) as jest.Mock).$2'
  );
  
  // Pattern 3: require('module' as jest.Mock).method -> (require('module') as jest.Mock).method
  content = content.replace(
    /require\((['"][^'"]+['"]) as jest\.Mock\)\.(\w+)/g,
    '(require($1) as any).$2'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    filesFixed.push(file);
    console.log(`✓ Fixed mock patterns in ${file}`);
  }
});

console.log(`\nFixed ${totalFixed} files total`);
if (filesFixed.length > 0) {
  console.log('\nFiles fixed:');
  filesFixed.forEach(file => console.log(`  - ${file}`));
}