#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test suites to analyze
const testSuites = {
  'lib/utils': [
    'compose.test.ts',
    'logger.test.ts',
    'drawing-queue-retry.test.ts',
    'retry-wrapper.test.ts',
    'stream-utils.test.ts',
    'zustand-helpers.test.ts',
    'parse-analysis.test.ts',
    'validation.test.ts',
    'drawing-reliability.test.ts',
    'retry-with-circuit-breaker.test.ts'
  ],
  'lib/services': [
    'enhanced-market-data.service.test.ts',
    'semantic-embedding.service.test.ts'
  ],
  'lib/binance': [
    'api-service.test.ts',
    'websocket-manager.test.ts',
    'connection-manager.test.ts'
  ],
  'lib/api': [
    'middleware.test.ts',
    'create-api-handler.test.ts',
    'error-boundary.test.ts',
    'streaming.test.ts'
  ],
  'lib/api/helpers': [
    'error-handler.test.ts',
    'proposal-extractor.test.ts',
    'response-builder.test.ts',
    'request-validator.test.ts'
  ],
  'lib/errors': [
    'base-error.test.ts',
    'error-tracker.test.ts'
  ],
  'lib/indicators': [
    'moving-average.test.ts',
    'bollinger-bands.test.ts',
    'macd.test.ts',
    'rsi.test.ts'
  ],
  'lib/logging': [
    'unified-logger.test.ts'
  ],
  'lib/mastra': [
    'a2a-communication.test.ts',
    'agent-ui-integration.test.ts',
    'e2e-agent-ui.test.ts',
    'enhanced-fallback.test.ts',
    'improved-orchestrator.test.ts'
  ],
  'lib/mastra/utils': [
    'intent-symbol-extraction.test.ts'
  ],
  'lib/ml': [
    'feature-extractor.test.ts',
    'line-predictor.test.ts',
    'streaming-ml-analyzer.test.ts'
  ],
  'lib/ws': [
    'compat-shim.test.ts',
    'WSManager.test.ts',
    'WSManager.coverage.test.ts',
    'index.test.ts',
    'e2e-simple.test.ts',
    'migration.test.ts',
    'e2e.test.ts',
    'e2e-advanced.test.ts',
    'websocket-coverage.test.ts',
    'ws-basic.test.ts',
    'ws-error-handling.test.ts'
  ],
  'hooks/base': [
    'use-streaming.test.ts'
  ],
  'store': [
    'market.store.test.ts',
    'chart.store.test.ts',
    'chat.store.test.ts',
    'ui-event.store.test.ts',
    'store-integration.test.ts'
  ]
};

// Performance results
const performanceResults = {};
const slowTests = [];

console.log('🔍 Running Performance Analysis on Test Suites...\n');

// Function to run tests and capture performance
function runTestSuite(suitePath, testFile) {
  const fullPath = path.join(suitePath, '__tests__', testFile);
  
  try {
    console.log(`\n📊 Analyzing: ${fullPath}`);
    
    // Run jest with performance flags
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const output = execSync(
      `npx jest ${fullPath} --verbose --no-coverage --detectOpenHandles=false --forceExit --maxWorkers=1`,
      { 
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' }
      }
    );
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    // Parse test results
    const testCountMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const testCount = testCountMatch ? parseInt(testCountMatch[2]) : 0;
    const passedCount = testCountMatch ? parseInt(testCountMatch[1]) : 0;
    
    // Extract individual test times if available
    const testTimes = [];
    const testTimeMatches = output.matchAll(/✓\s+(.+?)\s+\((\d+)\s*ms\)/g);
    for (const match of testTimeMatches) {
      const testName = match[1];
      const testTime = parseInt(match[2]);
      testTimes.push({ name: testName, time: testTime });
      
      if (testTime > 100) {
        slowTests.push({
          suite: fullPath,
          test: testName,
          time: testTime
        });
      }
    }
    
    const executionTime = endTime - startTime;
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // Convert to MB
    
    const result = {
      suite: fullPath,
      totalTests: testCount,
      passedTests: passedCount,
      executionTime: executionTime,
      memoryUsage: memoryUsed.toFixed(2) + ' MB',
      averageTimePerTest: testCount > 0 ? (executionTime / testCount).toFixed(2) : 0,
      testTimes: testTimes,
      status: 'success'
    };
    
    if (!performanceResults[suitePath]) {
      performanceResults[suitePath] = [];
    }
    performanceResults[suitePath].push(result);
    
    console.log(`✅ Success: ${testCount} tests in ${executionTime}ms`);
    
  } catch (error) {
    console.log(`❌ Error running ${fullPath}`);
    
    if (!performanceResults[suitePath]) {
      performanceResults[suitePath] = [];
    }
    performanceResults[suitePath].push({
      suite: fullPath,
      status: 'error',
      error: error.message.split('\n')[0]
    });
  }
}

