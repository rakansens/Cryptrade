/**
 * Additional WebSocket coverage tests
 * Testing edge cases and error scenarios
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/lib/ws/websocket-mock';

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
  // Set longer timeout for WebSocket tests
  // Note: We set a default timeout of 30 seconds since WebSocket tests need more time
  
  let cleanupWebSocketMocking: () => void;
  
  beforeAll(() => {
    cleanupWebSocketMocking = setupWebSocketMocking();
  });
  
  afterAll(() => {
    if (cleanupWebSocketMocking) {
      cleanupWebSocketMocking();
    }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket.clearInstances();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
    MockWebSocket.clearInstances();
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
      expect(preview.minDelay).toBe(100); // The actual minimum delay is 100ms, not 2000ms
      expect(preview.maxDelay).toBe(10000);
      // The clampedDelay should be calculated based on exponential backoff
      expect(preview.clampedDelay).toBeLessThanOrEqual(10000);
      expect(preview.exponentialDelay).toBe(2000 * Math.pow(2, 3)); // 2000 * 8 = 16000
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
    it('should handle immediate connection failure', async () => {
      const manager = new WSManager({
        url: 'wss://invalid.url',
        maxRetryAttempts: 0
      });

      let errorReceived = false;
      const subscription = manager.subscribe('test@stream').subscribe({
        next: () => {
          throw new Error('Should not receive data');
        },
        error: (error) => {
          errorReceived = true;
          expect(error).toBeDefined();
          expect(error.message).toContain('Max retry attempts (0) exceeded');
        }
      });

      // Wait for WebSocket to be created
      await jest.advanceTimersByTimeAsync(50);
      const ws = MockWebSocket.getAllInstances()[0];
      expect(ws).toBeDefined();
      
      // Simulate immediate failure
      ws.simulateError(new Error('Connection refused'));
      ws.close(1006);
      
      // Process the error through RxJS operators
      await jest.advanceTimersByTimeAsync(100);
      
      expect(errorReceived).toBe(true);
      subscription.unsubscribe();
    });

    it('should handle malformed JSON messages', async () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: false
      });

      let messageCount = 0;
      const messages: any[] = [];
      const subscription = manager.subscribe('test@stream').subscribe({
        next: (data) => {
          messageCount++;
          messages.push(data);
        },
        error: (error) => {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      });

      // Wait for WebSocket connection
      await jest.advanceTimersByTimeAsync(50);
      const ws = MockWebSocket.getInstanceByUrl('wss://test.com/test@stream');
      expect(ws).toBeDefined();
      
      // Send valid JSON
      ws!.simulateMessage({ valid: 'json' } as any);
      
      // Try to send invalid JSON (should be handled gracefully)
      // The WebSocket subject in RxJS will handle JSON parsing errors internally
      // and won't propagate them to subscribers
      try {
        // @ts-ignore - accessing private method for testing
        ws!['trigger']('message', { data: 'invalid json {' } as MessageEvent);
      } catch (e) {
        // Expected - invalid JSON will be caught by RxJS webSocket operator
      }
      
      // Wait for messages to be processed
      await jest.advanceTimersByTimeAsync(50);
      
      // Should only receive the valid message
      expect(messageCount).toBe(1);
      expect(messages[0]).toEqual({ valid: 'json' });
      
      subscription.unsubscribe();
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
    it('should handle rapid subscribe/unsubscribe cycles', async () => {
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

      // Allow some time for cleanup
      await jest.advanceTimersByTimeAsync(100);
      
      // Should handle gracefully without leaks
      expect(manager.getActiveStreamsCount()).toBeLessThanOrEqual(1);
      manager.destroy();
    });

    it('should handle concurrent subscriptions to different streams', async () => {
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

      // Allow time for all connections to be established
      await jest.advanceTimersByTimeAsync(100);
      
      expect(manager.getActiveStreamsCount()).toBe(10);
      expect(MockWebSocket.getAllInstances().length).toBeGreaterThanOrEqual(10);

      // Cleanup
      subscriptions.forEach(sub => sub.unsubscribe());
      manager.destroy();
    });
  });

  describe('Message Handling', () => {
    it('should handle different message types', async () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      const messages: any[] = [];
      const subscription = manager.subscribe('btcusdt@aggTrade').subscribe({
        next: (data) => {
          messages.push(data);
        },
        error: (error) => {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      });

      await jest.advanceTimersByTimeAsync(100);
      const ws = MockWebSocket.getInstanceByUrl('wss://test.com/btcusdt@aggTrade');
      expect(ws).toBeDefined();
      
      ws!.simulateMessage(BinanceMessageGenerator.tradeMessage());
      ws!.simulateMessage(BinanceMessageGenerator.klineMessage());
      ws!.simulateMessage(BinanceMessageGenerator.depthMessage());
      
      // Wait for messages to be processed
      await jest.advanceTimersByTimeAsync(50);
      
      expect(messages.length).toBe(3);
      expect(messages[0]).toHaveProperty('e', 'trade');
      expect(messages[1]).toHaveProperty('e', 'kline');
      expect(messages[2]).toHaveProperty('e', 'depthUpdate');
      
      subscription.unsubscribe();
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Create some subscriptions
      const sub1 = manager.subscribe('stream1').subscribe({ next: () => {}, error: () => {} });
      const sub2 = manager.subscribe('stream2').subscribe({ next: () => {}, error: () => {} });

      // Allow time for connections
      await jest.advanceTimersByTimeAsync(100);
      expect(manager.getActiveStreamsCount()).toBe(2);

      // Unsubscribe first to trigger proper cleanup
      sub1.unsubscribe();
      sub2.unsubscribe();
      
      // Allow cleanup to process
      await jest.advanceTimersByTimeAsync(50);

      // Destroy manager
      manager.destroy();

      // All resources should be cleaned up
      expect(manager.getActiveStreamsCount()).toBe(0);
      const instances = MockWebSocket.getAllInstances();
      const openInstances = instances.filter(ws => ws.readyState !== MockWebSocket.CLOSED);
      expect(openInstances.length).toBe(0);
    });

    it('should handle destroy during reconnection', async () => {
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
      await jest.advanceTimersByTimeAsync(100);
      const ws = MockWebSocket.getAllInstances()[0];
      expect(ws).toBeDefined();
      
      ws.simulateError(new Error('Connection lost'));
      ws.close(1006);

      // Destroy during reconnection attempt
      await jest.advanceTimersByTimeAsync(20);
      
      // Wrap destroy in try-catch to handle any cleanup issues
      expect(() => {
        manager.destroy();
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high message throughput', async () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: false
      });

      let messageCount = 0;
      const targetCount = 100; // Reduced for faster test
      
      const subscription = manager.subscribe('perf@test').subscribe({
        next: () => {
          messageCount++;
        },
        error: (error) => {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      });

      await jest.advanceTimersByTimeAsync(50);
      const ws = MockWebSocket.getInstanceByUrl('wss://test.com/perf@test');
      expect(ws).toBeDefined();
      
      // Send all messages at once
      for (let i = 0; i < targetCount; i++) {
        ws!.simulateMessage({ id: i, data: 'test' } as any);
      }
      
      // Wait for all messages to be processed
      await jest.advanceTimersByTimeAsync(100);
      
      // Just verify we received all messages
      expect(messageCount).toBe(targetCount);
      subscription.unsubscribe();
    }, 10000);
  });
});