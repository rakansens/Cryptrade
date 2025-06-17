#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Priority test files to run
const priorityTests = [
  'tests/unit/hooks/__tests__/use-is-client.test.ts',
  'tests/unit/hooks/__tests__/use-view-persistence.test.ts',
  'tests/unit/lib/api/middleware.test.ts',
  'tests/unit/store/chat.store.test.ts',
  'tests/unit/store/chart.store.test.ts',
];

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running ${testFile}...`);
    
    const child = spawn('npm', ['test', '--', testFile, '--maxWorkers=1'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} passed`);
        resolve({ file: testFile, passed: true });
      } else {
        console.log(`❌ ${testFile} failed`);
        resolve({ file: testFile, passed: false });
      }
    });
    
    child.on('error', (err) => {
      console.error(`Error running ${testFile}:`, err);
      resolve({ file: testFile, passed: false, error: err });
    });
  });
}

async function main() {
  console.log('🏃 Running priority tests...\n');
  
  const results = [];
  
  // Run tests sequentially to avoid conflicts
  for (const test of priorityTests) {
    const result = await runTest(test);
    results.push(result);
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.file}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);