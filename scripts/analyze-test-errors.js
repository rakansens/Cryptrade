#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Analyzing test errors...\n');

// Run tests and capture output
let output;
try {
  output = execSync('npm test -- --verbose=false 2>&1', {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    env: { ...process.env, CI: 'true' }
  });
} catch (error) {
  output = error.stdout || error.message;
}

// Save raw output for reference
fs.writeFileSync('test-output.log', output);

// Parse error patterns
const errorPatterns = {
  'Cannot read properties of undefined': [],
  'is not defined': [],
  'is not a function': [],
  'Cannot find module': [],
  'Exceeded timeout': [],
  'act(...) warning': [],
  'TypeError': [],
  'ReferenceError': [],
  'Test suite failed to run': [],
  'Expected mock function': [],
};

// Extract error details
const lines = output.split('\n');
let currentTest = '';
let currentSuite = '';

lines.forEach((line, index) => {
  // Track current test suite
  if (line.includes('FAIL') && line.includes('.test.')) {
    const match = line.match(/tests\/.*\.(test|spec)\.(ts|tsx|js|jsx)/);
    if (match) {
      currentSuite = match[0];
    }
  }
  
  // Track current test
  if (line.includes('● ') && !line.includes('Test suite failed')) {
    currentTest = line.replace('● ', '').trim();
  }
  
  // Categorize errors
  Object.keys(errorPatterns).forEach(pattern => {
    if (line.includes(pattern)) {
      const context = {
        suite: currentSuite,
        test: currentTest,
        line: line.trim(),
        lineNumber: index + 1,
        surrounding: lines.slice(Math.max(0, index - 2), index + 3).join('\n')
      };
      errorPatterns[pattern].push(context);
    }
  });
});

// Analyze specific patterns
const notDefinedErrors = {};
const propertyErrors = {};
const functionErrors = {};

lines.forEach((line) => {
  // "X is not defined" errors
  const notDefinedMatch = line.match(/(\w+) is not defined/);
  if (notDefinedMatch) {
    const varName = notDefinedMatch[1];
    notDefinedErrors[varName] = (notDefinedErrors[varName] || 0) + 1;
  }
  
  // "Cannot read properties of undefined (reading 'X')" errors
  const propertyMatch = line.match(/Cannot read properties of undefined \(reading '(\w+)'\)/);
  if (propertyMatch) {
    const propName = propertyMatch[1];
    propertyErrors[propName] = (propertyErrors[propName] || 0) + 1;
  }
  
  // "X is not a function" errors
  const functionMatch = line.match(/(\w+(?:\.\w+)*) is not a function/);
  if (functionMatch) {
    const funcName = functionMatch[1];
    functionErrors[funcName] = (functionErrors[funcName] || 0) + 1;
  }
});

// Generate report
console.log('=== TEST ERROR ANALYSIS REPORT ===\n');

console.log('Error Pattern Summary:');
Object.entries(errorPatterns).forEach(([pattern, occurrences]) => {
  if (occurrences.length > 0) {
    console.log(`  ${pattern}: ${occurrences.length} occurrences`);
  }
});

console.log('\nTop "is not defined" errors:');
Object.entries(notDefinedErrors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([name, count]) => {
    console.log(`  ${name}: ${count} times`);
  });

console.log('\nTop "Cannot read properties" errors:');
Object.entries(propertyErrors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([prop, count]) => {
    console.log(`  ${prop}: ${count} times`);
  });

console.log('\nTop "is not a function" errors:');
Object.entries(functionErrors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([func, count]) => {
    console.log(`  ${func}: ${count} times`);
  });

// Extract test suite statistics
const suiteStats = {};
const failedSuites = output.match(/FAIL.*\.(test|spec)\.(ts|tsx|js|jsx)/g) || [];
const passedSuites = output.match(/PASS.*\.(test|spec)\.(ts|tsx|js|jsx)/g) || [];

console.log('\n\nTest Suite Statistics:');
console.log(`  Total Failed Suites: ${failedSuites.length}`);
console.log(`  Total Passed Suites: ${passedSuites.length}`);

// Find most problematic test files
const testFileErrors = {};
failedSuites.forEach(suite => {
  const file = suite.replace('FAIL ', '').trim();
  testFileErrors[file] = (testFileErrors[file] || 0) + 1;
});

console.log('\nMost Problematic Test Files:');
Object.entries(testFileErrors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([file, count]) => {
    console.log(`  ${file}`);
  });

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    failedSuites: failedSuites.length,
    passedSuites: passedSuites.length,
    errorPatterns: Object.entries(errorPatterns).reduce((acc, [pattern, occurrences]) => {
      acc[pattern] = occurrences.length;
      return acc;
    }, {})
  },
  notDefinedErrors,
  propertyErrors,
  functionErrors,
  details: errorPatterns
};

fs.writeFileSync('test-error-report.json', JSON.stringify(report, null, 2));
console.log('\n\nDetailed report saved to test-error-report.json');
console.log('Full output saved to test-output.log');