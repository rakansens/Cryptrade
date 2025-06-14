/**
 * WebSocket Mock for E2E testing
 * Provides realistic WebSocket behavior simulation
 */

import type { RawWebSocketMessage } from '../types';

// WebSocket event types
interface WebSocketEventMap {
  close: CloseEvent;
  error: Event;
  message: MessageEvent;
  open: Event;
}

type WebSocketEventHandler<K extends keyof WebSocketEventMap> = (event: WebSocketEventMap[K]) => void;

// Binance message types
interface BinanceTradeMessage {
  e: 'trade';
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}

interface BinanceKlineMessage {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    x: boolean;
  };
}

interface BinanceDepthMessage {
  e: 'depthUpdate';
  E: number;
  s: string;
  b: Array<[string, string]>;
  a: Array<[string, string]>;
}

interface BinanceErrorMessage {
  error: {
    code: number;
    msg: string;
  };
}

interface BinanceSubscriptionResponse {
  result: unknown;
  id: number;
}

type BinanceMessage = BinanceTradeMessage | BinanceKlineMessage | BinanceDepthMessage | BinanceErrorMessage | BinanceSubscriptionResponse;

export class MockWebSocket {
  private static instances: MockWebSocket[] = [];
  private listeners: Map<keyof WebSocketEventMap, Array<WebSocketEventHandler<keyof WebSocketEventMap>>> = new Map();
  private _readyState: number = MockWebSocket.CONNECTING;
  private _url: string;
  private messageQueue: BinanceMessage[] = [];
  private closeCode?: number;
  private closeReason?: string;

  // WebSocket constants
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this._url = url;
    MockWebSocket.instances.push(this);
    
    // Simulate async connection
    setTimeout(() => {
      if (this._readyState === MockWebSocket.CONNECTING) {
        this._readyState = MockWebSocket.OPEN;
        this.trigger('open', new Event('open'));
        
        // Process any queued messages
        this.messageQueue.forEach(message => {
          this.trigger('message', new MessageEvent('message', { data: JSON.stringify(message) }));
        });
        this.messageQueue = [];
      }
    }, 10);
  }

  get readyState(): number {
    return this._readyState;
  }

  get url(): string {
    return this._url;
  }

  addEventListener<K extends keyof WebSocketEventMap>(event: K, handler: WebSocketEventHandler<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    (this.listeners.get(event)! as Array<WebSocketEventHandler<K>>).push(handler);
  }

  removeEventListener<K extends keyof WebSocketEventMap>(event: K, handler: WebSocketEventHandler<K>): void {
    const handlers = this.listeners.get(event) as Array<WebSocketEventHandler<K>> | undefined;
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  send(data: string): void {
    if (this._readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // In a real scenario, this would send data to server
    // For testing, we can trigger responses based on sent data
    this.handleSentMessage(JSON.parse(data));
  }

  close(code?: number, reason?: string): void {
    if (this._readyState === MockWebSocket.CLOSED || this._readyState === MockWebSocket.CLOSING) {
      return;
    }
    
    this._readyState = MockWebSocket.CLOSING;
    this.closeCode = code;
    this.closeReason = reason;
    
    setTimeout(() => {
      this._readyState = MockWebSocket.CLOSED;
      this.trigger('close', new CloseEvent('close', { 
        code: this.closeCode || 1000, 
        reason: this.closeReason || '' 
      }));
    }, 1);
  }

  // Simulate receiving a message from server
  simulateMessage(data: BinanceMessage): void {
    if (this._readyState === MockWebSocket.OPEN) {
      this.trigger('message', new MessageEvent('message', { data: JSON.stringify(data) }));
    } else {
      // Queue message for when connection opens
      this.messageQueue.push(data);
    }
  }

  // Simulate connection error
  simulateError(error?: Error): void {
    this.trigger('error', new ErrorEvent('error', { error: error || new Error('WebSocket error') }));
  }

  // Simulate network disconnection
  simulateDisconnect(): void {
    if (this._readyState === MockWebSocket.OPEN) {
      this._readyState = MockWebSocket.CLOSED;
      this.trigger('close', new CloseEvent('close', { code: 1006, reason: 'Connection lost' }));
    }
  }

  private trigger<K extends keyof WebSocketEventMap>(event: K, data: WebSocketEventMap[K]): void {
    const handlers = (this.listeners.get(event) || []) as Array<WebSocketEventHandler<K>>;
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in WebSocket event handler:', error);
      }
    });

    // Also trigger onXxx properties if set
    const onHandlerName = `on${event}` as keyof this;
    const onHandler = this[onHandlerName];
    if (typeof onHandler === 'function') {
      try {
        (onHandler as WebSocketEventHandler<K>)(data);
      } catch (error) {
        console.error('Error in WebSocket on handler:', error);
      }
    }
  }

  private handleSentMessage(message: { method?: string; id?: number }): void {
    // Simulate server responses based on sent messages
    // This could be customized per test case
    if (message.method === 'SUBSCRIBE') {
      // Simulate subscription confirmation
      setTimeout(() => {
        this.simulateMessage({
          result: null,
          id: message.id
        });
      }, 5);
    }
  }

  // Static methods for test control
  static getAllInstances(): MockWebSocket[] {
    return [...MockWebSocket.instances];
  }

  static getInstanceByUrl(url: string): MockWebSocket | undefined {
    return MockWebSocket.instances.find(instance => instance.url === url);
  }

  static clearInstances(): void {
    MockWebSocket.instances.forEach(instance => {
      if (instance.readyState !== MockWebSocket.CLOSED) {
        instance.close();
      }
    });
    MockWebSocket.instances = [];
  }

  static simulateNetworkIssue(): void {
    MockWebSocket.instances.forEach(instance => {
      if (instance.readyState === MockWebSocket.OPEN) {
        instance.simulateDisconnect();
      }
    });
  }
}

