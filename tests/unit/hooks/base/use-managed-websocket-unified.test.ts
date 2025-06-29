import { renderHook, act } from '@testing-library/react';
import { useManagedWebSocketUnified } from '@/hooks/base/use-managed-websocket-unified';
import { connectionManager } from '@/lib/ws/connection-manager';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/ws/connection-manager');
jest.mock('@/lib/utils/logger');

// Mock WebSocket
class MockWebSocket {
  readyState: number;
  url: string;
  _onopen: ((event: Event) => void) | null = null;
  _onclose: ((event: CloseEvent) => void) | null = null;
  _onmessage: ((event: MessageEvent) => void) | null = null;
  _onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
  }

  get onopen() {
    return this._onopen;
  }
  set onopen(handler: ((event: Event) => void) | null) {
    this._onopen = handler;
  }

  get onclose() {
    return this._onclose;
  }
  set onclose(handler: ((event: CloseEvent) => void) | null) {
    this._onclose = handler;
  }

  get onmessage() {
    return this._onmessage;
  }
  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler;
  }

  get onerror() {
    return this._onerror;
  }
  set onerror(handler: ((event: Event) => void) | null) {
    this._onerror = handler;
  }

  send = jest.fn();
  close = jest.fn();
}

// @ts-ignore
global.WebSocket = MockWebSocket;

// Add WebSocket static properties
Object.assign(WebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
});

