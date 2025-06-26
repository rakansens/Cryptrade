// tests/setup/jsdom-environment.js
// JSDOM環境の追加設定

// グローバルタイマー関数の定義
if (typeof global.clearInterval === 'undefined') {
  global.clearInterval = clearInterval;
  global.setInterval = setInterval;
  global.clearTimeout = clearTimeout;
  global.setTimeout = setTimeout;
}

// window._documentが適切に初期化されるようにする
if (typeof window !== 'undefined' && window._document === null) {
  // JSDOMの初期化を待つ
  Object.defineProperty(window, '_document', {
    get() {
      return window.document;
    },
    configurable: true
  });
}

// URLとURLSearchParamsのポリフィル
if (typeof global.URL === 'undefined') {
  global.URL = URL;
}

if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = URLSearchParams;
}

// Blobのポリフィル
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  };
}

// FormDataのポリフィル
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this.data = new Map();
    }
    
    append(key, value) {
      if (this.data.has(key)) {
        const existing = this.data.get(key);
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          this.data.set(key, [existing, value]);
        }
      } else {
        this.data.set(key, value);
      }
    }
    
    get(key) {
      const value = this.data.get(key);
      return Array.isArray(value) ? value[0] : value;
    }
    
    getAll(key) {
      const value = this.data.get(key);
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }
    
    has(key) {
      return this.data.has(key);
    }
    
    delete(key) {
      return this.data.delete(key);
    }
    
    set(key, value) {
      this.data.set(key, value);
    }
    
    entries() {
      return this.data.entries();
    }
    
    keys() {
      return this.data.keys();
    }
    
    values() {
      return this.data.values();
    }
    
    [Symbol.iterator]() {
      return this.data.entries();
    }
  };
}

// crypto.randomUUIDのモック
if (typeof global.crypto === 'undefined') {
  global.crypto = {};
}

if (typeof global.crypto.randomUUID === 'undefined') {
  global.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// structuredCloneのポリフィル
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// EventSourceのモック
if (typeof global.EventSource === 'undefined') {
  global.EventSource = class EventSource {
    constructor(url, options) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.withCredentials = options?.withCredentials || false;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.close = jest.fn();
      this._listeners = {};
      
      // Simulate connection
      setTimeout(() => {
        this.readyState = 1; // OPEN
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }, 0);
    }
    
    addEventListener(type, listener) {
      if (!this._listeners[type]) {
        this._listeners[type] = [];
      }
      this._listeners[type].push(listener);
    }
    
    removeEventListener(type, listener) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(l => l !== listener);
      }
    }
    
    dispatchEvent(event) {
      const listeners = this._listeners[event.type] || [];
      listeners.forEach(listener => listener(event));
      
      const handler = this[`on${event.type}`];
      if (handler) {
        handler(event);
      }
    }
  };
}

module.exports = {};