/**
 * WebSocket Mock for Testing
 * 共通のWebSocketモック実装
 */

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
    
    // 非同期でCONNECTING状態を設定
    setTimeout(() => {
      // 初期状態では接続中のまま
    }, 0);
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

  // テスト用のヘルパーメソッド
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
      // errorプロパティを追加
      (event as any).error = error;
      (event as any).message = error?.message || 'WebSocket error';
      this._onerror(event);
    }
  }
}

// グローバルな設定関数
export function setupWebSocketMock() {
  // グローバルWebSocketを置き換え
  (global as any).WebSocket = MockWebSocket;
  
  // 静的プロパティも設定
  Object.assign(MockWebSocket, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  });

  return MockWebSocket;
}

// テスト用のファクトリー関数
export function createMockWebSocketFactory() {
  const instances: MockWebSocket[] = [];
  
  const factory = jest.fn().mockImplementation((url: string, protocols?: string | string[]) => {
    const instance = new MockWebSocket(url, protocols);
    instances.push(instance);
    return instance;
  });

  // 静的プロパティを追加（型アサーションを使用）
  (factory as any).CONNECTING = 0;
  (factory as any).OPEN = 1;
  (factory as any).CLOSING = 2;
  (factory as any).CLOSED = 3;

  return {
    factory,
    instances,
    getLatest: () => instances[instances.length - 1],
    clear: () => instances.length = 0
  };
}