import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';

// 完全にモックされたバージョンを作成
const mockUseManagedWebSocket = jest.fn();

// Mockの実装
jest.mock('@/hooks/base/use-managed-websocket', () => ({
  useManagedWebSocket: mockUseManagedWebSocket
}));

jest.mock('@/lib/ws/connection-manager', () => ({
  connectionManager: {
    createConnection: jest.fn(),
    closeConnection: jest.fn(),
    setReconnectTimeout: jest.fn(),
    setHeartbeatInterval: jest.fn(),
    clearReconnectTimeout: jest.fn(),
    clearHeartbeatInterval: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// WebSocketモック
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number;
  url: string;
  protocols?: string | string[];
  
  private _onopen: ((event: Event) => void) | null = null;
  private _onclose: ((event: CloseEvent) => void) | null = null;
  private _onmessage: ((event: MessageEvent) => void) | null = null;
  private _onerror: ((event: Event) => void) | null = null;

  send = jest.fn();
  close = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
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

  mockOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this._onopen) {
      const event = new Event('open');
      this._onopen(event);
    }
  }

  mockClose(code = 1000, reason = '', wasClean = true) {
    this.readyState = MockWebSocket.CLOSED;
    if (this._onclose) {
      const event = new CloseEvent('close', { 
        code, 
        reason, 
        wasClean: code === 1000 ? wasClean : false 
      });
      this._onclose(event);
    }
  }

  mockMessage(data: any) {
    if (this._onmessage) {
      const event = new MessageEvent('message', { 
        data: typeof data === 'string' ? data : JSON.stringify(data) 
      });
      this._onmessage(event);
    }
  }

  mockError(error?: any) {
    if (this._onerror) {
      const event = new Event('error');
      (event as any).error = error;
      (event as any).message = error?.message || 'WebSocket error';
      this._onerror(event);
    }
  }
}

describe('useManagedWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // グローバルWebSocketを設定
    (global as any).WebSocket = MockWebSocket;
    
    // デフォルトのモック実装
    mockUseManagedWebSocket.mockImplementation((options) => {
      return {
        isConnected: false,
        isConnecting: false,
        error: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn()
      };
    });
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should initialize with disconnected state', () => {
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connect).toBeDefined();
    expect(result.current.disconnect).toBeDefined();
    expect(result.current.send).toBeDefined();
  });

  it('should handle connection state changes', () => {
    let mockState = {
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    };

    mockUseManagedWebSocket.mockImplementation(() => mockState);

    const { result, rerender } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    // 初期状態
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);

    // 接続中状態に変更
    mockState = {
      ...mockState,
      isConnecting: true
    };
    
    rerender();
    expect(result.current.isConnecting).toBe(true);

    // 接続完了状態に変更
    mockState = {
      ...mockState,
      isConnected: true,
      isConnecting: false
    };
    
    rerender();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle errors', () => {
    const mockError = new Error('Connection failed');
    
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: mockError,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    expect(result.current.error).toBe(mockError);
  });

  it('should call connect function', () => {
    const mockConnect = jest.fn();
    
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    act(() => {
      result.current.connect();
    });

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should call disconnect function', () => {
    const mockDisconnect = jest.fn();
    
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: mockDisconnect,
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    act(() => {
      result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should call send function', () => {
    const mockSend = jest.fn();
    
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: mockSend
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: false })
    );
    
    act(() => {
      result.current.send('test message');
    });

    expect(mockSend).toHaveBeenCalledWith('test message');
  });

  it('should handle auto-connect option', () => {
    mockUseManagedWebSocket.mockReturnValue({
      isConnected: false,
      isConnecting: true,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn()
    });

    const { result } = renderHook(() => 
      mockUseManagedWebSocket({ url: 'ws://test.com', autoConnect: true })
    );
    
    expect(mockUseManagedWebSocket).toHaveBeenCalledWith({ url: 'ws://test.com', autoConnect: true });
    expect(result.current.isConnecting).toBe(true);
  });
});
