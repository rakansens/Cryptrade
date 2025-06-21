#!/usr/bin/env node

/**
 * Analyze test errors in detail with categorization
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Running detailed test error analysis...\n');

// Run tests and capture output
let output;
try {
  output = execSync('npm test -- --json --outputFile=test-results.json 2>&1', {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    encoding: 'utf8'
  });
} catch (error) {
  // Tests failed, but we still have output
  output = error.stdout || error.output?.join('') || '';
}

// Parse test results if JSON file was created
let testResults;
try {
  testResults = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
} catch (e) {
  console.log('Could not parse test results JSON, analyzing raw output...');
}

// Categorize errors
const errorCategories = {
  moduleNotFound: [],
  zustandSnapshot: [],
  renderHook: [],
  responseNotDefined: [],
  timeout: [],
  typeError: [],
  other: []
};

// Parse errors from output
const lines = output.split('\n');
let currentFile = '';
let currentError = '';

lines.forEach(line => {
  // Track current test file
  if (line.includes('FAIL') && line.includes('.test.')) {
    const match = line.match(/([^\s]+\.test\.(ts|tsx))/);
    if (match) currentFile = match[1];
  }
  
  // Categorize errors
  if (line.includes('Cannot find module') || line.includes('Could not locate module')) {
    const match = line.match(/Cannot find module '([^']+)'|Could not locate module ([^\s]+)/);
    const module = match ? (match[1] || match[2]) : 'unknown';
    errorCategories.moduleNotFound.push({ file: currentFile, module });
  } else if (line.includes('getSnapshot should be cached')) {
    errorCategories.zustandSnapshot.push({ file: currentFile });
  } else if (line.includes('renderHook')) {
    errorCategories.renderHook.push({ file: currentFile, error: line.trim() });
  } else if (line.includes('Response is not defined')) {
    errorCategories.responseNotDefined.push({ file: currentFile });
  } else if (line.includes('timeout') || line.includes('Exceeded timeout')) {
    errorCategories.timeout.push({ file: currentFile });
  } else if (line.includes('TypeError:')) {
    errorCategories.typeError.push({ file: currentFile, error: line.trim() });
  }
});

// Report results
console.log('=== TEST ERROR ANALYSIS ===\n');

// Summary from test results
if (testResults) {
  console.log('Test Summary:');
  console.log(`Total test suites: ${testResults.numTotalTestSuites}`);
  console.log(`Failed test suites: ${testResults.numFailedTestSuites}`);
  console.log(`Passed test suites: ${testResults.numPassedTestSuites}`);
  console.log(`Success rate: ${((testResults.numPassedTestSuites / testResults.numTotalTestSuites) * 100).toFixed(1)}%\n`);
}

// Error categories
console.log('Error Categories:');
console.log(`1. Module not found errors: ${errorCategories.moduleNotFound.length}`);
console.log(`2. Zustand snapshot warnings: ${errorCategories.zustandSnapshot.length}`);
console.log(`3. RenderHook errors: ${errorCategories.renderHook.length}`);
console.log(`4. Response not defined: ${errorCategories.responseNotDefined.length}`);
console.log(`5. Timeout errors: ${errorCategories.timeout.length}`);
console.log(`6. Type errors: ${errorCategories.typeError.length}`);
console.log(`7. Other errors: ${errorCategories.other.length}\n`);

// Top missing modules
if (errorCategories.moduleNotFound.length > 0) {
  console.log('Top Missing Modules:');
  const moduleCounts = {};
  errorCategories.moduleNotFound.forEach(({ module }) => {
    moduleCounts[module] = (moduleCounts[module] || 0) + 1;
  });
  
  Object.entries(moduleCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([module, count]) => {
      console.log(`  ${module}: ${count} occurrences`);
    });
  console.log();
}

// Files with zustand issues
if (errorCategories.zustandSnapshot.length > 0) {
  console.log('Files with Zustand Snapshot Issues:');
  const uniqueFiles = [...new Set(errorCategories.zustandSnapshot.map(e => e.file))];
  uniqueFiles.slice(0, 5).forEach(file => {
    console.log(`  - ${file}`);
  });
  console.log();
}

// Cleanup
try {
  fs.unlinkSync('test-results.json');
} catch (e) {
  // Ignore
}