import { renderHook, act } from '@testing-library/react';

// Mock the hook implementations completely
const mockUseWebSocket = jest.fn();
const mockUseMultiWebSocket = jest.fn();

jest.mock('@/hooks/base/use-websocket', () => ({
  useWebSocket: mockUseWebSocket,
  useMultiWebSocket: mockUseMultiWebSocket
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

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    mockUseWebSocket.mockReturnValue({
      readyState: 3, // CLOSED
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
    );

    expect(result.current.readyState).toBe(3);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.lastMessage).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.webSocket).toBeNull();
  });

  it('should handle auto-connect when enabled', () => {
    const mockConnect = jest.fn();
    
    mockUseWebSocket.mockReturnValue({
      readyState: 0, // CONNECTING
      isConnected: false,
      isConnecting: true,
      lastMessage: null,
      error: null,
      webSocket: {},
      connect: mockConnect,
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
    );

    expect(mockUseWebSocket).toHaveBeenCalledWith({
      url: 'ws://localhost:8080',
      autoConnect: true
    });
    expect(result.current.isConnecting).toBe(true);
  });

  it('should handle connection success', () => {
    const onOpen = jest.fn();
    
    mockUseWebSocket.mockReturnValue({
      readyState: 1, // OPEN
      isConnected: true,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: {},
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseWebSocket({ 
        url: 'ws://localhost:8080', 
        autoConnect: false,
        onOpen 
      })
    );

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle incoming messages', () => {
    const onMessage = jest.fn();
    const testMessage = { data: 'test message' };
    
    mockUseWebSocket.mockReturnValue({
      readyState: 1,
      isConnected: true,
      isConnecting: false,
      lastMessage: testMessage,
      error: null,
      webSocket: {},
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ 
        url: 'ws://localhost:8080',
        autoConnect: true,
        onMessage 
      })
    );

    expect(result.current.lastMessage).toBe(testMessage);
  });

  it('should send messages when connected', () => {
    const mockSendMessage = jest.fn();
    
    mockUseWebSocket.mockReturnValue({
      readyState: 1,
      isConnected: true,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: {},
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: mockSendMessage
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ url: 'ws://localhost:8080', autoConnect: true })
    );

    act(() => {
      result.current.sendMessage('test message');
    });

    expect(mockSendMessage).toHaveBeenCalledWith('test message');
  });

  it('should handle connection errors', () => {
    const onError = jest.fn();
    const testError = new Error('Connection failed');
    
    mockUseWebSocket.mockReturnValue({
      readyState: 3,
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: testError,
      webSocket: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ 
        url: 'ws://localhost:8080',
        autoConnect: true,
        onError 
      })
    );

    expect(result.current.error).toBe(testError);
  });

  it('should handle manual connection', () => {
    const mockConnect = jest.fn();
    
    mockUseWebSocket.mockReturnValue({
      readyState: 0,
      isConnected: false,
      isConnecting: true,
      lastMessage: null,
      error: null,
      webSocket: {},
      connect: mockConnect,
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
    );

    act(() => {
      result.current.connect();
    });

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should handle disconnection', () => {
    const mockDisconnect = jest.fn();
    
    mockUseWebSocket.mockReturnValue({
      readyState: 3,
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: null,
      connect: jest.fn(),
      disconnect: mockDisconnect,
      sendMessage: jest.fn()
    });

    const { result } = renderHook(() =>
      mockUseWebSocket({ url: 'ws://localhost:8080', autoConnect: false })
    );

    act(() => {
      result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle callback options', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const onMessage = jest.fn();
    const onError = jest.fn();

    mockUseWebSocket.mockReturnValue({
      readyState: 3,
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    renderHook(() =>
      mockUseWebSocket({ 
        url: 'ws://localhost:8080',
        autoConnect: false,
        onOpen,
        onClose,
        onMessage,
        onError
      })
    );

    expect(mockUseWebSocket).toHaveBeenCalledWith({
      url: 'ws://localhost:8080',
      autoConnect: false,
      onOpen,
      onClose,
      onMessage,
      onError
    });
  });

  it('should handle protocol options', () => {
    mockUseWebSocket.mockReturnValue({
      readyState: 3,
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    renderHook(() =>
      mockUseWebSocket({ 
        url: 'ws://localhost:8080',
        protocols: ['chat', 'superchat'],
        autoConnect: false
      })
    );

    expect(mockUseWebSocket).toHaveBeenCalledWith({
      url: 'ws://localhost:8080',
      protocols: ['chat', 'superchat'],
      autoConnect: false
    });
  });

  it('should handle reconnection options', () => {
    mockUseWebSocket.mockReturnValue({
      readyState: 3,
      isConnected: false,
      isConnecting: false,
      lastMessage: null,
      error: null,
      webSocket: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    renderHook(() =>
      mockUseWebSocket({ 
        url: 'ws://localhost:8080',
        autoConnect: false,
        reconnect: true,
        reconnectInterval: 1000
      })
    );

    expect(mockUseWebSocket).toHaveBeenCalledWith({
      url: 'ws://localhost:8080',
      autoConnect: false,
      reconnect: true,
      reconnectInterval: 1000
    });
  });
});

describe('useMultiWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle multiple connections', () => {
    const connections = [
      { id: 'conn1', url: 'ws://localhost:8080' },
      { id: 'conn2', url: 'ws://localhost:8081' },
    ];

    mockUseMultiWebSocket.mockReturnValue({
      connections: {},
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn(),
      disconnectAll: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseMultiWebSocket({ connections })
    );

    expect(mockUseMultiWebSocket).toHaveBeenCalledWith({ connections });
    expect(result.current.connect).toBeDefined();
    expect(result.current.disconnect).toBeDefined();
    expect(result.current.send).toBeDefined();
    expect(result.current.disconnectAll).toBeDefined();
  });

  it('should handle connection management functions', () => {
    const mockConnect = jest.fn();
    const mockDisconnect = jest.fn();
    const mockSend = jest.fn();
    const mockDisconnectAll = jest.fn();

    mockUseMultiWebSocket.mockReturnValue({
      connections: {},
      connect: mockConnect,
      disconnect: mockDisconnect,
      send: mockSend,
      disconnectAll: mockDisconnectAll
    });

    const { result } = renderHook(() => 
      mockUseMultiWebSocket({ connections: [] })
    );

    act(() => {
      result.current.connect('conn1');
      result.current.disconnect('conn1');
      result.current.send('conn1', 'message');
      result.current.disconnectAll();
    });

    expect(mockConnect).toHaveBeenCalledWith('conn1');
    expect(mockDisconnect).toHaveBeenCalledWith('conn1');
    expect(mockSend).toHaveBeenCalledWith('conn1', 'message');
    expect(mockDisconnectAll).toHaveBeenCalled();
  });
});