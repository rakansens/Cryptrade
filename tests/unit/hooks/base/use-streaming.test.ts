import { renderHook, act } from '@testing-library/react-hooks';
import { .* } from '../../../../hooks/base/use-streaming';
import { .* } from '../../../../lib/utils/logger';

// Mock logger
jest.mock('../../../../lib/utils/logger');

// Mock fetch
global.fetch = jest.fn();

// Mock EventSource
global.EventSource = jest.fn() as any;

describe('useStreaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useStreaming({ endpoint: '/api/stream', autoConnect: false })
      );

      expect(result.current.data).toBeNull();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should auto-connect when enabled', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"test": "data"}\n\n'));
            controller.close();
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() =>
        useStreaming({ endpoint: '/api/stream', autoConnect: true })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stream',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Connection management', () => {
    it('should connect successfully and handle stream data', async () => {
      const onMessage = jest.fn();
      const onStart = jest.fn();
      const onEnd = jest.fn();

      const mockResponse = {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"value": 1}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: {"value": 2}\n\n'));
            controller.close();
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          onMessage,
          onStart,
          onEnd,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(onStart).toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(false); // Stream has ended
      expect(onEnd).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          onError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).toEqual(new Error('Connection failed'));
      expect(onError).toHaveBeenCalledWith(new Error('Connection failed'));
    });

    it('should handle HTTP errors', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          onError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error?.message).toBe('Stream request failed: 500 Internal Server Error');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Disconnection and cleanup', () => {
    it('should disconnect and clean up resources', async () => {
      const abortSpy = jest.fn();
      const mockAbortController = {
        signal: {},
        abort: abortSpy,
      };
      global.AbortController = jest.fn(() => mockAbortController) as any;

      const { result } = renderHook(() =>
        useStreaming({ endpoint: '/api/stream', autoConnect: false })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isStreaming).toBe(false);
    });

    it('should clean up on unmount', () => {
      const abortSpy = jest.fn();
      const mockAbortController = {
        signal: {},
        abort: abortSpy,
      };
      global.AbortController = jest.fn(() => mockAbortController) as any;

      const { unmount } = renderHook(() =>
        useStreaming({ endpoint: '/api/stream' })
      );

      unmount();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Message parsing', () => {
    it('should parse JSON messages correctly', async () => {
      const onMessage = jest.fn();
      const parseResponse = jest.fn((chunk) => {
        try {
          return JSON.parse(chunk);
        } catch {
          return null;
        }
      });

      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"test": "data"}\n'));
            controller.enqueue(new TextEncoder().encode('invalid json\n'));
            controller.enqueue(new TextEncoder().encode('{"valid": true}\n'));
            controller.close();
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          onMessage,
          parseResponse,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(parseResponse).toHaveBeenCalledTimes(3);
      expect(onMessage).toHaveBeenCalledTimes(2); // Only valid JSON
    });

    it('should handle SSE format messages', async () => {
      const onMessage = jest.fn();

      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"type": "update"}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: {"type": "complete"}\n\n'));
            controller.close();
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          onMessage,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(onMessage).toHaveBeenCalledWith({ type: 'update' });
      expect(onMessage).toHaveBeenCalledWith({ type: 'complete' });
    });
  });

  describe('Reconnection logic', () => {
    it('should attempt reconnection on failure', async () => {
      jest.useFakeTimers();
      const onError = jest.fn();

      // First attempt fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));
      
      // Second attempt succeeds
      const mockResponse = {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: false,
          reconnect: true,
          reconnectInterval: 1000,
          maxReconnectAttempts: 2,
          onError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(onError).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[useStreaming] Scheduling reconnect',
        expect.objectContaining({ attempt: 1 })
      );

      // Fast forward to trigger reconnection
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      jest.useRealTimers();
    });

    it('should use exponential backoff for reconnection', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          autoConnect: true,
          reconnect: true,
          reconnectInterval: 1000,
          maxReconnectAttempts: 3,
        })
      );

      // Wait for initial connection attempt
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useStreaming] Scheduling reconnect',
        expect.objectContaining({ attempt: 1, delay: 1000 })
      );

      // Second attempt
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useStreaming] Scheduling reconnect',
        expect.objectContaining({ attempt: 2, delay: 2000 })
      );

      jest.useRealTimers();
    });
  });

  describe('Request customization', () => {
    it('should include custom headers and body', async () => {
      const customHeaders = { Authorization: 'Bearer token' };
      const customBody = { filter: 'important' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      });

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          method: 'POST',
          headers: customHeaders,
          body: customBody,
          autoConnect: false,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stream',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...customHeaders,
          },
          body: JSON.stringify(customBody),
        })
      );
    });

    it('should support GET method without body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      });

      const { result } = renderHook(() =>
        useStreaming({
          endpoint: '/api/stream',
          method: 'GET',
          autoConnect: false,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stream',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect((global.fetch as jest.Mock).mock.calls[0][1]).not.toHaveProperty('body');
    });
  });
});

