/**
 * Common test setup and teardown utilities
 * Provides standardized beforeEach/afterEach patterns
 */

import { clearLoggerMocks } from './mock-logger';

/**
 * Standard setup for most test cases
 */
export const standardTestSetup = () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    clearLoggerMocks();
    
    // Use fake timers for consistent timing tests
    jest.useFakeTimers();
    
    // Mock requestAnimationFrame for React components
    global.requestAnimationFrame = jest.fn((callback) => {
      setTimeout(callback, 16); // Simulate 60fps
      return 1;
    });
    
    // Mock cancelAnimationFrame
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    // Restore real timers
    jest.useRealTimers();
    
    // Clean up any remaining mocks
    jest.clearAllMocks();
  });
};

/**
 * Setup for async/promise-based tests
 */
export const asyncTestSetup = () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLoggerMocks();
    
    // Don't use fake timers for async tests by default
    jest.useRealTimers();
    
    // Mock fetch for API tests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
};

/**
 * Setup for WebSocket-related tests
 */
export const websocketTestSetup = () => {
  let mockWsSubject: any;

  beforeEach(() => {
    jest.clearAllMocks();
    clearLoggerMocks();
    jest.useFakeTimers();
    
    // Create mock WebSocket subject
    mockWsSubject = {
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
      unsubscribe: jest.fn(),
      closed: false,
    };
    
    // Mock RxJS webSocket
    jest.mock('rxjs/webSocket', () => ({
      webSocket: jest.fn().mockReturnValue(mockWsSubject),
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  return () => mockWsSubject;
};

/**
 * Setup for React component tests
 */
export const reactTestSetup = () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLoggerMocks();
    
    // Mock IntersectionObserver for components that use it
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    
    // Mock canvas context for chart tests
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn().mockReturnValue({ data: new Array(4) }),
      putImageData: jest.fn(),
      createImageData: jest.fn().mockReturnValue({ data: new Array(4) }),
      setTransform: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      fillText: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 0 }),
      transform: jest.fn(),
      rect: jest.fn(),
      clip: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
};

/**
 * Setup for store/Zustand tests
 */
export const storeTestSetup = () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLoggerMocks();
    
    // Mock localStorage for store persistence
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    global.localStorage = localStorageMock as any;
    
    // Mock sessionStorage
    global.sessionStorage = localStorageMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
};