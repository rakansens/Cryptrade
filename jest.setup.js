// jest.setup.js
// Global test setup

// Import test environment setup before anything else
require('./tests/setup/test-env');

// Setup MSW for API mocking
require('./tests/setup/msw-setup');

// Extend Jest matchers
require('@testing-library/jest-dom');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  // Keep console.error and console.warn for debugging
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  // Silence other console methods
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Environment variables are now set in tests/setup/test-env.ts
// Additional test-specific environment variables can be set here if needed
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';

// Mock fetch for Node.js environment
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      status: 200,
      statusText: 'OK',
    })
  );
}

// Mock browser APIs only if window is defined (jsdom environment)
if (typeof window !== 'undefined') {
  // Mock window.matchMedia
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

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };
}

// Mock semantic embedding service to avoid API calls in tests
jest.mock('@/lib/services/semantic-embedding.service', () => {
  const { MockSemanticEmbeddingService } = require('./tests/setup/mock-semantic-embedding');
  return {
    SemanticEmbeddingService: MockSemanticEmbeddingService,
    embeddingService: MockSemanticEmbeddingService.getInstance(),
  };
});

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});