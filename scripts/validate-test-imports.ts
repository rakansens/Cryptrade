#!/usr/bin/env tsx

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const rootDir = process.cwd();
const testsDir = join(rootDir, 'tests');

interface TestImportIssue {
  file: string;
  line: number;
  issue: string;
}

const issues: TestImportIssue[] = [];

function checkFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = relative(rootDir, filePath);
  
  lines.forEach((line, index) => {
    // Check for old __tests__ imports
    if (line.includes('__tests__') && !line.includes('node_modules')) {
      issues.push({
        file: relPath,
        line: index + 1,
        issue: 'Contains __tests__ import (should use tests/ structure)'
      });
    }
    
    // Check for relative imports that go too far up
    if (line.includes('import') && line.includes('../../../../../')) {
      issues.push({
        file: relPath,
        line: index + 1,
        issue: 'Import path goes too many levels up'
      });
    }
    
    // Check for absolute imports from old test locations
    if (line.match(/from ['"]@\/(app|lib|components|hooks|store|types)\/.*\/__tests__/)) {
      issues.push({
        file: relPath,
        line: index + 1,
        issue: 'Absolute import from old __tests__ location'
      });
    }
  });
}

function walkDir(dir: string) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDir(filePath);
    } else if (stat.isFile() && (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts'))) {
      checkFile(filePath);
    }
  }
}

console.log('🔍 Validating test imports...\n');

// Check tests directory
if (statSync(testsDir).isDirectory()) {
  walkDir(testsDir);
}

// Check for any remaining __tests__ directories outside of tests/
const oldTestDirs: string[] = [];
function findOldTestDirs(dir: string) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'tests' || file === '.next' || file === 'coverage') {
      continue;
    }
    
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file === '__tests__') {
        oldTestDirs.push(relative(rootDir, filePath));
      } else {
        findOldTestDirs(filePath);
      }
    }
  }
}

findOldTestDirs(rootDir);

// Report results
if (issues.length === 0 && oldTestDirs.length === 0) {
  console.log('✅ All test imports are valid!\n');
} else {
  console.log(`❌ Found ${issues.length} import issues and ${oldTestDirs.length} old test directories\n`);
  
  if (issues.length > 0) {
    console.log('Import issues:');
    issues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.issue}`);
    });
    console.log('');
  }
  
  if (oldTestDirs.length > 0) {
    console.log('Old __tests__ directories found:');
    oldTestDirs.forEach(dir => {
      console.log(`  ${dir}`);
    });
    console.log('\nThese should be moved to the tests/ directory structure.');
  }
  
  process.exit(1);
}