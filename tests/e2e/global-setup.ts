/**
 * Global setup for E2E tests
 * Runs once before all tests
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  // Create test results directory
  const resultsDir = path.join(__dirname, '../../e2e-test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Setup test database (if needed)
  if (process.env.DATABASE_URL?.includes('test')) {
    console.log('📦 Setting up test database...');
    // Run database migrations for test environment
    // This would typically run: npx prisma migrate deploy
  }

  // Pre-warm the browser for faster test execution
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Visit the base URL to ensure the server is ready
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3001';
    console.log(`🌐 Checking test server at ${baseURL}...`);
    
    await page.goto(baseURL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('✅ Test server is ready!');
  } catch (error) {
    console.error('❌ Test server is not ready:', error);
    throw new Error('Test server failed to start. Please check the server logs.');
  } finally {
    await browser.close();
  }

  // Store test start time for reporting
  process.env.TEST_START_TIME = new Date().toISOString();
  
  console.log('✨ E2E test setup complete!');
  console.log(`📊 Test results will be saved to: ${resultsDir}`);
}

export default globalSetup;