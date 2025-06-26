/**
 * WebSocket モックの実装
 */

import { WebSocketSimulator } from './mock-helpers';
// WebSocket message imports removed - using inline objects instead

export class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  private messageQueue: any[] = [];
  private closeCode?: number;
  private closeReason?: string;
  private _simulator?: WebSocketSimulator;
  private autoRespond: boolean = false;
  private responsePatterns: Map<string, (data: any) => any> = new Map();

  // Track all instances for global cleanup
  private static instances = new Set<MockWebSocket>();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    
    // Store protocols if needed
    this.protocols = Array.isArray(protocols) ? protocols : protocols ? [protocols] : [];
    
    // Add this instance to the global set
    MockWebSocket.instances.add(this);
    
    // Simulate connection by default
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.mockOpen();
      }
    }, 10);
  }

  protocols: string[];
  binaryType: 'blob' | 'arraybuffer' = 'blob';
  bufferedAmount: number = 0;
  extensions: string = '';
  protocol: string = '';

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Convert data to string for processing
    let message: string;
    if (typeof data === 'string') {
      message = data;
    } else {
      message = JSON.stringify(data);
    }
    
    // Auto-respond if enabled
    if (this.autoRespond) {
      this.handleAutoResponse(message);
    }
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSING || this.readyState === MockWebSocket.CLOSED) {
      return;
    }
    
    this.readyState = MockWebSocket.CLOSING;
    this.closeCode = code ?? 1000;
    this.closeReason = reason ?? '';
    
    // Remove from global instances
    MockWebSocket.instances.delete(this);
    
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        const event = new CloseEvent('close', {
          code: this.closeCode || 1000,
          reason: this.closeReason || '',
          wasClean: this.closeCode === 1000
        });
        this.onclose(event);
      }
    }, 10);
  }

  // Test helper methods
  mockReceiveMessage(data: any): void {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      const event = new MessageEvent('message', {
        data: typeof data === 'string' ? data : JSON.stringify(data),
        origin: new URL(this.url).origin,
        lastEventId: '',
        source: null,
        ports: []
      });
      this.onmessage(event);
    } else if (this.readyState === MockWebSocket.CONNECTING) {
      this.messageQueue.push(data);
    }
  }

  mockError(error: any): void {
    if (this.onerror) {
      const event = new Event('error');
      Object.assign(event, { error, message: error?.message || 'WebSocket error' });
      this.onerror(event);
    }
    
    // Errors often lead to closure
    if (this.readyState === MockWebSocket.OPEN || this.readyState === MockWebSocket.CONNECTING) {
      this.close(1006, 'Connection error');
    }
  }

  mockOpen(): void {
    if (this.readyState !== MockWebSocket.CONNECTING) {
      return;
    }
    
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
    
    // Process queued messages
    while (this.messageQueue.length > 0) {
      this.mockReceiveMessage(this.messageQueue.shift());
    }
  }

  mockClose(code: number = 1000, reason: string = ''): void {
    this.close(code, reason);
  }

  // Advanced test helpers
  get simulator(): WebSocketSimulator {
    if (!this._simulator) {
      this._simulator = new WebSocketSimulator(this);
    }
    return this._simulator;
  }

  enableAutoRespond(enabled: boolean = true): void {
    this.autoRespond = enabled;
  }

  setResponsePattern(pattern: string | RegExp, response: (data: any) => any): void {
    this.responsePatterns.set(pattern.toString(), response);
  }

  private handleAutoResponse(message: string): void {
    try {
      const data = JSON.parse(message);
      
      // Check response patterns
      for (const [pattern, handler] of this.responsePatterns) {
        if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.endsWith('/')) {
          try {
            const regex = new RegExp(pattern.slice(1, -1));
            if (regex.test(message)) {
              const response = handler(data);
              if (response) {
                setTimeout(() => this.mockReceiveMessage(response), 50);
              }
              return;
            }
          } catch (e) {
            // Not a valid regex, skip
          }
        } else if (pattern === message) {
          const response = handler(data);
          if (response) {
            setTimeout(() => this.mockReceiveMessage(response), 50);
          }
          return;
        }
      }
      
      // Default auto-responses based on message type
      if (data.type === 'ping') {
        setTimeout(() => this.mockReceiveMessage({ type: 'pong', timestamp: Date.now() }), 10);
      } else if (data.type === 'subscribe') {
        setTimeout(() => this.mockReceiveMessage({
          type: 'subscription',
          status: 'subscribed',
          channel: data.channel,
          id: data.id || 'sub-' + Date.now()
        }), 20);
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  // Simulate various connection states
  simulateNetworkError(): void {
    this.mockError(new Error('Network error'));
  }

  simulateConnectionLost(): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.mockClose(1006, 'Connection lost');
    }
  }

  simulateReconnect(): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      this.readyState = MockWebSocket.CONNECTING;
      setTimeout(() => this.mockOpen(), 100);
    }
  }

  // Bulk message helpers
  mockReceiveMessages(messages: any[], interval: number = 100): void {
    messages.forEach((message, index) => {
      setTimeout(() => this.mockReceiveMessage(message), index * interval);
    });
  }

  mockStreamData(generator: Generator<any>, interval: number = 100): void {
    const sendNext = () => {
      const { value, done } = generator.next();
      if (!done && this.readyState === MockWebSocket.OPEN) {
        this.mockReceiveMessage(value);
        setTimeout(sendNext, interval);
      }
    };
    sendNext();
  }

  // Global cleanup method for Jest teardown
  static cleanupAll(): void {
    console.log(`🧹 Cleaning up ${MockWebSocket.instances.size} MockWebSocket instances`);
    
    // Close all open connections
    for (const ws of [...MockWebSocket.instances]) {
      if (ws.readyState !== MockWebSocket.CLOSED) {
        ws.close(1001, 'Global cleanup');
      }
    }
    
    // Clear the set
    MockWebSocket.instances.clear();
  }

  // Helper to get active instance count
  static getActiveInstanceCount(): number {
    return MockWebSocket.instances.size;
  }
}

// Enhanced mock WebSocket factory
export const createMockWebSocket = (options: {
  url?: string;
  autoOpen?: boolean;
  autoRespond?: boolean;
  connectionDelay?: number;
} = {}): MockWebSocket => {
  const ws = new MockWebSocket(options.url || 'ws://localhost:8080');
  
  if (options.autoRespond) {
    ws.enableAutoRespond(true);
  }
  
  if (options.autoOpen === false) {
    // Prevent auto-open
    ws.readyState = MockWebSocket.CONNECTING;
  } else if (options.connectionDelay) {
    // Delay connection
    ws.readyState = MockWebSocket.CONNECTING;
    setTimeout(() => ws.mockOpen(), options.connectionDelay);
  }
  
  return ws;
};

// Global mock setup for tests
if (typeof global !== 'undefined') {
  (global as any).WebSocket = MockWebSocket;
}

export default MockWebSocket;