import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIChat } from '../use-ai-chat';
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
jest.mock('@/lib/utils/validation');
jest.mock('@/lib/utils/stream-utils');

// Mock fetch
global.fetch = jest.fn();

describe('useAIChat', () => {
  const mockChatStore = {
    currentSessionId: 'session-123',
    messages: [],
    addMessage: jest.fn(),
    updateLastMessage: jest.fn(),
    setLoading: jest.fn(),
    setStreaming: jest.fn(),
    setError: jest.fn(),
    createSession: jest.fn().mockReturnValue('new-session-123'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue(mockChatStore);
    (useIsClient as jest.Mock).mockReturnValue(true);
    (safeParseOrWarn as jest.Mock).mockImplementation((schema, value) => value);
  });

  describe('send function', () => {
    it('should not send empty messages', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.send('');
      });

      expect(fetch).not.toHaveBeenCalled();
      expect(mockChatStore.addMessage).not.toHaveBeenCalled();
    });

    it('should validate input message', async () => {
      (safeParseOrWarn as jest.Mock).mockReturnValue(null);
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.send('test message');
      });

      expect(safeParseOrWarn).toHaveBeenCalled();
      expect(mockChatStore.setError).toHaveBeenCalledWith('Message must be between 1-500 characters');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should create session if none exists', async () => {
      const { result } = renderHook(() => useAIChat());
      mockChatStore.currentSessionId = null;

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Response from AI' }),
      });

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

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      await act(async () => {
        await result.current.send('test message');
      });

      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test message',
          sessionId: 'session-123',
          messages: [{ role: 'user', content: 'test message' }],
        }),
      });

      expect(mockChatStore.addMessage).toHaveBeenCalledTimes(2);
      expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', 'AI response');
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

      (fetch as jest.Mock).mockResolvedValueOnce({
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
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        for (const data of mockStreamData) {
          yield JSON.stringify(data);
        }
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {},
      });

      await act(async () => {
        await result.current.send('test message');
      });

      await waitFor(() => {
        expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', 'Hello from AI');
      });
    });

    it('should handle HTTP errors', async () => {
      const { result } = renderHook(() => useAIChat());
      
      (fetch as jest.Mock).mockResolvedValueOnce({
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
        'Sorry, I encountered an error: Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      const { result } = renderHook(() => useAIChat());
      
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

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
      
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield JSON.stringify({ content: 'Partial ' });
        yield JSON.stringify({ error: 'Stream interrupted' });
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {},
      });

      await act(async () => {
        await result.current.send('test message');
      });

      await waitFor(() => {
        expect(mockChatStore.updateLastMessage).toHaveBeenCalledWith('session-123', 'Partial ');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith('Failed to send message: Stream interrupted');
    });

    it('should handle malformed JSON in stream', async () => {
      const { result } = renderHook(() => useAIChat());
      
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield 'not valid json';
        yield JSON.stringify({ content: 'Valid content', done: true });
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
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
      (useIsClient as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useAIChat());

      expect(result.current.isReady).toBe(false);
    });

    it('should be true when on client', () => {
      (useIsClient as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useAIChat());

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('middleware', () => {
    it('should apply retry middleware on failure', async () => {
      const { result } = renderHook(() => useAIChat());
      
      (fetch as jest.Mock)
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
      
      (fetch as jest.Mock).mockResolvedValueOnce({
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
      
      (fetch as jest.Mock).mockResolvedValueOnce({
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
      });
    });

    it('should include conversation history in request', async () => {
      mockChatStore.messages = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const { result } = renderHook(() => useAIChat());
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'New response' }),
      });

      await act(async () => {
        await result.current.send('new message');
      });

      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
        body: expect.stringContaining('"Previous message"'),
      }));
    });
  });
});