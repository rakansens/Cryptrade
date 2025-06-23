/**
 * E2E Connection Tests for WSManager
 * Tests connection establishment, sharing, and cleanup
 */

import { WSManager } from '@/lib/ws/WSManager';
import { setupWebSocketMocking } from '@/tests/helpers/websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// First import the mock setup before anything else
import { MockWebSocket } from '@/tests/helpers/websocket-mock';

// Mock RxJS webSocket to use our MockWebSocket
jest.mock('rxjs/webSocket', () => {
  const { Observable } = require('rxjs');
  const { MockWebSocket: MockWS } = require('@/tests/helpers/websocket-mock');
  
  return {
    webSocket: (config: any) => {
      // Create an observable that manages WebSocket lifecycle
      return new Observable(subscriber => {
        const mockWs = new MockWS(config.url);
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
          if (!isCompleted) {
            isCompleted = true;
            if (mockWs.readyState !== MockWS.CLOSED) {
              mockWs.close(1000, 'Normal closure');
            }
          }
        };
      });
    }
  };
});

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('WSManager E2E - Connection Management', () => {
  let manager: WSManager;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    manager = new WSManager({
      url: 'wss://stream.binance.com:9443/ws/',
      debug: false
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });

  describe('Connection Establishment', () => {
    it('should establish connection on first subscription', async () => {
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });

      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify connection created
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0]?.url).toBe('wss://stream.binance.com:9443/ws/btcusdt@trade');
      expect(instances[0]?.readyState).toBe(MockWebSocket.OPEN);

      subscription.unsubscribe();
    });

    it('should create separate connections for different streams', async () => {
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      const sub2 = manager.subscribe('ethusdt@trade').subscribe({ next: () => {} });
      const sub3 = manager.subscribe('bnbusdt@kline_1m').subscribe({ next: () => {} });

      // Wait for async connections
      await new Promise(resolve => setTimeout(resolve, 20));

      // Each stream should have its own connection
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(3);
      
      const urls = instances.map(ws => ws.url);
      expect(urls).toContain('wss://stream.binance.com:9443/ws/btcusdt@trade');
      expect(urls).toContain('wss://stream.binance.com:9443/ws/ethusdt@trade');
      expect(urls).toContain('wss://stream.binance.com:9443/ws/bnbusdt@kline_1m');

      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    });
  });

  describe('Connection Sharing', () => {
    it('should share connection for same stream', async () => {
      const subscriptions = [];
      
      // Create 5 subscriptions to the same stream
      for (let i = 0; i < 5; i++) {
        const sub = manager.subscribe('btcusdt@trade').subscribe({
          next: () => {},
          error: () => {}
        });
        subscriptions.push(sub);
      }

      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should only have one WebSocket connection
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Unsubscribe all
      subscriptions.forEach(sub => sub.unsubscribe());
    });

    it('should maintain connection while at least one subscriber exists', async () => {
      // Create two subscribers to the same stream
      const messages1: any[] = [];
      const messages2: any[] = [];
      
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ 
        next: (msg) => messages1.push(msg),
        error: () => {}
      });
      const sub2 = manager.subscribe('btcusdt@trade').subscribe({ 
        next: (msg) => messages2.push(msg),
        error: () => {}
      });
      
      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Both subscribers should be connected to the same WebSocket
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      expect(manager.getActiveStreamsCount()).toBe(1);
      
      // Send a message to verify both subscribers receive it
      const mockWs = MockWebSocket.getAllInstances()[0];
      if (mockWs) {
        mockWs.simulateMessage({ e: 'trade', s: 'BTCUSDT', p: '50000', q: '1' } as any);
      }
      
      // Both should receive the message (shareReplay shares the stream)
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(messages1.length).toBeGreaterThan(0);
      expect(messages2.length).toBeGreaterThan(0);
      
      // Unsubscribe first subscriber
      sub1.unsubscribe();
      
      // Give time for any async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // WebSocket should still be open because sub2 is still active
      const wsInstances = MockWebSocket.getAllInstances();
      const openWs = wsInstances.filter(ws => ws.readyState === MockWebSocket.OPEN);
      expect(openWs.length).toBe(1);
      
      // Unsubscribe second subscriber
      sub2.unsubscribe();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now the stream should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(0);
    });
  });

  describe('Connection Cleanup', () => {
    it('should close connections on destroy', async () => {
      // Create multiple connections and keep references to subscriptions
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      const sub2 = manager.subscribe('ethusdt@trade').subscribe({ next: () => {} });
      
      // Wait for async connections
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(2);
      
      // Verify connections are open
      instances.forEach(ws => {
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
      });
      
      // Destroy manager - this should unsubscribe all and close connections
      manager.destroy();
      
      // Also unsubscribe manually to ensure cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
      
      // Wait for destroy to complete and WebSocket close operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if connections are closed or closing
      const closedCount = instances.filter(ws => 
        ws.readyState === MockWebSocket.CLOSED || 
        ws.readyState === MockWebSocket.CLOSING
      ).length;
      
      expect(closedCount).toBe(instances.length);
      
      // Metrics should show cleanup
      expect(manager.getActiveStreamsCount()).toBe(0);
    });

    it('should handle rapid subscribe/unsubscribe cycles', async () => {
      const cycles = 20;
      
      for (let i = 0; i < cycles; i++) {
        const sub = manager.subscribe('btcusdt@trade').subscribe({
          next: () => {},
          error: () => {}
        });
        
        // Immediately unsubscribe
        sub.unsubscribe();
        
        // Small delay to allow cleanup between cycles
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // Wait for any remaining async cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should handle gracefully without connection leaks
      // After cleanup, we should have no active streams
      expect(manager.getActiveStreamsCount()).toBe(0);
      
      // MockWebSocket instances might still exist but should be closed
      const instances = MockWebSocket.getAllInstances();
      const openInstances = instances.filter(ws => ws.readyState === MockWebSocket.OPEN);
      expect(openInstances.length).toBe(0);
    });
  });

  describe('Connection Metrics', () => {
    it('should track connection metrics accurately', async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.activeConnections).toBe(0);
      expect(initialMetrics.totalStreamCreations).toBe(0);
      
      // Create connections
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      const sub2 = manager.subscribe('ethusdt@trade').subscribe({ next: () => {} });
      
      const activeMetrics = manager.getMetrics();
      expect(activeMetrics.activeConnections).toBe(2);
      expect(activeMetrics.totalStreamCreations).toBe(2);
      
      // Cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
      
      // Allow for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      const finalMetrics = manager.getMetrics();
      expect(finalMetrics.activeConnections).toBeLessThanOrEqual(2);
      expect(finalMetrics.totalStreamCreations).toBe(2); // Total should remain
    });

    it('should track high water mark', () => {
      const subscriptions = [];
      
      // Create 10 connections
      for (let i = 0; i < 10; i++) {
        const sub = manager.subscribe(`stream${i}@trade`).subscribe({ 
          next: () => {} 
        });
        subscriptions.push(sub);
      }
      
      const metrics = manager.getMetrics();
      expect(metrics.activeConnectionsHWM).toBeGreaterThanOrEqual(10);
      
      // Cleanup half
      for (let i = 0; i < 5; i++) {
        subscriptions[i]?.unsubscribe();
      }
      
      // HWM should remain at 10
      const metricsAfter = manager.getMetrics();
      expect(metricsAfter.activeConnectionsHWM).toBeGreaterThanOrEqual(10);
      
      // Cleanup rest
      subscriptions.slice(5).forEach(sub => sub.unsubscribe());
    });
  });
});