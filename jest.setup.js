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

// Polyfill setImmediate/clearImmediate for environments that don't have it
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = clearTimeout;
}

// Polyfill fetch for Node.js environments that don't have it
if (typeof global.fetch === 'undefined') {
  // Create a simple fetch implementation that MSW can intercept
  const simpleFetch = async (url, options = {}) => {
    // Create request object for MSW to intercept
    const request = new global.Request(url, options);
    
    // Return a pending promise that MSW will resolve
    return new Promise((resolve, reject) => {
      // This will be intercepted by MSW if handlers are set up
      // If not intercepted, reject with network error
      setTimeout(() => {
        reject(new Error(`No MSW handler found for ${url}`));
      }, 100);
    });
  };
  
  global.fetch = simpleFetch;
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

// Extend Jest matchers
require('@testing-library/jest-dom');

// Setup MSW for API mocking AFTER polyfills but BEFORE other mocks
require('./tests/setup/msw-setup');

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

// Removed fetch mock - MSW will handle all HTTP mocking
// If tests need a default fetch mock, they should set it up individually

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
    this._listeners = {};
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
  
  addEventListener(type, handler) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(handler);
  }
  
  removeEventListener(type, handler) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(h => h !== handler);
    }
  }
  
  dispatchEvent(event) {
    const type = event.type;
    if (this._listeners[type]) {
      this._listeners[type].forEach(handler => {
        handler(event);
      });
    }
    // Also trigger the on* handlers
    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (type === 'error' && this.onerror) {
      this.onerror(event);
    } else if (type === 'open' && this.onopen) {
      this.onopen(event);
    }
    return true;
  }
  
  // Helper method for tests to simulate messages
  simulateMessage(data) {
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
  }
  
  // Helper method for tests to simulate errors
  simulateError(error) {
    const event = new Event('error');
    event.error = error;
    this.dispatchEvent(event);
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
          // Apply middleware if provided
          if (config.middleware) {
            const middlewares = Array.isArray(config.middleware) ? config.middleware : [config.middleware];
            for (const middleware of middlewares) {
              const response = await middleware(request);
              if (response) {
                return response; // Middleware returned early response
              }
            }
          }
          
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
          } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE') {
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
          
          // Extract session ID from headers
          const sessionId = request.headers.get('x-session-id');
          
          // Call the handler
          const result = await config.handler({
            data,
            request,
            context: {
              sessionId,
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
            // ApiError stores statusCode in data field
            status = (error.data && error.data.statusCode) || error.statusCode || 500;
            
            // Extract retryable and other properties from error
            const errorObject = {
              message: error.message,
              ...(error.retryable !== undefined && { retryable: error.retryable }),
              ...(error.context !== undefined && { context: error.context }),
            };
            
            errorResponse = { 
              error: errorObject
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
  createStreamingHandler: jest.fn((config) => {
    return jest.fn(async (request) => {
      try {
        // Parse request data
        let data = {};
        if (request.method === 'POST' || request.method === 'PUT') {
          try {
            data = await request.json();
          } catch {
            // Ignore JSON parsing errors in tests
          }
        }
        
        // Validate with schema if provided
        if (config.schema) {
          data = config.schema.parse(data);
        }
        
        // Call the stream handler
        const context = {
          sessionId: request.headers.get('x-session-id'),
          headers: Object.fromEntries(request.headers.entries()),
        };
        
        const stream = config.streamHandler({ data, request, context });
        
        // Create a mock SSE response
        return new Response(new ReadableStream({
          async start(controller) {
            try {
              if (stream instanceof ReadableStream) {
                // Handle ReadableStream directly
                const reader = stream.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              } else {
                // Handle AsyncGenerator
                for await (const chunk of stream) {
                  const data = typeof chunk === 'string'
                    ? chunk
                    : `data: ${JSON.stringify(chunk)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(data));
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        }), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error) {
        // Return error response
        return new (require('next/server').NextResponse)(
          JSON.stringify({ error: { message: error.message } }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
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

// Mock chart stores
jest.mock('@/store/chart', () => ({
  useChartBaseStore: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      patterns: new Map(),
      reset: jest.fn(),
      isChartReady: true,
      isLoading: false,
      error: null,
      setChartReady: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartStoreBase: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT', 
      timeframe: '1h',
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      patterns: new Map(),
      reset: jest.fn(),
      drawings: [],
      indicators: {},
      drawingMode: null,
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      settings: {}
    };
    return selector ? selector(state) : state;
  }),
  useIndicatorStore: jest.fn((selector) => {
    const state = {
      indicators: {},
      settings: {},
      setIndicators: jest.fn(),
      updateIndicator: jest.fn(),
      setIndicatorEnabled: jest.fn(),
      setIndicatorSetting: jest.fn(),
      setSettings: jest.fn(),
      updateSetting: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useDrawingStore: jest.fn((selector) => {
    const state = {
      drawingMode: null,
      drawings: [],
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      setDrawingMode: jest.fn(),
      addDrawing: jest.fn(),
      addDrawingAsync: jest.fn(),
      updateDrawing: jest.fn(),
      deleteDrawing: jest.fn(),
      deleteDrawingAsync: jest.fn(),
      selectDrawing: jest.fn(),
      clearAllDrawings: jest.fn(),
      setIsDrawing: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      initializeDrawings: jest.fn(),
      pushToUndoStack: jest.fn(),
      clearRedoStack: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  usePatternStore: jest.fn((selector) => {
    const state = {
      patterns: new Map(),
      addPattern: jest.fn(),
      removePattern: jest.fn(),
      clearPatterns: jest.fn(),
      getPattern: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartStore: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      isChartReady: true,
      isLoading: false,
      error: null,
      indicators: {},
      settings: {},
      drawingMode: null,
      drawings: [],
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      patterns: new Map(),
      // All actions
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      setChartReady: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      setIndicators: jest.fn(),
      updateIndicator: jest.fn(),
      setIndicatorEnabled: jest.fn(),
      setIndicatorSetting: jest.fn(),
      setSettings: jest.fn(),
      updateSetting: jest.fn(),
      setDrawingMode: jest.fn(),
      addDrawing: jest.fn(),
      addDrawingAsync: jest.fn(),
      updateDrawing: jest.fn(),
      deleteDrawing: jest.fn(),
      deleteDrawingAsync: jest.fn(),
      selectDrawing: jest.fn(),
      clearAllDrawings: jest.fn(),
      setIsDrawing: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      initializeDrawings: jest.fn(),
      addPattern: jest.fn(),
      removePattern: jest.fn(),
      clearPatterns: jest.fn(),
      getPattern: jest.fn(),
      pushToUndoStack: jest.fn(),
      clearRedoStack: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartActions: jest.fn(() => ({
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
    setIndicators: jest.fn(),
    updateIndicator: jest.fn(),
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
    setSettings: jest.fn(),
    updateSetting: jest.fn(),
    setChartReady: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    reset: jest.fn()
  })),
  useDrawingActions: jest.fn(() => ({
    setDrawingMode: jest.fn(),
    addDrawing: jest.fn(),
    updateDrawing: jest.fn(),
    deleteDrawing: jest.fn(),
    selectDrawing: jest.fn(),
    clearAllDrawings: jest.fn(),
    setIsDrawing: jest.fn(),
    getDrawing: jest.fn((id) => {
      if (id === 'drawing-456') {
        return { id, type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } };
      }
      return null;
    })
  })),
  usePatternActions: jest.fn(() => ({
    addPattern: jest.fn(),
    removePattern: jest.fn(),
    clearPatterns: jest.fn(),
    getPattern: jest.fn()
  })),
  // Convenience hooks
  useChartSymbol: jest.fn(() => 'BTCUSDT'),
  useChartTimeframe: jest.fn(() => '1h'),
  useChartIndicators: jest.fn(() => ({ ma: false, rsi: false, macd: false, boll: false })),
  useChartSettings: jest.fn(() => ({ ma: { ma1: 20, ma2: 50, ma3: 100 }, boll: { period: 20, stdDev: 2 }, rsi: { period: 14 }, macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } })),
  useIsChartReady: jest.fn(() => true),
  useChartDrawings: jest.fn(() => []),
  useChartPatterns: jest.fn(() => new Map()),
  useDrawingMode: jest.fn(() => null),
  useSelectedDrawing: jest.fn(() => null),
  useIsDrawing: jest.fn(() => false),
  useChart: jest.fn(() => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: { ma: false, rsi: false, macd: false, boll: false },
    settings: { ma: { ma1: 20, ma2: 50, ma3: 100 }, boll: { period: 20, stdDev: 2 }, rsi: { period: 14 }, macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
    isChartReady: true,
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
    setIndicators: jest.fn(),
    updateIndicator: jest.fn(),
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
    setSettings: jest.fn(),
    updateSetting: jest.fn(),
    setChartReady: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    reset: jest.fn()
  }))
}));

// Remove mock for error classes - let them use the real implementation
// The base-error module exports proper classes that tests expect

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
// Note: These mocks are handled by the manual mocks in __mocks__/@/components/ui/
// The mapping is configured in jest.preset.js moduleNameMapper

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
    currentView: 'home',
    showHome: true,
    showChat: false,
    setView: jest.fn(),
    goToChat: jest.fn(),
    goToHome: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-view-persistence', () => ({
  useViewPersistence: jest.fn(() => ({
    currentView: 'home',
    showHome: true,
    showChat: false,
    setView: jest.fn(),
    goToChat: jest.fn(),
    goToHome: jest.fn(),
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

// Mock ClipboardEvent for tests
if (typeof global.ClipboardEvent === 'undefined') {
  global.ClipboardEvent = class ClipboardEvent extends Event {
    constructor(type, eventInitDict) {
      super(type, eventInitDict);
      this.clipboardData = eventInitDict?.clipboardData || {
        getData: jest.fn(() => ''),
        setData: jest.fn(),
        items: [],
        types: [],
        files: []
      };
    }
  };
}

// Mock DataTransfer for tests
if (typeof global.DataTransfer === 'undefined') {
  global.DataTransfer = class DataTransfer {
    constructor() {
      this.items = [];
      this.types = [];
      this.files = [];
      this.effectAllowed = 'all';
      this.dropEffect = 'none';
    }
    
    getData(format) {
      return '';
    }
    
    setData(format, data) {
      // Mock implementation
    }
    
    clearData(format) {
      // Mock implementation
    }
    
    setDragImage(image, x, y) {
      // Mock implementation
    }
  };
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

// Error handling for Jest workers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Jest worker:', error);
  // Don't exit the process, let Jest handle it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, let Jest handle it
});

// Increase memory limits for tests
if (global.gc) {
  // Run garbage collection periodically
  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });
}