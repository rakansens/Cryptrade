#!/usr/bin/env node

const { spawn } = require('child_process');

// Run all unit tests with summary
const child = spawn('npm', ['test', '--', '--listTests'], {
  stdio: 'pipe',
  shell: true
});

let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  output += data.toString();
});

child.on('close', () => {
  const testFiles = output.split('\n').filter(line => line.includes('.test.'));
  console.log(`\n📊 Total test files found: ${testFiles.length}`);
  console.log('\n🧪 Running all unit tests...\n');
  
  // Run the actual tests
  const testRun = spawn('npm', ['test', '--', '--passWithNoTests', '--maxWorkers=4'], {
    stdio: 'inherit',
    shell: true
  });
  
  testRun.on('close', (code) => {
    console.log(`\n✅ Test run completed with exit code: ${code}`);
  });
});