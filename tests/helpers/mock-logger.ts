/**
 * Mock logger helper for consistent test setup
 * Provides a unified approach to mocking the logger across all tests
 */

// Mock logger to avoid noise in tests
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
};

/**
 * Mock the logger module for tests
 */
export const setupLoggerMock = () => {
  jest.mock('@/lib/utils/logger', () => ({
    logger: mockLogger,
  }));
  
  return mockLogger;
};

/**
 * Clear all logger mock calls
 */
export const clearLoggerMocks = () => {
  Object.values(mockLogger).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
};

/**
 * Enhanced logger mock with additional functionality
 */
export const createEnhancedLoggerMock = () => {
  const enhancedMock = {
    ...mockLogger,
    logs: [] as Array<{ level: string; message: string; data?: any }>,
    capture: (level: string, message: string, data?: any) => {
      enhancedMock.logs.push({ level, message, data });
    },
    clearCapture: () => {
      enhancedMock.logs = [];
    },
    getLogsByLevel: (level: string) => {
      return enhancedMock.logs.filter(log => log.level === level);
    },
  };

  // Intercept calls to capture them
  enhancedMock.debug.mockImplementation((message: string, data?: any) => {
    enhancedMock.capture('debug', message, data);
  });
  enhancedMock.info.mockImplementation((message: string, data?: any) => {
    enhancedMock.capture('info', message, data);
  });
  enhancedMock.warn.mockImplementation((message: string, data?: any) => {
    enhancedMock.capture('warn', message, data);
  });
  enhancedMock.error.mockImplementation((message: string, data?: any) => {
    enhancedMock.capture('error', message, data);
  });

  return enhancedMock;
};