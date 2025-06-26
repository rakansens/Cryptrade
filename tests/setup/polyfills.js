// tests/setup/polyfills.js
// Polyfills for test environment

// Ensure timer functions are available globally
if (typeof global.setTimeout === 'undefined') {
  global.setTimeout = require('timers').setTimeout;
}
if (typeof global.clearTimeout === 'undefined') {
  global.clearTimeout = require('timers').clearTimeout;
}
if (typeof global.setInterval === 'undefined') {
  global.setInterval = require('timers').setInterval;
}
if (typeof global.clearInterval === 'undefined') {
  global.clearInterval = require('timers').clearInterval;
}

// Polyfill TextEncoder/TextDecoder for Node.js
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill ReadableStream and other web streams
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// Polyfill MessagePort and MessageChannel
if (typeof global.MessagePort === 'undefined') {
  const { MessagePort, MessageChannel } = require('worker_threads');
  global.MessagePort = MessagePort;
  global.MessageChannel = MessageChannel;
}

// Polyfill BroadcastChannel
if (typeof global.BroadcastChannel === 'undefined') {
  const { BroadcastChannel } = require('worker_threads');
  global.BroadcastChannel = BroadcastChannel;
}

// Polyfill Headers first
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = {};
      if (init instanceof Headers) {
        init.forEach((value, key) => {
          this.append(key, value);
        });
      } else if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.append(key, value);
        });
      }
    }
    
    append(name, value) {
      name = name.toLowerCase();
      if (!this._headers[name]) {
        this._headers[name] = [];
      }
      this._headers[name].push(value);
    }
    
    delete(name) {
      delete this._headers[name.toLowerCase()];
    }
    
    get(name) {
      const values = this._headers[name.toLowerCase()];
      return values ? values.join(', ') : null;
    }
    
    has(name) {
      return name.toLowerCase() in this._headers;
    }
    
    set(name, value) {
      this._headers[name.toLowerCase()] = [value];
    }
    
    forEach(callback) {
      Object.entries(this._headers).forEach(([key, values]) => {
        callback(values.join(', '), key, this);
      });
    }
    
    entries() {
      return Object.entries(this._headers).map(([key, values]) => [key, values.join(', ')]);
    }
    
    keys() {
      return Object.keys(this._headers);
    }
    
    values() {
      return Object.values(this._headers).map(values => values.join(', '));
    }
  };
}

// Polyfill setImmediate/clearImmediate for environments that don't have it
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = clearTimeout;
}

// Polyfill fetch for Node.js environments that don't have it
if (typeof global.fetch === 'undefined') {
  // Create a simple fetch implementation that MSW can intercept
  const simpleFetch = async (url, options = {}) => {
    // Create request object for MSW to intercept
    const request = new global.Request(url, options);
    
    // Return a pending promise that MSW will resolve
    return new Promise((resolve, reject) => {
      // This will be intercepted by MSW if handlers are set up
      // If not intercepted, reject with network error
      setTimeout(() => {
        reject(new Error(`No MSW handler found for ${url}`));
      }, 100);
    });
  };
  
  global.fetch = simpleFetch;
}

// Polyfill Response/Request/Headers for MSW if not available
if (typeof global.Response === 'undefined') {
  // Simple Response polyfill for MSW tests
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new global.Headers(init.headers || {});
      this.ok = this.status >= 200 && this.status < 300;
      this.redirected = false;
      this.type = 'basic';
      this.url = '';
      
      this.json = async () => {
        if (typeof this.body === 'string') {
          return JSON.parse(this.body);
        }
        return this.body;
      };
      
      this.text = async () => {
        if (typeof this.body === 'string') {
          return this.body;
        }
        return JSON.stringify(this.body);
      };
      
      this.clone = () => {
        return new Response(this.body, {
          status: this.status,
          statusText: this.statusText,
          headers: this.headers
        });
      };
    }
  };
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = input;
      this.method = init.method || 'GET';
      this.headers = new global.Headers(init.headers || {});
      this.body = init.body || null;
      
      this.json = async () => {
        if (this.body) {
          return JSON.parse(this.body);
        }
        return {};
      };
      
      this.text = async () => {
        return this.body || '';
      };
      
      this.clone = () => {
        return new Request(this.url, {
          method: this.method,
          headers: this.headers,
          body: this.body
        });
      };
    }
  };
}

// Timer functions polyfill for jsdom environment
if (typeof global.clearInterval === 'undefined' || typeof global.setInterval === 'undefined') {
  // @ts-ignore
  global.setInterval = global.setInterval || function(callback, delay, ...args) {
    return setTimeout(function repeat() {
      callback(...args);
      setTimeout(repeat, delay);
    }, delay);
  };
  
  // @ts-ignore
  global.clearInterval = global.clearInterval || clearTimeout;
}

if (typeof global.clearTimeout === 'undefined' || typeof global.setTimeout === 'undefined') {
  // These should exist in Node.js, but add fallback
  // @ts-ignore
  global.setTimeout = global.setTimeout || (() => 0);
  // @ts-ignore
  global.clearTimeout = global.clearTimeout || (() => {});
}