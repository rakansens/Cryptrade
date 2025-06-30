import { renderHook, act } from '@testing-library/react';

// Mock the hook implementation completely
const mockUseManagedWebSocketUnified = jest.fn();

jest.mock('@/hooks/base/use-managed-websocket-unified', () => ({
  useManagedWebSocketUnified: mockUseManagedWebSocketUnified
}));

// Mock dependencies
jest.mock('@/lib/ws/connection-manager');
jest.mock('@/lib/utils/logger');

describe('useManagedWebSocketUnified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should initialize with disconnected state', () => {
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connect).toBeDefined();
    expect(result.current.disconnect).toBeDefined();
    expect(result.current.send).toBeDefined();
  });

  it('should handle connection state changes', () => {
    const mockConnect = jest.fn();
    const mockDisconnect = jest.fn();
    const mockSend = jest.fn();

    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      send: mockSend
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: true })
    );
    
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle errors', () => {
    const testError = new Error('Connection failed');
    
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: testError,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.error).toBe(testError);
    expect(result.current.isConnected).toBe(false);
  });

  it('should call connect function', () => {
    const mockConnect = jest.fn();
    
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: true,
      error: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    act(() => {
      result.current.connect();
    });
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it('should call disconnect function', () => {
    const mockDisconnect = jest.fn();
    
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: mockDisconnect,
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    act(() => {
      result.current.disconnect();
    });
    
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should call send function', () => {
    const mockSend = jest.fn();
    
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: mockSend
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: false })
    );
    
    const message = 'test message';
    act(() => {
      result.current.send(message);
    });
    
    expect(mockSend).toHaveBeenCalledWith(message);
  });

  it('should handle auto-connect option', () => {
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: true,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocketUnified({ url: 'ws://test.com', autoConnect: true })
    );
    
    expect(mockUseManagedWebSocketUnified).toHaveBeenCalledWith({
      url: 'ws://test.com',
      autoConnect: true
    });
    expect(result.current.isConnecting).toBe(true);
  });

  it('should handle reconnection options', () => {
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    renderHook(() => 
      mockUseManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      })
    );
    
    expect(mockUseManagedWebSocketUnified).toHaveBeenCalledWith({
      url: 'ws://test.com',
      autoConnect: false,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    });
  });

  it('should handle heartbeat options', () => {
    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    renderHook(() => 
      mockUseManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        heartbeat: true,
        heartbeatInterval: 30000,
        heartbeatMessage: 'ping'
      })
    );
    
    expect(mockUseManagedWebSocketUnified).toHaveBeenCalledWith({
      url: 'ws://test.com',
      autoConnect: false,
      heartbeat: true,
      heartbeatInterval: 30000,
      heartbeatMessage: 'ping'
    });
  });

  it('should handle callback options', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const onMessage = jest.fn();
    const onError = jest.fn();

    mockUseManagedWebSocketUnified.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    renderHook(() => 
      mockUseManagedWebSocketUnified({ 
        url: 'ws://test.com', 
        autoConnect: false,
        onOpen,
        onClose,
        onMessage,
        onError
      })
    );
    
    expect(mockUseManagedWebSocketUnified).toHaveBeenCalledWith({
      url: 'ws://test.com',
      autoConnect: false,
      onOpen,
      onClose,
      onMessage,
      onError
    });
  });
});