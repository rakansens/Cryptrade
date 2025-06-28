import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamBase } from '@/hooks/shared/useStreamBase';

// Mock logger
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
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose(new CloseEvent('close'));
    }, 10);
  }

  mockMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  mockError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    if (this.onclose) this.onclose(new Event('close'));
  }

  mockMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  mockError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Set up mocks
(global as any).WebSocket = MockWebSocket;
(global as any).EventSource = MockEventSource;

describe('useStreamBase', () => {
  const defaultConfig = {
    hookName: 'useStreamBase-test',
    connectionType: 'websocket' as const,
    autoConnect: false,
    logLevel: 'info' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useStreamBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.getConnectionStatus()).toBe('disconnected');
      expect(result.current.isConnected()).toBe(false);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-stream',
        connectionType: 'sse' as const,
        autoConnect: true,
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useStreamBase(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('WebSocket connection', () => {
    it('should connect to WebSocket', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      await waitFor(() => {
        expect(result.current.getConnectionStatus()).toBe('connected');
        expect(result.current.isConnected()).toBe(true);
      });
    });

    it('should handle WebSocket connection errors', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      // Simulate connection error
      await act(async () => {
        const ws = (result.current as any).connection as MockWebSocket;
        ws.mockError();
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useStreamBase-test] Connection error',
        expect.any(Object)
      );
    });

    it('should handle WebSocket messages', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      const mockHandler = jest.fn();
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
        result.current.onMessage(mockHandler);
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      const testData = { test: 'message' };
      
      act(() => {
        const ws = (result.current as any).connection as MockWebSocket;
        ws.mockMessage(testData);
      });
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should send WebSocket messages', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      const testMessage = { type: 'test', data: 'hello' };
      
      expect(() => {
        result.current.send(testMessage);
      }).not.toThrow();
    });
  });

  describe('SSE connection', () => {
    it('should connect to SSE', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'sse'
      }));
      
      await act(async () => {
        await result.current.connect('http://localhost:3000/events');
      });
      
      await waitFor(() => {
        expect(result.current.getConnectionStatus()).toBe('connected');
        expect(result.current.isConnected()).toBe(true);
      });
    });

    it('should handle SSE messages', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'sse'
      }));
      
      const mockHandler = jest.fn();
      
      await act(async () => {
        await result.current.connect('http://localhost:3000/events');
        result.current.onMessage(mockHandler);
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      const testData = { test: 'sse-message' };
      
      act(() => {
        const sse = (result.current as any).connection as MockEventSource;
        sse.mockMessage(testData);
      });
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle SSE connection errors', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'sse'
      }));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.connect('http://localhost:3000/events');
      });
      
      await act(async () => {
        const sse = (result.current as any).connection as MockEventSource;
        sse.mockError();
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useStreamBase-test] Connection error',
        expect.any(Object)
      );
    });
  });

  describe('custom connection', () => {
    it('should handle custom connection type', () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'custom'
      }));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.getConnectionStatus()).toBe('disconnected');
    });

    it('should allow setting custom connection status', () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'custom'
      }));
      
      act(() => {
        result.current.updateConnectionStatus('connected');
      });
      
      expect(result.current.getConnectionStatus()).toBe('connected');
      expect(result.current.isConnected()).toBe(true);
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on disconnect', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket',
        maxReconnectAttempts: 3,
        reconnectInterval: 100
      }));
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      // Simulate disconnect
      act(() => {
        const ws = (result.current as any).connection as MockWebSocket;
        ws.close();
      });
      
      await waitFor(() => {
        expect(result.current.getConnectionStatus()).toBe('reconnecting');
      }, { timeout: 200 });
    });

    it('should stop reconnecting after max attempts', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket',
        maxReconnectAttempts: 1,
        reconnectInterval: 50
      }));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      // Simulate disconnect and failed reconnection
      act(() => {
        const ws = (result.current as any).connection as MockWebSocket;
        ws.close();
      });
      
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[useStreamBase-test] Max reconnection attempts reached',
          expect.any(Object)
        );
      }, { timeout: 300 });
    });
  });

  describe('message handling', () => {
    it('should handle multiple message handlers', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
        result.current.onMessage(mockHandler1);
        result.current.onMessage(mockHandler2);
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      const testData = { test: 'multi-handler' };
      
      act(() => {
        const ws = (result.current as any).connection as MockWebSocket;
        ws.mockMessage(testData);
      });
      
      expect(mockHandler1).toHaveBeenCalledWith(testData);
      expect(mockHandler2).toHaveBeenCalledWith(testData);
    });

    it('should handle message parsing errors gracefully', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      const { logger } = require('@/lib/utils/logger');
      
      const mockHandler = jest.fn();
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
        result.current.onMessage(mockHandler);
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      // Send invalid JSON
      act(() => {
        const ws = (result.current as any).connection as MockWebSocket;
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', { data: 'invalid json' }));
        }
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useStreamBase-test] Error parsing message',
        expect.any(Object)
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should disconnect and cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
      
      unmount();
      
      expect(result.current.isMounted()).toBe(false);
      expect(result.current.isConnected()).toBe(false);
    });

    it('should clear message handlers on cleanup', async () => {
      const { result, unmount } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      
      const mockHandler = jest.fn();
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
        result.current.onMessage(mockHandler);
      });
      
      unmount();
      
      // Message handlers should be cleared
      expect((result.current as any).messageHandlers?.size || 0).toBe(0);
    });
  });

  describe('logging', () => {
    it('should log connection events', async () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        connectionType: 'websocket'
      }));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[useStreamBase-test] Connecting to ws://localhost:8080'
      );
      
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[useStreamBase-test] Connected successfully'
        );
      });
    });

    it('should use custom log level', () => {
      const { result } = renderHook(() => useStreamBase({
        ...defaultConfig,
        logLevel: 'debug'
      }));
      
      result.current.safeLog('debug', 'Debug message');
      
      const { logger } = require('@/lib/utils/logger');
      expect(logger.debug).toHaveBeenCalledWith('[useStreamBase-test] Debug message');
    });
  });

  describe('edge cases', () => {
    it('should handle connection without URL', async () => {
      const { result } = renderHook(() => useStreamBase(defaultConfig));
      
      await expect(result.current.connect('')).rejects.toThrow();
    });

    it('should handle multiple connection attempts', async () => {
      const { result } = renderHook(() => useStreamBase(defaultConfig));
      
      // First connection
      await act(async () => {
        await result.current.connect('ws://localhost:8080');
      });
      
      // Second connection should replace the first
      await act(async () => {
        await result.current.connect('ws://localhost:8081');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected()).toBe(true);
      });
    });

    it('should handle sending messages when not connected', () => {
      const { result } = renderHook(() => useStreamBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.send({ test: 'message' });
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[useStreamBase-test] Cannot send message: not connected'
      );
    });
  });
});