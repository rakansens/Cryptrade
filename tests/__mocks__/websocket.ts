/**
 * WebSocket モックの実装
 */

export class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  private messageQueue: any[] = [];
  private closeCode?: number;
  private closeReason?: string;

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(_data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock echo or custom response handling can be added here
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    this.closeCode = code ?? 1000;
    this.closeReason = reason ?? '';
    
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        const event = new CloseEvent('close', {
          code: this.closeCode || 1000,
          reason: this.closeReason || '',
          wasClean: true
        });
        this.onclose(event);
      }
    }, 10);
  }

  // Test helper methods
  mockReceiveMessage(data: any): void {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      const event = new MessageEvent('message', {
        data: typeof data === 'string' ? data : JSON.stringify(data)
      });
      this.onmessage(event);
    } else {
      this.messageQueue.push(data);
    }
  }

  mockError(error: any): void {
    if (this.onerror) {
      const event = new Event('error');
      Object.assign(event, { error });
      this.onerror(event);
    }
  }

  mockOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
    // Process queued messages
    while (this.messageQueue.length > 0) {
      this.mockReceiveMessage(this.messageQueue.shift());
    }
  }

  mockClose(code: number = 1000, reason: string = ''): void {
    this.close(code, reason);
  }
}

// Global mock setup for tests
if (typeof global !== 'undefined') {
  (global as any).WebSocket = MockWebSocket;
}

export default MockWebSocket;