/**
 * Binance-specific WebSocket message generators
 */
export class BinanceMessageGenerator {
  static tradeMessage(symbol: string = 'BTCUSDT', price: string = '50000'): BinanceTradeMessage {
    return {
      e: 'trade',
      E: Date.now(),
      s: symbol,
      t: Math.floor(Math.random() * 1000000),
      p: price,
      q: '0.1',
      T: Date.now(),
      m: Math.random() > 0.5
    };
  }

  static klineMessage(symbol: string = 'BTCUSDT', interval: string = '1m'): BinanceKlineMessage {
    const now = Date.now();
    const startTime = now - 60000; // 1 minute ago
    
    return {
      e: 'kline',
      E: now,
      s: symbol,
      k: {
        t: startTime,
        T: now,
        s: symbol,
        i: interval,
        o: '49900.00',
        c: '50000.00',
        h: '50100.00',
        l: '49800.00',
        v: '10.5',
        x: Math.random() > 0.5 // Randomly closed or not
      }
    };
  }

  static depthMessage(symbol: string = 'BTCUSDT'): BinanceDepthMessage {
    return {
      e: 'depthUpdate',
      E: Date.now(),
      s: symbol,
      b: [
        ['49950.00', '1.5'],
        ['49940.00', '2.0']
      ],
      a: [
        ['50050.00', '1.2'],
        ['50060.00', '0.8']
      ]
    };
  }

  static errorMessage(code: number = -1, msg: string = 'Test error'): BinanceErrorMessage {
    return {
      error: {
        code,
        msg
      }
    };
  }

  static subscriptionResponse(id: number, result: unknown = null): BinanceSubscriptionResponse {
    return {
      result,
      id
    };
  }
}

/**
 * Test scenario helpers
 */
export class WebSocketTestScenarios {
  static simulateHighFrequencyTrading(ws: MockWebSocket, symbol: string, duration: number = 5000): void {
    let lastPrice = 50000;
    const interval = setInterval(() => {
      if (ws.readyState !== MockWebSocket.OPEN) {
        clearInterval(interval);
        return;
      }
      
      // Simulate price volatility
      const change = (Math.random() - 0.5) * 100; // ±50 price change
      lastPrice = Math.max(0, lastPrice + change);
      
      ws.simulateMessage(BinanceMessageGenerator.tradeMessage(symbol, lastPrice.toFixed(2)));
    }, 100); // 10 messages per second

    setTimeout(() => clearInterval(interval), duration);
  }

  static simulateNetworkInstability(ws: MockWebSocket, disconnectAfter: number = 2000): void {
    setTimeout(() => {
      ws.simulateDisconnect();
      
      // Reconnect after some delay
      setTimeout(() => {
        // This would trigger reconnection logic in the actual implementation
        console.log('Network instability simulation: connection lost and should reconnect');
      }, 1000);
    }, disconnectAfter);
  }

  static simulateServerError(ws: MockWebSocket, errorCode: number = -1121): void {
    setTimeout(() => {
      ws.simulateMessage(BinanceMessageGenerator.errorMessage(errorCode, 'Invalid symbol'));
    }, 100);
  }

  static simulateIdleConnection(ws: MockWebSocket, idleDuration: number = 300000): void {
    // No messages for specified duration
    setTimeout(() => {
      console.log('Idle connection simulation: no messages for', idleDuration, 'ms');
    }, idleDuration);
  }
}

// Global setup for tests
export function setupWebSocketMocking(): (() => void) {
  // Store original WebSocket
  const originalWebSocket = (global as { WebSocket?: typeof WebSocket }).WebSocket;
  
  // Replace global WebSocket with mock immediately
  (global as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  
  // Return cleanup function
  return () => {
    (global as { WebSocket?: typeof WebSocket }).WebSocket = originalWebSocket;
  };
}