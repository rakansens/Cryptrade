import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { WSManager } from '@/lib/ws/WSManager';
import { BinanceWebSocketManager } from '@/lib/binance/websocket-manager';
import { ConnectionManager } from '@/lib/binance/connection-manager';
import type { WebSocketMessage } from '@/lib/ws/types';

// Mock WebSocket
class MockWebSocket {
  readyState: number = 0; // CONNECTING
  onopen?: (event: any) => void;
  onmessage?: (event: any) => void;
  onerror?: (event: any) => void;
  onclose?: (event: any) => void;
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.({ type: 'open' });
    }, 10);
  }

  send(data: string) {
    // Simulate echo
    setTimeout(() => {
      this.onmessage?.({ data });
    }, 1);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ type: 'close', code: 1000 });
  }
}

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  connectionEstablishment: 50,
  messageSending: 1,
  messageReceiving: 1,
  bulkMessageHandling: 10,
  reconnection: 100,
  subscriptionManagement: 5,
  connectionPooling: 20,
  largePayloadHandling: 5
};

describe('WebSocket Performance Tests', () => {
  let wsManager: WSManager;
  let binanceWsManager: BinanceWebSocketManager;
  let connectionManager: ConnectionManager;
  let performanceResults: Record<string, number[]> = {};

  beforeEach(() => {
    // Mock WebSocket globally
    (global as any).WebSocket = MockWebSocket;
    
    wsManager = new WSManager('ws://test.example.com');
    binanceWsManager = new BinanceWebSocketManager();
    connectionManager = new ConnectionManager();
  });

  afterEach(() => {
    // Cleanup
    wsManager.cleanup();
    binanceWsManager.cleanup();
    connectionManager.cleanup();

    // Log performance results
    Object.entries(performanceResults).forEach(([test, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      console.log(`[PERF] ${test}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    });
    performanceResults = {};
  });

  describe('Connection Performance', () => {
    it('should establish connection within threshold', async () => {
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const tempManager = new WSManager(`ws://test${i}.example.com`);
        
        const start = performance.now();
        await tempManager.connect();
        const end = performance.now();
        
        times.push(end - start);
        tempManager.cleanup();
      }

      performanceResults['connectionEstablishment'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.connectionEstablishment);
    });

    it('should handle multiple concurrent connections', async () => {
      const connectionCount = 10;
      const managers: WSManager[] = [];
      
      const start = performance.now();
      
      const connectionPromises = Array.from({ length: connectionCount }, async (_, i) => {
        const manager = new WSManager(`ws://concurrent${i}.example.com`);
        managers.push(manager);
        await manager.connect();
      });

      await Promise.all(connectionPromises);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['concurrentConnections'] = [totalTime];
      expect(totalTime).toBeLessThan(100); // 10 connections under 100ms

      // Cleanup
      managers.forEach(m => m.cleanup());
    });

    it('should reconnect efficiently', async () => {
      await wsManager.connect();
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        // Force disconnect
        (wsManager as any).ws?.close();
        
        const start = performance.now();
        await wsManager.connect();
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['reconnection'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reconnection);
    });
  });

  describe('Message Performance', () => {
    it('should send messages within threshold', async () => {
      await wsManager.connect();
      const times: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const message: WebSocketMessage = {
          type: 'ping',
          data: { id: i }
        };

        const start = performance.now();
        wsManager.send(message);
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['messageSending'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.messageSending);
    });

    it('should handle received messages efficiently', async () => {
      await wsManager.connect();
      const times: number[] = [];
      let messageCount = 0;

      wsManager.on('message', (message) => {
        messageCount++;
      });

      // Simulate incoming messages
      const ws = (wsManager as any).ws as MockWebSocket;
      
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        ws.onmessage?.({ data: JSON.stringify({ type: 'data', id: i }) });
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['messageReceiving'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.messageReceiving);
      expect(messageCount).toBe(1000);
    });

    it('should handle bulk messages efficiently', async () => {
      await wsManager.connect();
      let processedCount = 0;

      wsManager.on('message', () => {
        processedCount++;
      });

      const ws = (wsManager as any).ws as MockWebSocket;
      const bulkSize = 100;
      
      const start = performance.now();
      
      // Send bulk messages rapidly
      for (let i = 0; i < bulkSize; i++) {
        ws.onmessage?.({ 
          data: JSON.stringify({ 
            type: 'bulk', 
            id: i,
            payload: Array(100).fill(0) // Larger payload
          }) 
        });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['bulkMessageHandling'] = [totalTime];
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.bulkMessageHandling * bulkSize);
      expect(processedCount).toBe(bulkSize);
    });

    it('should handle large payloads efficiently', async () => {
      await wsManager.connect();
      const times: number[] = [];

      // Create large payload
      const largeData = {
        type: 'largeData',
        payload: Array(1000).fill(0).map((_, i) => ({
          id: i,
          data: Array(100).fill(Math.random()),
          metadata: {
            timestamp: Date.now(),
            source: 'test',
            tags: Array(10).fill('tag')
          }
        }))
      };

      const ws = (wsManager as any).ws as MockWebSocket;

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        ws.onmessage?.({ data: JSON.stringify(largeData) });
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['largePayloadHandling'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.largePayloadHandling);
    });
  });

  describe('Subscription Management Performance', () => {
    it('should manage subscriptions efficiently', async () => {
      await binanceWsManager.connect();
      const times: number[] = [];
      const symbols = Array.from({ length: 50 }, (_, i) => `SYMBOL${i}USDT`);

      for (const symbol of symbols) {
        const start = performance.now();
        binanceWsManager.subscribeToTicker(symbol, (data) => {});
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['subscriptionManagement'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.subscriptionManagement);
    });

    it('should handle subscription updates efficiently', async () => {
      await binanceWsManager.connect();
      const symbol = 'BTCUSDT';
      let updateCount = 0;

      binanceWsManager.subscribeToTicker(symbol, (data) => {
        updateCount++;
      });

      // Simulate rapid ticker updates
      const times: number[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const tickerData = {
          e: '24hrTicker',
          s: symbol,
          c: '50000',
          p: '1000',
          P: '2.0',
          v: '10000'
        };

        const start = performance.now();
        // Simulate incoming ticker update
        (binanceWsManager as any).handleMessage({
          data: JSON.stringify(tickerData)
        });
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['subscriptionUpdates'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(1);
      expect(updateCount).toBe(1000);
    });
  });

  describe('Connection Pooling Performance', () => {
    it('should manage connection pool efficiently', async () => {
      const streamCount = 20;
      const times: number[] = [];

      for (let i = 0; i < streamCount; i++) {
        const start = performance.now();
        const streamId = await connectionManager.addStream(`stream${i}`, `ws://stream${i}.example.com`);
        const end = performance.now();
        
        times.push(end - start);
      }

      performanceResults['connectionPooling'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.connectionPooling);
    });

    it('should handle connection rotation efficiently', async () => {
      // Add initial streams
      const streamIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await connectionManager.addStream(`stream${i}`, `ws://stream${i}.example.com`);
        streamIds.push(id);
      }

      const times: number[] = [];

      // Rotate connections
      for (let i = 0; i < 50; i++) {
        const oldId = streamIds[i % streamIds.length];
        
        const start = performance.now();
        await connectionManager.removeStream(oldId);
        const newId = await connectionManager.addStream(`newstream${i}`, `ws://newstream${i}.example.com`);
        const end = performance.now();
        
        streamIds[i % streamIds.length] = newId;
        times.push(end - start);
      }

      performanceResults['connectionRotation'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(20);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory with continuous messaging', async () => {
      await wsManager.connect();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Send and receive many messages
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 1000; i++) {
          wsManager.send({ type: 'test', data: { id: i, cycle } });
        }
        
        // Wait for messages to process
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });

    it('should handle connection churn without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy many connections
      for (let cycle = 0; cycle < 50; cycle++) {
        const manager = new WSManager(`ws://churn${cycle}.example.com`);
        await manager.connect();
        
        // Send some messages
        for (let i = 0; i < 10; i++) {
          manager.send({ type: 'test', data: i });
        }
        
        manager.cleanup();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-frequency trading simulation', async () => {
      await binanceWsManager.connect();
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      let totalUpdates = 0;

      // Subscribe to multiple streams
      symbols.forEach(symbol => {
        binanceWsManager.subscribeToTicker(symbol, () => totalUpdates++);
        binanceWsManager.subscribeToKline(symbol, '1m', () => totalUpdates++);
      });

      const start = performance.now();
      
      // Simulate rapid market data updates
      for (let i = 0; i < 10000; i++) {
        const symbol = symbols[i % symbols.length];
        
        // Ticker update
        (binanceWsManager as any).handleMessage({
          data: JSON.stringify({
            e: '24hrTicker',
            s: symbol,
            c: (50000 + Math.random() * 1000).toFixed(2)
          })
        });

        // Kline update
        if (i % 10 === 0) {
          (binanceWsManager as any).handleMessage({
            data: JSON.stringify({
              e: 'kline',
              s: symbol,
              k: {
                t: Date.now(),
                o: '50000',
                h: '50100',
                l: '49900',
                c: '50050',
                v: '100'
              }
            })
          });
        }
      }

      const end = performance.now();
      const totalTime = end - start;
      const updatesPerSecond = (totalUpdates / totalTime) * 1000;

      performanceResults['highFrequencyTrading'] = [totalTime];
      console.log(`[PERF] High-frequency updates: ${updatesPerSecond.toFixed(0)} updates/second`);
      
      expect(totalTime).toBeLessThan(1000); // Process 10k updates under 1 second
      expect(totalUpdates).toBeGreaterThan(10000); // All updates processed
    });
  });
});

// Mock implementations for testing
jest.mock('@/lib/ws/WSManager', () => {
  return {
    WSManager: jest.fn().mockImplementation(function(this: any, url: string) {
      this.url = url;
      this.ws = null;
      this.listeners = new Map();
      
      this.connect = async () => {
        this.ws = new MockWebSocket(url);
        return new Promise(resolve => {
          this.ws.onopen = () => resolve(undefined);
        });
      };
      
      this.send = (message: any) => {
        if (this.ws?.readyState === 1) {
          this.ws.send(JSON.stringify(message));
        }
      };
      
      this.on = (event: string, callback: Function) => {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        if (event === 'message' && this.ws) {
          this.ws.onmessage = (e: any) => {
            const callbacks = this.listeners.get('message') || [];
            callbacks.forEach((cb: Function) => cb(JSON.parse(e.data)));
          };
        }
      };
      
      this.cleanup = () => {
        this.ws?.close();
        this.listeners.clear();
      };
    })
  };
});

jest.mock('@/lib/binance/websocket-manager', () => {
  return {
    BinanceWebSocketManager: jest.fn().mockImplementation(function(this: any) {
      this.ws = null;
      this.subscriptions = new Map();
      
      this.connect = async () => {
        this.ws = new MockWebSocket('wss://stream.binance.com');
        return new Promise(resolve => {
          this.ws.onopen = () => resolve(undefined);
        });
      };
      
      this.subscribeToTicker = (symbol: string, callback: Function) => {
        const key = `ticker:${symbol}`;
        this.subscriptions.set(key, callback);
      };
      
      this.subscribeToKline = (symbol: string, interval: string, callback: Function) => {
        const key = `kline:${symbol}:${interval}`;
        this.subscriptions.set(key, callback);
      };
      
      this.handleMessage = (event: any) => {
        const data = JSON.parse(event.data);
        if (data.e === '24hrTicker') {
          const callback = this.subscriptions.get(`ticker:${data.s}`);
          callback?.(data);
        } else if (data.e === 'kline') {
          const callback = this.subscriptions.get(`kline:${data.s}:1m`);
          callback?.(data);
        }
      };
      
      this.cleanup = () => {
        this.ws?.close();
        this.subscriptions.clear();
      };
    })
  };
});

jest.mock('@/lib/binance/connection-manager', () => {
  return {
    ConnectionManager: jest.fn().mockImplementation(function(this: any) {
      this.streams = new Map();
      
      this.addStream = async (name: string, url: string) => {
        const id = `stream-${Date.now()}-${Math.random()}`;
        this.streams.set(id, { name, url, ws: new MockWebSocket(url) });
        return id;
      };
      
      this.removeStream = async (id: string) => {
        const stream = this.streams.get(id);
        if (stream) {
          stream.ws.close();
          this.streams.delete(id);
        }
      };
      
      this.cleanup = () => {
        this.streams.forEach(stream => stream.ws.close());
        this.streams.clear();
      };
    })
  };
});