// Run all test suites
Object.entries(testSuites).forEach(([suitePath, testFiles]) => {
  console.log(`\n🗂️  Testing ${suitePath} suite...`);
  testFiles.forEach(testFile => {
    runTestSuite(suitePath, testFile);
  });
});

// Generate performance report
console.log('\n\n📈 PERFORMANCE ANALYSIS REPORT\n');
console.log('=' .repeat(80));

let totalTests = 0;
let totalTime = 0;
let totalSuites = 0;

Object.entries(performanceResults).forEach(([suite, results]) => {
  console.log(`\n📁 ${suite}`);
  console.log('-'.repeat(80));
  
  results.forEach(result => {
    if (result.status === 'success') {
      totalSuites++;
      totalTests += result.totalTests;
      totalTime += result.executionTime;
      
      console.log(`\n  📄 ${path.basename(result.suite)}`);
      console.log(`     Tests: ${result.totalTests} (${result.passedTests} passed)`);
      console.log(`     Time: ${result.executionTime}ms (avg: ${result.averageTimePerTest}ms/test)`);
      console.log(`     Memory: ${result.memoryUsage}`);
      
      // Show top 3 slowest tests in this suite
      if (result.testTimes.length > 0) {
        const slowestTests = result.testTimes
          .sort((a, b) => b.time - a.time)
          .slice(0, 3);
        
        if (slowestTests.length > 0 && slowestTests[0].time > 50) {
          console.log(`     Slowest tests:`);
          slowestTests.forEach(test => {
            console.log(`       - ${test.name}: ${test.time}ms`);
          });
        }
      }
    } else {
      console.log(`\n  ❌ ${path.basename(result.suite)}: ${result.error}`);
    }
  });
});

// Summary statistics
console.log('\n\n📊 SUMMARY STATISTICS');
console.log('=' .repeat(80));
console.log(`Total Test Suites: ${totalSuites}`);
console.log(`Total Tests: ${totalTests}`);
console.log(`Total Execution Time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
console.log(`Average Time per Suite: ${totalSuites > 0 ? (totalTime/totalSuites).toFixed(2) : 0}ms`);
console.log(`Average Time per Test: ${totalTests > 0 ? (totalTime/totalTests).toFixed(2) : 0}ms`);

// Slow tests report
if (slowTests.length > 0) {
  console.log('\n\n⚠️  SLOW TESTS (>100ms)');
  console.log('=' .repeat(80));
  
  slowTests
    .sort((a, b) => b.time - a.time)
    .slice(0, 20) // Top 20 slowest
    .forEach((test, index) => {
      console.log(`${index + 1}. ${test.time}ms - ${test.test}`);
      console.log(`   Suite: ${test.suite}`);
    });
}

// Optimization recommendations
console.log('\n\n💡 OPTIMIZATION RECOMMENDATIONS');
console.log('=' .repeat(80));

// Analyze results for patterns
const suitesByTime = Object.entries(performanceResults)
  .map(([suite, results]) => ({
    suite,
    totalTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
    totalTests: results.reduce((sum, r) => sum + (r.totalTests || 0), 0)
  }))
  .filter(s => s.totalTime > 0)
  .sort((a, b) => b.totalTime - a.totalTime);

console.log('\n1. Slowest Test Suites:');
suitesByTime.slice(0, 5).forEach(suite => {
  console.log(`   - ${suite.suite}: ${suite.totalTime}ms for ${suite.totalTests} tests`);
});

console.log('\n2. Key Findings:');
if (slowTests.length > 10) {
  console.log(`   - ${slowTests.length} tests take >100ms, indicating potential optimization opportunities`);
}

const wsTests = slowTests.filter(t => t.suite.includes('/ws/'));
if (wsTests.length > 0) {
  console.log(`   - WebSocket tests are particularly slow (${wsTests.length} slow tests)`);
  console.log('     Consider using mock timers or reducing connection timeouts in tests');
}

const mastraTests = slowTests.filter(t => t.suite.includes('/mastra/'));
if (mastraTests.length > 0) {
  console.log(`   - Mastra agent tests have ${mastraTests.length} slow tests`);
  console.log('     Consider mocking AI/LLM calls and external dependencies');
}

console.log('\n3. General Recommendations:');
console.log('   - Use jest.mock() for external dependencies and API calls');
console.log('   - Implement test data factories to reduce setup time');
console.log('   - Use beforeAll() for expensive setup operations');
console.log('   - Consider parallel test execution for independent test suites');
console.log('   - Add --bail flag to stop on first failure during development');

// Save detailed report to file
const reportPath = path.join(__dirname, '..', 'test-performance-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  summary: {
    totalSuites,
    totalTests,
    totalTime,
    averageTimePerSuite: totalSuites > 0 ? totalTime/totalSuites : 0,
    averageTimePerTest: totalTests > 0 ? totalTime/totalTests : 0
  },
  results: performanceResults,
  slowTests: slowTests.sort((a, b) => b.time - a.time)
}, null, 2));

console.log(`\n\n📄 Detailed report saved to: ${reportPath}`);