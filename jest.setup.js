// jest.setup.js
// Global test setup

// Ensure timer functions are available globally
if (typeof global.setTimeout === 'undefined') {
  global.setTimeout = require('timers').setTimeout;
}
if (typeof global.clearTimeout === 'undefined') {
  global.clearTimeout = require('timers').clearTimeout;
}
if (typeof global.setInterval === 'undefined') {
  global.setInterval = require('timers').setInterval;
}
if (typeof global.clearInterval === 'undefined') {
  global.clearInterval = require('timers').clearInterval;
}

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

// Polyfill Headers first
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = {};
      if (init instanceof Headers) {
        init.forEach((value, key) => {
          this.append(key, value);
        });
      } else if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.append(key, value);
        });
      }
    }
    
    append(name, value) {
      name = name.toLowerCase();
      if (!this._headers[name]) {
        this._headers[name] = [];
      }
      this._headers[name].push(value);
    }
    
    delete(name) {
      delete this._headers[name.toLowerCase()];
    }
    
    get(name) {
      const values = this._headers[name.toLowerCase()];
      return values ? values.join(', ') : null;
    }
    
    has(name) {
      return name.toLowerCase() in this._headers;
    }
    
    set(name, value) {
      this._headers[name.toLowerCase()] = [value];
    }
    
    forEach(callback) {
      Object.entries(this._headers).forEach(([key, values]) => {
        callback(values.join(', '), key, this);
      });
    }
    
    entries() {
      return Object.entries(this._headers).map(([key, values]) => [key, values.join(', ')]);
    }
    
    keys() {
      return Object.keys(this._headers);
    }
    
    values() {
      return Object.values(this._headers).map(values => values.join(', '));
    }
  };
}

// Polyfill Response/Request/Headers for MSW if not available
if (typeof global.Response === 'undefined') {
  // Simple Response polyfill for MSW tests
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new global.Headers(init.headers || {});
      this.ok = this.status >= 200 && this.status < 300;
      this.redirected = false;
      this.type = 'basic';
      this.url = '';
      
      this.json = async () => {
        if (typeof this.body === 'string') {
          return JSON.parse(this.body);
        }
        return this.body;
      };
      
      this.text = async () => {
        if (typeof this.body === 'string') {
          return this.body;
        }
        return JSON.stringify(this.body);
      };
      
      this.clone = () => {
        return new Response(this.body, {
          status: this.status,
          statusText: this.statusText,
          headers: this.headers
        });
      };
    }
  };
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = input;
      this.method = init.method || 'GET';
      this.headers = new global.Headers(init.headers || {});
      this.body = init.body || null;
      
      this.json = async () => {
        if (this.body) {
          return JSON.parse(this.body);
        }
        return {};
      };
      
      this.text = async () => {
        return this.body || '';
      };
      
      this.clone = () => {
        return new Request(this.url, {
          method: this.method,
          headers: this.headers,
          body: this.body
        });
      };
    }
  };
}

// Import test environment setup before anything else
require('./tests/setup/test-env');

// Import JSDOM environment setup
require('./tests/setup/jsdom-environment');

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

// Mock fetch for testing
const createDefaultResponse = (url) => ({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'basic',
  url: url || '',
  clone: jest.fn(function() { 
    return {...this};
  }),
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  blob: jest.fn().mockResolvedValue(new Blob()),
  formData: jest.fn().mockResolvedValue(new FormData()),
});

// Create the base mock function
const mockFetch = jest.fn();

// Set default implementation
mockFetch.mockImplementation((url, options) => {
  return Promise.resolve(createDefaultResponse(url));
});

global.fetch = mockFetch;

// Helper to create a mock ReadableStream for testing
global.createMockReadableStream = (chunks) => {
  let index = 0;
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
};

// Mock EventSource for SSE testing
class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.close = jest.fn(() => {
      this.readyState = 2; // CLOSED
    });
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 0);
  }
  
  // Helper method for tests to simulate messages
  simulateMessage(data) {
    if (this.onmessage && this.readyState === 1) {
      this.onmessage({ type: 'message', data });
    }
  }
  
  // Helper method for tests to simulate errors
  simulateError(error) {
    if (this.onerror) {
      this.onerror({ type: 'error', error });
    }
  }
}

