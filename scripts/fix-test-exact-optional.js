#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix test files for exact optional properties
const testFiles = [
  'store/__tests__/chart.store.test.ts',
  'store/__tests__/store-integration.test.ts',
  'scripts/test-type-consistency.ts',
  'scripts/test-performance-improvements.ts',
  'lib/notifications/__tests__/browser-notifications.test.ts'
];

const fixes = [
  // Fix metadata assignment
  {
    pattern: /metadata:\s*undefined/g,
    replacement: '/* metadata not set */'
  },
  // Fix details assignment
  {
    pattern: /details:\s*(.+?)\s*\?\s*(.+?)\s*:\s*undefined/g,
    replacement: '...(($1) && { details: $2 })'
  },
  // Fix response assignment  
  {
    pattern: /response:\s*(.+?)\s*\|\s*undefined/g,
    replacement: '...($1 && { response: $1 })'
  },
  // Fix icon/tag/etc assignments in notifications
  {
    pattern: /(icon|tag|requireInteraction|silent):\s*undefined/g,
    replacement: '/* $1 not set */'
  }
];

testFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  fixes.forEach(({ pattern, replacement }) => {
    const originalContent = content;
    content = content.replace(pattern, replacement);
    if (content !== originalContent) {
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  } else {
    console.log(`No changes needed: ${file}`);
  }
});

console.log('Test file fixes complete!');