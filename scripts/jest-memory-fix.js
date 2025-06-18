#!/usr/bin/env node

/**
 * Jest Memory Fix Script
 * 
 * This script sets up proper Node.js options for Jest to handle memory issues
 * and large test suites efficiently.
 */

const { execSync } = require('child_process');
const path = require('path');

// Set Node options for better memory management
const nodeOptions = [
  '--max-old-space-size=4096',  // 4GB heap
  '--expose-gc',                 // Allow manual GC
].join(' ');

// Get Jest arguments from command line
const jestArgs = process.argv.slice(2).join(' ');

// Build the command
const command = `NODE_OPTIONS="${nodeOptions}" npx jest ${jestArgs}`;

console.log('Running Jest with optimized memory settings...');
console.log(`Memory limit: 4GB`);
console.log(`Command: ${command}\n`);

try {
  // Execute Jest with the proper settings
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      // Force color output
      FORCE_COLOR: '1',
    },
  });
} catch (error) {
  // Jest returns non-zero exit code on test failures
  // We want to preserve that behavior
  process.exit(error.status || 1);
}