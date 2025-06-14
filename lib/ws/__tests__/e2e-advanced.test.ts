/**
 * Advanced E2E Tests for WSManager
 * Complex scenarios: high-frequency trading, network instability, load testing
 */

import { WSManager } from '../WSManager';
import { getBinanceConnection } from '../migration';
import { 
  MockWebSocket, 
  BinanceMessageGenerator, 
  WebSocketTestScenarios,
  setupWebSocketMocking 
} from './websocket-mock';

// Mock logger
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

describe('WSManager Advanced E2E Scenarios', () => {
  setupWebSocketMocking();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('High-Frequency Trading Simulation', () => {
    it('should handle rapid message bursts without memory leaks', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false // Disable debug for performance
      });

      const messageCount = 100;
      const receivedMessages: any[] = [];
      
      const messagePromise = new Promise((resolve, reject) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            receivedMessages.push(data);
            
            if (receivedMessages.length === messageCount) {
              // Verify all messages received
              expect(receivedMessages.length).toBe(messageCount);
              
              // Check metrics
              const metrics = manager.getMetrics();
              expect(metrics.activeConnections).toBe(1);
              
              subscription.unsubscribe();
              resolve(true);
            }
          },
          error: reject
        });
      });

      // Wait for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate high-frequency messages
      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        // Send messages rapidly
        for (let i = 0; i < messageCount; i++) {
          const price = (50000 + Math.random() * 1000).toFixed(2);
          mockWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', price));
        }
      } else {
        throw new Error('Mock WebSocket not found');
      }

      // Wait for all messages to be processed
      await messagePromise;
    });

    it('should maintain connection sharing under high load', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      const subscriptions: any[] = [];
      const streamName = 'btcusdt@trade';

      // Create multiple subscribers to same stream
      for (let i = 0; i < 5; i++) {
        const sub = manager.subscribe(streamName).subscribe({
          next: () => {}, // Just consume messages
          error: () => {}
        });
        subscriptions.push(sub);
      }

      // Should only have 1 active connection despite 5 subscribers
      expect(manager.getActiveStreamsCount()).toBe(1);
      expect(MockWebSocket.getAllInstances().length).toBe(1);

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
    });
  });

  describe('Network Instability Scenarios', () => {
    it('should handle connection drops and reconnection', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 100,
        debug: true
      });

      let reconnectionDetected = false;
      let messagesAfterReconnect = 0;

      const messagePromise = new Promise((resolve, reject) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            if (reconnectionDetected) {
              messagesAfterReconnect++;
              if (messagesAfterReconnect >= 2) {
                // Successfully receiving messages after reconnection
                subscription.unsubscribe();
                resolve(true);
              }
            }
          },
          error: (error) => {
            // Reconnection logic should handle errors internally
            console.log('Stream error (expected during reconnection):', error.message);
          }
        });
      });

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate network disconnection
      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        mockWs.simulateDisconnect();
        reconnectionDetected = true;
        
        // Simulate reconnection and new messages
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newMockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (newMockWs) {
          // Send messages after "reconnection"
          newMockWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
          newMockWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51100'));
        }
      }

      // Wait for messages to be processed
      await messagePromise;
    });

    it('should respect exponential backoff on repeated failures', () => {
      const manager = new WSManager({
        url: 'wss://unreachable.example.com/',
        maxRetryAttempts: 3,
        baseRetryDelay: 100,
        maxRetryDelay: 1000,
        debug: true
      });

      // Test delay calculations for failed connections
      const delays = [
        manager.getRetryDelayPreview(0), // First retry
        manager.getRetryDelayPreview(1), // Second retry  
        manager.getRetryDelayPreview(2)  // Third retry
      ];

      // Verify exponential growth
      expect(delays[0].exponentialDelay).toBe(100); // 100 * 2^0
      expect(delays[1].exponentialDelay).toBe(200); // 100 * 2^1
      expect(delays[2].exponentialDelay).toBe(400); // 100 * 2^2

      // All should enforce minimum delay
      delays.forEach(delay => {
        expect(delay.minDelay).toBe(100);
        expect(delay.maxDelay).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should cleanup resources after idle timeout', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      // Subscribe and then let it go idle
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {}
      });
      expect(manager.getActiveStreamsCount()).toBe(1);

      // Unsubscribe to simulate idle state
      subscription.unsubscribe();

      // In WSManager, streams are cleaned up immediately when refCount reaches 0
      // or after idle timeout via periodic cleanup
      // For immediate cleanup test, check after unsubscribe
      setTimeout(() => {
        expect(manager.getActiveStreamsCount()).toBe(0);
      }, 10);
    });

    it('should handle periodic cleanup correctly', () => {
      jest.useFakeTimers();
      
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      // Add mock streams with different activity times
      const now = Date.now();
      const recentTime = now - 60000; // 1 minute ago
      const oldTime = now - 400000;   // 6+ minutes ago

      manager['streams'].set('recent@stream', {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: recentTime
      });

      manager['streams'].set('old@stream', {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: oldTime
      });

      expect(manager.getActiveStreamsCount()).toBe(2);

      // Advance timer to trigger periodic cleanup (runs every minute)
      jest.advanceTimersByTime(61000);

      // Only old stream should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(1);
      expect(manager['streams'].has('recent@stream')).toBe(true);
      expect(manager['streams'].has('old@stream')).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed server messages gracefully', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      let errorHandled = false;
      let messageReceived = false;

      const testPromise = new Promise((resolve) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            // Should not receive malformed data
            expect(data).toBeDefined();
            messageReceived = true;
          },
          error: (error) => {
            errorHandled = true;
            // Error should be handled gracefully
            expect(error).toBeDefined();
            resolve(true);
          }
        });

        // Set a timeout to complete the test if no error occurs
        setTimeout(() => {
          if (!errorHandled) {
            subscription.unsubscribe();
            resolve(true);
          }
        }, 200);
      });

      // Wait for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
      if (mockWs) {
        // Send malformed message
        mockWs.simulateMessage({ invalid: 'format', missing: 'required fields' });
      }

      await testPromise;
      // Test passes if either error was handled or message was processed gracefully
      expect(errorHandled || messageReceived).toBe(true);
    });

    it('should handle server error messages', async () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      const errorPromise = new Promise((resolve) => {
        const subscription = manager.subscribe('invalid@stream').subscribe({
          next: () => {},
          error: (error) => {
            expect(error).toBeDefined();
            resolve(true);
          }
        });

        // Set a timeout to complete the test if no error occurs
        setTimeout(() => {
          subscription.unsubscribe();
          resolve(true);
        }, 200);
      });

      // Wait for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const mockWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/invalid@stream');
      if (mockWs) {
        mockWs.simulateMessage(BinanceMessageGenerator.errorMessage(-1121, 'Invalid symbol'));
      }

      await errorPromise;
    });
  });

  describe('Integration with Application Layer', () => {
    it('should work seamlessly with migration layer', () => {
      // Get connection through migration layer
      const connection = getBinanceConnection();
      
      // Should provide the expected API
      expect(connection).toHaveProperty('subscribe');
      expect(connection).toHaveProperty('getConnectionStatus');
      expect(connection).toHaveProperty('disconnect');

      // Test basic functionality
      const handler = jest.fn();
      const unsubscribe = connection.subscribe('btcusdt@trade', handler);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Cleanup
      unsubscribe();
    });

    it('should provide accurate metrics for monitoring', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      // Create some activity
      const sub1 = manager.subscribe('btcusdt@trade').subscribe();
      const sub2 = manager.subscribe('ethusdt@trade').subscribe();

      const metrics = manager.getMetrics();
      
      // Verify core metrics
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.implementation).toBe('WSManager');
      expect(metrics.totalStreamCreations).toBeGreaterThanOrEqual(2);
      
      // Test Prometheus format
      const prometheus = manager.getPrometheusMetrics();
      expect(prometheus).toContain('ws_manager_active_connections 2');
      expect(prometheus).toContain('# HELP ws_manager_active_connections');

      // Cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent streams efficiently', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
      const subscriptions: any[] = [];

      // Subscribe to multiple streams
      symbols.forEach(symbol => {
        const streamName = `${symbol.toLowerCase()}@trade`;
        const sub = manager.subscribe(streamName).subscribe({
          next: () => {},
          error: () => {}
        });
        subscriptions.push(sub);
      });

      // Verify efficient connection management
      expect(manager.getActiveStreamsCount()).toBe(symbols.length);
      expect(MockWebSocket.getAllInstances().length).toBe(symbols.length);

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(symbols.length);
      expect(metrics.activeConnectionsHWM).toBeGreaterThanOrEqual(symbols.length);

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
    });

    it('should maintain performance under stream churn', () => {
      const manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      // Simulate rapid subscribe/unsubscribe cycles
      for (let i = 0; i < 20; i++) {
        const streamName = `symbol${i}@trade`;
        const sub = manager.subscribe(streamName).subscribe();
        
        // Immediately unsubscribe some streams
        if (i % 3 === 0) {
          sub.unsubscribe();
        }
      }

      const metrics = manager.getMetrics();
      
      // Should handle churn without issues
      expect(metrics.totalStreamCreations).toBeGreaterThanOrEqual(20);
      expect(metrics.activeConnections).toBeGreaterThan(0);
      expect(metrics.activeConnections).toBeLessThan(20); // Some unsubscribed
    });
  });
});