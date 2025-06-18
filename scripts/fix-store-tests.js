#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all store test files
const testFiles = glob.sync('tests/unit/**/*.store.test.ts', {
  cwd: process.cwd(),
  absolute: true,
});

const jsdomHeader = `/**
 * @jest-environment jsdom
 */

`;

const jsdomRequire = `// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

`;

testFiles.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Check if file uses renderHook
  if (!content.includes('renderHook')) {
    return;
  }
  
  // Skip if already has jest-environment comment
  if (content.includes('@jest-environment')) {
    return;
  }
  
  // Add JSDOM header at the beginning
  content = jsdomHeader + content;
  
  // Find the first import statement and add the require after imports
  const importMatch = content.match(/^((?:import[^;]+;\s*\n)+)/m);
  if (importMatch) {
    const imports = importMatch[1];
    const afterImports = content.slice(importMatch.index + imports.length);
    content = jsdomHeader + imports + jsdomRequire + afterImports.replace(jsdomHeader, '');
  }
  
  fs.writeFileSync(file, content);
  console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
});

console.log(`\nProcessed ${testFiles.length} files`);