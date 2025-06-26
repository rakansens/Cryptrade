// tests/setup/browser-mocks.js
// Browser API mocks for test environment

// ▶ Node 環境で window が未定義の場合に最低限のスタブを用意
if (typeof global.window === 'undefined') {
  global.window = {};
}
if (typeof global.window.dispatchEvent === 'undefined') {
  global.window.dispatchEvent = jest.fn();
}
if (typeof global.window.addEventListener === 'undefined') {
  global.window.addEventListener = jest.fn();
  global.window.removeEventListener = jest.fn();
}

// Mock browser APIs only if window is defined (jsdom environment)
if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };
}

// Mock EventSource for SSE testing
class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this._listeners = {};
    this.close = jest.fn(() => {
      this.readyState = 2; // CLOSED
    });
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 0);
  }
  
  addEventListener(type, handler) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(handler);
  }
  
  removeEventListener(type, handler) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(h => h !== handler);
    }
  }
  
  dispatchEvent(event) {
    const type = event.type;
    if (this._listeners[type]) {
      this._listeners[type].forEach(handler => {
        handler(event);
      });
    }
    // Also trigger the on* handlers
    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (type === 'error' && this.onerror) {
      this.onerror(event);
    } else if (type === 'open' && this.onopen) {
      this.onopen(event);
    }
    return true;
  }
  
  // Helper method for tests to simulate messages
  simulateMessage(data) {
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
  }
  
  // Helper method for tests to simulate errors
  simulateError(error) {
    const event = new Event('error');
    event.error = error;
    this.dispatchEvent(event);
  }
}

MockEventSource.CONNECTING = 0;
MockEventSource.OPEN = 1;
MockEventSource.CLOSED = 2;

global.EventSource = MockEventSource;

// jsdom 22+ may expose window but location が null のケースを回避
if (typeof window !== 'undefined' && !window.location) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.location = new URL('http://localhost/');
}

// Mock ClipboardEvent for tests
if (typeof global.ClipboardEvent === 'undefined') {
  global.ClipboardEvent = class ClipboardEvent extends Event {
    constructor(type, eventInitDict) {
      super(type, eventInitDict);
      this.clipboardData = eventInitDict?.clipboardData || {
        getData: jest.fn(() => ''),
        setData: jest.fn(),
        items: [],
        types: [],
        files: []
      };
    }
  };
}

// Mock DataTransfer for tests
if (typeof global.DataTransfer === 'undefined') {
  global.DataTransfer = class DataTransfer {
    constructor() {
      this.items = [];
      this.types = [];
      this.files = [];
      this.effectAllowed = 'all';
      this.dropEffect = 'none';
    }
    
    getData(format) {
      return '';
    }
    
    setData(format, data) {
      // Mock implementation
    }
    
    clearData(format) {
      // Mock implementation
    }
    
    setDragImage(image, x, y) {
      // Mock implementation
    }
  };
}

// Setup WebSocket mock with constants
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class WebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = WebSocket.CONNECTING;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
    }
    
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// Helper to create a mock ReadableStream for testing
global.createMockReadableStream = (chunks) => {
  let index = 0;
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
};