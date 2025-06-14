/**
 * E2E Message Tests for WSManager
 * Tests message sending, receiving, and handling
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

describe('WSManager E2E - Message Handling', () => {
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

  describe('Message Reception', () => {
    it('should receive trade messages', (done) => {
      const tradeData = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000.00');
      
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data).toHaveProperty('e', 'trade');
          expect(data).toHaveProperty('s', 'BTCUSDT');
          expect(data).toHaveProperty('p', '50000.00');
          subscription.unsubscribe();
          done();
        },
        error: done.fail
      });

      // Wait for connection then send message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateMessage(tradeData);
        }
      }, 20);
    });

    it('should receive kline messages', (done) => {
      const klineData = BinanceMessageGenerator.klineMessage('ETHUSDT', '1h');
      
      const subscription = manager.subscribe('ethusdt@kline_1h').subscribe({
        next: (data) => {
          expect(data).toHaveProperty('e', 'kline');
          expect(data).toHaveProperty('s', 'ETHUSDT');
          expect(data.k).toHaveProperty('i', '1h');
          subscription.unsubscribe();
          done();
        },
        error: done.fail
      });

      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/ethusdt@kline_1h');
        if (ws) {
          ws.simulateMessage(klineData);
        }
      }, 20);
    });

    it('should receive depth messages', (done) => {
      const depthData = BinanceMessageGenerator.depthMessage('BNBUSDT');
      
      const subscription = manager.subscribe('bnbusdt@depth').subscribe({
        next: (data) => {
          expect(data).toHaveProperty('e', 'depthUpdate');
          expect(data).toHaveProperty('s', 'BNBUSDT');
          expect(data).toHaveProperty('b'); // bids
          expect(data).toHaveProperty('a'); // asks
          subscription.unsubscribe();
          done();
        },
        error: done.fail
      });

      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/bnbusdt@depth');
        if (ws) {
          ws.simulateMessage(depthData);
        }
      }, 20);
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast messages to all subscribers', (done) => {
      const testMessage = BinanceMessageGenerator.tradeMessage('BTCUSDT', '55000');
      let receivedCount = 0;
      const expectedCount = 3;
      
      const checkComplete = () => {
        receivedCount++;
        if (receivedCount === expectedCount) {
          done();
        }
      };
      
      // Create multiple subscribers
      const sub1 = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data.p).toBe('55000');
          checkComplete();
        }
      });
      
      const sub2 = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data.p).toBe('55000');
          checkComplete();
        }
      });
      
      const sub3 = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data.p).toBe('55000');
          checkComplete();
        }
      });
      
      // Send message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          ws.simulateMessage(testMessage);
        }
      }, 20);
      
      // Cleanup
      setTimeout(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
        sub3.unsubscribe();
      }, 100);
    });
  });

  describe('Message Ordering', () => {
    it('should maintain message order', (done) => {
      const messages: any[] = [];
      const messageCount = 10;
      
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          messages.push(data);
          
          if (messages.length === messageCount) {
            // Verify order
            for (let i = 0; i < messageCount; i++) {
              expect(messages[i].t).toBe(i); // Check trade ID order
            }
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });
      
      // Send messages in order
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        if (ws) {
          for (let i = 0; i < messageCount; i++) {
            const msg = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000');
            msg.t = i; // Set trade ID
            ws.simulateMessage(msg);
          }
        }
      }, 20);
    });
  });

  describe('High-Frequency Messages', () => {
    it('should handle rapid message bursts', (done) => {
      const messageCount = 100;
      let receivedCount = 0;
      
      const subscription = manager.subscribe('btcusdt@aggTrade').subscribe({
        next: () => {
          receivedCount++;
          if (receivedCount === messageCount) {
            expect(receivedCount).toBe(messageCount);
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail
      });
      
      // Send burst of messages
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@aggTrade');
        if (ws) {
          for (let i = 0; i < messageCount; i++) {
            ws.simulateMessage({ id: i, data: 'test' });
          }
        }
      }, 20);
    }, 5000);
  });

  describe('Message Filtering', () => {
    it('should only receive messages for subscribed streams', (done) => {
      let btcMessages = 0;
      let ethMessages = 0;
      
      // Subscribe only to BTC
      const subscription = manager.subscribe('btcusdt@trade').subscribe({
        next: (data) => {
          expect(data.s).toBe('BTCUSDT');
          btcMessages++;
          
          if (btcMessages === 2) {
            expect(ethMessages).toBe(0); // Should not receive ETH messages
            subscription.unsubscribe();
            done();
          }
        }
      });
      
      setTimeout(() => {
        // Try to send to both streams
        const btcWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
        const ethWs = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/ethusdt@trade');
        
        if (btcWs) {
          btcWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000'));
          btcWs.simulateMessage(BinanceMessageGenerator.tradeMessage('BTCUSDT', '51000'));
        }
        
        // This should not affect BTC subscriber
        if (ethWs) {
          ethWs.simulateMessage(BinanceMessageGenerator.tradeMessage('ETHUSDT', '3000'));
        }
      }, 20);
    });
  });
});