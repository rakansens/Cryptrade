/**
 * Common Test Utilities
 * 
 * Shared utilities for all test files
 */

import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

/**
 * Custom render function that includes common providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add any global providers here (Theme, Router, etc.)
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Waits for async operations to complete
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Creates a deferred promise for testing async flows
 */
export function createDeferredPromise<T>() {
  let resolve: (value: T) => void;
  let reject: (error: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Mocks the global fetch function
 */
export function mockFetch(responses: Array<{ url: string | RegExp; response: any }>) {
  const fetchMock = jest.fn();
  
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    const match = responses.find(r => {
      if (typeof r.url === 'string') {
        return url.includes(r.url);
      }
      return r.url.test(url);
    });
    
    if (!match) {
      return Promise.reject(new Error(`No mock found for ${url}`));
    }
    
    if (match.response instanceof Error) {
      return Promise.reject(match.response);
    }
    
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => match.response,
      text: async () => JSON.stringify(match.response),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
  });
  
  global.fetch = fetchMock;
  
  return fetchMock;
}

/**
 * Restores all mocks
 */
export function restoreAllMocks() {
  jest.restoreAllMocks();
  jest.clearAllMocks();
}

/**
 * Suppresses console output during tests
 */
export function suppressConsole() {
  const originalConsole = { ...console };
  
  beforeAll(() => {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
  });
  
  afterAll(() => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });
}

/**
 * Creates a mock timer for testing time-based functionality
 */
export class MockTimer {
  private currentTime: number;
  
  constructor(initialTime: number = Date.now()) {
    this.currentTime = initialTime;
  }
  
  advance(milliseconds: number) {
    this.currentTime += milliseconds;
    jest.advanceTimersByTime(milliseconds);
  }
  
  getCurrentTime() {
    return this.currentTime;
  }
  
  install() {
    jest.useFakeTimers();
    jest.setSystemTime(this.currentTime);
  }
  
  uninstall() {
    jest.useRealTimers();
  }
}

/**
 * Asserts that a promise rejects with a specific error
 */
export async function expectToReject(
  promise: Promise<any>,
  errorMessage?: string | RegExp
) {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error) {
    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect((error as Error).message).toContain(errorMessage);
      } else {
        expect((error as Error).message).toMatch(errorMessage);
      }
    }
  }
}

/**
 * Creates a spy on a module method
 */
export function spyOnModule<T>(
  module: T,
  method: keyof T,
  implementation?: any
): jest.SpyInstance {
  return jest.spyOn(module, method as any).mockImplementation(
    implementation || (() => Promise.resolve())
  );
}

/**
 * Waits for an element to appear in the DOM
 */
export async function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element ${selector} not found after ${timeout}ms`);
}

/**
 * Creates a mock intersection observer
 */
export function mockIntersectionObserver() {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  window.IntersectionObserver = mockIntersectionObserver as any;
  
  return mockIntersectionObserver;
}

/**
 * Creates a mock resize observer
 */
export function mockResizeObserver() {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  window.ResizeObserver = mockResizeObserver as any;
  
  return mockResizeObserver;
}

/**
 * Test data cleanup utility
 */
export class TestDataCleaner {
  private cleanupFns: Array<() => Promise<void> | void> = [];
  
  add(cleanupFn: () => Promise<void> | void) {
    this.cleanupFns.push(cleanupFn);
  }
  
  async cleanup() {
    for (const fn of this.cleanupFns.reverse()) {
      await fn();
    }
    this.cleanupFns = [];
  }
}

/**
 * Creates a test session ID
 */
export function createTestSessionId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates that an object matches a schema
 */
export function validateSchema(object: any, schema: Record<string, any>) {
  const errors: string[] = [];
  
  for (const [key, validator] of Object.entries(schema)) {
    if (typeof validator === 'function') {
      if (!validator(object[key])) {
        errors.push(`Property ${key} failed validation`);
      }
    } else if (typeof validator === 'object' && validator !== null) {
      if (typeof object[key] !== 'object') {
        errors.push(`Property ${key} should be an object`);
      } else {
        const nestedErrors = validateSchema(object[key], validator);
        if (nestedErrors.length > 0) {
          errors.push(`Property ${key}: ${nestedErrors.join(', ')}`);
        }
      }
    } else if (object[key] !== validator) {
      errors.push(`Property ${key} should be ${validator} but was ${object[key]}`);
    }
  }
  
  return errors;
}

/**
 * Measures execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T> | T,
  label?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  if (label) {
    console.log(`${label}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
}

/**
 * Retries a test assertion until it passes or times out
 */
export async function retryAssertion(
  assertion: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, onRetry } = options;
  const startTime = Date.now();
  let attempt = 0;
  let lastError: Error | undefined;
  
  while (Date.now() - startTime < timeout) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error as Error;
      attempt++;
      if (onRetry) onRetry(attempt);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error(
    `Assertion failed after ${attempt} attempts: ${lastError?.message}`
  );
}