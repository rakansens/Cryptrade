/**
 * Mock helper utilities for testing
 */

import { mockMessageSequences } from '../__fixtures__/websocket/messages';
import { mockAuthResponses } from '../__fixtures__/auth/user-states';
import { mockMarketDataResponses, mockErrorResponses } from '../__fixtures__/api/responses';

/**
 * Mock response builder for HTTP requests
 */
export class MockResponseBuilder {
  private status: number = 200;
  private headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  private body: any = {};
  private delay: number = 0;

  withStatus(status: number): MockResponseBuilder {
    this.status = status;
    return this;
  }

  withHeaders(headers: Record<string, string>): MockResponseBuilder {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  withBody(body: any): MockResponseBuilder {
    this.body = body;
    return this;
  }

  withDelay(ms: number): MockResponseBuilder {
    this.delay = ms;
    return this;
  }

  async build(): Promise<Response> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    return new Response(JSON.stringify(this.body), {
      status: this.status,
      headers: this.headers
    });
  }

  // Preset responses
  static success(data: any): MockResponseBuilder {
    return new MockResponseBuilder()
      .withStatus(200)
      .withBody({ success: true, data });
  }

  static error(code: string, message: string, status = 400): MockResponseBuilder {
    return new MockResponseBuilder()
      .withStatus(status)
      .withBody({ success: false, error: { code, message } });
  }

  static unauthorized(): MockResponseBuilder {
    return new MockResponseBuilder()
      .withStatus(401)
      .withBody(mockErrorResponses.unauthorized);
  }

  static serverError(): MockResponseBuilder {
    return new MockResponseBuilder()
      .withStatus(500)
      .withBody(mockErrorResponses.serverError);
  }
}

/**
 * Mock WebSocket event simulator
 */
export class WebSocketSimulator {
  private ws: any;
  private eventQueue: Array<{ event: any, delay: number }> = [];
  private isRunning: boolean = false;

  constructor(websocket: any) {
    this.ws = websocket;
  }

  // Queue an event to be sent
  queueEvent(event: any, delay: number = 0): WebSocketSimulator {
    this.eventQueue.push({ event, delay });
    return this;
  }

  // Queue multiple events
  queueEvents(events: any[], baseDelay: number = 0, interval: number = 100): WebSocketSimulator {
    events.forEach((event, index) => {
      this.queueEvent(event, baseDelay + (index * interval));
    });
    return this;
  }

  // Queue a message sequence
  queueSequence(sequenceName: keyof typeof mockMessageSequences): WebSocketSimulator {
    const sequence = mockMessageSequences[sequenceName];
    return this.queueEvents(sequence);
  }

  // Simulate connection lifecycle
  simulateConnection(): WebSocketSimulator {
    this.queueEvent({ type: 'open' }, 0);
    this.queueEvent({ type: 'connected', timestamp: Date.now() }, 10);
    this.queueEvent({ type: 'ping', timestamp: Date.now() }, 1000);
    this.queueEvent({ type: 'pong', timestamp: Date.now() }, 1100);
    return this;
  }

  // Simulate disconnection
  simulateDisconnection(reason: string = 'Normal closure'): WebSocketSimulator {
    this.queueEvent({ type: 'disconnected', timestamp: Date.now() }, 0);
    this.queueEvent({ type: 'close', code: 1000, reason }, 100);
    return this;
  }

  // Simulate reconnection attempts
  simulateReconnection(attempts: number = 3): WebSocketSimulator {
    for (let i = 0; i < attempts; i++) {
      const baseDelay = i * 5000;
      this.queueEvent({ type: 'reconnecting', attempt: i + 1 }, baseDelay);
      if (i === attempts - 1) {
        this.queueEvent({ type: 'connected', timestamp: Date.now() }, baseDelay + 2000);
      } else {
        this.queueEvent({ type: 'error', message: 'Connection failed' }, baseDelay + 2000);
      }
    }
    return this;
  }

