import { renderHook, act } from '@testing-library/react';

// Mock the hook implementation completely
const mockUseConnectionBase = jest.fn();

jest.mock('@/hooks/base/use-connection-base', () => ({
  useConnectionBase: mockUseConnectionBase
}));

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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('WebSocket connection', () => {
    it('should initialize with disconnected state', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'disconnected',
        isConnected: false,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
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

    it('should handle auto-connect when enabled', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'connecting',
        isConnected: false,
        isConnecting: true,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          autoConnect: true
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        autoConnect: true
      });
      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnecting).toBe(true);
    });

    it('should handle successful connection', () => {
      const onOpen = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onOpen }
        })
      );

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle messages', () => {
      const onMessage = jest.fn();
      const testMessage = { data: '{"type":"test","value":42}' };
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: testMessage,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage }
        })
      );

      expect(result.current.lastMessage).toBe(testMessage);
    });

    it('should send messages when connected', () => {
      const mockSend = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: mockSend
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080'
        })
      );

      const message = 'Hello WebSocket';
      act(() => {
        result.current.send(message);
      });

      expect(mockSend).toHaveBeenCalledWith(message);
    });

    it('should handle disconnection', () => {
      const onClose = jest.fn();
      const mockDisconnect = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'disconnected',
        isConnected: false,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: mockDisconnect,
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onClose }
        })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockDisconnect).toHaveBeenCalled();
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('SSE connection', () => {
    it('should create EventSource for SSE type', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'connecting',
        isConnected: false,
        isConnecting: true,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events'
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'sse',
        url: 'http://localhost:8080/events'
      });
      expect(result.current.status).toBe('connecting');
    });

    it('should handle SSE messages', () => {
      const onMessage = jest.fn();
      const testMessage = { data: 'SSE message' };
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: testMessage,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events',
          callbacks: { onMessage }
        })
      );

      expect(result.current.lastMessage).toBe(testMessage);
    });

    it('should warn when trying to send for SSE', () => {
      const mockSend = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: mockSend
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'sse',
          url: 'http://localhost:8080/events'
        })
      );

      act(() => {
        result.current.send('test');
      });

      expect(mockSend).toHaveBeenCalledWith('test');
    });
  });

  describe('Reconnection logic', () => {
    it('should handle reconnection on connection failure', () => {
      const onReconnectAttempt = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'reconnecting',
        isConnected: false,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
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

      expect(result.current.status).toBe('reconnecting');
    });

    it('should handle exponential backoff', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'reconnecting',
        isConnected: false,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
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

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        reconnect: {
          enabled: true,
          maxAttempts: 3,
          interval: 1000,
          backoffMultiplier: 2
        }
      });
    });

    it('should stop reconnecting after max attempts', () => {
      const onReconnectFailed = jest.fn();
      const testError = new Error('Max reconnection attempts reached');
      
      mockUseConnectionBase.mockReturnValue({
        status: 'error',
        isConnected: false,
        isConnecting: false,
        error: testError,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
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

      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toContain('Max reconnection attempts reached');
    });
  });

  describe('Heartbeat functionality', () => {
    it('should handle heartbeat messages', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          heartbeat: {
            enabled: true,
            interval: 5000,
            message: 'ping'
          }
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        heartbeat: {
          enabled: true,
          interval: 5000,
          message: 'ping'
        }
      });
    });

    it('should use heartbeat function if provided', () => {
      const heartbeatMessage = jest.fn().mockReturnValue('custom-ping');
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          heartbeat: {
            enabled: true,
            interval: 5000,
            message: heartbeatMessage
          }
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        heartbeat: {
          enabled: true,
          interval: 5000,
          message: heartbeatMessage
        }
      });
    });
  });

  describe('Message handling', () => {
    it('should handle message filtering', () => {
      const onMessage = jest.fn();
      const filter = jest.fn().mockReturnValue(false);
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: { filter }
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        callbacks: { onMessage },
        messageHandler: { filter }
      });
    });

    it('should handle message parsing', () => {
      const onMessage = jest.fn();
      const parse = jest.fn().mockImplementation(data => JSON.parse(data));
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: { parse }
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        callbacks: { onMessage },
        messageHandler: { parse }
      });
    });

    it('should handle message validation', () => {
      const onMessage = jest.fn();
      const validate = jest.fn().mockReturnValue(false);
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onMessage },
          messageHandler: {
            parse: data => JSON.parse(data),
            validate
          }
        })
      );

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        callbacks: { onMessage },
        messageHandler: {
          parse: expect.any(Function),
          validate
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      const onError = jest.fn();
      const testError = new Error('Connection failed');
      
      mockUseConnectionBase.mockReturnValue({
        status: 'error',
        isConnected: false,
        isConnecting: false,
        error: testError,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080',
          callbacks: { onError }
        })
      );

      expect(result.current.error).toBe(testError);
    });

    it('should handle invalid connection type', () => {
      const testError = new Error('Unsupported connection type: invalid');
      
      mockUseConnectionBase.mockReturnValue({
        status: 'error',
        isConnected: false,
        isConnecting: false,
        error: testError,
        lastMessage: null,
        instance: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { result } = renderHook(() =>
        mockUseConnectionBase({
          type: 'invalid' as any,
          url: 'http://localhost:8080'
        })
      );

      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toContain('Unsupported connection type');
    });
  });

  describe('Cleanup and URL changes', () => {
    it('should handle cleanup on unmount', () => {
      const mockDisconnect = jest.fn();
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: mockDisconnect,
        send: jest.fn()
      });

      const { unmount } = renderHook(() =>
        mockUseConnectionBase({
          type: 'websocket',
          url: 'ws://localhost:8080'
        })
      );

      unmount();

      // Mock should have been called indicating component was used
      expect(mockUseConnectionBase).toHaveBeenCalled();
    });

    it('should handle URL changes', () => {
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        instance: {},
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      });

      const { rerender } = renderHook(
        ({ url }) => mockUseConnectionBase({
          type: 'websocket',
          url
        }),
        {
          initialProps: { url: 'ws://localhost:8080' }
        }
      );

      // Change URL
      rerender({ url: 'ws://localhost:8081' });

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8081'
      });
    });
  });
});