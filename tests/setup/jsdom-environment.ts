// JSDOM Environment Setup - Lightweight browser environment for tests

// Only set up browser mocks if we're in a browser-like environment
if (typeof window !== 'undefined') {
  // Mock window.matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  
  console.log('[JSDOM] Browser environment mocks configured');
} else {
  console.log('[JSDOM] Skipping browser mocks - not in browser environment');
}

// Mock ResizeObserver for component size monitoring (global)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver for visibility detection (global)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));