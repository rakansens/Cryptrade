// jest.setup.js
// Global test setup

// Polyfill TextEncoder/TextDecoder for Node.js
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill ReadableStream and other web streams
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// Polyfill MessagePort and MessageChannel
if (typeof global.MessagePort === 'undefined') {
  const { MessagePort, MessageChannel } = require('worker_threads');
  global.MessagePort = MessagePort;
  global.MessageChannel = MessageChannel;
}

// Polyfill BroadcastChannel
if (typeof global.BroadcastChannel === 'undefined') {
  const { BroadcastChannel } = require('worker_threads');
  global.BroadcastChannel = BroadcastChannel;
}

// Polyfill fetch for Node.js (required for MSW) - must be done before any other imports
if (typeof global.fetch === 'undefined') {
  const { fetch, Headers, Request, Response } = require('undici');
  global.fetch = fetch;
  global.Headers = Headers;
  global.Request = Request;
  global.Response = Response;
}

// Import test environment setup before anything else
require('./tests/setup/test-env');

// Setup MSW for API mocking
// Temporarily disabled due to TypeScript compilation issues
// require('./tests/setup/msw-setup');

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
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = 'test-openai-key';
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

// Mock localStorage and sessionStorage for tests
const StorageMock = require('./tests/setup/storage-mock');
global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

// Mock @mastra/core module
jest.mock('@mastra/core', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    runThread: jest.fn(),
    runWorkflow: jest.fn(),
  })),
  Tool: jest.fn().mockImplementation((config) => ({
    ...config,
    execute: config.execute || jest.fn(),
  })),
  createTool: jest.fn((config) => config),
  createWorkflow: jest.fn((config) => ({
    ...config,
    execute: jest.fn(),
  })),
  Mastra: jest.fn().mockImplementation(() => ({
    getAgent: jest.fn(),
    getWorkflow: jest.fn(),
    getTool: jest.fn(),
  })),
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-123'),
}));

// Mock AI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue({
    chat: jest.fn(),
    completion: jest.fn(),
  }),
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: 'Mock AI response',
  }),
  streamText: jest.fn().mockResolvedValue({
    stream: new ReadableStream(),
  }),
}));

