#!/usr/bin/env node

import { readFileSync } from 'fs';

interface ErrorCategory {
  name: string;
  patterns: RegExp[];
  files: Set<string>;
}

const categories: ErrorCategory[] = [
  {
    name: '1. Import errors (TS2307: Cannot find module) - __tests__ and scripts only',
    patterns: [/error TS2307:/],
    files: new Set(),
  },
  {
    name: '2. Type mismatch errors (TS2345, TS2769: Argument type mismatch) - ToolExecutionContext and proposal',
    patterns: [/error TS2345:/, /error TS2769:/],
    files: new Set(),
  },
  {
    name: '3. Property errors (TS2339: Property does not exist)',
    patterns: [/error TS2339:/],
    files: new Set(),
  },
  {
    name: '4. Undefined/null check errors (TS18048: possibly undefined)',
    patterns: [/error TS18048:/],
    files: new Set(),
  },
  {
    name: '5. Any type usage errors (TS7006, TS2322 related)',
    patterns: [/error TS7006:/, /error TS2322:/],
    files: new Set(),
  },
];

// Read the typecheck output
const content = readFileSync('typecheck-output.txt', 'utf-8');
const lines = content.split('\n');

// Parse errors
for (const line of lines) {
  const match = line.match(/^(.+\.ts)\((\d+),(\d+)\): error (TS\d+):/);
  if (match) {
    const [, filePath, , , errorCode] = match;
    
    // For import errors, only include __tests__ and scripts
    if (errorCode === 'TS2307') {
      if (filePath && (filePath.includes('__tests__') || filePath.includes('scripts/'))) {
        const importCategory = categories[0];
        if (importCategory) {
          importCategory.files.add(filePath);
        }
      }
    } else {
      // For other errors, categorize based on error code
      for (let i = 1; i < categories.length; i++) {
        const category = categories[i];
        if (category && category.patterns.some(pattern => line.match(pattern))) {
          category.files.add(filePath || '');
          break;
        }
      }
    }
  }
}

// Output results
for (const category of categories) {
  console.log(`\n${category.name}`);
  console.log('='.repeat(80));
  
  const files = Array.from(category.files).sort();
  const displayFiles = files.slice(0, 10);
  
  displayFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  if (files.length > 10) {
    console.log(`... and ${files.length - 10} more files`);
  } else if (files.length === 0) {
    console.log('No errors found in this category');
  }
}

// Summary
console.log('\n\nSUMMARY');
console.log('='.repeat(80));
for (const category of categories) {
  const namePart = category.name.split('.')[1];
  console.log(`${namePart?.trim() ?? category.name}: ${category.files.size} files`);
}