/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BinanceWebSocketManager, PriceUpdateCallback } from '../websocket-manager';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    MockWebSocket.instances.push(this);
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 10);
  }
  
  close() {
    this.readyState = 2; // CLOSING
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose({ 
          code: 1000, 
          reason: 'Normal closure', 
          wasClean: true,
          type: 'close'
        });
      }
    }, 10);
  }
  
  static instances: MockWebSocket[] = [];
  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

(global as any).WebSocket = MockWebSocket;

// Mock timers
jest.useFakeTimers();

describe('BinanceWebSocketManager', () => {
  let manager: BinanceWebSocketManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    MockWebSocket.clearInstances();
    manager = new BinanceWebSocketManager();
  });
  
  afterEach(() => {
    manager.closeAll();
    // Don't run all timers as it causes infinite loop with heartbeat
    jest.clearAllTimers();
  });

  describe('subscribe', () => {
    it('should create connection and subscribe to symbol', async () => {
      const callback: PriceUpdateCallback = jest.fn();
      const unsubscribe = manager.subscribe('BTCUSDT', callback);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Creating connection',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Subscribed to symbol',
        { symbol: 'BTCUSDT' }
      );
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should normalize symbol to uppercase', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('btcusdt', callback);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Subscribed to symbol',
        { symbol: 'BTCUSDT' }
      );
    });

    it('should reuse connection for multiple callbacks on same symbol', () => {
      const callback1: PriceUpdateCallback = jest.fn();
      const callback2: PriceUpdateCallback = jest.fn();
      
      manager.subscribe('ETHUSDT', callback1);
      manager.subscribe('ETHUSDT', callback2);
      
      // Should only create one connection
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toContain('ethusdt@trade');
    });

    it('should handle connection open event', async () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      // Wait for async connection
      jest.advanceTimersByTime(20);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Connection opened',
        { symbol: 'BTCUSDT' }
      );
      
      const status = manager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.subscribedSymbols.has('BTCUSDT')).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('should remove callback from subscriptions', () => {
      const callback: PriceUpdateCallback = jest.fn();
      const unsubscribe = manager.subscribe('BTCUSDT', callback);
      
      unsubscribe();
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Unsubscribed from symbol',
        { symbol: 'BTCUSDT' }
      );
    });

    it('should close connection when no callbacks remain', async () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      const closeSpy = jest.spyOn(ws, 'close');
      
      manager.unsubscribe('BTCUSDT', callback);
      
      expect(closeSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Connection closed',
        { symbol: 'BTCUSDT' }
      );
    });

    it('should not close connection if other callbacks exist', () => {
      const callback1: PriceUpdateCallback = jest.fn();
      const callback2: PriceUpdateCallback = jest.fn();
      
      manager.subscribe('BTCUSDT', callback1);
      manager.subscribe('BTCUSDT', callback2);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      const closeSpy = jest.spyOn(ws, 'close');
      
      manager.unsubscribe('BTCUSDT', callback1);
      
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should process trade data and notify callbacks', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      // Simulate trade message
      const tradeData = {
        e: 'trade',
        s: 'BTCUSDT',
        p: '45000.50',
        q: '0.5',
        T: Date.now(),
        m: false,
      };
      
      const ws = MockWebSocket.instances[0];
      if (ws.onmessage) {
        ws.onmessage({ data: JSON.stringify(tradeData), type: 'message' });
      }
      
      expect(callback).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        price: 45000.50,
        volume: 0.5,
        timestamp: tradeData.T,
      });
      
      const status = manager.getStatus();
      expect(status.lastUpdate).toBeGreaterThan(0);
    });

    it('should handle malformed messages', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      if (ws.onmessage) {
        ws.onmessage({ data: 'invalid json', type: 'message' });
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceWS] Failed to parse message',
        expect.objectContaining({ symbol: 'BTCUSDT' })
      );
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback: PriceUpdateCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      manager.subscribe('BTCUSDT', errorCallback);
      
      jest.advanceTimersByTime(20);
      
      const tradeData = {
        e: 'trade',
        s: 'BTCUSDT',
        p: '45000.50',
        q: '0.5',
        T: Date.now(),
        m: false,
      };
      
      const ws = MockWebSocket.instances[0];
      if (ws.onmessage) {
        ws.onmessage({ data: JSON.stringify(tradeData), type: 'message' });
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceWS] Callback error',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          error: 'Callback error',
        })
      );
    });
  });

  describe('connection management', () => {
    it('should handle connection close event', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      if (ws.onclose) {
        ws.onclose({ 
          code: 1006, 
          reason: 'Connection lost',
          wasClean: false,
          type: 'close'
        });
      }
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[BinanceWS] Connection closed',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          code: 1006,
          reason: 'Connection lost',
        })
      );
      
      const status = manager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.subscribedSymbols.has('BTCUSDT')).toBe(false);
    });

    it('should handle connection error event', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      if (ws.onerror) {
        ws.onerror({ type: 'error' });
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceWS] Connection error',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          message: 'WebSocket connection failed',
        })
      );
    });

    it('should handle connection creation errors', () => {
      // Mock WebSocket to throw on creation
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = jest.fn(() => {
        throw new Error('Connection refused');
      });
      
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceWS] Failed to create connection',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          error: 'Connection refused',
        })
      );
      
      (global as any).WebSocket = originalWebSocket;
    });
  });

  describe('reconnection', () => {
    it('should schedule reconnection on connection close', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      const ws = MockWebSocket.instances[0];
      ws.close();
      
      jest.advanceTimersByTime(20);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Scheduling reconnect',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          delay: 1000,
          attempt: 1,
        })
      );
    });

    it('should use exponential backoff for reconnections', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      // Simulate multiple reconnection attempts
      manager['status'].reconnectCount = 3;
      manager['scheduleReconnect']('BTCUSDT');
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Scheduling reconnect',
        expect.objectContaining({
          delay: 8000, // 1000 * 2^3
          attempt: 4,
        })
      );
    });

    it('should cap reconnection delay at maximum', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      // Simulate many reconnection attempts
      manager['status'].reconnectCount = 10;
      manager['scheduleReconnect']('BTCUSDT');
      
      expect(logger.info).toHaveBeenCalledWith(
        '[BinanceWS] Scheduling reconnect',
        expect.objectContaining({
          delay: 30000, // Max delay
        })
      );
    });

    it('should clear reconnect timeout on manual close', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      // Close connection to trigger reconnect
      const ws = MockWebSocket.instances[0];
      ws.close();
      jest.advanceTimersByTime(20);
      
      // Manually close before reconnect happens
      manager['closeConnection']('BTCUSDT');
      
      // Advance time past reconnect delay
      jest.advanceTimersByTime(2000);
      
      // Should not have created a new connection
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  describe('heartbeat monitoring', () => {
    it('should detect stale connections', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      // Set last update to old timestamp
      manager['status'].lastUpdate = Date.now() - 70000; // 70 seconds ago
      
      // Trigger heartbeat
      jest.advanceTimersByTime(30000);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[BinanceWS] Stale connections detected, reconnecting'
      );
    });

    it('should not reconnect fresh connections', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      jest.advanceTimersByTime(20);
      
      // Set recent last update
      manager['status'].lastUpdate = Date.now();
      
      // Trigger heartbeat
      jest.advanceTimersByTime(30000);
      
      expect(logger.warn).not.toHaveBeenCalledWith(
        '[BinanceWS] Stale connections detected, reconnecting'
      );
    });

    it('should clear heartbeat interval on closeAll', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      manager.closeAll();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current connection status', () => {
      const status = manager.getStatus();
      
      expect(status).toEqual({
        connected: false,
        subscribedSymbols: new Set(),
        lastUpdate: 0,
        reconnectCount: 0,
      });
    });

    it('should return copy of status to prevent external modification', () => {
      const status1 = manager.getStatus();
      const status2 = manager.getStatus();
      
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe('closeAll', () => {
    it('should close all connections and clear state', () => {
      const callback1: PriceUpdateCallback = jest.fn();
      const callback2: PriceUpdateCallback = jest.fn();
      
      manager.subscribe('BTCUSDT', callback1);
      manager.subscribe('ETHUSDT', callback2);
      
      jest.advanceTimersByTime(20);
      
      expect(MockWebSocket.instances).toHaveLength(2);
      
      manager.closeAll();
      
      expect(logger.info).toHaveBeenCalledWith('[BinanceWS] Closing all connections');
      
      MockWebSocket.instances.forEach(ws => {
        expect(ws.readyState).toBe(2); // CLOSING
      });
      
      const status = manager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.subscribedSymbols.size).toBe(0);
    });

    it('should clear all timeouts on closeAll', () => {
      const callback: PriceUpdateCallback = jest.fn();
      manager.subscribe('BTCUSDT', callback);
      
      // Trigger reconnect scheduling
      manager['scheduleReconnect']('BTCUSDT');
      
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      manager.closeAll();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid subscribe/unsubscribe', () => {
      const callback: PriceUpdateCallback = jest.fn();
      
      // Rapid subscribe/unsubscribe
      const unsubscribe = manager.subscribe('BTCUSDT', callback);
      unsubscribe();
      manager.subscribe('BTCUSDT', callback);
      
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('should handle multiple symbols simultaneously', () => {
      const btcCallback: PriceUpdateCallback = jest.fn();
      const ethCallback: PriceUpdateCallback = jest.fn();
      const bnbCallback: PriceUpdateCallback = jest.fn();
      
      manager.subscribe('BTCUSDT', btcCallback);
      manager.subscribe('ETHUSDT', ethCallback);
      manager.subscribe('BNBUSDT', bnbCallback);
      
      jest.advanceTimersByTime(20);
      
      expect(MockWebSocket.instances).toHaveLength(3);
      
      const status = manager.getStatus();
      expect(status.subscribedSymbols.size).toBe(3);
      expect(status.connected).toBe(true);
    });
  });

  describe('browser events', () => {
    it('should register beforeunload handler', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      // Re-import to trigger registration
      jest.resetModules();
      require('../websocket-manager');
      
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });
  });
});