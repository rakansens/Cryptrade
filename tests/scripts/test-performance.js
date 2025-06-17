#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Running performance optimized tests...\n');

const testConfigs = [
  {
    name: 'Sequential (baseline)',
    command: 'npm test -- --maxWorkers=1 --no-coverage tests/unit/lib/utils',
  },
  {
    name: 'Parallel (50% workers)',
    command: 'npm test -- --maxWorkers=50% --no-coverage tests/unit/lib/utils',
  },
  {
    name: 'Parallel (75% workers)',
    command: 'npm test -- --maxWorkers=75% --no-coverage tests/unit/lib/utils',
  },
  {
    name: 'Sharded (2 shards)',
    command: 'npm run test:shard:2 -- tests/unit/lib/utils',
  },
];

const results = [];

for (const config of testConfigs) {
  console.log(`\n📊 Testing: ${config.name}`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    execSync(config.command, { 
      stdio: 'pipe',
      env: { ...process.env, CI: 'true' }
    });
    
    const duration = Date.now() - startTime;
    
    results.push({
      name: config.name,
      duration: duration,
      success: true,
    });
    
    console.log(`✅ Completed in ${(duration / 1000).toFixed(2)}s`);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    results.push({
      name: config.name,
      duration: duration,
      success: false,
      error: error.message,
    });
    
    console.log(`❌ Failed after ${(duration / 1000).toFixed(2)}s`);
  }
}

console.log('\n\n📈 Performance Summary');
console.log('═'.repeat(70));
console.log('Configuration'.padEnd(30) + 'Duration'.padEnd(15) + 'Speed Improvement');
console.log('─'.repeat(70));

const baseline = results[0].duration;

results.forEach((result) => {
  const improvement = baseline > result.duration 
    ? `${((1 - result.duration / baseline) * 100).toFixed(1)}% faster`
    : baseline < result.duration
    ? `${((result.duration / baseline - 1) * 100).toFixed(1)}% slower`
    : 'baseline';
    
  console.log(
    result.name.padEnd(30) +
    `${(result.duration / 1000).toFixed(2)}s`.padEnd(15) +
    improvement
  );
});

console.log('\n✨ Recommendations:');
const fastest = results.reduce((prev, current) => 
  current.duration < prev.duration ? current : prev
);

console.log(`- Use "${fastest.name}" for fastest test execution`);
console.log(`- ${((1 - fastest.duration / baseline) * 100).toFixed(0)}% speed improvement achieved`);

// Save results to file
const reportPath = path.join(__dirname, '..', 'test-performance-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  results: results,
  recommendation: fastest.name,
  improvementPercentage: ((1 - fastest.duration / baseline) * 100).toFixed(1),
}, null, 2));

console.log(`\n📄 Full report saved to: ${reportPath}`);