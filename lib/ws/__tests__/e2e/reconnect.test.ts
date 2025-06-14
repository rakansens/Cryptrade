/**
 * E2E Reconnection Tests for WSManager
 * Tests reconnection logic, exponential backoff, and recovery
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

describe('WSManager E2E - Reconnection Logic', () => {
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

  describe('Basic Reconnection', () => {
    it('should attempt reconnection on connection loss', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 50,
        debug: true
      });

      let connectionAttempts = 0;
      let messageReceived = false;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          if (!messageReceived) {
            messageReceived = true;
            // Verify we can receive messages after reconnection
            expect(data).toHaveProperty('e', 'trade');
            subscription.unsubscribe();
            done();
          }
        },
        error: (error) => {
          // Should not error out immediately
          connectionAttempts++;
        }
      });

      // Simulate connection drop after initial connection
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateDisconnect();
        }
      }, 30);

      // Send message after reconnection time
      setTimeout(() => {
        const instances = MockWebSocket.getAllInstances();
        const activeWs = instances.find(ws => ws.readyState === MockWebSocket.OPEN);
        if (activeWs) {
          activeWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
        }
      }, 200);
    }, 5000);
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff for retries', () => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        baseRetryDelay: 100,
        maxRetryDelay: 5000,
        maxRetryAttempts: 5
      });

      // Test retry delay calculations
      const delays = [];
      for (let i = 1; i <= 5; i++) {
        const delay = manager.getRetryDelayPreview(i);
        delays.push(delay);
      }

      // Verify exponential growth
      expect(delays[0].exponentialDelay).toBe(200);  // 100 * 2^1
      expect(delays[1].exponentialDelay).toBe(400);  // 100 * 2^2
      expect(delays[2].exponentialDelay).toBe(800);  // 100 * 2^3
      expect(delays[3].exponentialDelay).toBe(1600); // 100 * 2^4
      expect(delays[4].exponentialDelay).toBe(3200); // 100 * 2^5

      // Verify clamping to max delay
      delays.forEach(delay => {
        expect(delay.clampedDelay).toBeLessThanOrEqual(5000);
      });
    });

    it('should respect max retry attempts', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 2,
        baseRetryDelay: 10,
        debug: true
      });

      let errorReceived = false;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: (error) => {
          errorReceived = true;
          expect(error.message).toContain('Max retry attempts');
          done();
        }
      });

      // Simulate immediate connection failure
      setTimeout(() => {
        const instances = MockWebSocket.getAllInstances();
        instances.forEach(ws => {
          ws.simulateError(new Error('Connection failed'));
          ws.close(1006);
        });
      }, 10);
    });
  });

  describe('Recovery After Reconnection', () => {
    it('should resume normal operation after successful reconnection', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 5,
        baseRetryDelay: 50
      });

      const messages: any[] = [];
      const targetMessageCount = 3;

      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          messages.push(data);
          
          if (messages.length === targetMessageCount) {
            // Verify all messages received
            expect(messages).toHaveLength(targetMessageCount);
            messages.forEach(msg => {
              expect(msg).toHaveProperty('e', 'trade');
            });
            subscription.unsubscribe();
            done();
          }
        }
      });

      // Send initial message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
        }
      }, 20);

      // Simulate disconnect
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateDisconnect();
        }
      }, 50);

      // Send messages after reconnection
      setTimeout(() => {
        const instances = MockWebSocket.getAllInstances();
        const activeWs = instances.find(ws => ws.readyState === MockWebSocket.OPEN);
        if (activeWs) {
          activeWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
          activeWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '52000'));
        }
      }, 200);
    }, 5000);
  });

  describe('Multiple Stream Reconnection', () => {
    it('should handle reconnection for multiple streams independently', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 3,
        baseRetryDelay: 50
      });

      let btcReconnected = false;
      let ethReconnected = false;

      const checkComplete = () => {
        if (btcReconnected && ethReconnected) {
          done();
        }
      };

      // Subscribe to BTC
      const btcSub = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          if (data.p === '55000') {
            btcReconnected = true;
            btcSub.unsubscribe();
            checkComplete();
          }
        }
      });

      // Subscribe to ETH
      const ethSub = manager.subscribe('ethusdt@trade').subscribe({
        next: (data) => {
          if (data.p === '3500') {
            ethReconnected = true;
            ethSub.unsubscribe();
            checkComplete();
          }
        }
      });

      // Disconnect both streams
      setTimeout(() => {
        MockWebSocket.getAllInstances().forEach(ws => {
          ws.simulateDisconnect();
        });
      }, 50);

      // Send messages after reconnection
      setTimeout(() => {
        const instances = MockWebSocket.getAllInstances();
        instances.forEach(ws => {
          if (ws.url.includes('btcusdt')) {
            ws.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '55000'));
          } else if (ws.url.includes('ethusdt')) {
            ws.simulateMessage(BinanceMessageGenerator.tradeMessage('ETHUSDT', '3500'));
          }
        });
      }, 200);
    }, 5000);
  });

  describe('Reconnection Metrics', () => {
    it('should track reconnection metrics', (done) => {
      manager = new WSManager({
        url: 'wss://stream.binance.com:9443/ws/',
        maxRetryAttempts: 2,
        baseRetryDelay: 50
      });

      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalReconnections).toBe(0);
      expect(initialMetrics.retryCount).toBe(0);

      manager.subscribe('btcusdt@trade').subscribe({
        next: () => {},
        error: () => {
          const finalMetrics = manager.getMetrics();
          expect(finalMetrics.retryCount).toBeGreaterThan(0);
          done();
        }
      });

      // Force connection failure
      setTimeout(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          ws.simulateError(new Error('Test error'));
          ws.close(1006);
        }
      }, 20);
    });
  });
});