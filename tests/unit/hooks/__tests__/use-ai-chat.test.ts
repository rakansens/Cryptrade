/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAIChat } from '@/hooks/use-ai-chat';
import { useChat } from '@/store/chat.store';
import { useIsClient } from '@/hooks/use-is-client';
import { logger } from '@/lib/utils/logger';
import { safeParseOrWarn } from '@/lib/utils/validation';
import { streamToLines } from '@/lib/utils/stream-utils';

// Mock dependencies
jest.mock('@/store/chat.store');
jest.mock('@/hooks/use-is-client');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/utils/validation', () => ({
  safeParseOrWarn: jest.fn(),
  CommonSchemas: {
    ChatMessage: { parse: jest.fn() }
  }
}));
jest.mock('@/lib/utils/stream-utils', () => ({
  streamToLines: jest.fn()
}));

// Mock MSW to prevent interference with fetch mocks
jest.mock('../../../setup/msw-setup', () => ({
  mswServer: {
    close: jest.fn(),
    listen: jest.fn(),
    resetHandlers: jest.fn(),
    use: jest.fn(),
  }
}));

// Disable MSW polyfills and interceptors
jest.mock('../../../setup/polyfills', () => ({}));

// Import unified fetch mock
import { resetFetchMock, globalFetchMock } from '../../../setup/fetch-mock';

