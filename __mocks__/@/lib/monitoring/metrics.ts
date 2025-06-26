// Mock for monitoring metrics module
// Updated to properly mock observeMetric and incrementMetric functions

export const observeMetric = jest.fn();
export const incrementMetric = jest.fn();

// Legacy compatibility
export const recordMetric = jest.fn();
export const recordCounter = jest.fn();

// Reset all mocks
export const resetMetrics = () => {
  observeMetric.mockClear();
  incrementMetric.mockClear();
  recordMetric.mockClear();
  recordCounter.mockClear();
};

// Additional utility functions that might be used
export const getMetricValue = jest.fn();
export const clearMetrics = jest.fn();