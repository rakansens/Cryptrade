/**
 * Global teardown for E2E tests
 * Runs once after all tests complete
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...');

  // Calculate test duration
  const startTime = process.env['TEST_START_TIME'];
  if (startTime) {
    const duration = Date.now() - new Date(startTime).getTime();
    const seconds = Math.floor(duration / 1000);
    console.log(`⏱️  Total test duration: ${seconds}s`);
  }

  // Clean up test database (if needed)
  if (process.env['DATABASE_URL']?.includes('test')) {
    console.log('🗑️  Cleaning up test database...');
    // This would typically clean up test data
    // Be careful not to drop the database if you want to inspect it after tests
  }

  // Generate test summary report
  const resultsDir = path.join(__dirname, '../../e2e-test-results');
  const summaryPath = path.join(resultsDir, 'summary.json');
  
  try {
    const summary = {
      timestamp: new Date().toISOString(),
      duration: process.env['TEST_START_TIME'] 
        ? Date.now() - new Date(process.env['TEST_START_TIME']).getTime() 
        : 0,
      environment: {
        node: process.version,
        platform: process.platform,
        ci: !!process.env['CI']
      }
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📄 Test summary saved to: ${summaryPath}`);
  } catch (error) {
    console.warn('⚠️  Failed to write test summary:', error);
  }

  // Clean up temporary files (optional)
  const tempFiles: string[] = [
    // Add any temporary files created during tests
  ];
  
  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to clean up ${file}:`, error);
    }
  }

  console.log('✨ E2E test cleanup complete!');
}

export default globalTeardown;