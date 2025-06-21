import { renderHook, act } from '@testing-library/react-hooks';
import { useAIStream } from '@/hooks/use-ai-stream';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('../../../hooks/base/use-sse-stream');
jest.mock('../../../lib/utils/logger');

describe('useAIStream', () => {
  const mockSSEStream = {
    isStreaming: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSSEStream as jest.Mock).mockReturnValue(mockSSEStream);
  });

  describe('Initial state', () => {
    it('should initialize with empty messages and default values', () => {
      const { result } = renderHook(() => useAIStream());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept custom options', () => {
      const options = {
        agentId: 'customAgent',
        sessionId: 'session123',
        onStreamStart: jest.fn(),
        onStreamEnd: jest.fn(),
        onError: jest.fn(),
      };

      renderHook(() => useAIStream(options));

      expect(useSSEStream).toHaveBeenCalledWith(
        expect.objectContaining({
          autoConnect: false,
          onOpen: expect.any(Function),
          onEvent: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  describe('Sending messages', () => {
    it('should add user message and create assistant placeholder', async () => {
      const { result } = renderHook(() => useAIStream());

      await act(async () => {
        await result.current.sendMessage('Hello, AI!');
      });

      expect(result.current.messages).toHaveLength(2);
      
      // Check user message
      expect(result.current.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello, AI!',
      });

      // Check assistant placeholder
      expect(result.current.messages[1]).toMatchObject({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });

    it('should build correct SSE endpoint URL', async () => {
      const { result } = renderHook(() =>
        useAIStream({ agentId: 'testAgent', sessionId: 'session123' })
      );

      await act(async () => {
        await result.current.sendMessage('Test message', { context: 'value' });
      });

      // Verify URL was built correctly
      const expectedParams = new URLSearchParams({
        message: 'Test message',
        agentId: 'testAgent',
        sessionId: 'session123',
        context: JSON.stringify({ context: 'value' }),
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[useAIStream] Starting stream',
        expect.objectContaining({
          url: `/api/ai/stream?${expectedParams.toString()}`,
        })
      );
    });

    it('should handle send errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      // Make disconnect throw an error
      mockSSEStream.disconnect.mockImplementationOnce(() => {
        throw new Error('Disconnect failed');
      });

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(logger.error).toHaveBeenCalledWith(
        '[useAIStream] Failed to send message',
        expect.any(Object)
      );
    });
  });

  describe('SSE event handling', () => {
    let onEventHandler: (type: string, event: MessageEvent) => void;
    let onOpenHandler: () => void;
    let onErrorHandler: (ev: Event) => void;

    beforeEach(() => {
      (useSSEStream as jest.Mock).mockImplementation((config) => {
        onEventHandler = config.onEvent;
        onOpenHandler = config.onOpen;
        onErrorHandler = config.onError;
        return mockSSEStream;
      });
    });

    it('should handle connected event', () => {
      const onStreamStart = jest.fn();
      renderHook(() => useAIStream({ onStreamStart }));

      act(() => {
        onOpenHandler();
      });

      expect(logger.info).toHaveBeenCalledWith('[useAIStream] SSE connection opened');
      expect(onStreamStart).toHaveBeenCalled();
    });

    it('should handle chunk events and update assistant message', async () => {
      const { result } = renderHook(() => useAIStream());

      // Send a message first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const assistantMessageId = result.current.messages[1].id;

      // Simulate chunk events
      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'chunk', text: 'Hello ' }),
        }));
      });

      expect(result.current.messages[1].content).toBe('Hello ');

      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'chunk', text: 'there!' }),
        }));
      });

      expect(result.current.messages[1].content).toBe('Hello there!');
      expect(result.current.messages[1].isStreaming).toBe(true);
    });

    it('should handle end event', async () => {
      const onStreamEnd = jest.fn();
      const { result } = renderHook(() => useAIStream({ onStreamEnd }));

      // Send a message first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Simulate end event
      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'end' }),
        }));
      });

      expect(result.current.messages[1].isStreaming).toBe(false);
      expect(onStreamEnd).toHaveBeenCalled();
      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });

    it('should handle error event', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      // Send a message first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Simulate error event
      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'error', message: 'Server error occurred' }),
        }));
      });

      expect(result.current.messages[1].content).toBe('エラーが発生しました。');
      expect(result.current.messages[1].isStreaming).toBe(false);
      expect(onError).toHaveBeenCalledWith(new Error('Server error occurred'));
      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });

    it('should handle SSE connection errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAIStream({ onError }));

      // Send a message first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Simulate SSE error
      act(() => {
        onErrorHandler(new Event('error'));
      });

      expect(result.current.messages[1].content).toBe('エラーが発生しました。');
      expect(result.current.messages[1].isStreaming).toBe(false);
      expect(onError).toHaveBeenCalledWith(new Error('SSE connection error'));
    });

    it('should handle non-JSON SSE data', () => {
      renderHook(() => useAIStream());

      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: 'plain text data',
        }));
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[useAIStream] Failed to parse SSE data as JSON',
        { data: 'plain text data' }
      );
    });

    it('should ignore heartbeat events', () => {
      const { result } = renderHook(() => useAIStream());

      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'heartbeat' }),
        }));
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should handle unknown event types', () => {
      renderHook(() => useAIStream());

      act(() => {
        onEventHandler('message', new MessageEvent('message', {
          data: JSON.stringify({ type: 'unknown_type' }),
        }));
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[useAIStream] Unknown SSE event type',
        { type: 'unknown_type' }
      );
    });
  });

  describe('Clear messages', () => {
    it('should clear all messages and reset state', async () => {
      const { result } = renderHook(() => useAIStream());

      // Add some messages
      await act(async () => {
        await result.current.sendMessage('Message 1');
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      // Clear messages
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });
  });

  describe('Stop streaming', () => {
    it('should stop streaming and update current message', async () => {
      const { result } = renderHook(() => useAIStream());

      // Send a message first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Stop streaming
      act(() => {
        result.current.stopStreaming();
      });

      expect(result.current.messages[1].isStreaming).toBe(false);
      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });

    it('should handle stop when no active streaming', () => {
      const { result } = renderHook(() => useAIStream());

      act(() => {
        result.current.stopStreaming();
      });

      expect(mockSSEStream.disconnect).toHaveBeenCalled();
    });
  });

  describe('Stream state', () => {
    it('should reflect SSE streaming state', () => {
      mockSSEStream.isStreaming = true;
      const { result } = renderHook(() => useAIStream());

      expect(result.current.isStreaming).toBe(true);
    });

    it('should reflect SSE error state', () => {
      const error = new Error('SSE error');
      mockSSEStream.error = error;
      const { result } = renderHook(() => useAIStream());

      expect(result.current.error).toBe(error);
    });
  });
});

