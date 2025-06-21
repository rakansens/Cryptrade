import { ConnectionManager } from '@/lib/ws/connection-manager';
import { WSManager } from '@/lib/ws/WSManager';
import { logger } from '@/lib/utils/logger';
import type { WSMessage } from '@/lib/ws/types';

// Mock dependencies
jest.mock('@/lib/ws/WSManager');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('WebSocket Connection Manager', () => {
  let connectionManager: ConnectionManager;
  let mockWSManager: jest.Mocked<WSManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WSManager
    mockWSManager = {
      subscribe: jest.fn(),
      getActiveStreams: jest.fn(),
      getMetrics: jest.fn(),
      getExtendedMetrics: jest.fn(),
      getConnectionState: jest.fn(),
      destroy: jest.fn()
    } as any;

    jest.mocked(WSManager).mockImplementation(() => mockWSManager);
    
    connectionManager = new ConnectionManager({
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      messageQueueSize: 100
    });
  });

  afterEach(() => {
    connectionManager.destroy();
  });

  describe('Connection Management', () => {
    it('should establish connection to stream', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn()
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);

      expect(mockWSManager.subscribe).toHaveBeenCalledWith(streamId);
      expect(connectionManager.isConnected(streamId)).toBe(true);
    });

    it('should handle multiple stream connections', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn()
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streams = ['btcusdt@kline_1h', 'ethusdt@kline_1h', 'bnbusdt@kline_1h'];
      
      await Promise.all(streams.map(stream => connectionManager.connect(stream)));

      expect(mockWSManager.subscribe).toHaveBeenCalledTimes(3);
      streams.forEach(stream => {
        expect(connectionManager.isConnected(stream)).toBe(true);
      });
    });

    it('should disconnect from stream', async () => {
      const unsubscribeMock = jest.fn();
      const mockObservable = {
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: unsubscribeMock
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);
      
      connectionManager.disconnect(streamId);

      expect(unsubscribeMock).toHaveBeenCalled();
      expect(connectionManager.isConnected(streamId)).toBe(false);
    });

    it('should handle connection errors', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          setTimeout(() => {
            observer.error(new Error('Connection failed'));
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      
      await expect(connectionManager.connect(streamId)).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection error'),
        expect.any(Object)
      );
    });
  });

  describe('Message Handling', () => {
    it('should process incoming messages', async () => {
      const messages: WSMessage[] = [];
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          // Simulate incoming messages
          setTimeout(() => {
            observer.next({ e: 'kline', s: 'BTCUSDT', k: { c: '50000' } });
            observer.next({ e: 'kline', s: 'BTCUSDT', k: { c: '50100' } });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      connectionManager.onMessage(streamId, (msg) => {
        messages.push(msg);
      });

      await connectionManager.connect(streamId);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ e: 'kline', s: 'BTCUSDT', k: { c: '50000' } });
      expect(messages[1]).toEqual({ e: 'kline', s: 'BTCUSDT', k: { c: '50100' } });
    });

    it('should queue messages when disconnected', async () => {
      const streamId = 'btcusdt@kline_1h';
      
      // Send messages before connection
      connectionManager.send(streamId, { action: 'subscribe', symbol: 'BTCUSDT' });
      connectionManager.send(streamId, { action: 'subscribe', symbol: 'ETHUSDT' });

      expect(connectionManager.getQueuedMessages(streamId)).toBe(2);

      // Connect and verify messages are sent
      const sentMessages: any[] = [];
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          return {
            unsubscribe: jest.fn(),
            next: (msg: any) => sentMessages.push(msg)
          };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      await connectionManager.connect(streamId);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(connectionManager.getQueuedMessages(streamId)).toBe(0);
    });

    it('should handle message queue overflow', () => {
      const streamId = 'btcusdt@kline_1h';
      
      // Fill queue beyond capacity
      for (let i = 0; i < 150; i++) {
        connectionManager.send(streamId, { id: i });
      }

      // Should only keep last 100 messages (based on config)
      expect(connectionManager.getQueuedMessages(streamId)).toBe(100);
    });

    it('should broadcast messages to multiple listeners', async () => {
      const listeners = [jest.fn(), jest.fn(), jest.fn()];
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          setTimeout(() => {
            observer.next({ e: 'trade', s: 'BTCUSDT', p: '50000' });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@trade';
      
      listeners.forEach(listener => {
        connectionManager.onMessage(streamId, listener);
      });

      await connectionManager.connect(streamId);
      await new Promise(resolve => setTimeout(resolve, 50));

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledWith({ e: 'trade', s: 'BTCUSDT', p: '50000' });
      });
    });
  });

  describe('Heartbeat and Health Checks', () => {
    it('should send heartbeat messages', async () => {
      jest.useFakeTimers();
      
      const sentMessages: any[] = [];
      const mockObservable = {
        subscribe: jest.fn().mockImplementation(() => {
          return {
            unsubscribe: jest.fn(),
            next: (msg: any) => sentMessages.push(msg)
          };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);

      // Fast-forward time to trigger heartbeat
      jest.advanceTimersByTime(30000);

      const heartbeatMessages = sentMessages.filter(msg => msg.ping !== undefined);
      expect(heartbeatMessages.length).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('should detect stale connections', async () => {
      jest.useFakeTimers();
      
      const mockObservable = {
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn()
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);

      // Simulate no messages for extended period
      jest.advanceTimersByTime(120000); // 2 minutes

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Connection appears stale'),
        expect.any(Object)
      );

      jest.useRealTimers();
    });

    it('should handle heartbeat responses', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          // Simulate pong response
          setTimeout(() => {
            observer.next({ pong: Date.now() });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);

      await new Promise(resolve => setTimeout(resolve, 50));

      const health = connectionManager.getConnectionHealth(streamId);
      expect(health.lastPong).toBeGreaterThan(0);
      expect(health.isHealthy).toBe(true);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt automatic reconnection', async () => {
      let connectionAttempts = 0;
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          connectionAttempts++;
          if (connectionAttempts === 1) {
            // First connection fails
            setTimeout(() => observer.error(new Error('Connection lost')), 10);
          } else {
            // Subsequent connection succeeds
            setTimeout(() => observer.next({ connected: true }), 10);
          }
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      
      try {
        await connectionManager.connect(streamId);
      } catch (error) {
        // Expected error on first attempt
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(connectionAttempts).toBeGreaterThan(1);
      expect(connectionManager.isConnected(streamId)).toBe(true);
    });

    it('should respect max reconnection attempts', async () => {
      let connectionAttempts = 0;
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          connectionAttempts++;
          setTimeout(() => observer.error(new Error('Connection failed')), 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      
      try {
        await connectionManager.connect(streamId);
      } catch (error) {
        // Expected
      }

      // Wait for all reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(connectionAttempts).toBeLessThanOrEqual(6); // Initial + 5 retries
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Max reconnection attempts reached'),
        expect.any(Object)
      );
    });

    it('should reset reconnection count on successful connection', async () => {
      let connectionAttempts = 0;
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          connectionAttempts++;
          if (connectionAttempts <= 2) {
            setTimeout(() => observer.error(new Error('Connection failed')), 10);
          } else if (connectionAttempts === 3) {
            // Success on third attempt
            setTimeout(() => observer.next({ connected: true }), 10);
          } else {
            // Fail again after success
            setTimeout(() => observer.error(new Error('Connection lost again')), 10);
          }
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      
      try {
        await connectionManager.connect(streamId);
      } catch (error) {
        // Expected
      }

      // Wait for reconnections
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Should continue attempting after successful connection
      expect(connectionAttempts).toBeGreaterThan(3);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all connections on destroy', async () => {
      const unsubscribeMocks = [jest.fn(), jest.fn(), jest.fn()];
      let index = 0;
      
      const mockObservable = {
        subscribe: jest.fn().mockImplementation(() => {
          return { unsubscribe: unsubscribeMocks[index++] };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streams = ['stream1', 'stream2', 'stream3'];
      await Promise.all(streams.map(stream => connectionManager.connect(stream)));

      connectionManager.destroy();

      unsubscribeMocks.forEach(mock => {
        expect(mock).toHaveBeenCalled();
      });
      expect(mockWSManager.destroy).toHaveBeenCalled();
    });

    it('should remove message listeners on cleanup', async () => {
      const listener = jest.fn();
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          setTimeout(() => {
            observer.next({ test: 'message' });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      connectionManager.onMessage(streamId, listener);
      
      await connectionManager.connect(streamId);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Remove listener and send another message
      connectionManager.offMessage(streamId, listener);
      
      const mockObservable2 = {
        subscribe: jest.fn().mockImplementation((observer) => {
          setTimeout(() => {
            observer.next({ test: 'message2' });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable2 as any);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Listener should not be called again
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection State Management', () => {
    it('should track connection states accurately', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn()
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      
      expect(connectionManager.getConnectionState(streamId)).toBe('disconnected');
      
      const connectPromise = connectionManager.connect(streamId);
      expect(connectionManager.getConnectionState(streamId)).toBe('connecting');
      
      await connectPromise;
      expect(connectionManager.getConnectionState(streamId)).toBe('connected');
      
      connectionManager.disconnect(streamId);
      expect(connectionManager.getConnectionState(streamId)).toBe('disconnected');
    });

    it('should provide connection statistics', async () => {
      const mockObservable = {
        subscribe: jest.fn().mockImplementation((observer) => {
          // Send some messages
          setTimeout(() => {
            observer.next({ e: 'kline', s: 'BTCUSDT' });
            observer.next({ e: 'kline', s: 'BTCUSDT' });
            observer.next({ e: 'kline', s: 'BTCUSDT' });
          }, 10);
          return { unsubscribe: jest.fn() };
        })
      };
      mockWSManager.subscribe.mockReturnValue(mockObservable as any);

      const streamId = 'btcusdt@kline_1h';
      await connectionManager.connect(streamId);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = connectionManager.getConnectionStats(streamId);
      expect(stats.messagesReceived).toBe(3);
      expect(stats.connectionTime).toBeGreaterThan(0);
      expect(stats.reconnectCount).toBe(0);
    });
  });
});