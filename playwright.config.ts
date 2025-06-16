// E2E Test Configuration with Enhanced Settings
/* eslint-disable no-restricted-syntax */
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright configuration for E2E tests
 * Optimized for CI/CD and local development
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Test execution settings
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    timeout: 10 * 1000 // 10 seconds for assertions
  },
  
  // Parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4, // More workers locally
  
  // CI/CD specific settings
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  
  // Enhanced reporting
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['list'],
    ['json', { outputFile: 'e2e-test-results/results.json' }],
    ...(process.env.CI ? [
      ['github'] as const,
      ['junit', { outputFile: 'e2e-test-results/junit.xml' }] as const
    ] : [])
  ],
  
  // Global test settings
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001',
    
    // Enhanced debugging
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    video: process.env.CI ? 'retain-on-failure' : 'on',
    
    // Browser context settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Timeouts
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },

  // Browser configurations
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome-specific settings
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled']
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Test server configuration
  webServer: {
    command: process.env.CI 
      ? 'node test-server.js' 
      : 'npm run test:server',
    port: parseInt(process.env.TEST_PORT || '3001'),
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      ...process.env
    },
    stdout: 'pipe',
    stderr: 'pipe'
  },

  // Output directory for test artifacts
  outputDir: 'e2e-test-results',

  // Global setup/teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});