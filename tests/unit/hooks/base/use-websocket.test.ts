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