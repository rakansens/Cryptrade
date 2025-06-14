/**
 * Additional WebSocket coverage tests
 * Testing edge cases and error scenarios
 */

import { WSManager } from '../WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from './websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager Coverage Tests', () => {
  setupWebSocketMocking();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Options', () => {
    it('should use default options when not provided', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Test default behavior
      expect(manager.getActiveStreamsCount()).toBe(0);
      expect(manager.getMetrics().activeConnections).toBe(0);
    });

    it('should respect custom retry options', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        baseRetryDelay: 2000,
        maxRetryDelay: 10000,
        maxRetryAttempts: 5
      });

      // Get retry preview - this method returns an object with delay info
      const preview = manager.getRetryDelayPreview(3);
      expect(preview).toBeDefined();
      expect(preview.baseDelay).toBe(2000);
      expect(preview.maxDelay).toBe(10000);
      // The clampedDelay should be calculated based on exponential backoff
      expect(preview.clampedDelay).toBeLessThanOrEqual(10000);
    });

    it('should handle debug mode', () => {
      const debugLogger = jest.spyOn(console, 'log').mockImplementation();
      
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Subscribe to trigger debug logs
      const sub = manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: () => {}
      });

      // Cleanup
      sub.unsubscribe();
      debugLogger.mockRestore();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle immediate connection failure', (done) => {
      const manager = new WSManager({
        url: 'wss://invalid.url',
        maxRetryAttempts: 0
      });

      manager.subscribe('test@stream').subscribe({
        next: () => {
          done.fail('Should not receive data');
        },
        error: (error) => {
          expect(error).toBeDefined();
          done();
        }
      });

      // Simulate immediate failure
      setImmediate(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          ws.simulateError(new Error('Connection refused'));
          ws.close(1006);
        }
      });
    });

    it('should handle malformed JSON messages', (done) => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: false
      });

      let messageCount = 0;
      const subscription = manager.subscribe('test@stream').subscribe({
        next: (data) => {
          messageCount++;
          if (messageCount === 1) {
            expect(data).toEqual({ valid: 'json' });
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });

      setImmediate(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://test.com/test@stream');
        if (ws) {
          // Send valid JSON
          ws.simulateMessage({ valid: 'json' });
          
          // Try to send invalid JSON (should be handled gracefully)
          try {
            ws.trigger('message', { data: 'invalid json {' });
          } catch (e) {
            // Expected
          }
        }
      });
    });
  });

  describe('Connection State', () => {
    it('should track connection state changes', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // WSManager tracks metrics internally
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.activeConnections).toBe(0);

      // Create subscription
      const sub = manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: () => {}
      });

      // Check that connection is tracked
      const activeMetrics = manager.getMetrics();
      expect(activeMetrics.activeConnections).toBe(1);
      expect(activeMetrics.totalStreamCreations).toBeGreaterThan(0);

      sub.unsubscribe();
    });
  });

  describe('Multiple Subscriptions', () => {
    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Rapidly create and destroy subscriptions
      for (let i = 0; i < 10; i++) {
        const sub = manager.subscribe('test@stream').subscribe({
          next: () => {},
          error: () => {}
        });
        sub.unsubscribe();
      }

      // Should handle gracefully without leaks
      expect(manager.getActiveStreamsCount()).toBeLessThanOrEqual(1);
    });

    it('should handle concurrent subscriptions to different streams', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      const subscriptions = [];
      
      // Create 10 different stream subscriptions
      for (let i = 0; i < 10; i++) {
        const sub = manager.subscribe(`stream${i}@trade`).subscribe({
          next: () => {},
          error: () => {}
        });
        subscriptions.push(sub);
      }

      expect(manager.getActiveStreamsCount()).toBe(10);
      expect(MockWebSocket.getAllInstances().length).toBe(10);

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
    });
  });

  describe('Message Handling', () => {
    it('should handle different message types', (done) => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      const messages: any[] = [];
      const subscription = manager.subscribe('btcusdt@aggTrade').subscribe({
        next: (data) => {
          messages.push(data);
          if (messages.length === 3) {
            expect(messages[0]).toHaveProperty('e', 'trade');
            expect(messages[1]).toHaveProperty('e', 'kline');
            expect(messages[2]).toHaveProperty('e', 'depthUpdate');
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });

      setImmediate(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://test.com/btcusdt@aggTrade');
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage());
          ws.simulateMessage(BinanceMessageGenerator.klineMessage());
          ws.simulateMessage(BinanceMessageGenerator.depthMessage());
        }
      });
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Create some subscriptions
      const subs = [
        manager.subscribe('stream1').subscribe({ next: () => {}, error: () => {} }),
        manager.subscribe('stream2').subscribe({ next: () => {}, error: () => {} })
      ];

      expect(manager.getActiveStreamsCount()).toBe(2);

      // Destroy manager
      manager.destroy();

      // All resources should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(0);
      expect(MockWebSocket.getAllInstances().every(ws => ws.readyState === MockWebSocket.CLOSED)).toBe(true);
    });

    it('should handle destroy during reconnection', (done) => {
      const manager = new WSManager({
        url: 'wss://test.com',
        baseRetryDelay: 10,
        maxRetryAttempts: 10
      });

      manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: () => {}
      });

      // Simulate connection failure to trigger reconnection
      setImmediate(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          ws.simulateError(new Error('Connection lost'));
          ws.close(1006);
        }

        // Destroy during reconnection attempt
        setTimeout(() => {
          manager.destroy();
          // Should not throw any errors
          done();
        }, 20);
      });
    });
  });

  describe('Performance', () => {
    it('should handle high message throughput', (done) => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: false
      });

      let messageCount = 0;
      const targetCount = 100; // Reduced for faster test
      
      const subscription = manager.subscribe('perf@test').subscribe({
        next: () => {
          messageCount++;
          if (messageCount === targetCount) {
            // Just verify we received all messages
            expect(messageCount).toBe(targetCount);
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });

      setImmediate(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://test.com/perf@test');
        if (ws) {
          // Send all messages at once
          for (let i = 0; i < targetCount; i++) {
            ws.simulateMessage({ id: i, data: 'test' });
          }
        }
      });
    }, 5000);
  });
});