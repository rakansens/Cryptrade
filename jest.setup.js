// jest.setup.js
// Jest test setup - reorganized and modularized

// 1. Polyfills - Browser API polyfills for Node.js environment
require('./tests/setup/polyfills');

// 2. Test environment setup
require('./tests/setup/test-env');

// 3. JSDOM environment setup
require('./tests/setup/jsdom-environment');

// 4. Extend Jest matchers
require('@testing-library/jest-dom');

// 5. MSW setup - AFTER polyfills and JSDOM but BEFORE other mocks
require('./tests/setup/msw-setup');

// 6. Browser API mocks
require('./tests/setup/browser-mocks');

// 7. Library and framework mocks
require('./tests/setup/library-mocks');

// 8. Next.js specific mocks
require('./tests/setup/nextjs-mocks');

// 9. Store and state management mocks
require('./tests/setup/store-mocks');

// 10. Mock localStorage and sessionStorage for tests
const StorageMock = require('./tests/setup/storage-mock');
global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

// Environment variables setup
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = 'sk-test-key-12345';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';

// Global test timeout
jest.setTimeout(10000);

// Console handling
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Mock console methods to reduce noise in test output
beforeAll(() => {
  // Filter out expected error messages
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    const message = args[0]?.toString() || '';
    
    // List of expected error patterns that should be silenced
    const expectedErrors = [
      'Chart control error',
      'Invalid klines payload',
      'Expected array, got',
      '[Improved Orchestrator] DETAILED ERROR',
      'Failed to convert value to',
      'Error in chart data processing',
      'WebSocket error simulation',
      'Test error',
      'Mock error',
      'Simulated error',
      'Expected error',
      '[MSW] Warning:', // MSW warnings
      '[MSW] Error:', // MSW errors
      'intercepted a request without a matching request handler', // MSW unhandled request messages
      'Warning: An update to',
      'inside a test was not wrapped in act',
      'When testing, code that causes React state updates should be wrapped into act',
      'react-dom.development.js',
      'printWarning',
      'warnIfUpdatesNotWrappedWithActDEV',
      'scheduleUpdateOnFiber',
      'forceStoreRerender',
      'handleStoreChange'
    ];
    
    // Check if this is an expected error
    const isExpectedError = expectedErrors.some(pattern => 
      message.includes(pattern) || 
      (args.length > 1 && args.some(arg => 
        arg?.toString().includes(pattern)
      ))
    );
    
    // If not an expected error, log it
    if (!isExpectedError) {
      originalConsoleError(...args);
    }
  });
  
  // Also filter warnings
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    const message = args[0]?.toString() || '';
    
    // List of expected warning patterns that should be silenced
    const expectedWarnings = [
      'React Router Future Flag Warning',
      'Zustand devtools',
      'Test warning',
      '[MSW] Warning:', // MSW warnings
      'intercepted a request without a matching request handler', // MSW unhandled request warnings
      '[RateLimit] Using memory fallback', // Rate limit warnings
      'RateLimit', // General rate limit warnings
      '[Deprecated]', // Deprecation warnings
      'An update to TestComponent inside a test was not wrapped in act', // React act warnings
      'Warning: An update to', // React state update warnings
      'Consider using the \"jsdom\" test environment' // JSDOM environment warnings
    ];
    
    const isExpectedWarning = expectedWarnings.some(pattern => 
      message.includes(pattern)
    );
    
    if (!isExpectedWarning) {
      originalConsoleWarn(...args);
    }
  });
});

// Restore console after all tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Additional console mocking for other methods
global.console = {
  ...console,
  // Silence other console methods
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Handle unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection in test:', reason);
  console.error('Promise:', promise);
  if (process.env.CI) {
    // In CI, fail fast on unhandled rejections
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in test:', error);
  if (process.env.CI) {
    // In CI, fail fast on uncaught exceptions
    process.exit(1);
  }
});

// Import store reset utility
const { resetAllStores } = require('./tests/setup/reset-stores');

// Clean up after each test
afterEach(() => {
  // Reset all Zustand stores
  try {
    resetAllStores();
  } catch (error) {
    // Ignore errors if stores are not available
  }
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear all timers if fake timers were used
  if (jest.isMockFunction(global.setTimeout)) {
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  }
  
  // Reset module cache to ensure clean state
  jest.resetModules();
});

// Error handling for Jest workers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Jest worker:', error);
  // Don't exit the process, let Jest handle it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, let Jest handle it
});

// Increase memory limits for tests
if (global.gc) {
  // Run garbage collection periodically
  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });
}

// Force EnhancedMarketDataService custom mock before tests execute
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const emdMock = require('./__mocks__/@/lib/services/enhanced-market-data.service.ts');
  jest.setMock('@/lib/services/enhanced-market-data.service', emdMock);
} catch (e) {}