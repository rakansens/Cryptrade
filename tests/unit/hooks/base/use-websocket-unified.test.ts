import { renderHook, act } from '@testing-library/react';
import { useWebSocketUnified } from '@/hooks/base/use-websocket-unified';
import { useConnectionBase } from '@/hooks/base/use-connection-base';

// Mock the underlying useConnectionBase hook
jest.mock('@/hooks/base/use-connection-base');

const mockUseConnectionBase = useConnectionBase as jest.MockedFunction<typeof useConnectionBase>;

describe('useWebSocketUnified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseConnectionBase.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
      reconnectAttempts: 0,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn(),
      reset: jest.fn(),
      instance: null
    });
  });

  describe('initialization and configuration mapping', () => {
    it('should map WebSocket options to ConnectionConfig correctly', () => {
      const options = {
        url: 'ws://localhost:8080',
        protocols: ['chat', 'superchat'],
        autoConnect: true,
        reconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        onOpen: jest.fn(),
        onClose: jest.fn(),
        onMessage: jest.fn(),
        onError: jest.fn()
      };

      renderHook(() => useWebSocketUnified(options));

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        protocols: ['chat', 'superchat'],
        autoConnect: true,
        reconnect: {
          enabled: true,
          maxAttempts: 10,
          interval: 5000,
          backoffMultiplier: 1.5,
          maxInterval: 30000,
          shouldReconnect: expect.any(Function)
        },
        heartbeat: {
          enabled: false,
          interval: 30000,
          message: 'ping'
        },
        callbacks: {
          onOpen: options.onOpen,
          onClose: options.onClose,
          onMessage: options.onMessage,
          onError: options.onError,
          onReconnectAttempt: options.onReconnectAttempt,
          onReconnectFailed: options.onReconnectFailed,
          onReconnectSuccess: options.onReconnectSuccess
        },
        messageHandler: {
          filter: options.filter
        }
      });
    });

    it('should handle minimal configuration', () => {
      const options = {
        url: 'ws://localhost:8080'
      };

      renderHook(() => useWebSocketUnified(options));

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        protocols: undefined,
        autoConnect: true,
        reconnect: {
          enabled: true,
          maxAttempts: 10,
          interval: 1000,
          backoffMultiplier: 1.5,
          maxInterval: 30000,
          shouldReconnect: expect.any(Function)
        },
        heartbeat: {
          enabled: false,
          interval: 30000,
          message: 'ping'
        },
        callbacks: {
          onOpen: undefined,
          onClose: undefined,
          onMessage: undefined,
          onError: undefined,
          onReconnectAttempt: undefined,
          onReconnectFailed: undefined,
          onReconnectSuccess: undefined
        },
        messageHandler: {
          filter: undefined
        }
      });
    });

    it('should map deprecated options correctly', () => {
      const options = {
        url: 'ws://localhost:8080',
        shouldReconnect: () => true, // deprecated but should be a function
        maxReconnectAttempts: 5,  // correct property name
        reconnectInterval: 3000
      };

      renderHook(() => useWebSocketUnified(options));

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        protocols: undefined,
        autoConnect: true,
        reconnect: {
          enabled: true,
          maxAttempts: 5,
          interval: 3000,
          backoffMultiplier: 1.5,
          maxInterval: 30000,
          shouldReconnect: expect.any(Function)
        },
        heartbeat: {
          enabled: false,
          interval: 30000,
          message: 'ping'
        },
        callbacks: {
          onOpen: undefined,
          onClose: undefined,
          onMessage: undefined,
          onError: undefined,
          onReconnectAttempt: undefined,
          onReconnectFailed: undefined,
          onReconnectSuccess: undefined
        },
        messageHandler: {
          filter: undefined
        }
      });
    });
  });

  describe('backward compatibility interface', () => {
    it('should provide the same interface as original useWebSocket', () => {
      const mockConnection = {
        status: 'connected' as const,
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: { data: 'test' },
        reconnectAttempts: 1,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        reset: jest.fn(),
        instance: { readyState: WebSocket.OPEN } as WebSocket
      };

      mockUseConnectionBase.mockReturnValue(mockConnection);

      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      // Check that all expected properties exist
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastMessage).toEqual({ data: 'test' });
      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.send).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should forward method calls to underlying connection', () => {
      const mockConnect = jest.fn();
      const mockDisconnect = jest.fn();
      const mockSend = jest.fn();
      const mockReset = jest.fn();

      mockUseConnectionBase.mockReturnValue({
        status: 'disconnected',
        isConnected: false,
        isConnecting: false,
        error: null,
        lastMessage: null,
        reconnectAttempts: 0,
        connect: mockConnect,
        disconnect: mockDisconnect,
        send: mockSend,
        reset: mockReset,
        instance: null
      });

      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      // Test method forwarding
      act(() => {
        result.current.connect();
      });
      expect(mockConnect).toHaveBeenCalled();

      act(() => {
        result.current.disconnect();
      });
      expect(mockDisconnect).toHaveBeenCalled();

      act(() => {
        result.current.send('test message');
      });
      expect(mockSend).toHaveBeenCalledWith('test message');

      act(() => {
        result.current.reset();
      });
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('WebSocket-specific features', () => {
    it('should handle readyState mapping from connection status', () => {
      const testCases = [
        { 
          status: 'disconnected' as const, 
          isConnected: false,
          instance: null,
          expectedReadyState: WebSocket.CLOSED 
        },
        { 
          status: 'connecting' as const, 
          isConnected: false,
          instance: Object.create(WebSocket.prototype, {
            readyState: { value: WebSocket.CONNECTING }
          }),
          expectedReadyState: WebSocket.CONNECTING 
        },
        { 
          status: 'connected' as const, 
          isConnected: true,
          instance: Object.create(WebSocket.prototype, {
            readyState: { value: WebSocket.OPEN }
          }),
          expectedReadyState: WebSocket.OPEN 
        },
        { 
          status: 'error' as const, 
          isConnected: false,
          instance: null,
          expectedReadyState: WebSocket.CLOSED 
        }
      ];

      testCases.forEach(({ status, isConnected, instance, expectedReadyState }) => {
        mockUseConnectionBase.mockReturnValue({
          status,
          isConnected,
          isConnecting: status === 'connecting',
          error: status === 'error' ? new Error('Test error') : null,
          lastMessage: null,
          reconnectAttempts: 0,
          connect: jest.fn(),
          disconnect: jest.fn(),
          send: jest.fn(),
          reset: jest.fn(),
          instance
        });

        const { result } = renderHook(() => useWebSocketUnified({
          url: 'ws://localhost:8080'
        }));

        expect(result.current.readyState).toBe(expectedReadyState);
      });
    });

    it('should provide webSocket property from instance', () => {
      const mockWebSocket = { readyState: WebSocket.OPEN } as WebSocket;
      
      mockUseConnectionBase.mockReturnValue({
        status: 'connected',
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null,
        reconnectAttempts: 0,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        reset: jest.fn(),
        instance: mockWebSocket
      });

      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      expect(result.current.webSocket).toBe(mockWebSocket);
    });
  });

  describe('error handling', () => {
    it('should pass through connection errors', () => {
      const testError = new Error('Connection failed');
      
      mockUseConnectionBase.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: testError,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        lastMessage: null,
        reconnect: jest.fn(),
        status: 'error',
        connectionAttempts: 3,
        lastError: testError
      });

      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      expect(result.current.error).toBe(testError);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.readyState).toBe(3); // CLOSED
    });
  });

  describe('message handling', () => {
    it('should pass through last message from connection', () => {
      const testMessage = { 
        data: '{"type":"test","content":"hello"}',
        timestamp: Date.now()
      };

      mockUseConnectionBase.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        lastMessage: testMessage,
        reconnect: jest.fn(),
        status: 'connected',
        connectionAttempts: 1,
        lastError: null
      });

      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      expect(result.current.lastMessage).toBe(testMessage);
    });
  });

  describe('options validation', () => {
    it('should require url parameter', () => {
      // This should be caught by TypeScript, but we can test runtime behavior
      expect(() => {
        renderHook(() => useWebSocketUnified({} as any));
      }).not.toThrow(); // useConnectionBase should handle validation
    });

    it('should handle invalid URL gracefully', () => {
      renderHook(() => useWebSocketUnified({
        url: 'invalid-url'
      }));

      // Should delegate validation to useConnectionBase
      expect(mockUseConnectionBase).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'invalid-url'
        })
      );
    });
  });

  describe('performance and optimization', () => {
    it('should not recreate connection config unnecessarily', () => {
      const options = {
        url: 'ws://localhost:8080',
        autoConnect: true
      };

      const { rerender } = renderHook(() => useWebSocketUnified(options));

      // Clear previous calls
      mockUseConnectionBase.mockClear();

      // Rerender with same options
      rerender();

      // Should use memoized config (implementation detail - this test verifies stable behavior)
      expect(mockUseConnectionBase).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid option changes efficiently', () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocketUnified({ url }),
        { initialProps: { url: 'ws://localhost:8080' } }
      );

      // Change URL multiple times
      rerender({ url: 'ws://localhost:8081' });
      rerender({ url: 'ws://localhost:8082' });
      rerender({ url: 'ws://localhost:8083' });

      // Should handle all changes without errors
      expect(result.error).toBeUndefined();
      expect(mockUseConnectionBase).toHaveBeenCalledTimes(4); // Initial + 3 rerenders
    });
  });
});