import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';;
import { useManagedWebSocket } from '@/hooks/base/use-managed-websocket';
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

describe('useManagedWebSocket', () => {
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
      useManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connect).toBeDefined();
    expect(result.current.disconnect).toBeDefined();
    expect(result.current.send).toBeDefined();
  });

  it('should auto-connect when autoConnect is true', async () => {
    jest.useRealTimers();
    
    const { result } = renderHook(() => 
      useManagedWebSocket({ url: 'ws://test.com', autoConnect: true })
    );
    
    // Wait for the effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    await waitFor(() => {
      expect(connectionManager.createConnection).toHaveBeenCalledWith(
        'ws://test.com',
        'ws://test.com'
      );
    });
    
    jest.useFakeTimers();
  });

  it('should handle successful connection', async () => {
    const onOpen = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocket({ 
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
      useManagedWebSocket({ 
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

    expect(result.current.error).toEqual(new Error('WebSocket error'));
    expect(onError).toHaveBeenCalled();
  });

  it('should handle messages', async () => {
    const onMessage = jest.fn();
    const { result } = renderHook(() => 
      useManagedWebSocket({ 
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
      useManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
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
      useManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
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
      useManagedWebSocket({ 
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
      useManagedWebSocket({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true,
        reconnectInterval: 100
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
      useManagedWebSocket({ 
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
    const heartbeatMessage = jest.fn(() => 'ping');
    const { result } = renderHook(() => 
      useManagedWebSocket({ 
        url: 'ws://test.com', 
        autoConnect: false,
        heartbeat: true,
        heartbeatInterval: 1000,
        heartbeatMessage
      })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(connectionManager.setHeartbeatInterval).toHaveBeenCalled();
  });

  it('should handle max reconnect attempts', async () => {
    const { result } = renderHook(() => 
      useManagedWebSocket({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true,
        maxReconnectAttempts: 2
      })
    );

    // Simulate multiple failed connection attempts
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.connect();
        mockWs.onclose?.(new CloseEvent('close', { code: 1006 }));
      });
    }

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('Max reconnection attempts reached'));
    });
  });

  it('should handle URL changes', async () => {
    // This test verifies that changing the URL triggers a reconnection
    const { result, rerender } = renderHook(
      ({ url }) => useManagedWebSocket({ url, autoConnect: false }),
      { initialProps: { url: 'ws://test1.com' } }
    );

    // Connect to first URL
    act(() => {
      result.current.connect();
    });

    // Verify connection was created
    expect(connectionManager.createConnection).toHaveBeenCalledWith(
      'ws://test1.com',
      'ws://test1.com'
    );

    // Simulate successful connection
    act(() => {
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    expect(result.current.isConnected).toBe(true);

    // Clear mocks to track new calls
    jest.clearAllMocks();

    // Change URL - this should trigger disconnect and reconnect
    rerender({ url: 'ws://test2.com' });

    // The hook detects URL change and reconnects
    // Since we're using the URL as the ID, it will use the new URL for both operations
    expect(connectionManager.closeConnection).toHaveBeenCalled();
    expect(connectionManager.createConnection).toHaveBeenCalledWith(
      'ws://test2.com',
      'ws://test2.com'
    );
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = renderHook(() => 
      useManagedWebSocket({ url: 'ws://test.com', autoConnect: true })
    );

    // Wait for auto-connect to happen
    await waitFor(() => {
      expect(connectionManager.createConnection).toHaveBeenCalled();
    });

    // Clear mocks to ensure we're only checking the unmount behavior
    jest.clearAllMocks();

    unmount();

    expect(connectionManager.closeConnection).toHaveBeenCalledWith('ws://test.com');
  });
});