describe('useSSE', () => {
  let mockEventSource: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventSource = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
      readyState: EventSource.CONNECTING,
      onopen: null,
      onerror: null,
      onmessage: null,
    };
    (global.EventSource as jest.Mock).mockImplementation(() => mockEventSource);
  });

  describe('Initial state and connection', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useSSE({ endpoint: '/api/sse', autoConnect: false })
      );

      expect(result.current.data).toBeNull();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.eventSource).toBeNull();
    });

    it('should auto-connect when enabled', () => {
      renderHook(() => useSSE({ endpoint: '/api/sse' }));

      expect(global.EventSource).toHaveBeenCalledWith('/api/sse');
    });

    it('should handle connection open event', () => {
      const onStart = jest.fn();

      const { result } = renderHook(() =>
        useSSE({ endpoint: '/api/sse', onStart })
      );

      // Simulate connection open
      act(() => {
        mockEventSource.readyState = EventSource.OPEN;
        mockEventSource.onopen?.();
      });

      expect(onStart).toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(true);
    });
  });

  describe('Message handling', () => {
    it('should handle standard message events', () => {
      const onMessage = jest.fn();

      renderHook(() => useSSE({ endpoint: '/api/sse', onMessage }));

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'update', value: 42 }),
      });

      act(() => {
        mockEventSource.onmessage?.(messageEvent);
      });

      expect(onMessage).toHaveBeenCalledWith({ type: 'update', value: 42 });
    });

    it('should handle custom event types', () => {
      const onMessage = jest.fn();

      renderHook(() =>
        useSSE({
          endpoint: '/api/sse',
          eventTypes: ['trade', 'orderbook'],
          onMessage,
        })
      );

      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('trade', expect.any(Function));
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('orderbook', expect.any(Function));

      // Simulate custom event
      const tradeHandler = mockEventSource.addEventListener.mock.calls[0][1];
      const tradeEvent = new MessageEvent('trade', {
        data: JSON.stringify({ price: 100, volume: 10 }),
      });

      act(() => {
        tradeHandler(tradeEvent);
      });

      expect(onMessage).toHaveBeenCalledWith({ price: 100, volume: 10 });
    });

    it('should handle JSON parse errors gracefully', () => {
      const onMessage = jest.fn();

      renderHook(() => useSSE({ endpoint: '/api/sse', onMessage }));

      const messageEvent = new MessageEvent('message', {
        data: 'invalid json',
      });

      act(() => {
        mockEventSource.onmessage?.(messageEvent);
      });

      expect(onMessage).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        '[useSSE] Failed to parse message',
        expect.any(Object)
      );
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      const onError = jest.fn();

      renderHook(() => useSSE({ endpoint: '/api/sse', onError }));

      const errorEvent = new Event('error');

      act(() => {
        mockEventSource.onerror?.(errorEvent);
      });

      expect(onError).toHaveBeenCalledWith(new Error('SSE connection failed'));
      expect(logger.error).toHaveBeenCalledWith(
        '[useSSE] Connection error',
        expect.any(Object)
      );
    });

    it('should handle EventSource creation errors', () => {
      const onError = jest.fn();
      (global.EventSource as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to create EventSource');
      });

      renderHook(() => useSSE({ endpoint: '/api/sse', onError }));

      expect(onError).toHaveBeenCalledWith(new Error('Failed to create EventSource'));
      expect(logger.error).toHaveBeenCalledWith(
        '[useSSE] Failed to create EventSource',
        expect.any(Object)
      );
    });
  });

  describe('Disconnection and cleanup', () => {
    it('should disconnect and clean up event listeners', () => {
      const { result } = renderHook(() =>
        useSSE({
          endpoint: '/api/sse',
          eventTypes: ['custom1', 'custom2'],
        })
      );

      // Store handlers
      const handlers = mockEventSource.addEventListener.mock.calls.map(call => ({
        type: call[0],
        handler: call[1],
      }));

      act(() => {
        result.current.disconnect();
      });

      // Verify all handlers were removed
      handlers.forEach(({ type, handler }) => {
        expect(mockEventSource.removeEventListener).toHaveBeenCalledWith(type, handler);
      });

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(mockEventSource.onopen).toBeNull();
      expect(mockEventSource.onerror).toBeNull();
      expect(mockEventSource.onmessage).toBeNull();
      expect(result.current.eventSource).toBeNull();
    });

    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() => useSSE({ endpoint: '/api/sse' }));

      unmount();

      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('should prevent operations after unmount', () => {
      const onMessage = jest.fn();
      const { unmount } = renderHook(() =>
        useSSE({ endpoint: '/api/sse', onMessage })
      );

      unmount();

      // Try to trigger message after unmount
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ test: 'data' }),
      });

      act(() => {
        mockEventSource.onmessage?.(messageEvent);
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('Multiple connections', () => {
    it('should not create duplicate connections', async () => {
      const { result } = renderHook(() =>
        useSSE({ endpoint: '/api/sse', autoConnect: false })
      );

      mockEventSource.readyState = EventSource.OPEN;

      await act(async () => {
        await result.current.connect();
        await result.current.connect(); // Second call
      });

      expect(global.EventSource).toHaveBeenCalledTimes(1);
    });
  });
});