/**
 * Test Helpers Index
 * 
 * Centralized export of all test utilities for easy importing
 */

// Import and re-export all helpers
import {
  mockLogger,
  setupLoggerMock,
  clearLoggerMocks,
  createEnhancedLoggerMock,
} from './mock-logger';

import {
  standardTestSetup,
  asyncTestSetup,
  websocketTestSetup,
  reactTestSetup,
  storeTestSetup,
} from './mock-setup';

import {
  server,
  defaultHandlers,
  createMockServer,
  setupMswServer,
  createTestHandlers,
  createWebSocketMock,
  simulateWebSocketEvent,
} from './msw-server';

// Re-export everything
export {
  // Mock helpers
  mockLogger,
  setupLoggerMock,
  clearLoggerMocks,
  createEnhancedLoggerMock,
  // Setup helpers
  standardTestSetup,
  asyncTestSetup,
  websocketTestSetup,
  reactTestSetup,
  storeTestSetup,
  // MSW server helpers
  server,
  defaultHandlers,
  createMockServer,
  setupMswServer,
  createTestHandlers,
  createWebSocketMock,
  simulateWebSocketEvent,
};

/**
 * All-in-one test setup for most common use cases
 */
export const completeTestSetup = () => {
  // Setup MSW server
  setupMswServer();
  
  // Setup standard mocks and utilities
  standardTestSetup();
  
  // Setup logger mock
  setupLoggerMock();
  
  return {
    server,
    mockLogger,
  };
};

/**
 * API test setup (for testing API routes and external calls)
 */
export const apiTestSetup = (customHandlers: any[] = []) => {
  const testServer = setupMswServer(customHandlers);
  asyncTestSetup();
  setupLoggerMock();
  
  return {
    server: testServer,
    mockLogger,
  };
};

/**
 * Component test setup (for React components)
 */
export const componentTestSetup = () => {
  setupMswServer();
  reactTestSetup();
  setupLoggerMock();
  
  return {
    server,
    mockLogger,
  };
};

/**
 * Integration test setup (for complex multi-system tests)
 */
export const integrationTestSetup = (customHandlers: any[] = []) => {
  const testServer = setupMswServer(customHandlers);
  const mockWs = createWebSocketMock();
  
  // Combine multiple setup patterns
  asyncTestSetup();
  storeTestSetup();
  setupLoggerMock();
  
  return {
    server: testServer,
    mockWs,
    mockLogger,
    simulateWsEvent: (event: string, data?: any) => 
      simulateWebSocketEvent(mockWs, event, data),
  };
};

/**
 * Performance test setup (with timing utilities)
 */
export const performanceTestSetup = () => {
  setupMswServer();
  setupLoggerMock();
  
  // Performance measurement helpers
  const performanceMarks: Map<string, number> = new Map();
  
  const startTimer = (label: string) => {
    performanceMarks.set(label, Date.now());
  };
  
  const endTimer = (label: string) => {
    const start = performanceMarks.get(label);
    if (!start) throw new Error(`Timer '${label}' not found`);
    const duration = Date.now() - start;
    performanceMarks.delete(label);
    return duration;
  };
  
  const expectTimingLessThan = (label: string, maxMs: number) => {
    const duration = endTimer(label);
    expect(duration).toBeLessThan(maxMs);
    return duration;
  };
  
  // Standard test setup
  standardTestSetup();
  
  return {
    server,
    mockLogger,
    startTimer,
    endTimer,
    expectTimingLessThan,
  };
};