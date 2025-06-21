#!/usr/bin/env node

/**
 * Quick test runner for faster feedback during development
 * Usage: npm run test:quick [pattern]
 */

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const pattern = args.join(' ');

// Build jest command with optimizations
const jestCmd = [
  'npx jest',
  pattern,
  '--maxWorkers=50%', // Use 50% of CPU cores
  '--no-coverage',
  '--bail',
  '--detectOpenHandles=false',
  '--forceExit',
  '--testTimeout=5000',
  // '--runInBand', // Removed as it conflicts with maxWorkers
].filter(Boolean).join(' ');

console.log('🚀 Running quick tests...');
console.log(`Command: ${jestCmd}`);

try {
  execSync(jestCmd, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: 'true', // Reduces output noise
    }
  });
} catch (error) {
  process.exit(1);
}