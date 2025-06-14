// Jest setup file for additional configuration
require('@testing-library/jest-dom');

// Load environment variables from .env.local for tests
require('dotenv').config({ path: '.env.local' });

// Mock Next.js environment variables if needed
process.env.NODE_ENV = 'test';

// Mock fetch if needed for Node.js environment
global.fetch = jest.fn();

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress debug/info logs in tests unless explicitly needed
  debug: jest.fn(),
  info: jest.fn(),
  // Keep warn and error for important test feedback
  warn: console.warn,
  error: console.error,
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

// Setup timezone for consistent date/time tests
process.env.TZ = 'UTC';