  // Start processing the event queue
  async start(): Promise<void> {
    this.isRunning = true;
    const startTime = Date.now();

    while (this.eventQueue.length > 0 && this.isRunning) {
      const nextEvent = this.eventQueue[0];
      if (!nextEvent) break;
      const { event, delay } = nextEvent;
      const elapsed = Date.now() - startTime;

      if (elapsed >= delay) {
        this.eventQueue.shift();
        this.sendEvent(event);
      } else {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  // Stop processing
  stop(): void {
    this.isRunning = false;
    this.eventQueue = [];
  }

  // Send an event immediately
  sendEvent(event: any): void {
    if (event.type === 'open') {
      this.ws.mockOpen();
    } else if (event.type === 'close') {
      this.ws.mockClose(event.code, event.reason);
    } else if (event.type === 'error') {
      this.ws.mockError(new Error(event.message || 'WebSocket error'));
    } else {
      this.ws.mockReceiveMessage(event);
    }
  }
}

/**
 * Mock API request interceptor
 */
export class APIInterceptor {
  private routes: Map<string, (req: any) => Promise<any>> = new Map();
  private defaultHandler: (req: any) => Promise<any>;

  constructor() {
    this.defaultHandler = async () => {
      return MockResponseBuilder.error('NOT_FOUND', 'Route not found', 404).build();
    };
  }

  // Register a route handler
  route(method: string, path: string | RegExp, handler: (req: any) => any): APIInterceptor {
    const key = `${method.toUpperCase()} ${path}`;
    this.routes.set(key, async (req) => {
      const result = await handler(req);
      if (result instanceof MockResponseBuilder) {
        return result.build();
      }
      return MockResponseBuilder.success(result).build();
    });
    return this;
  }

  // Convenience methods
  get(path: string | RegExp, handler: (req: any) => any): APIInterceptor {
    return this.route('GET', path, handler);
  }

  post(path: string | RegExp, handler: (req: any) => any): APIInterceptor {
    return this.route('POST', path, handler);
  }

  put(path: string | RegExp, handler: (req: any) => any): APIInterceptor {
    return this.route('PUT', path, handler);
  }

  delete(path: string | RegExp, handler: (req: any) => any): APIInterceptor {
    return this.route('DELETE', path, handler);
  }

  // Set default handler for unmatched routes
  setDefaultHandler(handler: (req: any) => Promise<any>): APIInterceptor {
    this.defaultHandler = handler;
    return this;
  }

  // Handle a request
  async handle(method: string, url: string, options?: any): Promise<Response> {
    const path = new URL(url).pathname;
    
    // Try exact match first
    const exactKey = `${method.toUpperCase()} ${path}`;
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey)!({ method, url, ...options });
    }

    // Try regex matches
    for (const [key, handler] of this.routes) {
      const [routeMethod, ...routePathParts] = key.split(' ');
      const routePath = routePathParts.join(' ');
      // Check if routePath looks like a regex (starts with /)
      if (routeMethod === method.toUpperCase() && routePath.startsWith('/') && routePath.endsWith('/')) {
        try {
          const regex = new RegExp(routePath.slice(1, -1));
          if (regex.test(path)) {
            return handler({ method, url, ...options });
          }
        } catch (e) {
          // Not a valid regex, skip
        }
      }
    }

    // Use default handler
    return this.defaultHandler({ method, url, ...options });
  }

  // Create preset API mocks
  static createMarketDataAPI(): APIInterceptor {
    return new APIInterceptor()
      .get('/api/market/ticker', () => mockMarketDataResponses.ticker)
      .get('/api/market/klines', () => mockMarketDataResponses.klines)
      .get('/api/market/orderbook', () => mockMarketDataResponses.orderBook)
      .get('/api/market/trades', () => mockMarketDataResponses.trades);
  }

  static createAuthAPI(): APIInterceptor {
    return new APIInterceptor()
      .post('/api/auth/login', (req) => {
        const { email, password } = req.body || {};
        if (email === 'test@example.com' && password === 'password') {
          return mockAuthResponses.loginSuccess;
        }
        return MockResponseBuilder.error('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      })
      .post('/api/auth/logout', () => mockAuthResponses.logoutSuccess)
      .post('/api/auth/refresh', () => mockAuthResponses.refreshSuccess)
      .get('/api/auth/session', () => mockAuthResponses.loginSuccess);
  }
}

/**
 * Test scenario runner
 */
export class ScenarioRunner {
  private steps: Array<() => Promise<void>> = [];
  private cleanup: Array<() => Promise<void>> = [];

  step(name: string, action: () => Promise<void>): ScenarioRunner {
    this.steps.push(async () => {
      console.log(`Running step: ${name}`);
      await action();
    });
    return this;
  }

  withCleanup(cleanup: () => Promise<void>): ScenarioRunner {
    this.cleanup.push(cleanup);
    return this;
  }

  async run(): Promise<void> {
    try {
      for (const step of this.steps) {
        await step();
      }
    } finally {
      for (const cleanupFn of this.cleanup) {
        await cleanupFn();
      }
    }
  }

  // Preset scenarios
  static tradingSession(): ScenarioRunner {
    return new ScenarioRunner()
      .step('Login user', async () => {
        // Mock login
      })
      .step('Connect to WebSocket', async () => {
        // Mock WebSocket connection
      })
      .step('Subscribe to market data', async () => {
        // Mock subscription
      })
      .step('Place order', async () => {
        // Mock order placement
      })
      .step('Receive order update', async () => {
        // Mock order update
      });
  }
}

/**
 * Time control for testing
 */
export class TimeController {
  private baseTime: number;
  private currentTime: number;
  private timers: Map<number, { callback: () => void, time: number }> = new Map();
  private nextTimerId: number = 1;

  constructor(initialTime?: Date | number) {
    this.baseTime = initialTime ? new Date(initialTime).getTime() : Date.now();
    this.currentTime = this.baseTime;
  }

  // Advance time by milliseconds
  advance(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    // Execute any timers that should fire
    for (const [id, timer] of this.timers) {
      if (timer.time <= targetTime) {
        timer.callback();
        this.timers.delete(id);
      }
    }
    
    this.currentTime = targetTime;
  }

  // Set specific time
  setTime(time: Date | number): void {
    this.currentTime = new Date(time).getTime();
  }

  // Get current mocked time
  now(): number {
    return this.currentTime;
  }

  // Mock setTimeout
  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      callback,
      time: this.currentTime + delay
    });
    return id;
  }

  // Mock clearTimeout
  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  // Install time mocks
  install(): void {
    jest.spyOn(Date, 'now').mockImplementation(() => this.now());
    jest.spyOn(global, 'setTimeout').mockImplementation((cb, delay) => this.setTimeout(cb, delay ?? 0) as any);
    jest.spyOn(global, 'clearTimeout').mockImplementation((id) => {
      if (typeof id === 'number') {
        this.clearTimeout(id);
      }
    });
  }

  // Restore original implementations
  restore(): void {
    jest.restoreAllMocks();
  }
}