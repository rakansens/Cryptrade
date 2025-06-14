/**
 * E2E Error Handling Tests for WSManager
 * Tests various error scenarios and recovery mechanisms
 */

import { WSManager } from '../../WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '../websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('WSManager E2E - Error Handling', () => {
  let manager: WSManager;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
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

  describe('Connection Errors', () => {
    it('should handle immediate connection failure', (done) => {
      manager = new WSManager({
        url: 'wss://invalid.example.com/',
        maxRetryAttempts: 0,
        debug: true
      });

      manager.subscribe('test@stream').subscribe({
        next: () => {
          done.fail('Should not receive data on failed connection');
        },
        error: (error) => {
          expect(error).toBeDefined();
          done();
        }
      });

      // Simulate immediate connection failure
      setTimeout(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          ws.simulateError(new Error('Connection refused'));
          ws.close(1006, 'Unable to connect');
        }
      }, 10);
    });

    it('should handle connection timeout', (done) => {
      manager = new WSManager({
        url: 'wss://timeout.example.com/',
        maxRetryAttempts: 1,
        baseRetryDelay: 50
      });

      const startTime = Date.now();

      manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: (error) => {
          const elapsed = Date.now() - startTime;
          expect(error.message).toContain('Max retry attempts');
          expect(elapsed).toBeGreaterThan(50); // Should have tried to retry
          done();
        }
      });

      // Simulate connection that never opens
      setTimeout(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          // Don't open the connection, just error
          ws.simulateError(new Error('Connection timeout'));
          ws.close(1006);
        }
      }, 10);
    });
  });

  describe('Message Errors', () => {
    it('should handle server error messages', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: true
      });

      let errorMessageReceived = false;

      const subscription = manager.subscribe('invalid@stream').subscribe({
        next: (data) => {
          // Check if it's an error message
          if (data.error) {
            errorMessageReceived = true;
            expect(data.error.code).toBe(-1121);
            expect(data.error.msg).toBe('Invalid symbol');
            subscription.unsubscribe();
            done();
          }
        },
        error: () => {
          // Stream-level errors
        }
      });

      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/invalid@stream');
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.errorMessage(-1121, 'Invalid symbol'));
        }
      }, 20);
    });

    it('should handle malformed messages gracefully', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        debug: false
      });

      let validMessageCount = 0;
      const targetCount = 2;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          // Should only receive valid messages
          expect(data).toHaveProperty('e');
          validMessageCount++;
          
          if (validMessageCount === targetCount) {
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });

      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          // Send valid message
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
          
          // Try to send malformed data (should be handled gracefully)
          try {
            ws.trigger('message', { data: 'invalid json {' });
          } catch (e) {
            // Expected - malformed JSON should be caught
          }
          
          // Send another valid message
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
        }
      }, 20);
    });
  });

  describe('Network Errors', () => {
    it('should handle network disconnection', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 2,
        baseRetryDelay: 50
      });

      let disconnectDetected = false;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: (error) => {
          if (!disconnectDetected) {
            disconnectDetected = true;
            expect(error.message).toContain('Max retry attempts');
            done();
          }
        }
      });

      // Simulate network disconnection
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateDisconnect();
        }
      }, 20);
    });

    it('should handle WebSocket close with error code', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 0
      });

      manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: (error) => {
          expect(error).toBeDefined();
          done();
        }
      });

      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          // Close with abnormal closure code
          ws.close(1006, 'Connection lost');
        }
      }, 20);
    });
  });

  describe('Resource Cleanup on Error', () => {
    it('should cleanup resources after max retries exceeded', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 1,
        baseRetryDelay: 10
      });

      const initialMetrics = manager.getMetrics();

      manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {
          // After error, check cleanup
          setTimeout(() => {
            const finalMetrics = manager.getMetrics();
            expect(finalMetrics.activeConnections).toBe(0);
            done();
          }, 50);
        }
      });

      // Force repeated failures
      let failureCount = 0;
      const failConnection = () => {
        const ws = MockWebSocket.getAllInstances().find(w => w.readyState !== MockWebSocket.CLOSED);
        if (ws) {
          failureCount++;
          ws.simulateError(new Error(`Connection failed ${failureCount}`));
          ws.close(1006);
          
          if (failureCount < 3) {
            setTimeout(failConnection, 20);
          }
        }
      };

      setTimeout(failConnection, 10);
    });

    it('should handle errors during destroy', () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/'
      });

      // Create some connections
      const sub1 = manager.subscribe('stream1').subscribe({ next: () => {} });
      const sub2 = manager.subscribe('stream2').subscribe({ next: () => {} });

      // Force error in one WebSocket
      const instances = MockWebSocket.getAllInstances();
      if (instances[0]) {
        instances[0].close = jest.fn().mockImplementation(() => {
          throw new Error('Close failed');
        });
      }

      // Destroy should handle the error gracefully
      expect(() => manager.destroy()).not.toThrow();

      // Verify cleanup attempted
      expect(manager.getActiveStreamsCount()).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient errors', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 50
      });

      let errorCount = 0;
      let messageReceived = false;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          if (!messageReceived) {
            messageReceived = true;
            expect(data).toHaveProperty('e', 'trade');
            expect(errorCount).toBeGreaterThan(0); // Should have had errors before success
            subscription.unsubscribe();
            done();
          }
        },
        error: () => {
          done.fail('Should recover from transient errors');
        }
      });

      // Simulate transient failures
      let attemptCount = 0;
      const simulateTransientError = () => {
        attemptCount++;
        const ws = MockWebSocket.getAllInstances().find(w => w.readyState !== MockWebSocket.CLOSED);
        
        if (ws && attemptCount <= 2) {
          errorCount++;
          ws.simulateError(new Error('Transient error'));
          ws.close(1006);
          setTimeout(simulateTransientError, 60);
        } else if (ws && attemptCount === 3) {
          // Success on third attempt
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
        }
      };

      setTimeout(simulateTransientError, 20);
    }, 5000);
  });
});