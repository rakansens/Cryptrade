export const circuitBreakerService = {
  getStatus: jest.fn(),
  getAllStatuses: jest.fn(),
  reset: jest.fn(),
  resetAll: jest.fn(),
  trip: jest.fn(),
  getMetrics: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
};