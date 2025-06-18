/**
 * Common Mock Helpers
 * 
 * This file provides reusable mock objects and utilities for tests.
 * Import these mocks in your test files to maintain consistency.
 */

import { jest } from '@jest/globals';
import type { ProcessedKline } from '@/types/market';
import type { ConversationMessage } from '@/types/conversation-memory';

/**
 * Logger Mock
 * 
 * Usage:
 * import { mockLogger } from '@/tests/helpers/common-mocks';
 * jest.mock('@/lib/utils/logger', () => ({ logger: mockLogger }));
 */
export const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn()
};

/**
 * LocalStorage Mock
 * 
 * Usage:
 * import { setupLocalStorageMock } from '@/tests/helpers/common-mocks';
 * setupLocalStorageMock();
 */
export const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0
};

export function setupLocalStorageMock() {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });
}

/**
 * Fetch Mock
 * 
 * Usage:
 * import { createFetchMock } from '@/tests/helpers/common-mocks';
 * global.fetch = createFetchMock({ data: 'test' });
 */
export function createFetchMock(response: any, options: {
  status?: number;
  ok?: boolean;
  headers?: Record<string, string>;
  delay?: number;
} = {}) {
  return jest.fn().mockImplementation(async () => {
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    
    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      headers: new Headers(options.headers || {}),
      json: async () => response,
      text: async () => JSON.stringify(response),
      blob: async () => new Blob([JSON.stringify(response)]),
      arrayBuffer: async () => new ArrayBuffer(0),
      formData: async () => new FormData(),
      clone: () => ({ json: async () => response })
    };
  });
}

/**
 * EventSource Mock
 * 
 * Usage:
 * import { createEventSourceMock } from '@/tests/helpers/common-mocks';
 * global.EventSource = createEventSourceMock();
 */
export function createEventSourceMock() {
  return jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
    readyState: 0,
    onopen: null,
    onerror: null,
    onmessage: null,
    url: '',
    withCredentials: false,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
  }));
}

/**
 * WebSocket Mock
 * 
 * Usage:
 * import { createWebSocketMock } from '@/tests/helpers/common-mocks';
 * global.WebSocket = createWebSocketMock();
 */
export function createWebSocketMock() {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 0,
    onopen: null,
    onerror: null,
    onmessage: null,
    onclose: null,
    url: '',
    protocol: '',
    bufferedAmount: 0,
    extensions: '',
    binaryType: 'blob' as BinaryType,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));
}

/**
 * Market Data Factories
 */
export const marketDataFactories = {
  /**
   * Create a ProcessedKline object
   */
  createKline(overrides: Partial<ProcessedKline> = {}): ProcessedKline {
    const baseTime = Date.now();
    return {
      time: baseTime,
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 1000,
      interval: '1h',
      symbol: 'BTCUSDT',
      ...overrides
    };
  },

  /**
   * Create an array of klines with trending data
   */
  createTrendingKlines(
    count: number,
    trend: 'up' | 'down' | 'sideways' = 'up',
    basePrice: number = 50000
  ): ProcessedKline[] {
    const klines: ProcessedKline[] = [];
    const baseTime = Date.now() - count * 3600000; // 1 hour intervals
    
    for (let i = 0; i < count; i++) {
      const trendFactor = trend === 'up' ? 1.001 : trend === 'down' ? 0.999 : 1;
      const volatility = 0.02; // 2% volatility
      
      const price = basePrice * Math.pow(trendFactor, i);
      const randomFactor = 1 + (Math.random() - 0.5) * volatility;
      
      const open = price * randomFactor;
      const close = price * Math.pow(trendFactor, 1) * randomFactor;
      const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
      const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
      
      klines.push({
        time: baseTime + i * 3600000,
        open,
        high,
        low,
        close,
        volume: 1000 + Math.random() * 500,
        interval: '1h',
        symbol: 'BTCUSDT'
      });
    }
    
    return klines;
  }
};

/**
 * Conversation/Chat Factories
 */
