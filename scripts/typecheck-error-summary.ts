#!/usr/bin/env node

import { readFileSync } from 'fs';

interface ErrorDetail {
  file: string;
  line: number;
  column: number;
  errorCode: string;
  message: string;
}

interface ErrorSummary {
  [category: string]: ErrorDetail[];
}

// Read the typecheck output
const content = readFileSync('typecheck-output.txt', 'utf-8');
const lines = content.split('\n');

const errorSummary: ErrorSummary = {
  'import_errors_tests_scripts': [],
  'type_mismatch_toolexecutioncontext': [],
  'type_mismatch_proposal': [],
  'property_not_exist': [],
  'possibly_undefined': [],
  'any_type_usage': [],
};

let currentError: ErrorDetail | null = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  
  const match = line.match(/^(.+\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  
  if (match) {
    const [, filePath, lineNum, colNum, errorCode, message] = match;
    currentError = {
      file: filePath || '',
      line: parseInt(lineNum),
      column: parseInt(colNum),
      errorCode,
      message: message || '',
    };
    
    // Categorize the error
    if (errorCode === 'TS2307' && filePath && (filePath.includes('__tests__') || filePath.includes('scripts/'))) {
      errorSummary.import_errors_tests_scripts?.push(currentError);
    } else if ((errorCode === 'TS2345' || errorCode === 'TS2769') && message && message.includes('ToolExecutionContext')) {
      errorSummary.type_mismatch_toolexecutioncontext?.push(currentError);
    } else if ((errorCode === 'TS2345' || errorCode === 'TS2769') && message && message.toLowerCase().includes('proposal')) {
      errorSummary.type_mismatch_proposal?.push(currentError);
    } else if (errorCode === 'TS2339') {
      errorSummary.property_not_exist?.push(currentError);
    } else if (errorCode === 'TS18048') {
      errorSummary.possibly_undefined?.push(currentError);
    } else if (errorCode === 'TS7006' || errorCode === 'TS2322') {
      errorSummary.any_type_usage?.push(currentError);
    }
  }
}

// Output the categorized errors
console.log('TypeScript Error Analysis - File Paths by Category');
console.log('='.repeat(80));

const categories = [
  {
    key: 'import_errors_tests_scripts',
    title: '1. Import errors (TS2307: Cannot find module) - __tests__ and scripts directories only',
  },
  {
    key: 'type_mismatch_toolexecutioncontext',
    title: '2. Type mismatch errors (TS2345, TS2769) - ToolExecutionContext related',
  },
  {
    key: 'type_mismatch_proposal',
    title: '3. Type mismatch errors (TS2345, TS2769) - proposal related',
  },
  {
    key: 'property_not_exist',
    title: '4. Property errors (TS2339: Property does not exist)',
  },
  {
    key: 'possibly_undefined',
    title: '5. Undefined/null check errors (TS18048: possibly undefined)',
  },
  {
    key: 'any_type_usage',
    title: '6. Any type usage errors (TS7006, TS2322)',
  },
];

for (const category of categories) {
  const errors = errorSummary[category.key];
  if (!errors) continue;
  const uniqueFiles = [...new Set(errors.map(e => e.file))].sort();
  
  console.log(`\n${category.title}`);
  console.log('-'.repeat(80));
  
  const displayFiles = uniqueFiles.slice(0, 10);
  displayFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  if (uniqueFiles.length > 10) {
    console.log(`... and ${uniqueFiles.length - 10} more files`);
  } else if (uniqueFiles.length === 0) {
    console.log('No errors found in this category');
  }
  
  console.log(`Total: ${uniqueFiles.length} files with ${errors?.length || 0} errors`);
}