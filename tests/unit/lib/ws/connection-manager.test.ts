import { ConnectionManager } from '@/lib/ws/connection-manager';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock WebSocket
class MockWebSocket {
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  close = jest.fn();
  send = jest.fn();
  readyState: number;
  onopen = null;
  onclose = null;
  onmessage = null;
  onerror = null;
  
  constructor(public url: string) {
    this.readyState = WebSocket.OPEN;
  }
}

global.WebSocket = MockWebSocket as any;

describe('WebSocket Connection Manager', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    connectionManager = new ConnectionManager();
  });

  afterEach(() => {
    connectionManager.destroyAll();
    jest.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should create a new WebSocket connection', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      
      const ws = connectionManager.createConnection(id, url);
      
      expect(ws).toBeInstanceOf(MockWebSocket);
      expect(ws?.url).toBe(url);
      expect(logger.info).toHaveBeenCalledWith(
        '[ConnectionManager] Created connection',
        { id, url }
      );
    });

    it('should close existing connection when creating new one with same id', () => {
      const id = 'test-connection';
      const url1 = 'wss://example.com/stream1';
      const url2 = 'wss://example.com/stream2';
      
      const ws1 = connectionManager.createConnection(id, url1);
      const ws2 = connectionManager.createConnection(id, url2);
      
      expect(ws1?.close).toHaveBeenCalled();
      expect(ws2).toBeInstanceOf(MockWebSocket);
    });

    it('should close connection properly', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      
      const ws = connectionManager.createConnection(id, url);
      connectionManager.closeConnection(id);
      
      expect(ws?.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[ConnectionManager] Closing connection',
        { id }
      );
    });

    it('should handle closing non-existent connection', () => {
      // Should not throw
      expect(() => {
        connectionManager.closeConnection('non-existent');
      }).not.toThrow();
    });
  });

  describe('Event Listener Management', () => {
    it('should add event listeners to WebSocket', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const handler = jest.fn();
      
      const ws = connectionManager.createConnection(id, url);
      connectionManager.addEventListener(id, 'message', handler);
      
      expect(ws?.addEventListener).toHaveBeenCalledWith('message', handler);
    });

    it('should not add listener if connection does not exist', () => {
      const handler = jest.fn();
      
      // Should not throw
      expect(() => {
        connectionManager.addEventListener('non-existent', 'message', handler);
      }).not.toThrow();
    });

    it('should remove event listeners on close', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      const ws = connectionManager.createConnection(id, url);
      connectionManager.addEventListener(id, 'message', handler1);
      connectionManager.addEventListener(id, 'error', handler2);
      
      connectionManager.closeConnection(id);
      
      expect(ws?.removeEventListener).toHaveBeenCalledWith('message', handler1);
      expect(ws?.removeEventListener).toHaveBeenCalledWith('error', handler2);
      expect(ws?.onopen).toBeNull();
      expect(ws?.onclose).toBeNull();
      expect(ws?.onmessage).toBeNull();
      expect(ws?.onerror).toBeNull();
    });
  });

  describe('Timers and Intervals', () => {
    it('should set reconnect timeout', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.setReconnectTimeout(id, callback, 1000);
      
      expect(callback).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clear existing timeout when setting new one', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.setReconnectTimeout(id, callback1, 1000);
      connectionManager.setReconnectTimeout(id, callback2, 2000);
      
      jest.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should set heartbeat interval', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.setHeartbeatInterval(id, callback, 5000);
      
      jest.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should clear heartbeat interval on close', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.setHeartbeatInterval(id, callback, 5000);
      
      jest.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      connectionManager.closeConnection(id);
      
      jest.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should not set timers for destroyed connections', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.closeConnection(id);
      
      connectionManager.setReconnectTimeout(id, callback, 1000);
      connectionManager.setHeartbeatInterval(id, callback, 5000);
      
      jest.advanceTimersByTime(10000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Pause and Resume', () => {
    it('should pause all connections', () => {
      const id1 = 'connection-1';
      const id2 = 'connection-2';
      const url = 'wss://example.com/stream';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      connectionManager.createConnection(id1, url);
      connectionManager.createConnection(id2, url);
      connectionManager.setHeartbeatInterval(id1, callback1, 1000);
      connectionManager.setHeartbeatInterval(id2, callback2, 1000);
      
      jest.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      
      connectionManager.pauseAll();
      
      jest.advanceTimersByTime(2000);
      // Callbacks should not be called after pause
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      
      expect(logger.info).toHaveBeenCalledWith('[ConnectionManager] Pausing all connections');
    });

    it('should resume all connections', () => {
      connectionManager.resumeAll();
      
      expect(logger.info).toHaveBeenCalledWith('[ConnectionManager] Resuming all connections');
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all connections on destroyAll', () => {
      const connections = [
        { id: 'conn-1', url: 'wss://example.com/stream1' },
        { id: 'conn-2', url: 'wss://example.com/stream2' },
        { id: 'conn-3', url: 'wss://example.com/stream3' }
      ];
      
      const websockets = connections.map(({ id, url }) => {
        return connectionManager.createConnection(id, url);
      });
      
      connectionManager.destroyAll();
      
      // All connections should be closed
      websockets.forEach(ws => {
        expect(ws?.close).toHaveBeenCalled();
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ConnectionManager] Destroying all connections',
        { count: 3 }
      );
    });

    it('should not create connections after destroyAll', () => {
      connectionManager.destroyAll();
      
      const ws = connectionManager.createConnection('test', 'wss://example.com');
      
      expect(ws).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        '[ConnectionManager] Manager is destroyed, not creating connection',
        { id: 'test' }
      );
    });

    it('should prevent duplicate destroyAll calls', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      
      const ws = connectionManager.createConnection(id, url);
      
      connectionManager.destroyAll();
      connectionManager.destroyAll(); // Second call
      
      // Close should only be called once
      expect(ws?.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection Statistics', () => {
    it('should provide connection statistics', () => {
      const connections = [
        { id: 'conn-1', url: 'wss://example.com/stream1' },
        { id: 'conn-2', url: 'wss://example.com/stream2' },
        { id: 'conn-3', url: 'wss://example.com/stream3' }
      ];
      
      connections.forEach(({ id, url }) => {
        connectionManager.createConnection(id, url);
      });
      
      // Set up some state
      connectionManager.setReconnectTimeout('conn-1', jest.fn(), 1000);
      connectionManager.setHeartbeatInterval('conn-2', jest.fn(), 5000);
      
      const stats = connectionManager.getStats();
      
      expect(stats.activeConnections).toBe(3); // All mocked as OPEN
      expect(stats.connections).toHaveLength(3);
      expect(stats.connections[0]).toMatchObject({
        id: 'conn-1',
        url: 'wss://example.com/stream1',
        readyState: WebSocket.OPEN,
        hasReconnectTimeout: true,
        hasHeartbeat: false
      });
      expect(stats.connections[1]).toMatchObject({
        id: 'conn-2',
        url: 'wss://example.com/stream2',
        readyState: WebSocket.OPEN,
        hasReconnectTimeout: false,
        hasHeartbeat: true
      });
    });

    it('should track connection ready states in stats', () => {
      // Create a new ConnectionManager instance for this test
      const testManager = new ConnectionManager();
      
      const connections = [
        { id: 'conn-1', url: 'wss://example.com/stream1', targetState: WebSocket.OPEN },
        { id: 'conn-2', url: 'wss://example.com/stream2', targetState: WebSocket.CLOSED },
        { id: 'conn-3', url: 'wss://example.com/stream3', targetState: WebSocket.CONNECTING }
      ];
      
      const websockets = connections.map(({ id, url, targetState }) => {
        const ws = testManager.createConnection(id, url) as MockWebSocket;
        if (ws) {
          ws.readyState = targetState;
        }
        return ws;
      });
      
      const stats = testManager.getStats();
      
      // Should have 3 connections total
      expect(stats.connections).toHaveLength(3);
      
      // Check each connection's state
      expect(stats.connections[0]).toMatchObject({
        id: 'conn-1',
        url: 'wss://example.com/stream1',
        readyState: WebSocket.OPEN
      });
      
      expect(stats.connections[1]).toMatchObject({
        id: 'conn-2',
        url: 'wss://example.com/stream2',
        readyState: WebSocket.CLOSED
      });
      
      expect(stats.connections[2]).toMatchObject({
        id: 'conn-3',
        url: 'wss://example.com/stream3',
        readyState: WebSocket.CONNECTING
      });
      
      // At least one connection should be active (OPEN)
      expect(stats.activeConnections).toBeGreaterThanOrEqual(1);
      
      // Cleanup
      testManager.destroyAll();
    });
  });

  describe('Browser Event Handlers', () => {
    let originalAddEventListener: any;
    let originalRemoveEventListener: any;
    let visibilityChangeHandler: any;

    beforeEach(() => {
      // Mock document properties
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
        configurable: true
      });
      
      // Store original methods
      originalAddEventListener = document.addEventListener;
      originalRemoveEventListener = document.removeEventListener;
      
      // Mock addEventListener to capture the visibility change handler
      document.addEventListener = jest.fn((event, handler) => {
        if (event === 'visibilitychange') {
          visibilityChangeHandler = handler;
        }
      });
      document.removeEventListener = jest.fn();
      
      // Re-create connectionManager to register handlers
      connectionManager.destroyAll();
      connectionManager = new ConnectionManager();
    });

    afterEach(() => {
      // Restore original methods
      document.addEventListener = originalAddEventListener;
      document.removeEventListener = originalRemoveEventListener;
    });

    it('should handle visibility changes', () => {
      const id = 'test-connection';
      const url = 'wss://example.com/stream';
      const callback = jest.fn();
      
      connectionManager.createConnection(id, url);
      connectionManager.setHeartbeatInterval(id, callback, 1000);
      
      expect(visibilityChangeHandler).toBeDefined();
      
      // Simulate page becoming hidden
      (document as any).hidden = true;
      visibilityChangeHandler();
      
      expect(logger.info).toHaveBeenCalledWith('[ConnectionManager] Pausing all connections');
      
      // Heartbeat should be cleared
      jest.advanceTimersByTime(2000);
      expect(callback).not.toHaveBeenCalled();
      
      // Simulate page becoming visible
      (document as any).hidden = false;
      visibilityChangeHandler();
      
      expect(logger.info).toHaveBeenCalledWith('[ConnectionManager] Resuming all connections');
    });
  });
});