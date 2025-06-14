/**
 * Simplified E2E Tests for WSManager
 * Using synchronous patterns where possible to avoid timeout issues
 */

import { WSManager } from '../WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from './websocket-mock';

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
  setupWebSocketMocking();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic WebSocket Operations', () => {
    it('should create WebSocket connection when subscribing', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      // Subscribe to a stream
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });

      // Check that WebSocket was created
      const instances = MockWebSocket.getAllInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0].url).toBe('wss://stream.binance.com:9443/ws/btcusdt@trade');

      subscription.unsubscribe();
    });

    it('should handle incoming messages', (done) => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      const tradeData = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000.00');

      // Subscribe and wait for message
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data).toEqual(tradeData);
          subscription.unsubscribe();
          done();
        },
        error: done.fail
      });

      // Get the mock WebSocket instance and simulate message
      // Use setImmediate to ensure WebSocket is created
      setImmediate(() => {
        const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (mockWs) {
          mockWs.simulateMessage(tradeData);
        } else {
          done.fail('Mock WebSocket not found');
        }
      });
    });

    it('should share connections for same stream', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      // Create multiple subscriptions to same stream
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });
      const sub2 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });
      const sub3 = manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} });

      // Should only create one WebSocket connection
      expect(MockWebSocket.getAllInstances()).toHaveLength(1);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    });

    it('should handle connection errors', (done) => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false,
        maxRetryAttempts: 1
      });

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: (error) => {
          expect(error).toBeDefined();
          expect(error.message).toContain('Max retry attempts');
          subscription.unsubscribe();
          done();
        }
      });

      // Simulate connection error
      setImmediate(() => {
        const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (mockWs) {
          mockWs.simulateError(new Error('WebSocket error'));
          mockWs.close(1006, 'Connection failed');
        }
      });
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track connection metrics', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

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
    });

    it('should export Prometheus metrics', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      const prometheusMetrics = manager.getPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('# TYPE ws_manager_active_connections gauge');
      expect(prometheusMetrics).toContain('# TYPE ws_manager_stream_creations_total counter');
      expect(prometheusMetrics).toContain('# TYPE ws_manager_retry_count_total counter');
    });
  });

  describe('Stream Management', () => {
    it('should cleanup inactive streams', (done) => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

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
      setTimeout(() => {
        // Stream should be removed when no subscribers
        expect(manager.getActiveStreamsCount()).toBe(0);
        done();
      }, 50);
    });

    it('should handle multiple stream types', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      const subscriptions = [
        manager.subscribe('btcusdt@trade').subscribe({ next: () => {}, error: () => {} }),
        manager.subscribe('ethusdt@kline_1m').subscribe({ next: () => {}, error: () => {} }),
        manager.subscribe('bnbusdt@depth').subscribe({ next: () => {}, error: () => {} })
      ];

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
    });
  });
});