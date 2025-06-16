// Jest setup file for additional configuration
require('@testing-library/jest-dom');

// Performance optimizations
jest.setTimeout(5000); // Global timeout for all tests

// Disable fake timers by default (can cause performance issues)
jest.useRealTimers();

// Reduce timer delays in tests
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;

global.setTimeout = (fn, delay, ...args) => {
  // Reduce delays in test environment
  const reducedDelay = delay > 10 ? Math.min(delay / 10, 100) : delay;
  return originalSetTimeout(fn, reducedDelay, ...args);
};

global.setInterval = (fn, delay, ...args) => {
  // Reduce intervals in test environment
  const reducedDelay = delay > 10 ? Math.min(delay / 10, 100) : delay;
  return originalSetInterval(fn, reducedDelay, ...args);
};

// Load environment variables from .env.local for tests
require('dotenv').config({ path: '.env.local' });

// Mock Next.js environment variables if needed
process.env.NODE_ENV = 'test';

// Mock fetch if needed for Node.js environment
global.fetch = jest.fn();

// Mock console methods for cleaner test output
const originalConsole = console;
global.console = {
  ...console,
  // Suppress debug/info logs in tests unless explicitly needed
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  // Keep warn and error for important test feedback but reduce noise
  warn: process.env.SHOW_TEST_WARNINGS ? originalConsole.warn : jest.fn(),
  error: process.env.SHOW_TEST_ERRORS ? originalConsole.error : jest.fn(),
};

// Mock WebSocket for connection manager tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  readyState: 1, // OPEN
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null
}));

// Mock TextEncoder/TextDecoder for Node.js test environment
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock ReadableStream for Node.js test environment
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource) {
      this.underlyingSource = underlyingSource;
      this.controller = {
        chunks: [],
        closed: false,
        enqueue: function(chunk) {
          this.chunks.push(chunk);
        },
        close: function() {
          this.closed = true;
        }
      };
      if (underlyingSource && underlyingSource.start) {
        underlyingSource.start(this.controller);
      }
    }

    async *[Symbol.asyncIterator]() {
      for (const chunk of this.controller.chunks) {
        yield chunk;
      }
    }

    getReader() {
      const controller = this.controller;
      let index = 0;
      return {
        async read() {
          if (index < controller.chunks.length) {
            return { value: controller.chunks[index++], done: false };
          }
          return { done: true };
        },
        releaseLock() {}
      };
    }
  };
}

// Setup timezone for consistent date/time tests
process.env.TZ = 'UTC';

// Optimize module resolution
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock heavy dependencies
jest.mock('@/lib/monitoring/metrics', () => ({
  metricsCollector: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
    reset: jest.fn(),
    toJSON: jest.fn(() => ({
      drawing_success_total: { value: 0 },
      drawing_failed_total: { value: 0 },
      drawing_retry_total: { value: 0 },
    })),
  },
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Prevent memory leaks
afterAll(() => {
  jest.restoreAllMocks();
});