MockEventSource.CONNECTING = 0;
MockEventSource.OPEN = 1;
MockEventSource.CLOSED = 2;

global.EventSource = MockEventSource;

// ▶ Node 環境で window が未定義の場合に最低限のスタブを用意
if (typeof global.window === 'undefined') {
  global.window = {};
}
if (typeof global.window.dispatchEvent === 'undefined') {
  global.window.dispatchEvent = jest.fn();
}
if (typeof global.window.addEventListener === 'undefined') {
  global.window.addEventListener = jest.fn();
  global.window.removeEventListener = jest.fn();
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

// Mock @neondatabase/serverless
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => {
    return jest.fn((sql) => Promise.resolve([]));
  }),
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn(),
  })),
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn(),
  })),
}));

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

// Remove Zustand mock - use actual implementation with test helpers
/*
const createZustandMock = () => {
  // グローバルにキャッシュを保持して、resetAllStoresから参照できるようにする
  if (!global.__zustand_store_cache__) {
    global.__zustand_store_cache__ = new Map();
  }
  const storeCache = global.__zustand_store_cache__;
  
  const createStore = (stateCreator) => {
    let currentState = {};
    const listeners = new Set();
    
    // Create a hook function that returns the current state
    const useStore = jest.fn((selector) => {
      if (selector) {
        return selector(currentState);
      }
      return currentState;
    });
    
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
      
      // Update the hook's internal state to trigger re-renders
      useStore.mockImplementation((selector) => {
        if (selector) {
          return selector(currentState);
        }
        return currentState;
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
      
      // Store the initial state for reset functionality
      store.initialState = {};
      for (const key in initialState) {
        if (typeof initialState[key] !== 'function') {
          store.initialState[key] = initialState[key];
        }
      }
    }
    
    // Add store methods to the hook
    useStore.getState = getState;
    useStore.setState = setState;
    useStore.subscribe = subscribe;
    useStore.destroy = store.destroy;
    
    // Add reset method support
    useStore.getInitialState = jest.fn(() => {
      return store.initialState || {};
    });
    
    // Add reset method
    useStore.reset = jest.fn(() => {
      if (store.initialState) {
        setState(store.initialState);
      }
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
*/

jest.mock('zustand/middleware', () => ({
  createJSONStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
  persist: jest.fn((stateCreator, options) => {
    // persistミドルウェアは、stateCreatorをそのまま返す
    return stateCreator;
  }),
  subscribeWithSelector: jest.fn((stateCreator) => stateCreator),
  devtools: jest.fn((stateCreator, options) => stateCreator),
}));

jest.mock('zustand/middleware/immer', () => ({
  immer: jest.fn((stateCreator) => stateCreator),
}));

// Mock SSE handler utilities
jest.mock('@/lib/api/create-sse-handler', () => {
  const mockSSEStream = {
    write: jest.fn(),
    close: jest.fn(),
    isClosed: false,
  };

  class MockSSEBroadcast {
    constructor() {
      this.subscribers = new Set();
      this.messageHistory = [];
    }
    
    subscribe(stream) {
      this.subscribers.add(stream);
      return () => {
        this.subscribers.delete(stream);
      };
    }
    
    broadcast(message) {
      this.messageHistory.push(message);
      for (const stream of this.subscribers) {
        if (!stream.isClosed) {
          stream.write(message);
        }
      }
    }
    
    getSubscriberCount() {
      return this.subscribers.size;
    }
    
    close() {
      for (const stream of this.subscribers) {
        if (!stream.isClosed) {
          stream.close();
        }
      }
      this.subscribers.clear();
      this.messageHistory = [];
    }
  }

  return {
    SSEBroadcast: MockSSEBroadcast,
    createSSEHandler: jest.fn((config) => {
      return jest.fn(async (request) => {
        // Create a mock response for SSE
        const stream = new ReadableStream({
          start(controller) {
            const sseStream = { ...mockSSEStream };
            
            // Call onConnect if provided
            if (config.handler.onConnect) {
              config.handler.onConnect({
                request,
                data: {},
                stream: sseStream,
              });
            }
            
            // Send initial connected event
            const message = JSON.stringify({
              event: 'connected',
              data: {
                message: 'SSE connection established',
                timestamp: Date.now(),
              },
            });
            controller.enqueue(`event: connected\ndata: ${message}\n\n`);
          },
        });
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      });
    }),
    createSSEOptionsHandler: jest.fn(() => {
      return jest.fn(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Origin': '*',
          },
        });
      });
    }),
  };
});

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
    trace: jest.fn(),
  },
}));

