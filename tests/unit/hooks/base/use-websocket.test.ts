import { renderHook, act } from '@testing-library/react-hooks';
import { useWebSocket } from '../../../../hooks/base/use-websocket';
import { logger } from '../../../../lib/utils/logger';

// Mock logger
jest.mock('../../../../lib/utils/logger');

describe('useWebSocket', () => {
  let mockWebSocket: any;
  let WebSocketSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.CONNECTING,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    };

    WebSocketSpy = jest.spyOn(global, 'WebSocket').mockImplementation(() => mockWebSocket);
  });

  afterEach(() => {
    jest.useRealTimers();
    WebSocketSpy.mockRestore();
  });

  describe('Initial state and connection', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      expect(result.current.readyState).toBe(WebSocket.CLOSED);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.webSocket).toBeNull();
    });

    it('should auto-connect when enabled', () => {
      renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      expect(WebSocketSpy).toHaveBeenCalledWith('ws://localhost:8080', undefined);
    });

    it('should support custom protocols', () => {
      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          protocols: ['v1', 'v2'],
          autoConnect: true,
        })
      );

      expect(WebSocketSpy).toHaveBeenCalledWith('ws://localhost:8080', ['v1', 'v2']);
    });

    it('should handle connection success', () => {
      const onOpen = jest.fn();
      const onReconnectSuccess = jest.fn();

      const { result } = renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onOpen,
          onReconnectSuccess,
          autoConnect: false,
        })
      );

      act(() => {
        result.current.connect();
      });

      // Simulate successful connection
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      expect(onOpen).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should prevent duplicate connections', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      // First connection
      act(() => {
        result.current.connect();
      });
      expect(WebSocketSpy).toHaveBeenCalledTimes(1);

      // Simulate connecting state
      act(() => {
        result.current.connect();
      });
      expect(WebSocketSpy).toHaveBeenCalledTimes(1); // No new connection

      // Simulate open connection
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        result.current.connect();
      });
      expect(WebSocketSpy).toHaveBeenCalledTimes(1); // Still no new connection
    });
  });

  describe('Message handling', () => {
    it('should handle incoming messages', () => {
      const onMessage = jest.fn();

      const { result } = renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onMessage,
          autoConnect: true,
        })
      );

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'update', value: 42 }),
      });

      act(() => {
        mockWebSocket.onmessage?.(messageEvent);
      });

      expect(onMessage).toHaveBeenCalledWith(messageEvent);
      expect(result.current.lastMessage).toBe(messageEvent);
    });

    it('should filter messages when filter function provided', () => {
      const onMessage = jest.fn();
      const filter = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        return data.type === 'important';
      };

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onMessage,
          filter,
          autoConnect: true,
        })
      );

      // Send unimportant message
      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ type: 'regular', value: 1 }),
        });
        mockWebSocket.onmessage?.(event);
      });
      expect(onMessage).not.toHaveBeenCalled();

      // Send important message
      act(() => {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ type: 'important', value: 2 }),
        });
        mockWebSocket.onmessage?.(event);
      });
      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it('should send messages when connected', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      act(() => {
        result.current.connect();
        mockWebSocket.readyState = WebSocket.OPEN;
      });

      act(() => {
        result.current.sendMessage('Hello, WebSocket!');
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('Hello, WebSocket!');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useWebSocket] Message sent',
        expect.any(Object)
      );
    });

    it('should not send messages when disconnected', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[useWebSocket] Cannot send message, WebSocket is not open',
        expect.any(Object)
      );
    });

    it('should support different message types', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
      });

      // String message
      act(() => {
        result.current.sendMessage('text message');
      });
      expect(mockWebSocket.send).toHaveBeenCalledWith('text message');

      // Blob message
      const blob = new Blob(['binary data']);
      act(() => {
        result.current.sendMessage(blob);
      });
      expect(mockWebSocket.send).toHaveBeenCalledWith(blob);

      // ArrayBuffer message
      const buffer = new ArrayBuffer(8);
      act(() => {
        result.current.sendMessage(buffer);
      });
      expect(mockWebSocket.send).toHaveBeenCalledWith(buffer);
    });
  });

  describe('Disconnection and cleanup', () => {
    it('should disconnect properly', () => {
      const onClose = jest.fn();

      const { result } = renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onClose,
          autoConnect: true,
        })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle connection close event', () => {
      const onClose = jest.fn();

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onClose,
          autoConnect: true,
        })
      );

      const closeEvent = new CloseEvent('close', {
        code: 1000,
        reason: 'Normal closure',
        wasClean: true,
      });

      act(() => {
        mockWebSocket.onclose?.(closeEvent);
      });

      expect(onClose).toHaveBeenCalledWith(closeEvent);
      expect(logger.info).toHaveBeenCalledWith(
        '[useWebSocket] Connection closed',
        expect.objectContaining({
          code: 1000,
          reason: 'Normal closure',
          wasClean: true,
        })
      );
    });

    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should clear event handlers before closing', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocket.onopen).toBeNull();
      expect(mockWebSocket.onclose).toBeNull();
      expect(mockWebSocket.onmessage).toBeNull();
      expect(mockWebSocket.onerror).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          onError,
          autoConnect: true,
        })
      );

      const errorEvent = new Event('error');

      act(() => {
        mockWebSocket.onerror?.(errorEvent);
      });

      expect(onError).toHaveBeenCalledWith(errorEvent);
      expect(result.current.error).toBe(errorEvent);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle WebSocket creation errors', () => {
      WebSocketSpy.mockImplementationOnce(() => {
        throw new Error('Failed to create WebSocket');
      });

      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      expect(result.current.error?.message).toBe('WebSocket creation failed');
      expect(result.current.isConnecting).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[useWebSocket] Failed to create WebSocket',
        expect.any(Object)
      );
    });
  });

  describe('Reconnection logic', () => {
    it('should attempt reconnection on failure', async () => {
      const onReconnectAttempt = jest.fn();

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          reconnect: true,
          reconnectInterval: 100,
          maxReconnectAttempts: 3,
          onReconnectAttempt,
          autoConnect: true,
        })
      );

      // Simulate connection close with error
      const closeEvent = new CloseEvent('close', {
        code: 1006,
        reason: 'Abnormal closure',
        wasClean: false,
      });

      act(() => {
        mockWebSocket.onclose?.(closeEvent);
      });

      expect(onReconnectAttempt).toHaveBeenCalledWith(1);

      // Fast forward to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(WebSocketSpy).toHaveBeenCalledTimes(2); // Initial + 1 reconnect
    });

    it('should use exponential backoff for reconnection', () => {
      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          reconnect: true,
          reconnectInterval: 1000,
          reconnectDecay: 2,
          maxReconnectAttempts: 3,
          autoConnect: true,
        })
      );

      // First reconnection attempt
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close', { code: 1006 }));
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useWebSocket] Scheduling reconnect',
        expect.objectContaining({ attempt: 1, timeout: 1000 })
      );

      // Simulate second failure
      act(() => {
        jest.advanceTimersByTime(1000);
        mockWebSocket.onclose?.(new CloseEvent('close', { code: 1006 }));
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useWebSocket] Scheduling reconnect',
        expect.objectContaining({ attempt: 2, timeout: 2000 })
      );
    });

    it('should respect max reconnection attempts', () => {
      const onReconnectFailed = jest.fn();

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          reconnect: true,
          reconnectInterval: 10,
          maxReconnectAttempts: 2,
          onReconnectFailed,
          autoConnect: true,
        })
      );

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        act(() => {
          mockWebSocket.onclose?.(new CloseEvent('close', { code: 1006 }));
          jest.advanceTimersByTime(10);
        });
      }

      expect(onReconnectFailed).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('[useWebSocket] Max reconnection attempts reached');
    });

    it('should use custom shouldReconnect logic', () => {
      const shouldReconnect = jest.fn((event: CloseEvent) => event.code !== 1000);

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          reconnect: true,
          shouldReconnect,
          autoConnect: true,
        })
      );

      // Normal closure - should not reconnect
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close', { code: 1000 }));
      });

      expect(shouldReconnect).toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Scheduling reconnect'),
        expect.any(Object)
      );

      // Abnormal closure - should reconnect
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close', { code: 1006 }));
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useWebSocket] Scheduling reconnect',
        expect.any(Object)
      );
    });

    it('should call onReconnectSuccess after successful reconnection', () => {
      const onReconnectSuccess = jest.fn();

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          reconnect: true,
          onReconnectSuccess,
          autoConnect: true,
        })
      );

      // Simulate failure then success
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close', { code: 1006 }));
      });

      // Fast forward and simulate successful reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      expect(onReconnectSuccess).toHaveBeenCalled();
    });
  });

  describe('Heartbeat functionality', () => {
    it('should send heartbeat messages when enabled', () => {
      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          heartbeat: true,
          heartbeatInterval: 1000,
          heartbeatMessage: 'ping',
          autoConnect: true,
        })
      );

      // Simulate successful connection
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      // Fast forward to trigger heartbeat
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('ping');
    });

    it('should support dynamic heartbeat messages', () => {
      let counter = 0;
      const heartbeatMessage = () => `ping-${++counter}`;

      renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          heartbeat: true,
          heartbeatInterval: 1000,
          heartbeatMessage,
          autoConnect: true,
        })
      );

      // Simulate successful connection
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      // Trigger multiple heartbeats
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockWebSocket.send).toHaveBeenCalledWith('ping-1');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockWebSocket.send).toHaveBeenCalledWith('ping-2');
    });

    it('should stop heartbeat on disconnect', () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: 'ws://localhost:8080',
          heartbeat: true,
          heartbeatInterval: 1000,
          autoConnect: true,
        })
      );

      // Connect and start heartbeat
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      // Disconnect
      act(() => {
        result.current.disconnect();
      });

      // Verify heartbeat doesn't send after disconnect
      mockWebSocket.send.mockClear();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('URL changes', () => {
    it('should reconnect when URL changes', () => {
      const { rerender } = renderHook(
        ({ url }) => useWebSocket({ url, autoConnect: true }),
        { initialProps: { url: 'ws://localhost:8080' } }
      );

      // Simulate connected state
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
      });

      // Change URL
      rerender({ url: 'ws://localhost:9090' });

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(WebSocketSpy).toHaveBeenCalledWith('ws://localhost:9090', undefined);
    });

    it('should not reconnect if URL remains the same', () => {
      const { rerender } = renderHook(
        ({ url }) => useWebSocket({ url, autoConnect: true }),
        { initialProps: { url: 'ws://localhost:8080' } }
      );

      const initialCallCount = WebSocketSpy.mock.calls.length;

      // Re-render with same URL
      rerender({ url: 'ws://localhost:8080' });

      expect(WebSocketSpy).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('State updates', () => {
    it('should update ready state periodically', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      expect(result.current.readyState).toBe(WebSocket.CONNECTING);

      // Simulate state change
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        jest.advanceTimersByTime(100);
      });

      expect(result.current.readyState).toBe(WebSocket.OPEN);
      expect(result.current.isConnected).toBe(true);
    });

    it('should clean up state interval on close', () => {
      renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Simulate connection close
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close'));
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});

describe('useMultiWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log warning about implementation needs', () => {
    const connections = [
      { id: 'conn1', url: 'ws://localhost:8080' },
      { id: 'conn2', url: 'ws://localhost:8081' },
    ];

    renderHook(() => useMultiWebSocket({ connections }));

    expect(logger.warn).toHaveBeenCalledWith(
      '[useMultiWebSocket] Multi-connection management needs custom implementation',
      expect.any(Object)
    );
  });
});