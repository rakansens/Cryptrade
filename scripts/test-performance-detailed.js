#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define test categories
const testCategories = [
  {
    name: 'Utils Tests',
    pattern: 'lib/utils/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Services Tests', 
    pattern: 'lib/services/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Binance Tests',
    pattern: 'lib/binance/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'API Tests',
    pattern: 'lib/api/**/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Error Handling Tests',
    pattern: 'lib/errors/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Indicators Tests',
    pattern: 'lib/indicators/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Logging Tests',
    pattern: 'lib/logging/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Mastra Tests',
    pattern: 'lib/mastra/**/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'ML Tests',
    pattern: 'lib/ml/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'WebSocket Tests',
    pattern: 'lib/ws/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Hook Tests',
    pattern: 'hooks/base/__tests__/*.test.ts',
    files: []
  },
  {
    name: 'Store Tests',
    pattern: 'store/__tests__/*.test.ts',
    files: []
  }
];

console.log('🚀 Detailed Test Performance Analysis');
console.log('=====================================\n');

// Collect all test files
testCategories.forEach(category => {
  try {
    const files = execSync(`find . -path "./${category.pattern}" -type f`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(f => f.length > 0)
      .map(f => f.replace('./', ''));
    category.files = files;
  } catch (e) {
    // Pattern didn't match any files
    category.files = [];
  }
});

// Run performance analysis for each category
const performanceReport = {
  timestamp: new Date().toISOString(),
  categories: [],
  summary: {
    totalSuites: 0,
    totalTests: 0,
    totalTime: 0,
    slowTests: []
  }
};

testCategories.forEach(category => {
  if (category.files.length === 0) return;
  
  console.log(`\n📁 ${category.name}`);
  console.log('─'.repeat(50));
  
  const categoryReport = {
    name: category.name,
    suites: [],
    totalTime: 0,
    totalTests: 0
  };
  
  category.files.forEach(file => {
    try {
      console.log(`\n  Testing: ${file}`);
      
      const startTime = Date.now();
      const output = execSync(
        `npx jest "${file}" --verbose --json --outputFile=/tmp/jest-output.json --no-coverage`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      const endTime = Date.now();
      
      // Read the JSON output
      let testResults;
      try {
        testResults = JSON.parse(fs.readFileSync('/tmp/jest-output.json', 'utf-8'));
      } catch (e) {
        // Fallback to parsing text output
        console.log(`  ⚠️  Could not parse JSON output for ${file}`);
        categoryReport.suites.push({
          file: file,
          executionTime: endTime - startTime,
          error: 'Could not parse JSON output'
        });
        return;
      }
      
      const executionTime = endTime - startTime;
      const suite = {
        file: file,
        executionTime: executionTime,
        numTests: testResults.numTotalTests || 0,
        numPassed: testResults.numPassedTests || 0,
        numFailed: testResults.numFailedTests || 0,
        testResults: []
      };
      
      // Extract individual test results
      if (testResults.testResults && testResults.testResults[0]) {
        const fileResult = testResults.testResults[0];
        if (fileResult.assertionResults) {
          fileResult.assertionResults.forEach(test => {
            const testTime = test.duration || 0;
            suite.testResults.push({
              title: test.title,
              fullName: test.fullName,
              status: test.status,
              duration: testTime
            });
            
            // Track slow tests
            if (testTime > 100) {
              performanceReport.summary.slowTests.push({
                file: file,
                test: test.fullName,
                duration: testTime
              });
            }
          });
        }
      }
      
      categoryReport.suites.push(suite);
      categoryReport.totalTime += executionTime;
      categoryReport.totalTests += suite.numTests;
      
      console.log(`  ✅ ${suite.numTests} tests in ${executionTime}ms`);
      
      // Show slowest tests in this suite
      const slowTests = suite.testResults
        .filter(t => t.duration > 50)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3);
      
      if (slowTests.length > 0) {
        console.log('     Slowest tests:');
        slowTests.forEach(test => {
          console.log(`       - ${test.duration}ms: ${test.title}`);
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message.split('\\n')[0]}`);
    }
  });
  
  if (categoryReport.suites.length > 0) {
    performanceReport.categories.push(categoryReport);
    performanceReport.summary.totalSuites += categoryReport.suites.length;
    performanceReport.summary.totalTests += categoryReport.totalTests;
    performanceReport.summary.totalTime += categoryReport.totalTime;
    
    console.log(`\\n  Category Summary: ${categoryReport.totalTests} tests in ${categoryReport.totalTime}ms`);
  }
});

// Clean up temp file
try {
  fs.unlinkSync('/tmp/jest-output.json');
} catch (e) {
  // Ignore
}

// Print final report
console.log('\\n\\n📊 PERFORMANCE SUMMARY');
console.log('═'.repeat(70));
console.log(`Total Suites: ${performanceReport.summary.totalSuites}`);
console.log(`Total Tests: ${performanceReport.summary.totalTests}`);
console.log(`Total Time: ${performanceReport.summary.totalTime}ms (${(performanceReport.summary.totalTime/1000).toFixed(2)}s)`);

if (performanceReport.summary.totalSuites > 0) {
  console.log(`Average per Suite: ${(performanceReport.summary.totalTime / performanceReport.summary.totalSuites).toFixed(0)}ms`);
}
if (performanceReport.summary.totalTests > 0) {
  console.log(`Average per Test: ${(performanceReport.summary.totalTime / performanceReport.summary.totalTests).toFixed(0)}ms`);
}

// Category breakdown
console.log('\\n📈 Category Breakdown:');
performanceReport.categories
  .sort((a, b) => b.totalTime - a.totalTime)
  .forEach(category => {
    const avgTime = category.suites.length > 0 ? category.totalTime / category.suites.length : 0;
    console.log(`  ${category.name}: ${category.totalTime}ms (${category.totalTests} tests, avg ${avgTime.toFixed(0)}ms/suite)`);
  });

// Slow tests
if (performanceReport.summary.slowTests.length > 0) {
  console.log('\\n⚠️  SLOW TESTS (>100ms):');
  performanceReport.summary.slowTests
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.duration}ms - ${test.test}`);
      console.log(`     File: ${test.file}`);
    });
}

// Recommendations
console.log('\\n💡 OPTIMIZATION RECOMMENDATIONS:');
console.log('═'.repeat(70));

// Find patterns in slow tests
const slowByCategory = {};
performanceReport.summary.slowTests.forEach(test => {
  const category = test.file.split('/')[1];
  if (!slowByCategory[category]) {
    slowByCategory[category] = 0;
  }
  slowByCategory[category]++;
});

Object.entries(slowByCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`\\n${category} module:`);
    if (category === 'ws') {
      console.log('  - Mock WebSocket connections instead of real connections');
      console.log('  - Use fake timers for connection timeouts');
      console.log('  - Reduce retry delays in test environment');
    } else if (category === 'mastra') {
      console.log('  - Mock AI/LLM API calls');
      console.log('  - Use test fixtures for agent responses');
      console.log('  - Disable real network calls in tests');
    } else if (category === 'api') {
      console.log('  - Mock fetch/axios calls');
      console.log('  - Use MSW for API mocking');
      console.log('  - Reduce middleware chain in tests');
    } else if (category === 'utils') {
      console.log('  - Use fake timers for retry/delay logic');
      console.log('  - Reduce iteration counts in tests');
      console.log('  - Mock expensive operations');
    }
  });

console.log('\\nGeneral optimizations:');
console.log('  - Run tests in parallel: jest --maxWorkers=auto');
console.log('  - Use --bail to stop on first failure');
console.log('  - Implement shared test setup with beforeAll()');
console.log('  - Consider test splitting for CI/CD');

// Save detailed report
const reportPath = path.join(__dirname, '..', 'test-performance-detailed.json');
fs.writeFileSync(reportPath, JSON.stringify(performanceReport, null, 2));
console.log(`\\n📄 Detailed report saved to: ${reportPath}`);