// Mock metrics
jest.mock('@/lib/monitoring/metrics', () => ({
  metrics: {
    incrementMetric: jest.fn(),
    recordMetric: jest.fn(),
    recordHistogram: jest.fn(),
    recordGauge: jest.fn(),
    startTimer: jest.fn(() => jest.fn()),
    recordAgentExecution: jest.fn(),
    getCacheMetrics: jest.fn(() => ({
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0
    })),
  },
}));

// Note: Mastra agent mocks are handled via automocking in the test files themselves

// Mock chart agent utils
jest.mock('@/lib/chart/agent-utils', () => ({
  agentUtils: {
    validateChartDrawing: jest.fn((drawing) => drawing),
    prepareDrawingData: jest.fn((data) => data),
    executeDrawingOperation: jest.fn(async (fn) => await fn()),
    showAgentSuccess: jest.fn(),
    handleAgentError: jest.fn(),
    handleValidationError: jest.fn(),
    validatePatternData: jest.fn((pattern) => pattern),
    executePatternOperation: jest.fn(async (fn) => await fn()),
    preparePatternData: jest.fn((data) => data),
  }
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

// Mock Next.js Image component
jest.mock('next/image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function Image({ src, alt, width, height, ...props }) {
      // eslint-disable-next-line @next/next/no-img-element
      return React.createElement('img', {
        src,
        alt,
        width,
        height,
        ...props,
      });
    },
  };
});

// Mock Next.js Link component
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function Link({ children, href, ...props }) {
      return React.createElement('a', { href: href.toString(), ...props }, children);
    },
  };
});

// Mock common UI components
jest.mock('@/components/ui/button', () => ({
  Button: require('react').forwardRef(({ children, onClick, ...props }, ref) => 
    require('react').createElement('button', { ref, onClick, 'data-testid': 'button', ...props }, children)
  ),
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'card', ...props }, children),
  CardHeader: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'card-header', ...props }, children),
  CardTitle: ({ children, ...props }) => require('react').createElement('h3', { 'data-testid': 'card-title', ...props }, children),
  CardDescription: ({ children, ...props }) => require('react').createElement('p', { 'data-testid': 'card-description', ...props }, children),
  CardContent: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'card-content', ...props }, children),
  CardFooter: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'card-footer', ...props }, children),
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => {
    const React = require('react');
    return open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null;
  },
  DialogTrigger: ({ children, asChild }) => {
    const React = require('react');
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children);
    }
    return React.createElement('button', { 'data-testid': 'dialog-trigger' }, children);
  },
  DialogContent: ({ children }) => require('react').createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogHeader: ({ children }) => require('react').createElement('div', { 'data-testid': 'dialog-header' }, children),
  DialogTitle: ({ children }) => require('react').createElement('h2', { 'data-testid': 'dialog-title' }, children),
  DialogDescription: ({ children }) => require('react').createElement('p', { 'data-testid': 'dialog-description' }, children),
  DialogFooter: ({ children }) => require('react').createElement('div', { 'data-testid': 'dialog-footer' }, children),
}))

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }) => require('react').createElement('div', { 'data-testid': 'scroll-area', ...props }, children),
}))

jest.mock('@/components/ui/separator', () => ({
  Separator: (props) => require('react').createElement('hr', { 'data-testid': 'separator', ...props }),
}))

