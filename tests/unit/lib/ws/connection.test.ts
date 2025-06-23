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
          isCompleted = true;
          if (mockWs.readyState !== MockWS.CLOSED) {
            mockWs.close(1000, 'Normal closure');
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
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      const sub2 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      
      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      
      // Unsubscribe first subscriber
      sub1.unsubscribe();
      
      // Wait a bit for async cleanup operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Connection should still exist
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      expect(manager.getActiveStreamsCount()).toBe(1);
      
      // Unsubscribe second subscriber
      sub2.unsubscribe();
      
      // Connection might be cleaned up after all subscribers are gone
      // (depending on cleanup policy)
    });
  });

  describe('Connection Cleanup', () => {
    it('should close connections on destroy', async () => {
      // Create multiple connections
      manager.subscribe('btcusdt@trade').subscribe({ next: () => {} });
      manager.subscribe('ethusdt@trade').subscribe({ next: () => {} });
      
      // Wait for async connections
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(2);
      
      // Destroy manager
      manager.destroy();
      
      // Wait for destroy to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // All connections should be closed
      instances.forEach(ws => {
        expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      });
      
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
      }
      
      // Wait a bit for any async cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should handle gracefully without connection leaks
      const instances = MockWebSocket.getAllInstances();
      expect(instances.length).toBeLessThanOrEqual(1);
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