import { renderHook, act } from '@testing-library/react';
import { useConnectionBase } from '@/hooks/base/use-connection-base';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock cleanup base
jest.mock('@/hooks/shared/useCleanupBase', () => ({
  useCleanupBase: () => ({
    registerCleanupTask: jest.fn(),
    cleanupTimeout: jest.fn(),
    cleanupRef: jest.fn(),
    executeAllCleanupTasks: jest.fn()
  })
}));

// Mock dependency base
jest.mock('@/hooks/shared/useDependencyBase', () => ({
  useDependencyBase: () => ({
    mergedDependencies: []
  }),
  createCommonDependencyGroups: {
    options: jest.fn(),
    eventHandlers: jest.fn(),
    stateManagement: jest.fn()
  }
}));

describe('useConnectionBase', () => {
  let mockWebSocketInstances: any[] = [];
  let mockEventSourceInstances: any[] = [];
  let WebSocketMock: jest.Mock;
  let EventSourceMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockWebSocketInstances = [];
    mockEventSourceInstances = [];

    // Create WebSocket mock
    WebSocketMock = jest.fn().mockImplementation((url, protocols) => {
      const instance = {
        url,
        protocols,
        readyState: 0, // CONNECTING
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        mockOpen: function() {
          this.readyState = 1;
          this.onopen?.(new Event('open'));
        },
        mockClose: function(code = 1000, reason = '') {
          this.readyState = 3;
          const event = new CloseEvent('close', { code, reason, wasClean: code === 1000 });
          this.onclose?.(event);
        },
        mockMessage: function(data: any) {
          const event = new MessageEvent('message', {
            data: typeof data === 'string' ? data : JSON.stringify(data)
          });
          this.onmessage?.(event);
        },
        mockError: function() {
          this.onerror?.(new Event('error'));
        }
      };
      mockWebSocketInstances.push(instance);
      return instance;
    });

    WebSocketMock.CONNECTING = 0;
    WebSocketMock.OPEN = 1;
    WebSocketMock.CLOSING = 2;
    WebSocketMock.CLOSED = 3;

    // Create EventSource mock
    EventSourceMock = jest.fn().mockImplementation((url) => {
      const instance = {
        url,
        readyState: 0, // CONNECTING
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        mockOpen: function() {
          this.readyState = 1;
          this.onopen?.(new Event('open'));
        },
        mockMessage: function(data: any) {
          const event = new MessageEvent('message', {
            data: typeof data === 'string' ? data : JSON.stringify(data)
          });
          this.onmessage?.(event);
        },
        mockError: function() {
          this.readyState = 2;
          this.onerror?.(new Event('error'));
        }
      };
      mockEventSourceInstances.push(instance);
      return instance;
    });

    EventSourceMock.CONNECTING = 0;
    EventSourceMock.OPEN = 1;
    EventSourceMock.CLOSED = 2;

    // Replace globals
    (global as any).WebSocket = WebSocketMock;
    (global as any).EventSource = EventSourceMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('WebSocket connection', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          autoConnect: false
        })
      );

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.instance).toBeNull();
    });

    it('should auto-connect when enabled', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          autoConnect: true
        })
      );

      expect(WebSocketMock).toHaveBeenCalledWith('ws://localhost:8080', undefined);
      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnecting).toBe(true);
    });

    it('should handle successful connection', () => {
      const onOpen = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onOpen }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      expect(onOpen).toHaveBeenCalled();
      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle messages', () => {
      const onMessage = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      const testData = { type: 'test', value: 42 };
      act(() => {
        mockWebSocketInstances[0].mockMessage(testData);
      });

      expect(onMessage).toHaveBeenCalled();
      expect(result.current.lastMessage?.data).toBe(JSON.stringify(testData));
    });

    it('should send messages when connected', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080'
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      const message = 'Hello WebSocket';
      act(() => {
        result.current.send(message);
      });

      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith(message);
    });

    it('should handle disconnection', () => {
      const onClose = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onClose }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('SSE connection', () => {
    it('should create EventSource for SSE type', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events'
        })
      );

      expect(EventSourceMock).toHaveBeenCalledWith('http://localhost:8080/events');
      expect(result.current.status).toBe('connecting');
    });

    it('should handle SSE messages', () => {
      const onMessage = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events',
          callbacks: { onMessage }
        })
      );

      act(() => {
        mockEventSourceInstances[0].mockOpen();
      });

      const testData = 'SSE message';
      act(() => {
        mockEventSourceInstances[0].mockMessage(testData);
      });

      expect(onMessage).toHaveBeenCalled();
      expect(result.current.lastMessage?.data).toBe(testData);
    });

    it('should not support send for SSE', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events'
        })
      );

      act(() => {
        mockEventSourceInstances[0].mockOpen();
      });

      // SSE is read-only, send should log warning
      act(() => {
        result.current.send('test');
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Send is only available for WebSocket')
      );
    });
  });

  describe('Reconnection logic', () => {
    it('should reconnect on connection failure', () => {
      const onReconnectAttempt = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          reconnect: {
            enabled: true,
            maxAttempts: 3,
            interval: 1000
          },
          callbacks: { onReconnectAttempt }
        })
      );

      // Simulate connection failure
      act(() => {
        mockWebSocketInstances[0].mockClose(1006, 'Connection lost');
      });

      expect(result.current.status).toBe('reconnecting');

      // Fast forward to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(onReconnectAttempt).toHaveBeenCalledWith(1);
      expect(WebSocketMock).toHaveBeenCalledTimes(2); // Initial + reconnect
    });

    it('should apply exponential backoff', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          reconnect: {
            enabled: true,
            maxAttempts: 3,
            interval: 1000,
            backoffMultiplier: 2
          }
        })
      );

      // First failure
      act(() => {
        mockWebSocketInstances[0].mockClose(1006, 'Connection lost');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Second failure  
      act(() => {
        mockWebSocketInstances[1].mockClose(1006, 'Connection lost');
      });

      // Should wait 2000ms (1000 * 2)
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(WebSocketMock).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(WebSocketMock).toHaveBeenCalledTimes(3);
    });

    it('should stop reconnecting after max attempts', () => {
      const onReconnectFailed = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          reconnect: {
            enabled: true,
            maxAttempts: 2,
            interval: 100
          },
          callbacks: { onReconnectFailed }
        })
      );

      // Fail twice
      for (let i = 0; i < 2; i++) {
        act(() => {
          mockWebSocketInstances[i].mockClose(1006, 'Connection lost');
        });
        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      // Third failure should trigger onReconnectFailed
      act(() => {
        mockWebSocketInstances[2].mockClose(1006, 'Connection lost');
      });

      expect(onReconnectFailed).toHaveBeenCalled();
      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toContain('Max reconnection attempts reached');
    });
  });

  describe('Heartbeat functionality', () => {
    it('should send heartbeat messages', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          heartbeat: {
            enabled: true,
            interval: 5000,
            message: 'ping'
          }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      // Fast forward to trigger heartbeat
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith('ping');
    });

    it('should use heartbeat function if provided', () => {
      const heartbeatMessage = jest.fn().mockReturnValue('custom-ping');
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          heartbeat: {
            enabled: true,
            interval: 5000,
            message: heartbeatMessage
          }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(heartbeatMessage).toHaveBeenCalled();
      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith('custom-ping');
    });
  });

  describe('Message filtering and parsing', () => {
    it('should filter messages', () => {
      const onMessage = jest.fn();
      const filter = jest.fn().mockReturnValue(false);
      
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: { filter }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      act(() => {
        mockWebSocketInstances[0].mockMessage('filtered message');
      });

      expect(filter).toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it('should parse messages', () => {
      const onMessage = jest.fn();
      const parse = jest.fn().mockImplementation(data => JSON.parse(data));
      
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: { parse }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      const testData = { type: 'test', value: 42 };
      act(() => {
        mockWebSocketInstances[0].mockMessage(JSON.stringify(testData));
      });

      expect(parse).toHaveBeenCalledWith(JSON.stringify(testData));
      expect(onMessage).toHaveBeenCalled();
    });

    it('should validate parsed messages', () => {
      const onMessage = jest.fn();
      const validate = jest.fn().mockReturnValue(false);
      
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: {
            parse: data => JSON.parse(data),
            validate
          }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      act(() => {
        mockWebSocketInstances[0].mockMessage('{"type":"test"}');
      });

      expect(validate).toHaveBeenCalledWith({ type: 'test' });
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onError }
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockError();
      });

      expect(onError).toHaveBeenCalled();
      expect(result.current.error).not.toBeNull();
    });

    it('should handle invalid connection type', () => {
      const { result } = renderHook(() =>
        useConnectionBase({
          type: 'invalid' as any,
          url: 'http://localhost:8080'
        })
      );

      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toContain('Unsupported connection type');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() =>
        useConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080'
        })
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      unmount();

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
    });

    it('should handle URL changes', () => {
      const { rerender } = renderHook(
        ({ url }) => useConnectionBase({
          type: 'websocket',
          url
        }),
        {
          initialProps: { url: 'ws://localhost:8080' }
        }
      );

      act(() => {
        mockWebSocketInstances[0].mockOpen();
      });

      // Change URL
      rerender({ url: 'ws://localhost:8081' });

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(WebSocketMock).toHaveBeenCalledWith('ws://localhost:8081', undefined);
    });
  });
});