// Tooltip mock is commented out temporarily
// jest.mock('@/components/ui/tooltip', () => {
//   const React = require('react');
//   return {
//     TooltipProvider: ({ children }) => children,
//     Tooltip: ({ children }) => children,
//     TooltipTrigger: ({ children, asChild }) => {
//       if (asChild && React.isValidElement(children)) {
//         return React.cloneElement(children);
//       }
//       return React.createElement('span', { 'data-testid': 'tooltip-trigger' }, children);
//     },
//     TooltipContent: ({ children }) => React.createElement('div', { 'data-testid': 'tooltip-content' }, children),
//   };
// })

// Mock hooks that are commonly missing
jest.mock('@/hooks/use-ui-event-stream', () => ({
  useUIEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  })),
  useUiEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-typed-ui-event-stream', () => ({
  useTypedUIEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  })),
  useTypedUiEventStream: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-view-persistence-simple', () => ({
  useViewPersistenceSimple: jest.fn(() => ({
    viewState: {},
    setViewState: jest.fn(),
  })),
  useViewPersistence: jest.fn(() => ({
    viewState: {},
    setViewState: jest.fn(),
    clearViewState: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-view-persistence', () => ({
  useViewPersistence: jest.fn(() => ({
    viewState: {},
    setViewState: jest.fn(),
    clearViewState: jest.fn(),
  }))
}));

jest.mock('@/hooks/market/use-candlestick-data', () => ({
  useCandlestickData: jest.fn(() => ({
    priceData: [],
    isLoading: false,
    error: null,
  }))
}));

jest.mock('@/hooks/chat/use-proposal-management', () => ({
  useProposalManagement: jest.fn(() => ({
    proposals: [],
    addProposal: jest.fn(),
    removeProposal: jest.fn(),
    updateProposal: jest.fn(),
  }))
}));

jest.mock('@/hooks/chat/use-message-handling', () => ({
  useMessageHandling: jest.fn(() => ({
    messages: [],
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
    editMessage: jest.fn(),
  }))
}));

jest.mock('@/hooks/chart/useChartUIEventHandlers', () => ({
  useChartUIEventHandlers: jest.fn()
}));

jest.mock('@/hooks/chart/useDrawingEventHandlers', () => ({
  useDrawingEventHandlers: jest.fn()
}));

jest.mock('@/hooks/chart/usePatternEventHandlers', () => ({
  usePatternEventHandlers: jest.fn()
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Additional JSDOM / Node polyfills
// ---------------------------------------------------------------------------

// jsdom 22+ may expose window but location が null のケースを回避
if (typeof window !== 'undefined' && !window.location) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.location = new URL('http://localhost/');
}

// Timer functions polyfill for jsdom environment
if (typeof global.clearInterval === 'undefined' || typeof global.setInterval === 'undefined') {
  // @ts-ignore
  global.setInterval = global.setInterval || function(callback, delay, ...args) {
    return setTimeout(function repeat() {
      callback(...args);
      setTimeout(repeat, delay);
    }, delay);
  };
  
  // @ts-ignore
  global.clearInterval = global.clearInterval || clearTimeout;
}

if (typeof global.clearTimeout === 'undefined' || typeof global.setTimeout === 'undefined') {
  // These should exist in Node.js, but add fallback
  // @ts-ignore
  global.setTimeout = global.setTimeout || (() => 0);
  // @ts-ignore
  global.clearTimeout = global.clearTimeout || (() => {});
}

// ---------------------------------------------------------------------------
// Library mocks to avoid missing module errors in unit tests
// ---------------------------------------------------------------------------

// axios mock (simple)
jest.mock('axios', () => {
  const fn = () => Promise.resolve({ data: {} });
  fn.create = () => fn;
  fn.get = jest.fn(() => Promise.resolve({ data: {} }));
  fn.post = jest.fn(() => Promise.resolve({ data: {} }));
  return { default: fn };
});

// nanoid non-secure mock
jest.mock('nanoid/non-secure', () => ({ nanoid: () => 'test-id' }));

// pg client mock to bypass database connections
jest.mock(
  'pg',
  () => ({
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    })),
  }),
  { virtual: true }
);

// Setup WebSocket mock with constants
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class WebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = WebSocket.CONNECTING;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
    }
    
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}