// Mock Next.js specific modules for API routes
jest.mock('next/server', () => {
  class MockNextRequest {
    constructor(url, init) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers || {});
      this.nextUrl = new URL(url);
      
      // Mock body parsing methods
      this.json = jest.fn().mockImplementation(async () => {
        if (init?.body) {
          try {
            return JSON.parse(init.body);
          } catch {
            throw new Error('Invalid JSON');
          }
        }
        return {};
      });
      
      this.text = jest.fn().mockResolvedValue(init?.body || '');
      this.formData = jest.fn().mockResolvedValue(new FormData());
    }
  }
  
  class MockNextResponse {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Headers(init?.headers || {});
      
      // Mock response methods
      this.json = jest.fn().mockImplementation(async () => {
        if (typeof this.body === 'string') {
          try {
            return JSON.parse(this.body);
          } catch {
            return this.body;
          }
        }
        return this.body;
      });
      
      this.text = jest.fn().mockResolvedValue(
        typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
      );
    }
  }
  
  MockNextResponse.json = jest.fn((data, init) => {
    return new MockNextResponse(data, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
  });
  
  MockNextResponse.error = jest.fn(() => {
    return new MockNextResponse(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  });
  
  MockNextResponse.redirect = jest.fn((url, status = 307) => {
    return new MockNextResponse(null, {
      status,
      headers: { Location: url },
    });
  });
  
  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

// Mock API handler creation utilities
jest.mock('@/lib/api/create-api-handler', () => {
  const { z } = require('zod');
  
  return {
    createApiHandler: jest.fn((config) => {
      return jest.fn(async (request) => {
        try {
          // Parse request data
          let data = {};
          if (request.method === 'GET' || request.method === 'HEAD') {
            // For GET requests, parse query params
            const searchParams = new URL(request.url).searchParams;
            const queryData = {};
            searchParams.forEach((value, key) => {
              queryData[key] = value;
            });
            data = queryData;
          } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
            try {
              data = await request.json();
            } catch {
              // Ignore JSON parsing errors in tests
            }
          }
          
          // Validate with schema if provided
          if (config.schema) {
            try {
              data = config.schema.parse(data);
            } catch (error) {
              if (error instanceof z.ZodError) {
                return new (require('next/server').NextResponse)(
                  JSON.stringify({ 
                    error: { 
                      message: 'Invalid query parameters',
                      errors: error.errors 
                    } 
                  }),
                  { status: 400 }
                );
              }
              throw error;
            }
          }
          
          // Call the handler
          const result = await config.handler({
            data,
            request,
            context: {
              headers: Object.fromEntries(request.headers.entries()),
            },
          });
          
          // Return NextResponse
          return new (require('next/server').NextResponse)(
            JSON.stringify(result),
            { 
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          );
        } catch (error) {
          // Handle different error types
          let status = 500;
          let errorResponse = { error: { message: error.message || 'Internal server error' } };
          
          // Check for specific error types
          if (error.constructor.name === 'AuthError' || error.message?.includes('Unauthorized')) {
            status = 401;
          } else if (error.constructor.name === 'ValidationError') {
            status = 400;
            errorResponse = { 
              error: { 
                message: error.message,
                field: error.field,
                value: error.value 
              } 
            };
          } else if (error.constructor.name === 'ApiError') {
            status = error.statusCode || 500;
            errorResponse = { 
              error: { 
                message: error.message,
                ...error.details 
              } 
            };
          }
          
          return new (require('next/server').NextResponse)(
            JSON.stringify(errorResponse),
            { status }
          );
        }
      });
    }),
  createOptionsHandler: jest.fn(() => {
    return jest.fn(async () => {
      return new (require('next/server').NextResponse)(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    });
  }),
  };
});

// Mock Zustand
const createZustandMock = () => {
  const storeCache = new Map();
  
  const createStore = (stateCreator) => {
    let currentState = {};
    const listeners = new Set();
    
    const setState = jest.fn((updater) => {
      const previousState = currentState;
      
      if (typeof updater === 'function') {
        // Immer-style draft handling
        const draft = { ...currentState };
        const result = updater(draft);
        // If the updater returns something, use it; otherwise use the mutated draft
        currentState = result !== undefined ? result : draft;
      } else {
        currentState = { ...currentState, ...updater };
      }
      
      // Notify listeners
      listeners.forEach(listener => {
        listener(currentState, previousState);
      });
    });
    
    const getState = jest.fn(() => currentState);
    
    const subscribe = jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });
    
    const store = {
      getState,
      setState,
      subscribe,
      destroy: jest.fn(() => {
        listeners.clear();
      }),
    };
    
    // Initialize state with proper function handling
    if (typeof stateCreator === 'function') {
      const initialState = stateCreator(setState, getState, store);
      currentState = initialState;
    }
    
    // Create a hook function that returns the current state
    const useStore = jest.fn((selector) => {
      if (selector) {
        return selector(currentState);
      }
      return currentState;
    });
    
    // Add store methods to the hook
    useStore.getState = getState;
    useStore.setState = setState;
    useStore.subscribe = subscribe;
    useStore.destroy = store.destroy;
    
    // Add reset method support
    useStore.getInitialState = jest.fn(() => {
      // Return a fresh initial state by re-running the state creator
      if (typeof stateCreator === 'function') {
        // Create a temporary store to get initial state
        const tempSetState = jest.fn();
        const tempGetState = jest.fn(() => ({}));
        const tempStore = { getState: tempGetState, setState: tempSetState };
        
        const freshState = stateCreator(tempSetState, tempGetState, tempStore);
        // Extract only the state properties (not actions)
        const stateOnly = {};
        for (const key in freshState) {
          if (typeof freshState[key] !== 'function') {
            stateOnly[key] = freshState[key];
          }
        }
        return stateOnly;
      }
      return {};
    });
    
    // Also expose them as properties for direct access
    Object.defineProperty(useStore, 'getState', {
      value: getState,
      writable: false,
      enumerable: true
    });
    Object.defineProperty(useStore, 'setState', {
      value: setState,
      writable: false,
      enumerable: true
    });
    
    return useStore;
  };
  
  return {
    create: jest.fn((stateCreatorOrConfig) => {
      // Handle curried version of create (TypeScript style)
      if (typeof stateCreatorOrConfig === 'undefined' || typeof stateCreatorOrConfig === 'object') {
        // This is the curried version: create<T>()(...) or create(config)(...)
        return (stateCreator) => {
          if (!stateCreator) {
            throw new Error('Zustand create called without state creator');
          }
          
          // Return cached store if it exists (for singleton stores)
          const creatorString = stateCreator.toString();
          if (storeCache.has(creatorString)) {
            return storeCache.get(creatorString);
          }
          
          const store = createStore(stateCreator);
          storeCache.set(creatorString, store);
          return store;
        };
      }
      
      // Direct version: create(stateCreator)
      if (!stateCreatorOrConfig) {
        throw new Error('Zustand create called without state creator');
      }
      
      // Return cached store if it exists (for singleton stores)
      const creatorString = stateCreatorOrConfig.toString();
      if (storeCache.has(creatorString)) {
        return storeCache.get(creatorString);
      }
      
      const store = createStore(stateCreatorOrConfig);
      storeCache.set(creatorString, store);
      return store;
    }),
  };
};

jest.mock('zustand', () => createZustandMock());

jest.mock('zustand/middleware', () => ({
  createJSONStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
  persist: jest.fn((stateCreator, options) => {
    return (set, get, store) => {
      const state = stateCreator(set, get, store);
      // Mock persist functionality
      const persistedState = {
        ...state,
        // Add persist-specific properties
        persist: {
          setOptions: jest.fn(),
          clearStorage: jest.fn(),
          rehydrate: jest.fn(),
          hasHydrated: jest.fn(() => true),
          onHydrate: jest.fn(),
          onFinishHydration: jest.fn(),
          getOptions: jest.fn(() => options),
          ...(options || {})
        }
      };
      return persistedState;
    };
  }),
  subscribeWithSelector: jest.fn((stateCreator) => stateCreator),
  devtools: jest.fn((stateCreator, options) => stateCreator),
}));

jest.mock('zustand/middleware/immer', () => ({
  immer: jest.fn((stateCreator) => stateCreator),
}));

// Mock Prisma client before any imports use it
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $use: jest.fn(),
    conversationSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
  serializeBigInt: jest.fn((data) => data),
  withTransaction: jest.fn(),
}));

// Mock utilities
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock error classes
jest.mock('@/lib/errors/base-error', () => ({
  AuthError: class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message, field, value) {
      super(message);
      this.name = 'ValidationError';
      this.field = field;
      this.value = value;
    }
  },
  ApiError: class ApiError extends Error {
    constructor(message, statusCode, details) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.details = details;
    }
  },
  BaseError: class BaseError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BaseError';
    }
  },
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});