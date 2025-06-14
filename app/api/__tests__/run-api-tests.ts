#!/usr/bin/env ts-node

/**
 * API Integration Test Runner
 * 
 * This script runs all API integration tests and provides a summary report.
 * Usage: npm run test:api or yarn test:api
 */

import { execSync } from 'child_process';
import { logger } from '@/lib/utils/logger';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

const testSuites = [
  {
    name: 'Chat API',
    path: 'app/api/ai/chat/__tests__/route.test.ts'
  },
  {
    name: 'Analysis Stream API',
    path: 'app/api/ai/analysis-stream/__tests__/route.test.ts'
  },
  {
    name: 'Binance Klines API',
    path: 'app/api/binance/klines/__tests__/route.test.ts'
  },
  {
    name: 'Binance Ticker API',
    path: 'app/api/binance/ticker/__tests__/route.test.ts'
  }
];

async function runTests() {
  logger.info('🚀 Starting API Integration Tests');
  
  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuration = 0;

  for (const suite of testSuites) {
    logger.info(`\n📋 Running ${suite.name} tests...`);
    
    const startTime = Date.now();
    
    try {
      const output = execSync(
        `npx jest ${suite.path} --colors --verbose`,
        { encoding: 'utf8' }
      );
      
      // Parse test results from output
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      const skippedMatch = output.match(/(\d+) skipped/);
      
      const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
      const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
      const duration = Date.now() - startTime;
      
      results.push({
        suite: suite.name,
        passed,
        failed,
        skipped,
        duration
      });
      
      totalPassed += passed;
      totalFailed += failed;
      totalSkipped += skipped;
      totalDuration += duration;
      
      logger.info(`✅ ${suite.name}: ${passed} passed, ${failed} failed, ${skipped} skipped (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Even if tests fail, try to extract the counts
      const errorOutput = error.toString();
      const passedMatch = errorOutput.match(/(\d+) passed/);
      const failedMatch = errorOutput.match(/(\d+) failed/);
      const skippedMatch = errorOutput.match(/(\d+) skipped/);
      
      const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
      const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
      
      results.push({
        suite: suite.name,
        passed,
        failed: failed || 1, // At least 1 if we caught an error
        skipped,
        duration
      });
      
      totalPassed += passed;
      totalFailed += failed || 1;
      totalSkipped += skipped;
      totalDuration += duration;
      
      logger.error(`❌ ${suite.name}: Test suite failed`);
    }
  }

  // Print summary
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 Test Summary');
  logger.info('='.repeat(60));
  
  results.forEach(result => {
    const status = result.failed === 0 ? '✅' : '❌';
    logger.info(
      `${status} ${result.suite.padEnd(25)} | ` +
      `Passed: ${result.passed.toString().padStart(3)} | ` +
      `Failed: ${result.failed.toString().padStart(3)} | ` +
      `Skipped: ${result.skipped.toString().padStart(3)} | ` +
      `Duration: ${result.duration}ms`
    );
  });
  
  logger.info('='.repeat(60));
  logger.info(
    `Total: ` +
    `Passed: ${totalPassed} | ` +
    `Failed: ${totalFailed} | ` +
    `Skipped: ${totalSkipped} | ` +
    `Duration: ${totalDuration}ms`
  );
  logger.info('='.repeat(60));
  
  // Exit with appropriate code
  if (totalFailed > 0) {
    logger.error(`\n❌ ${totalFailed} tests failed!`);
    process.exit(1);
  } else {
    logger.info(`\n✅ All tests passed!`);
    process.exit(0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { runTests };