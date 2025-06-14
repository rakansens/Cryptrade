import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreaming, useSSE } from '../use-streaming';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }
}));

// Mock fetch
global.fetch = jest.fn();

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState: number = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: MessageEvent): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    return true;
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

global.EventSource = MockEventSource as any;

describe('useStreaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('basic functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false
        })
      );

      expect(result.current.data).toBeNull();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should auto-connect when enabled', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"message": "hello"}\n\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const onMessage = jest.fn();
      const onStart = jest.fn();

      renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onMessage,
          onStart,
          autoConnect: true
        })
      );

      await waitFor(() => {
        expect(onStart).toHaveBeenCalled();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/stream', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
    });

    it('should handle manual connect', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"message": "test"}\n\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false
        })
      );

      expect(result.current.isStreaming).toBe(false);

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ message: 'test' });
      });
    });

    it('should handle disconnect', async () => {
      const abortSpy = jest.fn();
      global.AbortController = jest.fn().mockImplementation(() => ({
        signal: {},
        abort: abortSpy
      }));

      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            // Keep stream open
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(abortSpy).toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('stream processing', () => {
    it('should process SSE formatted data', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: {"event": "start"}\n\n'));
            controller.enqueue(encoder.encode('data: {"event": "data", "value": 42}\n\n'));
            controller.enqueue(encoder.encode('data: {"event": "end"}\n\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const messages: any[] = [];
      const onMessage = jest.fn((data) => messages.push(data));

      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onMessage
        })
      );

      await waitFor(() => {
        expect(messages.length).toBe(3);
      });

      expect(messages).toEqual([
        { event: 'start' },
        { event: 'data', value: 42 },
        { event: 'end' }
      ]);
    });

    it('should handle plain JSON lines', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('{"type": "message", "text": "hello"}\n'));
            controller.enqueue(encoder.encode('{"type": "message", "text": "world"}\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const messages: any[] = [];
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onMessage: (data) => messages.push(data)
        })
      );

      await waitFor(() => {
        expect(messages.length).toBe(2);
      });

      expect(messages).toEqual([
        { type: 'message', text: 'hello' },
        { type: 'message', text: 'world' }
      ]);
    });

    it('should handle custom parseResponse', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('CUSTOM:hello\n'));
            controller.enqueue(encoder.encode('CUSTOM:world\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const messages: any[] = [];
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          parseResponse: (chunk) => {
            if (chunk.startsWith('CUSTOM:')) {
              return { custom: chunk.slice(7) };
            }
            return null;
          },
          onMessage: (data) => messages.push(data)
        })
      );

      await waitFor(() => {
        expect(messages.length).toBe(2);
      });

      expect(messages).toEqual([
        { custom: 'hello' },
        { custom: 'world' }
      ]);
    });

    it('should handle chunks split across reads', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // Split a message across two chunks
            controller.enqueue(encoder.encode('data: {"mess'));
            controller.enqueue(encoder.encode('age": "split"}\n\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const messages: any[] = [];
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onMessage: (data) => messages.push(data)
        })
      );

      await waitFor(() => {
        expect(messages.length).toBe(1);
      });

      expect(messages[0]).toEqual({ message: 'split' });
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      const fetchError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(fetchError);

      const onError = jest.fn();
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onError,
          reconnect: false
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Network error');
      expect(onError).toHaveBeenCalledWith(fetchError);
    });

    it('should handle non-ok responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const onError = jest.fn();
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onError,
          reconnect: false
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Stream request failed: 500 Internal Server Error');
    });

    it('should handle empty response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null
      });

      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          reconnect: false
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Response body is empty');
    });

    it('should not treat abort as error', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      const onError = jest.fn();
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onError
        })
      );

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });

      expect(onError).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });

  describe('reconnection', () => {
    it('should reconnect on error with exponential backoff', async () => {
      let attemptCount = 0;
      (global.fetch as jest.Mock).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failed');
        }
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"success": true}\n\n'));
              controller.close();
            }
          })
        };
      });

      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          reconnect: true,
          reconnectInterval: 10,
          maxReconnectAttempts: 3
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ success: true });
      }, { timeout: 5000 });

      expect(attemptCount).toBe(3);
    });

    it('should stop reconnecting after max attempts', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const onError = jest.fn();
      const { result } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onError,
          reconnect: true,
          reconnectInterval: 10,
          maxReconnectAttempts: 2
        })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(2);
      }, { timeout: 5000 });

      expect(result.current.error?.message).toBe('Connection failed');
    });
  });

  describe('request configuration', () => {
    it('should use custom method', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          method: 'GET'
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stream', expect.objectContaining({
          method: 'GET'
        }));
      });
    });

    it('should include custom headers', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          headers: {
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          }
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stream', expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value',
            'Content-Type': 'application/json'
          })
        }));
      });
    });

    it('should send request body', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const requestBody = { query: 'test', filters: { active: true } };

      renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          body: requestBody
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stream', expect.objectContaining({
          body: JSON.stringify(requestBody)
        }));
      });
    });
  });

  describe('lifecycle callbacks', () => {
    it('should call lifecycle callbacks', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"test": true}\n\n'));
            controller.close();
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const onStart = jest.fn();
      const onMessage = jest.fn();
      const onEnd = jest.fn();

      renderHook(() => 
        useStreaming({
          endpoint: '/api/stream',
          onStart,
          onMessage,
          onEnd
        })
      );

      await waitFor(() => {
        expect(onEnd).toHaveBeenCalled();
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith({ test: true });
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', async () => {
      const abortSpy = jest.fn();
      global.AbortController = jest.fn().mockImplementation(() => ({
        signal: {},
        abort: abortSpy
      }));

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start() {
            // Keep stream open
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { unmount } = renderHook(() => 
        useStreaming({
          endpoint: '/api/stream'
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('useSSE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create EventSource connection', async () => {
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse'
      })
    );

    await waitFor(() => {
      expect(result.current.eventSource).toBeTruthy();
      expect(result.current.isStreaming).toBe(true);
    });
  });

  it('should handle SSE messages', async () => {
    const onMessage = jest.fn();
    
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse',
        onMessage
      })
    );

    await waitFor(() => {
      expect(result.current.eventSource).toBeTruthy();
    });

    // Simulate message
    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'update', value: 42 })
    });
    
    act(() => {
      result.current.eventSource!.onmessage!(event);
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'update', value: 42 });
  });

  it('should handle custom event types', async () => {
    const onMessage = jest.fn();
    
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse',
        eventTypes: ['update', 'notification'],
        onMessage
      })
    );

    await waitFor(() => {
      expect(result.current.eventSource).toBeTruthy();
    });

    const eventSource = result.current.eventSource as MockEventSource;

    // Simulate custom event
    const updateEvent = new MessageEvent('update', {
      data: JSON.stringify({ id: 1, status: 'active' })
    });
    
    act(() => {
      eventSource.dispatchEvent(updateEvent);
    });

    expect(onMessage).toHaveBeenCalledWith({ id: 1, status: 'active' });
  });

  it('should handle connection errors', async () => {
    const onError = jest.fn();
    
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse',
        onError
      })
    );

    await waitFor(() => {
      expect(result.current.eventSource).toBeTruthy();
    });

    // Simulate error
    act(() => {
      result.current.eventSource!.onerror!(new Event('error'));
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'SSE connection failed'
    }));
  });

  it('should handle parse errors', async () => {
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse'
      })
    );

    await waitFor(() => {
      expect(result.current.eventSource).toBeTruthy();
    });

    // Simulate message with invalid JSON
    const event = new MessageEvent('message', {
      data: 'invalid json'
    });
    
    act(() => {
      result.current.eventSource!.onmessage!(event);
    });

    expect(logger.error).toHaveBeenCalledWith('[useSSE] Failed to parse message', expect.any(Object));
  });

  it('should call onStart when connection opens', async () => {
    const onStart = jest.fn();
    
    renderHook(() => 
      useSSE({
        endpoint: '/api/sse',
        onStart
      })
    );

    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
  });

  it('should disconnect and cleanup', () => {
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse'
      })
    );

    act(() => {
      result.current.connect();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.eventSource).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('should not auto-connect when disabled', () => {
    const { result } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse',
        autoConnect: false
      })
    );

    expect(result.current.eventSource).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => 
      useSSE({
        endpoint: '/api/sse'
      })
    );

    act(() => {
      result.current.connect();
    });

    unmount();

    expect(result.current.eventSource).toBeNull();
  });
});