/**
 * Test utility helpers for performance optimization
 */

import { jest } from '@jest/globals';

/**
 * Fast wait function that reduces delays in test environment
 * @param ms - milliseconds to wait (will be reduced in test env)
 */
export async function fastWait(ms: number): Promise<void> {
  // In test environment, reduce delays significantly
  const reducedDelay = process.env.NODE_ENV === 'test' 
    ? Math.min(ms / 10, 10) 
    : ms;
  
  return new Promise(resolve => setTimeout(resolve, reducedDelay));
}

/**
 * Mock metrics collector for faster tests
 */
export const mockMetricsCollector = {
  increment: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  reset: jest.fn(),
  toJSON: jest.fn(() => ({
    drawing_success_total: { value: 0 },
    drawing_failed_total: { value: 0 },
    drawing_retry_total: { value: 0 },
  })),
};

/**
 * Fast retry configuration for tests
 */
export const testRetryConfig = {
  maxAttempts: 2, // Reduce from 3
  initialDelay: 10, // Reduce from 100ms
  maxDelay: 50, // Reduce from 1000ms
  backoffMultiplier: 1.5, // Reduce from 2
};

/**
 * Create a mock operation that resolves after a reduced delay
 */
export function createMockOperation<T>(
  result: T | Error,
  delay: number = 0
): jest.Mock<() => Promise<T>> {
  return jest.fn<() => Promise<T>>().mockImplementation(async () => {
    if (delay > 0) {
      await fastWait(delay);
    }
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
}

/**
 * Run tests with fake timers for better performance
 */
export function runWithFakeTimers(fn: () => void | Promise<void>) {
  return async () => {
    jest.useFakeTimers();
    try {
      const result = fn();
      if (result instanceof Promise) {
        // Fast-forward timers while waiting
        while (jest.getTimerCount() > 0) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        await result;
      }
    } finally {
      jest.useRealTimers();
    }
  };
}

/**
 * Mock logger for tests
 */
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/**
 * Setup common test mocks
 */
export function setupCommonMocks() {
  // Mock console to reduce noise
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  
  // Return cleanup function
  return () => {
    jest.restoreAllMocks();
  };
}