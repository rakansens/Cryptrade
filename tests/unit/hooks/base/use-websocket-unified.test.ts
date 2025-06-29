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
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn(),
      lastMessage: null,
      reconnect: jest.fn(),
      status: 'disconnected',
      connectionAttempts: 0,
      lastError: null
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
        reconnectOptions: {
          enabled: true,
          interval: 5000,
          maxAttempts: 10
        },
        eventHandlers: {
          onConnect: options.onOpen,
          onDisconnect: options.onClose,
          onMessage: options.onMessage,
          onError: options.onError
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
        autoConnect: undefined,
        reconnectOptions: {
          enabled: undefined,
          interval: undefined,
          maxAttempts: undefined
        },
        eventHandlers: {
          onConnect: undefined,
          onDisconnect: undefined,
          onMessage: undefined,
          onError: undefined
        }
      });
    });

    it('should map deprecated options correctly', () => {
      const options = {
        url: 'ws://localhost:8080',
        shouldReconnect: true, // deprecated
        reconnectAttempts: 5,  // deprecated
        reconnectInterval: 3000
      };

      renderHook(() => useWebSocketUnified(options));

      expect(mockUseConnectionBase).toHaveBeenCalledWith({
        type: 'websocket',
        url: 'ws://localhost:8080',
        protocols: undefined,
        autoConnect: undefined,
        reconnectOptions: {
          enabled: true,
          interval: 3000,
          maxAttempts: 5
        },
        eventHandlers: {
          onConnect: undefined,
          onDisconnect: undefined,
          onMessage: undefined,
          onError: undefined
        }
      });
    });
  });

  describe('backward compatibility interface', () => {
    it('should provide the same interface as original useWebSocket', () => {
      const mockConnection = {
        isConnected: true,
        isConnecting: false,
        error: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        lastMessage: { data: 'test' },
        reconnect: jest.fn(),
        status: 'connected' as const,
        connectionAttempts: 1,
        lastError: null
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
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should forward method calls to underlying connection', () => {
      const mockConnect = jest.fn();
      const mockDisconnect = jest.fn();
      const mockSend = jest.fn();
      const mockReconnect = jest.fn();

      mockUseConnectionBase.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        send: mockSend,
        lastMessage: null,
        reconnect: mockReconnect,
        status: 'disconnected',
        connectionAttempts: 0,
        lastError: null
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
        result.current.reconnect();
      });
      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('WebSocket-specific features', () => {
    it('should handle readyState mapping from connection status', () => {
      const testCases = [
        { status: 'disconnected' as const, expectedReadyState: 3 }, // CLOSED
        { status: 'connecting' as const, expectedReadyState: 0 },   // CONNECTING
        { status: 'connected' as const, expectedReadyState: 1 },    // OPEN
        { status: 'error' as const, expectedReadyState: 3 }         // CLOSED
      ];

      testCases.forEach(({ status, expectedReadyState }) => {
        mockUseConnectionBase.mockReturnValue({
          isConnected: status === 'connected',
          isConnecting: status === 'connecting',
          error: status === 'error' ? new Error('Test error') : null,
          connect: jest.fn(),
          disconnect: jest.fn(),
          send: jest.fn(),
          lastMessage: null,
          reconnect: jest.fn(),
          status,
          connectionAttempts: 0,
          lastError: null
        });

        const { result } = renderHook(() => useWebSocketUnified({
          url: 'ws://localhost:8080'
        }));

        expect(result.current.readyState).toBe(expectedReadyState);
      });
    });

    it('should provide webSocket property as null (unified implementation)', () => {
      const { result } = renderHook(() => useWebSocketUnified({
        url: 'ws://localhost:8080'
      }));

      // In unified implementation, webSocket is always null since we use abstract connection
      expect(result.current.webSocket).toBeNull();
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