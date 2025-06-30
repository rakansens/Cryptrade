/**
 * Mock implementation of useUIEventStream hook
 */
export const useUIEventStream = jest.fn(() => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}));