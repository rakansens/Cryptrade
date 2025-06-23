/**
 * E2E Reconnection Tests for WSManager
 * Tests reconnection logic, exponential backoff, and recovery
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/tests/helpers/websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock RxJS webSocket to use our MockWebSocket
jest.mock('rxjs/webSocket', () => {
  const { Observable, Subject } = require('rxjs');
  
  return {
    webSocket: (config: any) => {
      // Create an observable that manages WebSocket lifecycle
      return new Observable(subscriber => {
        const mockWs = new MockWebSocket(config.url);
        let isCompleted = false;
        
        // Connect mock WebSocket events
        mockWs.onopen = () => {
          if (config.openObserver && !isCompleted) {
            config.openObserver.next({ type: 'open' });
          }
        };
        
        mockWs.onclose = (e: CloseEvent) => {
          if (config.closeObserver && !isCompleted) {
            config.closeObserver.next(e);
          }
          
          if (!isCompleted) {
            isCompleted = true;
            if (e.code === 1000 || e.wasClean) {
              subscriber.complete();
            } else {
              // Emit error to trigger retry logic
              const error = new Error(`WebSocket closed abnormally: ${e.reason || 'Connection lost'}`);
              (error as any).code = e.code;
              subscriber.error(error);
            }
          }
        };
        
        mockWs.onerror = (e: Event) => {
          if (!isCompleted) {
            isCompleted = true;
            subscriber.error(e);
          }
        };
        
        mockWs.onmessage = (e: MessageEvent) => {
          if (!isCompleted) {
            try {
              const data = JSON.parse(e.data);
              subscriber.next(data);
            } catch {
              subscriber.next(e.data);
            }
          }
        };
        
        // Return teardown logic
        return () => {
          isCompleted = true;
          if (mockWs.readyState !== MockWebSocket.CLOSED) {
            mockWs.close(1000, 'Normal closure');
          }
        };
      });
    }
  };
});

// Setup WebSocket mocking before any tests
beforeAll(() => {
  // Force replace the global WebSocket with our mock
  (global as any).WebSocket = MockWebSocket as any;
});

afterAll(() => {
  // Restore original WebSocket if needed
  delete (global as any).WebSocket;
});

describe('WSManager E2E - Reconnection Logic', () => {
  let manager: WSManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    MockWebSocket.clearInstances();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    MockWebSocket.clearInstances();
    jest.clearAllTimers();
  });

  afterAll(() => {
    MockWebSocket.clearInstances();
  });

  describe('Basic Reconnection', () => {
    it('should attempt reconnection on connection loss', async () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 10,
        debug: true
      });

      let messageCount = 0;
      let errorCount = 0;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          messageCount++;
          expect(data).toHaveProperty('e', 'trade');
        },
        error: (_error) => {
          errorCount++;
        }
      });

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Send initial message
      const instances = MockWebSocket.getAllInstances();
      if (instances.length > 0) {
        instances[0].simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
      }
      
      // Wait and verify message received
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messageCount).toBeGreaterThan(0);

      // Simulate disconnect
      if (instances.length > 0) {
        instances[0].simulateDisconnect();
      }
      
      // Wait longer for reconnection with retry delays
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get all instances and find the new one created after reconnection
      const allInstances = MockWebSocket.getAllInstances();
      // Filter to get only the instance for btcusdt@trade that is open
      const newWs = allInstances.find(ws => 
        ws.url.includes('btcusdt@trade') && 
        ws.readyState === MockWebSocket.OPEN
      );
      
      expect(newWs).toBeDefined();
      if (newWs) {
        // Send message on the new connection
        newWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
        
        // Wait a bit for message processing
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Verify reconnection worked
      expect(messageCount).toBeGreaterThan(1);
      
      subscription.unsubscribe();
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff for retries', () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        baseRetryDelay: 100,
        maxRetryDelay: 5000,
        maxRetryAttempts: 5
      });

      // Test retry delay calculations
      const delays = [];
      for (let i = 1; i <= 5; i++) {
        const delay = manager.getRetryDelayPreview(i);
        delays.push(delay);
      }

      // Verify exponential growth
      expect(delays[0]?.exponentialDelay).toBe(200);  // 100 * 2^1
      expect(delays[1]?.exponentialDelay).toBe(400);  // 100 * 2^2
      expect(delays[2]?.exponentialDelay).toBe(800);  // 100 * 2^3
      expect(delays[3]?.exponentialDelay).toBe(1600); // 100 * 2^4
      expect(delays[4]?.exponentialDelay).toBe(3200); // 100 * 2^5

      // Verify clamping to max delay
      delays.forEach(delay => {
        expect(delay.clampedDelay).toBeLessThanOrEqual(5000);
      });
    });

    it('should respect max retry attempts', async () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 2,
        baseRetryDelay: 10,
        debug: true
      });

      const errorPromise = new Promise<unknown>((resolve) => {
        manager.subscribe('btcusdt@trade').subscribe({
          next: () => {},
          error: (error) => {
            resolve(error);
          }
        });
      });

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Force connection failures
      for (let i = 0; i < 3; i++) {
        const ws = MockWebSocket.getAllInstances().find(w => w.readyState !== MockWebSocket.CLOSED);
        if (ws) {
          ws.simulateError(new Error('Connection failed'));
          ws.close(1006);
        }
        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const error = await errorPromise;
      expect(error).toBeDefined();
      expect(error instanceof Error ? error.message : String(error)).toContain('Max retry attempts');
    }, 5000);
  });

  describe('Recovery After Reconnection', () => {
    it('should resume normal operation after successful reconnection', async () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 5,
        baseRetryDelay: 50
      });

      const messages: any[] = [];

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          messages.push(data);
        }
      });

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send initial message
      const instances = MockWebSocket.getAllInstances();
      if (instances.length > 0) {
        instances[0].simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
      }

      // Wait and verify first message
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messages).toHaveLength(1);

      // Simulate disconnect
      if (instances.length > 0) {
        instances[0].simulateDisconnect();
      }

      // Wait longer for reconnection with retry delays
      await new Promise(resolve => setTimeout(resolve, 200));

      // Find the new WebSocket instance created after reconnection
      const allInstances = MockWebSocket.getAllInstances();
      const newWs = allInstances.find(ws => 
        ws.url.includes('btcusdt@trade') && 
        ws.readyState === MockWebSocket.OPEN
      );
      
      expect(newWs).toBeDefined();
      if (newWs) {
        // Send messages on the new connection
        newWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
        newWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '52000'));
        
        // Wait for message processing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Verify all messages
      expect(messages).toHaveLength(3);
      messages.forEach(msg => {
        expect(msg).toHaveProperty('e', 'trade');
      });

      subscription.unsubscribe();
    });
  });

  describe('Multiple Stream Reconnection', () => {
    it('should handle reconnection for multiple streams independently', async () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 50
      });

      let btcMessages = 0;
      let ethMessages = 0;

      // Subscribe to BTC
      const btcSub = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          if (data['s'] === 'BTCUSDT') {
            btcMessages++;
          }
        }
      });

      // Subscribe to ETH
      const ethSub = manager.subscribe('ethusdt@trade').subscribe({
        next: (data) => {
          if (data['s'] === 'ETHUSDT') {
            ethMessages++;
          }
        }
      });

      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send initial messages
      const instances = MockWebSocket.getAllInstances();
      instances.forEach(ws => {
        if (ws.url.includes('btcusdt')) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
        } else if (ws.url.includes('ethusdt')) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('ETHUSDT', '3000'));
        }
      });

      // Wait and verify initial messages
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(btcMessages).toBeGreaterThan(0);
      expect(ethMessages).toBeGreaterThan(0);

      // Disconnect both streams
      MockWebSocket.getAllInstances().forEach(ws => {
        ws.simulateDisconnect();
      });

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 150));

      // Find the new WebSocket instances created after reconnection
      const allInstances = MockWebSocket.getAllInstances();
      const btcWs = allInstances.find(ws => 
        ws.url.includes('btcusdt@trade') && 
        ws.readyState === MockWebSocket.OPEN
      );
      const ethWs = allInstances.find(ws => 
        ws.url.includes('ethusdt@trade') && 
        ws.readyState === MockWebSocket.OPEN
      );
      
      // Send messages on the new connections
      if (btcWs) {
        btcWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '55000'));
      }
      if (ethWs) {
        ethWs.simulateMessage(BinanceMessageGenerator.tradeMessage('ETHUSDT', '3500'));
      }

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify reconnection messages
      expect(btcMessages).toBeGreaterThan(1);
      expect(ethMessages).toBeGreaterThan(1);

      btcSub.unsubscribe();
      ethSub.unsubscribe();
    });
  });

  describe('Reconnection Metrics', () => {
    it('should track reconnection metrics', async () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 2,
        baseRetryDelay: 10
      });

      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalReconnections).toBe(0);
      expect(initialMetrics.retryCount).toBe(0);

      const errorPromise = new Promise((resolve) => {
        manager.subscribe('btcusdt@trade').subscribe({
          next: () => {},
          error: () => {
            resolve(true);
          }
        });
      });

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Force connection failures
      for (let i = 0; i < 3; i++) {
        const ws = MockWebSocket.getAllInstances().find(w => w.readyState !== MockWebSocket.CLOSED);
        if (ws) {
          ws.simulateError(new Error('Test error'));
          ws.close(1006);
        }
        // Wait for retry delay  
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await errorPromise;
      
      const finalMetrics = manager.getMetrics();
      expect(finalMetrics.retryCount).toBeGreaterThan(0);
    }, 5000);
  });
});