describe('formatStreamMessage', () => {
  it('should format bold text', () => {
    const result = formatStreamMessage('This is **bold** text');
    expect(result).toBe('This is <strong>bold</strong> text');
  });

  it('should format italic text', () => {
    const result = formatStreamMessage('This is *italic* text');
    expect(result).toBe('This is <em>italic</em> text');
  });

  it('should format line breaks', () => {
    const result = formatStreamMessage('Line 1\nLine 2');
    expect(result).toBe('Line 1<br />Line 2');
  });

  it('should handle multiple formatting', () => {
    const result = formatStreamMessage('**Bold** and *italic*\nNew line');
    expect(result).toBe('<strong>Bold</strong> and <em>italic</em><br />New line');
  });
});

describe('getTypingDelay', () => {
  it('should return a delay between 15 and 30ms', () => {
    // Mock Math.random
    const mockRandom = jest.spyOn(Math, 'random');

    // Test minimum delay
    mockRandom.mockReturnValue(0);
    expect(getTypingDelay('test')).toBe(15); // 30 * 0.5

    // Test maximum delay
    mockRandom.mockReturnValue(1);
    expect(getTypingDelay('test')).toBe(30); // 30 * 1

    // Test middle value
    mockRandom.mockReturnValue(0.5);
    expect(getTypingDelay('test')).toBe(22.5); // 30 * 0.75

    mockRandom.mockRestore();
  });
});