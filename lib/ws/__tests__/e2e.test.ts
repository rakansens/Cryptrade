/**
 * E2E Tests for WSManager with WebSocket mocking
 * Tests: stream mock, reconnection, idle cleanup, integration scenarios
 */

import { WSManager } from '../WSManager';
import { binanceConnectionManagerShim } from '../compat-shim';
import { getBinanceConnection } from '../migration';
import { 
  MockWebSocket, 
  BinanceMessageGenerator, 
  WebSocketTestScenarios,
  setupWebSocketMocking 
} from './websocket-mock';

// Mock logger to reduce noise
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Set global timeout for all tests in this file
jest.setTimeout(30000);

// WebSocket message types for E2E testing
interface MockTradeMessage {
  e: 'trade';
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}

interface MockKlineMessage {
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

describe('WSManager E2E Tests', () => {
  setupWebSocketMocking();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('WebSocket Stream Mocking', () => {
    it('should handle trade stream messages correctly', async () => {
      // Arrange
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      const tradeData = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000.00');
      const receivedMessages: any[] = [];

      // Create promise to wait for message
      const messagePromise = new Promise((resolve, reject) => {
        // Subscribe to stream
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            receivedMessages.push(data);
            
            // Verify message structure
            expect(data).toHaveProperty('e', 'trade');
            expect(data).toHaveProperty('s', 'BTCUSDT');
            expect(data).toHaveProperty('p', '50000.00');
            
            subscription.unsubscribe();
            resolve(data);
          },
          error: (error) => {
            reject(error);
          }
        });
      });

      // Wait for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate receiving message
      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        mockWs.simulateMessage(tradeData);
      } else {
        // If no WebSocket found, fail the test
        throw new Error('Mock WebSocket not found');
      }

      // Wait for message to be received
      await messagePromise;
      
      // Verify we received the message
      expect(receivedMessages).toHaveLength(1);
    });

