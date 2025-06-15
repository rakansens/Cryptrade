/**
 * MSW (Mock Service Worker) server setup helper
 * Provides consistent API mocking across all tests
 */

import { setupServer } from 'msw/node';
import { http, HttpResponse, type DefaultBodyType } from 'msw';

/**
 * Default MSW handlers for common API endpoints
 */
export const defaultHandlers = [
  // Binance API mocks
  http.get('https://api.binance.com/api/v3/klines', () => {
    return HttpResponse.json([
      [1640995200000, "100.00", "101.00", "99.00", "100.50", "1000.0", 1640995259999, "100000.0", 100, "500.0", "50000.0", "0"]
    ]);
  }),

  http.get('https://api.binance.com/api/v3/ticker/24hr', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');
    
    if (symbol) {
      return HttpResponse.json({
        symbol,
        priceChange: "1.00",
        priceChangePercent: "1.00",
        weightedAvgPrice: "100.50",
        prevClosePrice: "100.00",
        lastPrice: "101.00",
        lastQty: "1.00",
        bidPrice: "100.95",
        askPrice: "101.05",
        openPrice: "100.00",
        highPrice: "102.00",
        lowPrice: "99.00",
        volume: "10000.00",
        quoteVolume: "1005000.00",
        openTime: 1640995200000,
        closeTime: 1640995259999,
        firstId: 1,
        lastId: 100,
        count: 100
      });
    }
    
    return HttpResponse.json([]);
  }),

  // Internal API mocks
  http.get('/api/metrics', () => {
    return HttpResponse.json({
      success: true,
      data: { requests: 0, errors: 0 }
    });
  }),

  http.get('/api/logs', () => {
    return HttpResponse.json({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, pages: 0, limit: 50 }
    });
  }),

  http.get('/api/logs/stats', () => {
    return HttpResponse.json({
      success: true,
      total: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0, critical: 0 },
      bySource: {}
    });
  }),

  // Error simulation handlers
  http.get('/api/test/error', () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.get('/api/test/timeout', () => {
    return new Promise(() => {}); // Never resolves (timeout simulation)
  }),
];

/**
 * Create MSW server with default handlers
 */
export const createMockServer = (additionalHandlers: any[] = []) => {
  return setupServer(...defaultHandlers, ...additionalHandlers);
};

/**
 * Default server instance
 */
export const server = createMockServer();

/**
 * Setup MSW server for tests
 */
export const setupMswServer = (additionalHandlers: any[] = []) => {
  const testServer = additionalHandlers.length > 0 
    ? createMockServer(additionalHandlers)
    : server;

  beforeAll(() => {
    testServer.listen({ onUnhandledRequest: 'warn' });
  });

  afterEach(() => {
    testServer.resetHandlers();
  });

  afterAll(() => {
    testServer.close();
  });

  return testServer;
};

/**
 * Create handlers for specific test scenarios
 */
export const createTestHandlers = {
  /**
   * Create handlers that simulate network errors
   */
  networkError: (endpoints: string[]) => {
    return endpoints.map(endpoint => 
      http.get(endpoint, () => {
        throw new Error('Network error');
      })
    );
  },

  /**
   * Create handlers that simulate server errors
   */
  serverError: (endpoints: string[], status = 500) => {
    return endpoints.map(endpoint =>
      http.get(endpoint, () => {
        return new HttpResponse(null, { status });
      })
    );
  },

  /**
   * Create handlers with custom responses
   */
  customResponse: (endpoint: string, response: DefaultBodyType, status = 200) => {
    return http.get(endpoint, () => {
      return HttpResponse.json(response, { status });
    });
  },

  /**
   * Create handlers for rate limiting simulation
   */
  rateLimited: (endpoints: string[]) => {
    return endpoints.map(endpoint =>
      http.get(endpoint, () => {
        return new HttpResponse(null, { 
          status: 429,
          headers: { 'Retry-After': '60' }
        });
      })
    );
  },
};

/**
 * Helper to create WebSocket mock
 */
export const createWebSocketMock = () => {
  const mockWs = {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: WebSocket.OPEN,
    url: 'ws://localhost:3000',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob' as BinaryType,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    dispatchEvent: jest.fn(),
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
  };

  // Mock the WebSocket constructor
  (global as any).WebSocket = jest.fn().mockImplementation(() => mockWs);
  
  return mockWs;
};

/**
 * Helper to simulate WebSocket events
 */
export const simulateWebSocketEvent = (mockWs: any, event: string, data?: any) => {
  const handler = mockWs[`on${event}`];
  if (handler && typeof handler === 'function') {
    handler(data);
  }
  
  // Also trigger addEventListener callbacks
  const listeners = mockWs.addEventListener.mock.calls
    .filter(([eventType]: [string]) => eventType === event)
    .map(([, callback]: [string, Function]) => callback);
  
  listeners.forEach((callback: Function) => callback(data));
};