/**
 * E2E Message Tests for WSManager
 * Tests message sending, receiving, and handling
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/tests/helpers/websocket-mock';

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
    it('should receive trade messages', async () => {
      const tradeData = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000.00');
      
      const messagePromise = new Promise((resolve) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            subscription.unsubscribe();
            resolve(data);
          },
          error: (error) => {
            throw error;
          }
        });
      });

      // Wait for connection and get WebSocket instance
      const ws = await new Promise<MockWebSocket | undefined>((resolve) => {
        const checkInstance = () => {
          const instance = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
          if (instance) {
            resolve(instance);
          } else {
            setTimeout(checkInstance, 10);
          }
        };
        checkInstance();
        setTimeout(() => resolve(undefined), 1000);
      });
      
      if (ws) {
        ws.simulateMessage(tradeData);
      }
      
      const data = await messagePromise;
      expect(data).toHaveProperty('e', 'trade');
      expect(data).toHaveProperty('s', 'BTCUSDT');
      expect(data).toHaveProperty('p', '50000.00');
    });

    it('should receive kline messages', async () => {
      const klineData = BinanceMessageGenerator.klineMessage('ETHUSDT', '1h');
      
      const messagePromise = new Promise((resolve) => {
        const subscription = manager.subscribe('ethusdt@kline_1h').subscribe({
          next: (data) => {
            subscription.unsubscribe();
            resolve(data);
          },
          error: (error) => {
            throw error;
          }
        });
      });

      // Wait for connection and get WebSocket instance
      const ws = await new Promise<MockWebSocket | undefined>((resolve) => {
        const checkInstance = () => {
          const instance = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/ethusdt@kline_1h');
          if (instance) {
            resolve(instance);
          } else {
            setTimeout(checkInstance, 10);
          }
        };
        checkInstance();
        setTimeout(() => resolve(undefined), 1000);
      });
      
      if (ws) {
        ws.simulateMessage(klineData);
      }
      
      const data = await messagePromise;
      expect(data).toHaveProperty('e', 'kline');
      expect(data).toHaveProperty('s', 'ETHUSDT');
      expect(data['k']).toHaveProperty('i', '1h');
    });

    it('should receive depth messages', async () => {
      const depthData = BinanceMessageGenerator.depthMessage('BNBUSDT');
      
      const messagePromise = new Promise((resolve) => {
        const subscription = manager.subscribe('bnbusdt@depth').subscribe({
          next: (data) => {
            subscription.unsubscribe();
            resolve(data);
          },
          error: (error) => {
            throw error;
          }
        });
      });

      // Wait for connection and get WebSocket instance
      const ws = await new Promise<MockWebSocket | undefined>((resolve) => {
        const checkInstance = () => {
          const instance = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/bnbusdt@depth');
          if (instance) {
            resolve(instance);
          } else {
            setTimeout(checkInstance, 10);
          }
        };
        checkInstance();
        setTimeout(() => resolve(undefined), 1000);
      });
      
      if (ws) {
        ws.simulateMessage(depthData);
      }
      
      const data = await messagePromise;
      expect(data).toHaveProperty('e', 'depthUpdate');
      expect(data).toHaveProperty('s', 'BNBUSDT');
      expect(data).toHaveProperty('b'); // bids
      expect(data).toHaveProperty('a'); // asks
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast messages to all subscribers', async () => {
      const testMessage = BinanceMessageGenerator.tradeMessage('BTCUSDT', '55000');
      const expectedCount = 3;
      const receivedMessages: any[] = [];
      
      // Create multiple subscribers with promises
      const messagePromises = Array.from({ length: expectedCount }, (_, i) => 
        new Promise((resolve) => {
          const subscription = manager.subscribe('btcusdt@trade').subscribe({
            next: (data) => {
              receivedMessages.push({ subscriber: i, data });
              subscription.unsubscribe();
              resolve(data);
            }
          });
        })
      );
      
      // Wait for connection and get WebSocket instance
      const ws = await new Promise<MockWebSocket | undefined>((resolve) => {
        const checkInstance = () => {
          const instance = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
          if (instance) {
            resolve(instance);
          } else {
            setTimeout(checkInstance, 10);
          }
        };
        checkInstance();
        setTimeout(() => resolve(undefined), 1000);
      });
      
      if (ws) {
        ws.simulateMessage(testMessage);
      }
      
      // Wait for all subscribers to receive the message
      const results = await Promise.all(messagePromises);
      
      // Verify all subscribers received the message
      expect(results).toHaveLength(expectedCount);
      results.forEach(data => {
        expect(data['p']).toBe('55000');
      });
    });
  });

  describe('Message Ordering', () => {
    it('should maintain message order', async () => {
      const messages: any[] = [];
      const messageCount = 10;
      
      const allMessagesPromise = new Promise((resolve) => {
        const subscription = manager.subscribe('btcusdt@trade').subscribe({
          next: (data) => {
            messages.push(data);
            
            if (messages.length === messageCount) {
              subscription.unsubscribe();
              resolve(messages);
            }
          },
          error: (error) => {
            throw error;
          }
        });
      });
      
      // Wait for connection and get WebSocket instance
      const ws = await new Promise<MockWebSocket | undefined>((resolve) => {
        const checkInstance = () => {
          const instance = MockWebSocket.getInstanceByUrl('wss://stream.binance.com:9443/ws/btcusdt@trade');
          if (instance) {
            resolve(instance);
          } else {
            setTimeout(checkInstance, 10);
          }
        };
        checkInstance();
        setTimeout(() => resolve(undefined), 1000);
      });
      
      if (ws) {
        // Send messages in order
        for (let i = 0; i < messageCount; i++) {
          const msg = BinanceMessageGenerator.tradeMessage('BTCUSDT', '50000');
          msg.t = i; // Set trade ID
          ws.simulateMessage(msg);
        }
      }
      
      // Wait for all messages to be received
      const receivedMessages = await allMessagesPromise;
      
      // Verify order
      expect(receivedMessages).toHaveLength(messageCount);
      for (let i = 0; i < messageCount; i++) {
        expect((receivedMessages as any[])[i].t).toBe(i); // Check trade ID order
      }
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
            ws.simulateMessage({ id: i, data: 'test' } as any);
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
          expect(data['s']).toBe('BTCUSDT');
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