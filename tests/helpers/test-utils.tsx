/**
 * Common Test Utilities
 * 
 * Shared utilities for all test files
 */

import { render, RenderOptions } from '@testing-library/react';
import * as React from 'react';
import { ReactElement } from 'react';
import { config } from 'dotenv';
import { 
  AsyncTestUtility, 
  MockResponseBuilder, 
  WaitUtility,
  MockObserverUtility,
  TestSessionManager,
  MockTimerManager,
  ValidationUtility 
} from '../utils/common-test-utilities';

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
 * @deprecated Use AsyncTestUtility.flushPromises instead
 */
export async function flushPromises(): Promise<void> {
  return AsyncTestUtility.flushPromises();
}

/**
 * Creates a deferred promise for testing async flows
 * @deprecated Use AsyncTestUtility.createDeferredPromise instead
 */
export function createDeferredPromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
} {
  return AsyncTestUtility.createDeferredPromise<T>();
}

/**
 * Mocks the global fetch function
 * @deprecated Use MockResponseBuilder.createFetchMock instead
 */
export function mockFetch(responses: Array<{ url: string | RegExp; response: any }>): jest.Mock {
  return MockResponseBuilder.createFetchMock(responses);
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
 * @deprecated Use MockTimerManager instead
 */
export class MockTimer extends MockTimerManager {}

/**
 * Asserts that a promise rejects with a specific error
 * @deprecated Use ValidationUtility.expectToReject instead
 */
export async function expectToReject(
  promise: Promise<any>,
  errorMessage?: string | RegExp
) {
  return ValidationUtility.expectToReject(promise, errorMessage);
}

/**
 * Creates a spy on a module method
 */
export function spyOnModule<T extends Record<string, any>>(
  module: T,
  method: keyof T,
  implementation?: any
): jest.SpyInstance {
  const spy = jest.spyOn(module, method as any);
  if (implementation) {
    spy.mockImplementation(implementation);
  } else {
    spy.mockImplementation((() => Promise.resolve()) as any);
  }
  return spy;
}

/**
 * Waits for an element to appear in the DOM
 * @deprecated Use WaitUtility.forElement instead
 */
export async function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element> {
  return WaitUtility.forElement(selector, { timeout });
}

/**
 * Creates a mock intersection observer
 * @deprecated Use MockObserverUtility.createIntersectionObserver instead
 */
export function mockIntersectionObserver() {
  return MockObserverUtility.createIntersectionObserver();
}

/**
 * Creates a mock resize observer
 * @deprecated Use MockObserverUtility.createResizeObserver instead
 */
export function mockResizeObserver() {
  return MockObserverUtility.createResizeObserver();
}

/**
 * Test data cleanup utility
 * @deprecated Use TestSessionManager instead
 */
export class TestDataCleaner extends TestSessionManager {
  add(cleanupFn: () => Promise<void> | void) {
    this.addCleanup(cleanupFn);
  }
}

/**
 * Creates a test session ID
 * @deprecated Use TestSessionManager.createSessionId instead
 */
export function createTestSessionId(prefix: string = 'test'): string {
  const manager = new TestSessionManager();
  return manager.createSessionId(prefix);
}

/**
 * Validates that an object matches a schema
 * @deprecated Use ValidationUtility.validateSchema instead
 */
export function validateSchema(object: any, schema: Record<string, any>): string[] {
  return ValidationUtility.validateSchema(object, schema);
}

/**
 * Measures execution time of a function
 * @deprecated Use AsyncTestUtility.measureExecutionTime instead
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T> | T,
  label?: string
): Promise<{ result: T; duration: number }> {
  return AsyncTestUtility.measureExecutionTime(fn, label);
}

/**
 * Retries a test assertion until it passes or times out
 * @deprecated Use AsyncTestUtility.retryAssertion instead
 */
export async function retryAssertion(
  assertion: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<void> {
  return AsyncTestUtility.retryAssertion(assertion, options);
}