export const conversationFactories = {
  /**
   * Create a ConversationMessage
   */
  createMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: 'test-session',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
      metadata: {},
      ...overrides
    };
  },

  /**
   * Create a conversation thread
   */
  createConversation(messageCount: number = 5): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    const baseTime = Date.now() - messageCount * 60000;
    
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg-${i}`,
        sessionId: 'test-session',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i % 2 === 0 ? `User message ${i}` : `Assistant response ${i}`,
        timestamp: baseTime + i * 60000,
        metadata: {
          index: i
        }
      });
    }
    
    return messages;
  }
};

/**
 * Timer Helpers
 */
export const timerHelpers = {
  /**
   * Setup fake timers with common configuration
   */
  setupFakeTimers() {
    jest.useFakeTimers();
    return {
      advance: (ms: number) => jest.advanceTimersByTime(ms),
      runAll: () => jest.runAllTimers(),
      runPending: () => jest.runOnlyPendingTimers(),
      clear: () => jest.clearAllTimers(),
      restore: () => jest.useRealTimers()
    };
  },

  /**
   * Wait for async operations with timeout
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }
};

/**
 * React Testing Helpers
 */
export const reactHelpers = {
  /**
   * Create mock router for Next.js
   */
  createMockRouter(overrides: any = {}) {
    return {
      basePath: '',
      pathname: '/',
      route: '/',
      asPath: '/',
      query: {},
      push: jest.fn().mockResolvedValue(true),
      replace: jest.fn().mockResolvedValue(true),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      },
      isFallback: false,
      isReady: true,
      isLocaleDomain: false,
      ...overrides
    };
  },

  /**
   * Create mock IntersectionObserver
   */
  setupIntersectionObserver() {
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: []
    }));
  },

  /**
   * Create mock ResizeObserver
   */
  setupResizeObserver() {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  }
};

/**
 * API Response Factories
 */
export const apiResponseFactories = {
  /**
   * Create a successful API response
   */
  success<T>(data: T, meta: any = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: Date.now(),
        ...meta
      }
    };
  },

  /**
   * Create an error API response
   */
  error(message: string, code: string = 'ERROR', status: number = 400) {
    return {
      success: false,
      error: {
        message,
        code,
        status,
        timestamp: Date.now()
      }
    };
  },

  /**
   * Create a paginated response
   */
  paginated<T>(
    items: T[],
    page: number = 1,
    perPage: number = 20,
    total: number = 100
  ) {
    return {
      success: true,
      data: items,
      meta: {
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
          hasNext: page * perPage < total,
          hasPrev: page > 1
        }
      }
    };
  }
};

/**
 * Test Data Generators
 */
export const testDataGenerators = {
  /**
   * Generate random string
   */
  randomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, length + 2);
  },

  /**
   * Generate random number in range
   */
  randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random boolean
   */
  randomBoolean(): boolean {
    return Math.random() < 0.5;
  },

  /**
   * Generate random date
   */
  randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },

  /**
   * Generate random email
   */
  randomEmail(): string {
    return `user${this.randomNumber(1000, 9999)}@example.com`;
  },

  /**
   * Generate random crypto symbol
   */
  randomCryptoSymbol(): string {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'];
    return symbols[Math.floor(Math.random() * symbols.length)];
  }
};

/**
 * Assertion Helpers
 */
export const assertionHelpers = {
  /**
   * Assert that a promise rejects with specific error
   */
  async assertRejects(
    promise: Promise<any>,
    expectedError: string | RegExp | Error
  ) {
    try {
      await promise;
      throw new Error('Promise did not reject as expected');
    } catch (error) {
      if (expectedError instanceof RegExp) {
        expect(error.message).toMatch(expectedError);
      } else if (expectedError instanceof Error) {
        expect(error).toEqual(expectedError);
      } else {
        expect(error.message).toBe(expectedError);
      }
    }
  },

  /**
   * Assert that a function is called within a time window
   */
  assertCalledWithin(fn: jest.Mock, timeout: number) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Function not called within ${timeout}ms`));
      }, timeout);

      const checkInterval = setInterval(() => {
        if (fn.mock.calls.length > 0) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });
  }
};

/**
 * Environment Helpers
 */
export const environmentHelpers = {
  /**
   * Temporarily set environment variables
   */
  withEnv(vars: Record<string, string>, fn: () => void | Promise<void>) {
    const original: Record<string, string | undefined> = {};
    
    // Save original values
    Object.keys(vars).forEach(key => {
      original[key] = process.env[key];
    });
    
    // Set new values
    Object.assign(process.env, vars);
    
    try {
      return fn();
    } finally {
      // Restore original values
      Object.keys(vars).forEach(key => {
        if (original[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original[key];
        }
      });
    }
  },

  /**
   * Mock browser environment
   */
  setupBrowserEnv() {
    global.window = {
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Test Environment)'
      },
      document: {
        cookie: ''
      }
    } as any;
  },

  /**
   * Clean up browser environment
   */
  cleanupBrowserEnv() {
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).navigator;
  }
};