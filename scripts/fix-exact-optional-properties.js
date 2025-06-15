#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common patterns to fix
const patterns = [
  // Fix optional properties with undefined in function arguments
  {
    pattern: /(\w+):\s*(\w+(?:\[\])?)\s*\|\s*undefined/g,
    replacement: (match, name, type) => `${name}?: ${type}`,
    description: 'Convert "prop: Type | undefined" to "prop?: Type"'
  },
  // Fix metadata: Record<string, unknown> | undefined
  {
    pattern: /metadata:\s*Record<string,\s*unknown>\s*\|\s*undefined/g,
    replacement: 'metadata?: Record<string, unknown>',
    description: 'Fix metadata property'
  },
  // Fix getters returning undefined
  {
    pattern: /get\s+(\w+)\(\):\s*(\w+(?:<[^>]+>)?)\s*\|\s*undefined/g,
    replacement: (match, name, type) => `get ${name}(): ${type}`,
    description: 'Remove undefined from getter return types'
  },
  // Fix optional properties in type definitions
  {
    pattern: /(\w+):\s*(.+?)\s*\|\s*undefined;/g,
    replacement: (match, name, type) => {
      if (type.includes('|')) {
        return match; // Skip complex union types
      }
      return `${name}?: ${type};`;
    },
    description: 'Convert property definitions'
  }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  patterns.forEach(({ pattern, replacement, description }) => {
    const originalContent = content;
    content = content.replace(pattern, replacement);
    if (content !== originalContent) {
      modified = true;
      console.log(`  ✓ ${description}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
  
  return modified;
}

// Get all TypeScript files
const files = glob.sync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**']
});

console.log(`Found ${files.length} TypeScript files to check...`);

let fixedCount = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} files.`);