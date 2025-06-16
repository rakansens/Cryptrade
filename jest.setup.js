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

// Mock AbortController if not available
if (typeof global.AbortController === 'undefined') {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      onabort: null
    };
    
    abort = jest.fn(() => {
      this.signal.aborted = true;
      if (this.signal.onabort) {
        this.signal.onabort();
      }
    });
  };
}

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

// Mock EventSource for SSE tests
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url = '';
  readyState = MockEventSource.CONNECTING;
  onopen = null;
  onerror = null;
  onmessage = null;
  listeners = new Map();

  constructor(url) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    return true;
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    this.listeners.clear();
  }
}

global.EventSource = MockEventSource;

// Mock WebSocket for connection manager tests
// Only mock if WebSocket doesn't exist (avoid overriding test-specific mocks)
if (typeof global.WebSocket === 'undefined') {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    url = '';
    readyState = MockWebSocket.CONNECTING;
    onopen = null;
    onclose = null;
    onmessage = null;
    onerror = null;

    constructor(url) {
      this.url = url;
      // Simulate async connection
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }, 0);
    }

    close = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        setTimeout(() => {
          this.onclose(new Event('close'));
        }, 0);
      }
    });

    send = jest.fn();
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
  }

  global.WebSocket = MockWebSocket;
}

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
      this._controller = null;
      this._started = false;
      this._chunks = [];
      this._closed = false;
      
      // Create controller
      this._controller = {
        chunks: this._chunks,
        closed: false,
        enqueue: (chunk) => {
          if (!this._closed) {
            this._chunks.push(chunk);
          }
        },
        close: () => {
          this._closed = true;
          this._controller.closed = true;
        },
        error: (e) => {
          this._closed = true;
          this._controller.closed = true;
          this._error = e;
        }
      };
      
      // Start the underlying source
      if (underlyingSource && underlyingSource.start) {
        Promise.resolve(underlyingSource.start(this._controller)).then(() => {
          this._started = true;
        });
      } else {
        this._started = true;
      }
    }

    async *[Symbol.asyncIterator]() {
      // Wait for start to complete
      while (!this._started) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      let index = 0;
      while (true) {
        if (index < this._chunks.length) {
          yield this._chunks[index++];
        } else if (this._closed) {
          break;
        } else {
          // Wait for more chunks
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    getReader() {
      let index = 0;
      const chunks = this._chunks;
      const self = this;
      
      return {
        closed: Promise.resolve(),
        async read() {
          // Wait for start to complete
          while (!self._started) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          if (self._error) {
            throw self._error;
          }
          
          if (index < chunks.length) {
            return { value: chunks[index++], done: false };
          } else if (self._closed) {
            return { done: true, value: undefined };
          } else {
            // Wait for more chunks or close
            await new Promise(resolve => setTimeout(resolve, 10));
            return this.read();
          }
        },
        releaseLock() {},
        cancel() {
          self._closed = true;
          return Promise.resolve();
        }
      };
    }
    
    get locked() {
      return false;
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