    it('should handle kline stream data', () => {
      // Arrange
      const klineMessage: MockKlineMessage = {
        e: 'kline',
        E: Date.now(),
        s: 'BTCUSDT',
        k: {
          t: Date.now() - 60000,
          T: Date.now(),
          s: 'BTCUSDT',
          i: '1m',
          o: '49900.00',
          c: '50000.00',
          h: '50100.00',
          l: '49800.00',
          v: '10.5',
          x: true
        }
      };

      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      // Test message extraction
      const extractedData = manager['extractStreamData'](klineMessage, 'btcusdt@kline_1m');
      expect(extractedData).toEqual(klineMessage);
    });
  });

  describe('Reconnection Testing', () => {
    it('should implement exponential backoff on connection failure', () => {
      // Arrange
      const manager = new WSManager({
        url: 'wss://unreachable.test.com/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 100,
        maxRetryDelay: 1000,
        debug: true
      });

      // Test retry delay calculation
      const delay0 = manager.getRetryDelayPreview(0);
      const delay1 = manager.getRetryDelayPreview(1);
      const delay2 = manager.getRetryDelayPreview(2);

      expect(delay0.exponentialDelay).toBe(100); // 100 * 2^0
      expect(delay1.exponentialDelay).toBe(200); // 100 * 2^1
      expect(delay2.exponentialDelay).toBe(400); // 100 * 2^2

      // All delays should be within range [100, maxDelay]
      expect(delay0.minDelay).toBe(100);
      expect(delay1.minDelay).toBe(100);
      expect(delay2.minDelay).toBe(100);
    });

    it('should cap retry delay at maxRetryDelay', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        baseRetryDelay: 1000,
        maxRetryDelay: 5000
      });

      const delay10 = manager.getRetryDelayPreview(10);
      
      // 1000 * 2^10 = 1,024,000, should be clamped to 5000
      expect(delay10.exponentialDelay).toBe(1024000);
      expect(delay10.clampedDelay).toBe(5000);
      expect(delay10.maxDelay).toBe(5000);
    });

    it('should track reconnection metrics', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Initial metrics
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.retryCount).toBe(0);
      expect(initialMetrics.totalReconnections).toBe(0);

      // Simulate retry by updating internal metrics
      manager['metrics'].totalRetryAttempts = 5;
      manager['metrics'].totalReconnections = 2;
      manager['metrics'].lastRetryTime = Date.now();

      const updatedMetrics = manager.getMetrics();
      expect(updatedMetrics.retryCount).toBe(5);
      expect(updatedMetrics.totalReconnections).toBe(2);
      expect(updatedMetrics.lastRetryTime).toBeGreaterThan(0);
    });
  });

  describe('Idle Cleanup Testing', () => {
    it('should automatically cleanup streams after idle timeout', () => {
      jest.useFakeTimers();
      
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Create mock stream with old timestamp
      const oldTimestamp = Date.now() - 400000; // 6+ minutes ago
      const streamState = {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: oldTimestamp
      };

      manager['streams'].set('idle@stream', streamState);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Force cleanup of idle streams
      const cleanedCount = manager.forceCleanupIdleStreams(300000); // 5 min threshold

      expect(cleanedCount).toBe(1);
      expect(manager.getActiveStreamsCount()).toBe(0);
    });

    it('should not cleanup recently active streams', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Create mock stream with recent timestamp
      const recentTimestamp = Date.now() - 60000; // 1 minute ago
      const streamState = {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: recentTimestamp
      };

      manager['streams'].set('active@stream', streamState);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Try to cleanup with 5 minute threshold
      const cleanedCount = manager.forceCleanupIdleStreams(300000);

      expect(cleanedCount).toBe(0);
      expect(manager.getActiveStreamsCount()).toBe(1);
    });

    it('should run periodic cleanup automatically', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Verify cleanup timer is running
      expect(manager['cleanupTimer']).toBeDefined();

      // Add an idle stream
      const oldTimestamp = Date.now() - 400000;
      const streamState = {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: oldTimestamp
      };

      manager['streams'].set('periodic@cleanup', streamState);
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Fast-forward time to trigger periodic cleanup
      jest.advanceTimersByTime(61000); // 1 minute + 1 second

      // Stream should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(0);
    });
  });

  describe('Integration with Migration Layer', () => {
    it('should work correctly with migration utilities', () => {
      // Test feature flag behavior
      const connection = getBinanceConnection();
      expect(connection).toBeDefined();
      expect(connection).toHaveProperty('subscribe');
      expect(connection).toHaveProperty('getConnectionStatus');
      expect(connection).toHaveProperty('disconnect');
    });

    it('should provide consistent API through migration layer', () => {
      const connection = getBinanceConnection();
      
      // Test subscribe returns unsubscribe function
      const mockHandler = jest.fn();
      const unsubscribe = connection.subscribe('btcusdt@trade', mockHandler);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Test connection status
      const status = connection.getConnectionStatus();
      expect(typeof status).toBe('boolean');
      
      // Cleanup
      unsubscribe();
      connection.disconnect();
    });
  });

  describe('Backward Compatibility Testing', () => {
    it('should maintain API compatibility with legacy manager', () => {
      const shim = binanceConnectionManagerShim;
      
      // Test core API methods exist
      expect(typeof shim.subscribe).toBe('function');
      expect(typeof shim.getConnectionStatus).toBe('function');
      expect(typeof shim.disconnect).toBe('function');
      
      // Test additional methods for monitoring
      expect(typeof shim.getMetrics).toBe('function');
      expect(typeof shim.getDebugInfo).toBe('function');
      expect(typeof shim.getPrometheusMetrics).toBe('function');
    });

    it('should provide metrics through shim layer', () => {
      const shim = binanceConnectionManagerShim;
      
      // Get metrics should work
      const metrics = shim.getMetrics();
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('retryCount');
      expect(metrics).toHaveProperty('implementation');
      
      // Prometheus format should work
      const prometheus = shim.getPrometheusMetrics();
      expect(typeof prometheus).toBe('string');
      expect(prometheus).toContain('ws_manager_active_connections');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed WebSocket messages gracefully', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Test with invalid message format
      expect(() => {
        manager['extractStreamData']({ invalid: 'format' }, 'test@stream');
      }).not.toThrow();

      // Test with mismatched stream
      expect(() => {
        manager['extractStreamData']({ 
          stream: 'different@stream', 
          data: {} 
        }, 'test@stream');
      }).toThrow('Message for different stream');
    });

    it('should handle resource cleanup on manager destruction', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Add some mock streams
      manager['streams'].set('test1', { 
        observable: { pipe: jest.fn() } as any, 
        refCount: 1, 
        lastActivity: Date.now() 
      });
      manager['streams'].set('test2', { 
        observable: { pipe: jest.fn() } as any, 
        refCount: 1, 
        lastActivity: Date.now() 
      });

      expect(manager.getActiveStreamsCount()).toBe(2);
      expect(manager['cleanupTimer']).toBeDefined();

      // Destroy manager
      manager.destroy();

      // All resources should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(0);
      expect(manager['cleanupTimer']).toBeUndefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent streams efficiently', async () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: false // Disable debug for performance test
      });

      const streamNames = [
        'btcusdt@trade',
        'ethusdt@trade', 
        'adausdt@trade',
        'dotusdt@trade',
        'linkusdt@trade'
      ];

      const subscriptions: any[] = [];

      // Subscribe to multiple streams
      streamNames.forEach(streamName => {
        const subscription = manager.subscribe(streamName).subscribe({
          next: () => {},
          error: () => {}
        });
        subscriptions.push(subscription);
      });

      // Wait for connections to be established
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(manager.getActiveStreamsCount()).toBe(5);

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(5);
      expect(metrics.totalStreamCreations).toBeGreaterThanOrEqual(5);
      expect(metrics.activeConnectionsHWM).toBeGreaterThanOrEqual(5);

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
    });

    it('should track high water mark correctly under load', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Simulate varying load
      for (let i = 1; i <= 10; i++) {
        const streamState = {
          observable: { pipe: jest.fn() } as any,
          refCount: 1,
          lastActivity: Date.now()
        };
        manager['streams'].set(`stream${i}`, streamState);
        
        // Update metrics to simulate stream creation
        manager['metrics'].totalStreamCreations++;
        manager['metrics'].activeConnectionsHWM = Math.max(
          manager['metrics'].activeConnectionsHWM, 
          manager.getActiveStreamsCount()
        );
      }

      // Remove some streams
      manager['streams'].delete('stream1');
      manager['streams'].delete('stream2');

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(8); // 10 - 2
      expect(metrics.activeConnectionsHWM).toBe(10); // Should retain peak
    });
  });
});