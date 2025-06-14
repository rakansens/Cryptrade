#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Test Performance Summary Analysis');
console.log('=====================================\n');

// Run jest with JSON output for all specified test patterns
const patterns = [
  'lib/utils/__tests__/*.test.ts',
  'lib/services/__tests__/*.test.ts',
  'lib/binance/__tests__/*.test.ts',
  'lib/api/__tests__/*.test.ts',
  'lib/api/helpers/__tests__/*.test.ts',
  'lib/errors/__tests__/*.test.ts',
  'lib/indicators/__tests__/*.test.ts',
  'lib/logging/__tests__/*.test.ts',
  'lib/mastra/__tests__/*.test.ts',
  'lib/mastra/utils/__tests__/*.test.ts',
  'lib/ml/__tests__/*.test.ts',
  'lib/ws/__tests__/*.test.ts',
  'hooks/base/__tests__/*.test.ts',
  'store/__tests__/*.test.ts'
];

const results = {
  timestamp: new Date().toISOString(),
  totalSuites: 0,
  totalTests: 0,
  totalTime: 0,
  slowTests: [],
  suiteDetails: [],
  errorSuites: []
};

// Run each pattern separately
patterns.forEach((pattern, index) => {
  console.log(`\nAnalyzing ${pattern}...`);
  
  try {
    const startTime = Date.now();
    
    // Run jest with JSON reporter
    execSync(
      `npx jest "${pattern}" --json --outputFile=/tmp/jest-result-${index}.json --no-coverage --testTimeout=10000`,
      { stdio: 'ignore' }
    );
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // Read results
    const testResults = JSON.parse(fs.readFileSync(`/tmp/jest-result-${index}.json`, 'utf-8'));
    
    // Process results
    if (testResults.success) {
      const suiteInfo = {
        pattern: pattern,
        numSuites: testResults.numTotalTestSuites,
        numTests: testResults.numTotalTests,
        numPassed: testResults.numPassedTests,
        executionTime: executionTime,
        avgTimePerTest: testResults.numTotalTests > 0 ? executionTime / testResults.numTotalTests : 0
      };
      
      results.totalSuites += testResults.numTotalTestSuites;
      results.totalTests += testResults.numTotalTests;
      results.totalTime += executionTime;
      results.suiteDetails.push(suiteInfo);
      
      // Find slow tests
      testResults.testResults.forEach(fileResult => {
        if (fileResult.assertionResults) {
          fileResult.assertionResults.forEach(test => {
            if (test.duration && test.duration > 100) {
              results.slowTests.push({
                file: fileResult.name,
                test: test.fullName,
                duration: test.duration
              });
            }
          });
        }
      });
      
      console.log(`✅ ${testResults.numTotalTests} tests in ${executionTime}ms`);
    }
    
    // Clean up
    fs.unlinkSync(`/tmp/jest-result-${index}.json`);
    
  } catch (error) {
    console.log(`❌ Error or test failures in ${pattern}`);
    results.errorSuites.push(pattern);
    
    // Try to clean up
    try {
      fs.unlinkSync(`/tmp/jest-result-${index}.json`);
    } catch (e) {}
  }
});

// Print summary report
console.log('\n\n📊 PERFORMANCE SUMMARY');
console.log('═'.repeat(70));
console.log(`Total Test Suites: ${results.totalSuites}`);
console.log(`Total Tests: ${results.totalTests}`);
console.log(`Total Execution Time: ${results.totalTime}ms (${(results.totalTime/1000).toFixed(2)}s)`);

if (results.totalSuites > 0) {
  console.log(`Average Time per Suite: ${(results.totalTime / results.totalSuites).toFixed(0)}ms`);
}
if (results.totalTests > 0) {
  console.log(`Average Time per Test: ${(results.totalTime / results.totalTests).toFixed(0)}ms`);
}

// Suite breakdown
console.log('\n📈 Performance by Test Category:');
console.log('─'.repeat(70));
results.suiteDetails
  .sort((a, b) => b.executionTime - a.executionTime)
  .forEach(suite => {
    console.log(`${suite.pattern}`);
    console.log(`  Tests: ${suite.numTests} | Time: ${suite.executionTime}ms | Avg: ${suite.avgTimePerTest.toFixed(0)}ms/test`);
  });

// Slow tests
if (results.slowTests.length > 0) {
  console.log('\n⚠️  SLOW TESTS (>100ms):');
  console.log('─'.repeat(70));
  results.slowTests
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .forEach((test, i) => {
      console.log(`${i + 1}. ${test.duration}ms - ${test.test}`);
      console.log(`   File: ${test.file}`);
    });
}

// Error suites
if (results.errorSuites.length > 0) {
  console.log('\n❌ Test Suites with Errors:');
  console.log('─'.repeat(70));
  results.errorSuites.forEach(suite => {
    console.log(`  - ${suite}`);
  });
}

// Optimization recommendations
console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
console.log('═'.repeat(70));

// Analyze slow test patterns
const slowCategories = {};
results.slowTests.forEach(test => {
  const category = test.file.match(/lib\/([^/]+)/)?.[1] || 'other';
  slowCategories[category] = (slowCategories[category] || 0) + 1;
});

if (Object.keys(slowCategories).length > 0) {
  console.log('\nSlow tests by category:');
  Object.entries(slowCategories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count} slow tests`);
    });
}

console.log('\nSpecific optimizations:');
if (slowCategories.utils > 2) {
  console.log('\nUtils module:');
  console.log('  - Use jest.useFakeTimers() for retry/delay logic');
  console.log('  - Reduce iteration counts in performance-sensitive tests');
  console.log('  - Mock setTimeout/setInterval calls');
}

if (slowCategories.ws > 2) {
  console.log('\nWebSocket module:');
  console.log('  - Mock WebSocket constructor globally');
  console.log('  - Use synchronous event emission in tests');
  console.log('  - Reduce connection timeout values for tests');
}

if (slowCategories.mastra > 2) {
  console.log('\nMastra module:');
  console.log('  - Mock all AI/LLM API calls');
  console.log('  - Use pre-computed embeddings');
  console.log('  - Disable network requests in test environment');
}

console.log('\nGeneral optimizations:');
console.log('  - Enable parallel test execution: --maxWorkers=auto');
console.log('  - Use --bail flag during development');
console.log('  - Implement shared test fixtures');
console.log('  - Consider test splitting for large suites');
console.log('  - Use beforeAll() for expensive setup operations');

// Performance metrics
const avgTimePerTest = results.totalTests > 0 ? results.totalTime / results.totalTests : 0;
if (avgTimePerTest > 50) {
  console.log(`\n⚡ Performance Alert: Average test time is ${avgTimePerTest.toFixed(0)}ms`);
  console.log('   Target: <50ms per test for optimal developer experience');
}

// Save report
const reportPath = path.join(__dirname, '..', 'test-performance-summary.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Full report saved to: ${reportPath}`);