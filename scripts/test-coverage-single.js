#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Testing coverage for a single file...\n');

const testFile = 'tests/unit/lib/store/enhanced-conversation-memory.store.test.ts';
const sourceFile = 'lib/store/enhanced-conversation-memory.store.ts';

try {
  // Run Jest with explicit coverage configuration
  const cmd = `npx jest "${testFile}" --coverage --collectCoverageFrom="${sourceFile}" --coverageReporters=text --no-cache --verbose`;
  
  console.log('Running command:', cmd);
  console.log('---\n');
  
  execSync(cmd, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}