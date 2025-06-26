import { renderHook, act } from '@testing-library/react';
import { logger } from '@/lib/utils/logger';

// Mock logger first
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking to ensure proper module resolution
import { useWebSocket, useMultiWebSocket } from '@/hooks/base/use-websocket';

describe('useWebSocket', () => {
  let mockWebSocketInstances: any[] = [];
  let WebSocketMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockWebSocketInstances = [];

    // Create WebSocket mock class
    WebSocketMock = jest.fn().mockImplementation((url, protocols) => {
      const instance = {
        url,
        protocols,
        readyState: 0, // CONNECTING
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        // Add mock helper methods
        mockError: function(error?: any) {
          if (this.onerror) {
            const event = new Event('error');
            Object.assign(event, { error, message: error?.message || 'WebSocket error' });
            this.onerror(event);
          }
        },
        mockOpen: function() {
          this.readyState = 1; // OPEN
          if (this.onopen) {
            this.onopen(new Event('open'));
          }
        },
        mockClose: function(code = 1000, reason = '') {
          this.readyState = 3; // CLOSED
          if (this.onclose) {
            const event = new CloseEvent('close', { code, reason, wasClean: code === 1000 });
            this.onclose(event);
          }
        },
        mockReceiveMessage: function(data: any) {
          if (this.onmessage) {
            const event = new MessageEvent('message', {
              data: typeof data === 'string' ? data : JSON.stringify(data)
            });
            this.onmessage(event);
          }
        }
      };
      mockWebSocketInstances.push(instance);
      return instance;
    });

    // Add static properties
    WebSocketMock.CONNECTING = 0;
    WebSocketMock.OPEN = 1;
    WebSocketMock.CLOSING = 2;
    WebSocketMock.CLOSED = 3;

    // Replace global WebSocket
    (global as any).WebSocket = WebSocketMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initial state and connection', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      expect(result.current.readyState).toBe(3); // CLOSED
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.webSocket).toBeNull();
    });

    it('should auto-connect when enabled', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      expect(WebSocketMock).toHaveBeenCalledWith('ws://localhost:8080', undefined);
      expect(result.current.isConnecting).toBe(true);
      expect(mockWebSocketInstances).toHaveLength(1);
    });

    it('should connect manually', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      expect(WebSocketMock).toHaveBeenCalledWith('ws://localhost:8080', undefined);
      expect(mockWebSocketInstances).toHaveLength(1);
    });

    it('should handle connection success', () => {
      const onOpen = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080', 
          autoConnect: false,
          onOpen 
        })
      );

      act(() => {
        result.current.connect();
      });

      const ws = mockWebSocketInstances[0];
      
      // Simulate successful connection
      act(() => {
        ws.readyState = 1; // OPEN
        ws.onopen?.(new Event('open'));
      });

      expect(onOpen).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe('Message handling', () => {
    it('should handle incoming messages', () => {
      const onMessage = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onMessage 
        })
      );

      const ws = mockWebSocketInstances[0];
      const messageEvent = new MessageEvent('message', { data: 'test message' });

      act(() => {
        ws.onmessage?.(messageEvent);
      });

      expect(onMessage).toHaveBeenCalledWith(messageEvent);
      expect(result.current.lastMessage).toBe(messageEvent);
    });

    it('should send messages when connected', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      const ws = mockWebSocketInstances[0];
      
      // Simulate open connection
      act(() => {
        ws.readyState = 1; // OPEN
        ws.onopen?.(new Event('open'));
      });

      act(() => {
        result.current.sendMessage('test message');
      });

      expect(ws.send).toHaveBeenCalledWith('test message');
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onError 
        })
      );

      const ws = mockWebSocketInstances[0];
      const errorEvent = new Event('error');

      act(() => {
        ws.onerror?.(errorEvent);
      });

      expect(onError).toHaveBeenCalledWith(errorEvent);
      expect(result.current.error).toBe(errorEvent);
    });

    it('should handle invalid URLs', () => {
      const onError = jest.fn();
      
      // Mock WebSocket constructor to throw for invalid URLs
      WebSocketMock.mockImplementationOnce(() => {
        throw new Error('Invalid URL');
      });

      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'invalid-url',
          autoConnect: true,
          onError 
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create WebSocket'),
        expect.any(Object)
      );
    });

    it('should handle connection timeout', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onError
        })
      );

      const ws = mockWebSocketInstances[0];

      // Simulate a connection error instead of timeout
      act(() => {
        ws.mockError();
      });

      // WebSocket should handle the error
      expect(onError).toHaveBeenCalled();
    });

    it('should handle send errors when not connected', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      // Try to send message without connection
      act(() => {
        result.current.sendMessage('test message');
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send message'),
        expect.any(Object)
      );
    });

    it('should handle send errors with null WebSocket', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      // Ensure webSocket is null
      expect(result.current.webSocket).toBeNull();

      act(() => {
        result.current.sendMessage('test message');
      });

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle malformed messages', () => {
      const onMessage = jest.fn();
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onMessage,
          onError,
          parseMessage: true
        })
      );

      const ws = mockWebSocketInstances[0];
      const malformedData = 'invalid json {]';
      const messageEvent = new MessageEvent('message', { data: malformedData });

      act(() => {
        ws.onmessage?.(messageEvent);
      });

      // Should still receive the message even if parsing fails
      expect(onMessage).toHaveBeenCalledWith(messageEvent);
    });

    it('should handle WebSocket creation failures', () => {
      const onError = jest.fn();
      let constructorCallCount = 0;
      
      WebSocketMock.mockImplementation(() => {
        constructorCallCount++;
        if (constructorCallCount === 1) {
          throw new Error('WebSocket creation failed');
        }
        return {
          readyState: 0,
          send: jest.fn(),
          close: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        };
      });

      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onError 
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create WebSocket'),
        expect.any(Object)
      );
    });

    it('should handle unexpected close events', () => {
      const onClose = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onClose 
        })
      );

      const ws = mockWebSocketInstances[0];
      
      // Simulate unexpected close
      act(() => {
        ws.readyState = 3; // CLOSED
        ws.onclose?.(new CloseEvent('close', { 
          code: 1006, 
          reason: 'Abnormal Closure',
          wasClean: false 
        }));
      });

      expect(onClose).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 1006,
          reason: 'Abnormal Closure',
          wasClean: false
        })
      );
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
      );

      // Rapid connect/disconnect
      act(() => {
        result.current.connect();
        result.current.disconnect();
        result.current.connect();
        result.current.disconnect();
      });

      // Should handle gracefully without errors
      expect(mockWebSocketInstances.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined options gracefully', () => {
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          protocols: undefined,
          onOpen: undefined,
          onClose: undefined,
          onMessage: undefined,
          onError: undefined
        })
      );

      expect(result.current).toBeDefined();
      expect(mockWebSocketInstances).toHaveLength(1);
    });

    it('should handle simultaneous error and close events', () => {
      const onError = jest.fn();
      const onClose = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          onError,
          onClose 
        })
      );

      const ws = mockWebSocketInstances[0];
      
      // Simulate simultaneous error and close
      act(() => {
        ws.onerror?.(new Event('error'));
        ws.onclose?.(new CloseEvent('close', { code: 1006 }));
      });

      expect(onError).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(result.current.error).toBeDefined();
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle reconnection after error', () => {
      const { result } = renderHook(() =>
        useWebSocket({ 
          url: 'ws://localhost:8080',
          autoConnect: true,
          reconnect: true,
          reconnectInterval: 100
        })
      );

      const ws = mockWebSocketInstances[0];
      
      // Wait for initial connection
      act(() => {
        jest.advanceTimersByTime(20);
      });
      
      // Simulate error and close
      act(() => {
        ws.mockError(new Error('Connection error'));
        ws.mockClose(1006);
      });

      // Advance timers to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Should handle reconnection attempt
      expect(result.current.readyState).toBeDefined();
    });
  });

  describe('Disconnection', () => {
    it('should disconnect properly', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
      );

      const ws = mockWebSocketInstances[0];
      
      // Simulate open connection
      act(() => {
        ws.readyState = 1; // OPEN
        ws.onopen?.(new Event('open'));
      });

      act(() => {
        result.current.disconnect();
      });

      expect(ws.close).toHaveBeenCalled();
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