describe('useAIChat', () => {
  const mockChatStore = {
    currentSessionId: 'session-123',
    messages: [],
    addMessage: jest.fn(),
    updateLastMessage: jest.fn(),
    setLoading: jest.fn(),
    setStreaming: jest.fn(),
    setError: jest.fn(),
    createSession: jest.fn().mockResolvedValue('new-session-123'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset unified fetch mock
    resetFetchMock();
    // Ensure our fetch mock takes precedence over any interceptors
    global.fetch = globalFetchMock;
    // Reset mockChatStore to default state
    mockChatStore.currentSessionId = 'session-123';
    mockChatStore.messages = [];
    mockChatStore.createSession.mockResolvedValue('new-session-123');
    jest.mocked(useChat).mockReturnValue(mockChatStore);
    jest.mocked(useIsClient).mockReturnValue(true);
    jest.mocked(safeParseOrWarn).mockImplementation((_schema, value) => value);
  });

  describe('send function', () => {
    it('should not send empty messages', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.send('');
      });

      expect(globalFetchMock).not.toHaveBeenCalled();
      expect(mockChatStore.addMessage).not.toHaveBeenCalled();
    });

    it('should validate input message', async () => {
      jest.mocked(safeParseOrWarn).mockReturnValue(null);
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.send('test message');
      });

      expect(safeParseOrWarn).toHaveBeenCalled();
      expect(mockChatStore.setError).toHaveBeenCalledWith('Message must be between 1-500 characters');
      expect(globalFetchMock).not.toHaveBeenCalled();
    });

    it('should create session if none exists', async () => {
      // Override the mock for this specific test
      const mockChatStoreNoSession = {
        ...mockChatStore,
        currentSessionId: '',
      };
      jest.mocked(useChat).mockReturnValue(mockChatStoreNoSession);
      
      const { result } = renderHook(() => useAIChat());

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Response from AI' }),
      } as any);

      await act(async () => {
        await result.current.send('test message');
      });

      expect(mockChatStore.createSession).toHaveBeenCalled();
      expect(mockChatStore.addMessage).toHaveBeenCalledWith('new-session-123', {
        role: 'user',
        content: 'test message',
      });
    });

    it('should handle successful JSON response (A2A format)', async () => {
      const { result } = renderHook(() => useAIChat());
      
      const mockResponse = {
        message: 'AI response',
        selectedAgent: 'trading-agent',
        analysis: { confidence: 0.9 },
        execution: { executionTime: 123 },
      };

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(globalFetchMock).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test message',
          sessionId: 'session-123',
          messages: [{ role: 'user', content: 'test message' }],
        }),
      });

      expect(mockChatStore.addMessage).toHaveBeenCalledTimes(2);
      expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', {
        content: 'AI response',
        isTyping: false,
      });
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
      expect(mockChatStore.setStreaming).toHaveBeenCalledWith(false);
    });

    it('should handle proposal response', async () => {
      const { result } = renderHook(() => useAIChat());
      
      const mockProposalResponse = {
        message: 'トレンドライン候補を生成しました',
        proposalGroup: {
          id: 'pg-123',
          proposals: [
            { id: 'p1', type: 'trendline', description: 'Uptrend line' },
            { id: 'p2', type: 'support', description: 'Support level' },
          ],
        },
      };

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockProposalResponse,
      });

      await act(async () => {
        await result.current.send('トレンドラインを引いて');
      });

      expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', {
        content: 'トレンドライン候補を生成しました',
        type: 'proposal',
        proposalGroup: mockProposalResponse.proposalGroup,
        isTyping: false,
      });
    });

    it('should handle streaming response', async () => {
      const { result } = renderHook(() => useAIChat());
      
      const mockStreamData = [
        { content: 'Hello ' },
        { content: 'from ' },
        { content: 'AI' },
        { done: true },
      ];

      // Mock streamToLines async generator
      jest.mocked(streamToLines).mockImplementation(async function* () {
        for (const data of mockStreamData) {
          yield JSON.stringify(data);
        }
      });

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {},
      });

      await act(async () => {
        await result.current.send('test message');
      });

      await waitFor(() => {
        expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', {
          content: 'Hello from AI',
          isTyping: false,
        });
      });
    });

    it('should handle HTTP errors', async () => {
      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith('Failed to send message: Internal Server Error');
      expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith(
        'session-123',
        {
          content: 'Sorry, I encountered an error: Internal Server Error',
          isTyping: false,
        }
      );
    });

    it('should handle network errors', async () => {
      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.send('test message');
      });

      expect(logger.error).toHaveBeenCalled();
      expect(mockChatStore.setError).toHaveBeenCalledWith('Failed to send message: Network error');
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
      expect(mockChatStore.setStreaming).toHaveBeenCalledWith(false);
    });

    it('should handle streaming errors', async () => {
      const { result } = renderHook(() => useAIChat());
      
      jest.mocked(streamToLines).mockImplementation(async function* () {
        yield JSON.stringify({ content: 'Partial ' });
        yield JSON.stringify({ error: 'Stream interrupted' });
      });

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {},
      });

      await act(async () => {
        await result.current.send('test message');
      });

      await waitFor(() => {
        expect(mockChatStore.updateLastMessage).toHaveBeenNthCalledWith(1, 'session-123', {
          content: 'Partial ',
          isTyping: false,
        });
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith('Failed to send message: Stream interrupted');
    });

    it('should handle malformed JSON in stream', async () => {
      const { result } = renderHook(() => useAIChat());
      
      jest.mocked(streamToLines).mockImplementation(async function* () {
        yield 'not valid json';
        yield JSON.stringify({ content: 'Valid content', done: true });
      });

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {},
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[useAIChat] Failed to parse streaming JSON',
        expect.any(Object)
      );
    });
  });

  describe('isReady state', () => {
    it('should be false when not on client', () => {
      jest.mocked(useIsClient).mockReturnValue(false);
      const { result } = renderHook(() => useAIChat());

      expect(result.current.isReady).toBe(false);
    });

    it('should be true when on client', () => {
      jest.mocked(useIsClient).mockReturnValue(true);
      const { result } = renderHook(() => useAIChat());

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('middleware', () => {
    it('should apply retry middleware on failure', async () => {
      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Success on retry' }),
        });

      await act(async () => {
        await result.current.send('test message');
      });

      // Currently retry is not implemented, so it should fail on first attempt
      expect(logger.warn).toHaveBeenCalledWith(
        '[useAIChat] Request failed, could implement retry logic here',
        expect.any(Error)
      );
    });

    it('should log trace information', async () => {
      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Response' }),
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(logger.info).toHaveBeenCalledWith('[useAIChat] Starting AI request');
      expect(logger.info).toHaveBeenCalledWith(
        '[useAIChat] AI request completed',
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });
  });

  describe('message handling', () => {
    it('should add both user and assistant messages optimistically', async () => {
      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'AI response' }),
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(mockChatStore.addMessage).toHaveBeenNthCalledWith(1, 'session-123', {
        role: 'user',
        content: 'test message',
      });

      expect(mockChatStore.addMessage).toHaveBeenNthCalledWith(2, 'session-123', {
        role: 'assistant',
        content: '',
        isTyping: true,
      });
    });

    it('should include conversation history in request', async () => {
      mockChatStore.messages = [
        { role: 'user', content: 'Previous message' } as never,
        { role: 'assistant', content: 'Previous response' } as never,
      ];

      const { result } = renderHook(() => useAIChat());
      
      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'New response' }),
      });

      await act(async () => {
        await result.current.send('new message');
      });

      expect(globalFetchMock).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
        body: expect.stringContaining('"Previous message"'),
      }));
    });
  });
});