describe('useManagedWebSocketUnified', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockWs = new MockWebSocket('ws://test.com');
    
    // Set up mocks with proper return values
    (connectionManager.createConnection as jest.Mock).mockImplementation((id, url) => {
      mockWs = new MockWebSocket(url);
      return mockWs;
    });
    
    (connectionManager.setReconnectTimeout as jest.Mock).mockImplementation((id, callback, delay) => {
      return setTimeout(callback, delay);
    });
    
    (connectionManager.setHeartbeatInterval as jest.Mock).mockImplementation((id, callback, interval) => {
      return setInterval(callback, interval);
    });
    
    (connectionManager.closeConnection as jest.Mock).mockImplementation((id) => {
      if (mockWs) {
        mockWs.readyState = WebSocket.CLOSED;
        mockWs.close();
      }
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connect).toBeDefined();
    expect(result.current.disconnect).toBeDefined();
    expect(result.current.send).toBeDefined();
  });

  it('should auto-connect when autoConnect is true', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: true })
    );
    
    // Should start connecting
    expect(result.current.isConnecting).toBe(true);
    expect(connectionManager.createConnection).toHaveBeenCalledWith(
      'ws://test.com',
      'ws://test.com'
    );
  });

  it('should handle successful connection', async () => {
    const onOpen = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        onOpen 
      })
    );

    // Initial state should be disconnected
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);

    // Start connection
    act(() => {
      result.current.connect();
    });

    // Should be connecting
    expect(result.current.isConnecting).toBe(true);
    expect(connectionManager.createConnection).toHaveBeenCalledWith('ws://test.com', 'ws://test.com');

    // Simulate successful connection by calling the onopen handler
    act(() => {
      if (mockWs.onopen) {
        mockWs.readyState = WebSocket.OPEN;
        mockWs.onopen(new Event('open'));
      }
    });

    // Should now be connected
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(onOpen).toHaveBeenCalled();
  });

  it('should handle connection error', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        onError 
      })
    );

    act(() => {
      result.current.connect();
    });

    act(() => {
      mockWs.onerror?.(new Event('error'));
    });

    expect(result.current.error?.message).toBe('WebSocket error');
    expect(onError).toHaveBeenCalled();
  });

  it('should handle messages', async () => {
    const onMessage = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        onMessage 
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    const messageEvent = new MessageEvent('message', { data: 'test data' });
    
    act(() => {
      mockWs.onmessage?.(messageEvent);
    });

    expect(onMessage).toHaveBeenCalledWith(messageEvent);
  });

  it('should send messages when connected', () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    act(() => {
      result.current.send('test message');
    });

    expect(mockWs.send).toHaveBeenCalledWith('test message');
  });

  it('should not send messages when disconnected', () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );

    act(() => {
      result.current.send('test message');
    });

    expect(mockWs.send).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '[ManagedWebSocket] Cannot send, not connected',
      { id: 'ws://test.com' }
    );
  });

  it('should handle disconnection', async () => {
    const onClose = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        onClose 
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(connectionManager.closeConnection).toHaveBeenCalledWith('ws://test.com');
    expect(result.current.isConnected).toBe(false);
  });

  it('should handle reconnection on abnormal closure', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 3
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    const closeEvent = new CloseEvent('close', { code: 1006 });
    
    act(() => {
      mockWs.onclose?.(closeEvent);
    });

    expect(connectionManager.setReconnectTimeout).toHaveBeenCalled();
  });

  it('should not reconnect on normal closure', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    const closeEvent = new CloseEvent('close', { code: 1000 });
    
    act(() => {
      mockWs.onclose?.(closeEvent);
    });

    expect(connectionManager.setReconnectTimeout).not.toHaveBeenCalled();
  });

  it('should handle heartbeat when enabled', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        heartbeat: true,
        heartbeatInterval: 1000,
        heartbeatMessage: 'ping'
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(connectionManager.setHeartbeatInterval).toHaveBeenCalled();
  });

  it('should handle heartbeat with function message', async () => {
    const heartbeatMessage = jest.fn(() => JSON.stringify({ type: 'ping' }));
    
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        heartbeat: true,
        heartbeatMessage
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(connectionManager.setHeartbeatInterval).toHaveBeenCalled();
    
    // Get the heartbeat callback and test it
    const heartbeatCall = (connectionManager.setHeartbeatInterval as jest.Mock).mock.calls[0];
    const heartbeatCallback = heartbeatCall[1];
    
    act(() => {
      heartbeatCallback();
    });

    expect(heartbeatMessage).toHaveBeenCalled();
    expect(mockWs.send).toHaveBeenCalledWith('{"type":"ping"}');
  });

  it('should handle max reconnect attempts', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true,
        maxReconnectAttempts: 2
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    // Simulate multiple failed reconnections
    for (let i = 0; i < 3; i++) {
      act(() => {
        mockWs.onclose?.(new CloseEvent('close', { code: 1006 }));
      });
    }

    expect(result.current.error?.message).toBe('Max reconnection attempts reached');
  });

  it('should handle URL changes', async () => {
    const { result, rerender } = renderHook(
      ({ url }) => useManagedWebSocketUnified({ url, autoConnect: false }),
      { initialProps: { url: 'ws://test1.com' } }
    );

    // Connect to first URL
    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(result.current.isConnected).toBe(true);

    // Clear mocks to track new calls
    jest.clearAllMocks();

    // Change URL - this should trigger disconnect and reconnect
    rerender({ url: 'ws://test2.com' });

    expect(connectionManager.closeConnection).toHaveBeenCalledWith('ws://test1.com');
    expect(connectionManager.createConnection).toHaveBeenCalledWith('ws://test2.com', 'ws://test2.com');
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: true })
    );

    expect(connectionManager.createConnection).toHaveBeenCalled();

    // Clear mocks to ensure we're only checking the unmount behavior
    jest.clearAllMocks();

    unmount();

    expect(connectionManager.closeConnection).toHaveBeenCalledWith('ws://test.com');
  });

  it('should handle custom id parameter', () => {
    renderHook(() => 
      useManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        id: 'custom-id',
        autoConnect: true 
      })
    );

    expect(connectionManager.createConnection).toHaveBeenCalledWith('custom-id', 'ws://test.com');
  });

  it('should handle connection creation failure', () => {
    (connectionManager.createConnection as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );

    act(() => {
      result.current.connect();
    });

    expect(result.current.error?.message).toBe('Failed to create WebSocket connection');
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle exception during connection', () => {
    (connectionManager.createConnection as jest.Mock).mockImplementation(() => {
      throw new Error('Connection error');
    });

    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );

    act(() => {
      result.current.connect();
    });

    expect(result.current.error?.message).toBe('Connection error');
    expect(result.current.isConnecting).toBe(false);
  });

  it('should not connect if already connecting or connected', () => {
    const { result } = renderHook(() => 
      useManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );

    // First connection attempt
    act(() => {
      result.current.connect();
    });

    expect(connectionManager.createConnection).toHaveBeenCalledTimes(1);

    // Second attempt while connecting should be ignored
    act(() => {
      result.current.connect();
    });

    expect(connectionManager.createConnection).toHaveBeenCalledTimes(1);
  });
});