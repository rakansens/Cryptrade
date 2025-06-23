/**
 * Simplified E2E Tests for WSManager
 * Using synchronous patterns where possible to avoid timeout issues
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/tests/helpers/websocket-mock';

// Mock logger to reduce noise
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager Simplified E2E Tests', () => {
  const cleanupWebSocketMocking = setupWebSocketMocking();
  let managers: WSManager[] = [];
  
  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    managers = [];
  });

  afterEach(() => {
    // Clean up all managers
    managers.forEach(manager => manager.destroy());
    managers = [];
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupWebSocketMocking();
  });

  describe('Basic WebSocket Operations', () => {
    it('should create WebSocket connection when subscribing', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      // Subscribe to a stream
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });

      // Wait for WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that WebSocket was created
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0]?.url).toBe('wss://stream.binance.com:9443/ws/btcusdt@trade');

      subscription.unsubscribe();
      manager.destroy();
    });

    it('should handle incoming messages', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      const tradeData = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000.00');

      // Create a promise that resolves when message is received
      const messageReceived = new Promise<void>((resolve, reject) => {
        // Subscribe and wait for message
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            expect(data).toEqual(tradeData);
            subscription.unsubscribe();
            resolve();
          },
          error: reject
        });
      });

      // Wait a bit for WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        mockWs.simulateMessage(tradeData);
      } else {
        throw new Error('Mock WebSocket not found');
      }
      
      // Wait for message
      await messageReceived;
    }, 10000);

    it('should share connections for same stream', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      // Create multiple subscriptions to same stream
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });
      const sub2 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });
      const sub3 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });

      // Wait for WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only create one WebSocket connection
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      manager.destroy();
    });

    it('should handle connection errors', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false,
        maxRetryAttempts: 1
      });
      managers.push(manager);

      // Create a promise that resolves when error is received
      const errorReceived = new Promise<void>((resolve) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: () => {},
          error: (error) => {
            expect(error).toBeDefined();
            expect(error.message).toContain('Max retry attempts');
            subscription.unsubscribe();
            resolve();
          }
        });
      });

      // Wait for WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate connection error
      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        mockWs.simulateError(new Error('WebSocket error'));
        mockWs.close(1006, 'Connection failed');
      }
      
      // Wait for error
      await errorReceived;
    }, 10000);
  });

  describe('Metrics and Monitoring', () => {
    it('should track connection metrics', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      // Initial state
      let metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.totalStreamCreations).toBe(0);

      // Create subscription
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });

      // Check metrics after subscription
      metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.totalStreamCreations).toBe(1);

      // Cleanup
      subscription.unsubscribe();

      // Check metrics after unsubscribe
      metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(0);
      
      manager.destroy();
    });

    it('should export Prometheus metrics', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      const prometheusMetrics = manager.getPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('# TYPE ws_manager_active_connections gauge');
      expect(prometheusMetrics).toContain('# TYPE ws_manager_stream_creations_total counter');
      expect(prometheusMetrics).toContain('# TYPE ws_manager_retry_count_total counter');
      
      manager.destroy();
    });
  });

  describe('Stream Management', () => {
    it('should cleanup inactive streams', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      // Create a subscription
      const sub = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });

      // Stream should exist
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Unsubscribe - this should remove the stream immediately if refCount is 0
      sub.unsubscribe();

      // Give it a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stream should be removed when no subscribers
      expect(manager.getActiveStreamsCount()).toBe(0);
      
      manager.destroy();
    });

    it('should handle multiple stream types', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });
      managers.push(manager);

      const subscriptions = [
        manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} }),
        manager.subscribe('ethusdt@kline_1m').subscribe({ next: () => {}, error: () => {} }),
        manager.subscribe('bnbusdt@depth').subscribe({ next: () => {}, error: () => {} })
      ];

      // Wait for WebSockets to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should create 3 separate connections
      expect(MockWebSocket.getAllInstances()).toHaveLength(3);
      expect(manager.getActiveStreamsCount()).toBe(3);

      // Verify URLs
      const urls = MockWebSocket.getAllInstances().map(ws => ws.url);
      expect(urls).toContain('wss://stream.binance.com:9443/ws/btcusdt@trade');
      expect(urls).toContain('wss://stream.binance.com:9443/ws/ethusdt@kline_1m');
      expect(urls).toContain('wss://stream.binance.com:9443/ws/bnbusdt@depth');

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
      manager.destroy();
    });
  });
});