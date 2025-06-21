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
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
  }

  send = jest.fn();
  close = jest.fn();
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe('useManagedWebSocket', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWs = new MockWebSocket('ws://test.com');
    (connectionManager.createConnection as jest.Mock).mockReturnValue(mockWs);
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
    
    expect(result.current.isConnecting).toBe(true);
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

    act(() => {
      result.current.connect();
    });

    expect(result.current.isConnecting).toBe(true);

    act(() => {
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

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
    const { rerender } = renderHook(
      ({ url }) => useManagedWebSocket({ url, autoConnect: false }),
      { initialProps: { url: 'ws://test1.com' } }
    );

    const { result } = renderHook(() => 
      useManagedWebSocket({ url: 'ws://test1.com', autoConnect: false })
    );

    act(() => {
      result.current.connect();
      mockWs.readyState = WebSocket.OPEN;
      mockWs.onopen?.(new Event('open'));
    });

    rerender({ url: 'ws://test2.com' });

    await waitFor(() => {
      expect(connectionManager.closeConnection).toHaveBeenCalled();
      expect(connectionManager.createConnection).toHaveBeenCalledWith(
        'ws://test2.com',
        'ws://test2.com'
      );
    });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => 
      useManagedWebSocket({ url: 'ws://test.com' })
    );

    unmount();

    expect(connectionManager.closeConnection).toHaveBeenCalledWith('ws://test.com');
  });
});
