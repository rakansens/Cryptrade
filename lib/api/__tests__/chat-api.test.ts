// Mock dependencies before imports
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/logger');

// Mock global fetch
global.fetch = jest.fn();

import { ChatAPI, ChatMessage, ChatSession } from '../chat-api';
import { apiCache } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';
import type { CreateSessionResponse, AddMessageResponse } from '@/types/api.types';
import type { ProposalGroup, EntryProposalGroup } from '@/types/database.types';

describe('ChatAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    // Mock withRetry to execute function immediately
    (withRetry as jest.Mock).mockImplementation(async (fn) => fn());
  });

  describe('convertToChatSession', () => {
    it('should convert database session to chat session format', () => {
      const dbSession = {
        id: 'session-1',
        title: 'Test Session',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T01:00:00Z'),
      };

      const result = ChatAPI.convertToChatSession(dbSession);

      expect(result).toEqual({
        id: 'session-1',
        title: 'Test Session',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        updatedAt: new Date('2024-01-01T01:00:00Z').getTime(),
      });
    });

    it('should handle null title with default value', () => {
      const dbSession = {
        id: 'session-1',
        title: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T01:00:00Z'),
      };

      const result = ChatAPI.convertToChatSession(dbSession);

      expect(result.title).toBe('Untitled Session');
    });
  });

  describe('convertToChatMessage', () => {
    it('should convert database message to chat message format', () => {
      const dbMessage: AddMessageResponse['message'] = {
        id: 'msg-1',
        content: 'Test message',
        role: 'user',
        timestamp: 1234567890,
        type: 'text',
        isTyping: false,
      };

      const result = ChatAPI.convertToChatMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-1',
        content: 'Test message',
        role: 'user',
        timestamp: 1234567890,
        type: 'text',
        isTyping: false,
      });
    });

    it('should handle proposal group data', () => {
      const proposalGroup: ProposalGroup = {
        proposals: [
          {
            symbol: 'BTCUSDT',
            action: 'BUY',
            timeframe: '1h',
            entry: 50000,
            targets: [51000, 52000],
            stopLoss: 49000,
            confidence: 0.8,
            reasoning: 'Test reasoning',
          },
        ],
      };

      const dbMessage: AddMessageResponse['message'] = {
        id: 'msg-1',
        content: 'Proposal message',
        role: 'assistant',
        timestamp: 1234567890,
        type: 'proposal',
        proposalGroup,
      };

      const result = ChatAPI.convertToChatMessage(dbMessage);

      expect(result.proposalGroup).toEqual(proposalGroup);
    });

    it('should handle entry proposal group data', () => {
      const entryProposalGroup: EntryProposalGroup = {
        proposals: [
          {
            symbol: 'BTCUSDT',
            action: 'BUY',
            entry: 50000,
            stopLoss: 49000,
            targets: [51000],
            confidence: 0.9,
            reasoning: 'Entry reasoning',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const dbMessage: AddMessageResponse['message'] = {
        id: 'msg-1',
        content: 'Entry message',
        role: 'assistant',
        timestamp: 1234567890,
        type: 'entry',
        entryProposalGroup,
      };

      const result = ChatAPI.convertToChatMessage(dbMessage);

      expect(result.entryProposalGroup).toEqual(entryProposalGroup);
    });

    it('should handle undefined and null values properly', () => {
      const dbMessage: AddMessageResponse['message'] = {
        id: 'msg-1',
        content: 'Test',
        role: 'user',
        timestamp: 1234567890,
        proposalGroup: undefined,
        entryProposalGroup: null,
      };

      const result = ChatAPI.convertToChatMessage(dbMessage);

      expect(result.proposalGroup).toBeUndefined();
      expect(result.entryProposalGroup).toBeUndefined();
    });
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockResponse: CreateSessionResponse = {
        session: {
          id: 'new-session',
          title: 'New Session',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await ChatAPI.createSession('user-1', 'New Session');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'user-1', title: 'New Session' }),
      });

      expect(result).toEqual({
        id: 'new-session',
        title: 'New Session',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        updatedAt: new Date('2024-01-01T00:00:00Z').getTime(),
      });
    });

    it('should handle optional parameters', async () => {
      const mockResponse: CreateSessionResponse = {
        session: {
          id: 'new-session',
          title: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await ChatAPI.createSession();

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(ChatAPI.createSession()).rejects.toThrow('Failed to create session: Internal Server Error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(ChatAPI.createSession()).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalledWith('[ChatAPI] Failed to create session', { error: networkError });
    });
  });

  describe('getUserSessions', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should return cached sessions if available', async () => {
      const cachedSessions: ChatSession[] = [
        {
          id: 'session-1',
          title: 'Cached Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockApiCache.createKey.mockReturnValue('chat_sessions_user-1');
      mockApiCache.get.mockReturnValue(cachedSessions);

      const result = await ChatAPI.getUserSessions('user-1');

      expect(result).toEqual(cachedSessions);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('[ChatAPI] Returning cached sessions', { userId: 'user-1' });
    });

    it('should fetch sessions from API when cache is empty', async () => {
      const sessions: ChatSession[] = [
        {
          id: 'session-1',
          title: 'Session 1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions }),
      });

      const result = await ChatAPI.getUserSessions('user-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions', {
        method: 'GET',
        headers: { 'x-user-id': 'user-1' },
      });
      expect(mockApiCache.set).toHaveBeenCalledWith('chat_sessions_user-1', sessions, { useLocalStorage: true });
      expect(result).toEqual(sessions);
    });

    it('should handle default user when userId is not provided', async () => {
      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      await ChatAPI.getUserSessions();

      expect(mockApiCache.createKey).toHaveBeenCalledWith('chat_sessions', { userId: 'default' });
      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions', {
        method: 'GET',
        headers: {},
      });
    });

    it('should use stale cache when API fails', async () => {
      const staleSessions: ChatSession[] = [
        {
          id: 'stale-session',
          title: 'Stale Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockApiCache.get
        .mockReturnValueOnce(null) // First call - no fresh cache
        .mockReturnValueOnce(staleSessions); // Second call - stale cache

      const error = new Error('API Error');
      (withRetry as jest.Mock).mockRejectedValueOnce(error);

      const result = await ChatAPI.getUserSessions('user-1');

      expect(result).toEqual(staleSessions);
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('[ChatAPI] Using stale cache due to API failure', { userId: 'user-1' });
    });

    it('should return empty array in development when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await ChatAPI.getUserSessions();

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChatAPI] Returning empty array in development mode');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(ChatAPI.getUserSessions()).rejects.toThrow('Failed to get sessions: API Error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('addMessage', () => {
    it('should add a text message successfully', async () => {
      const mockResponse: AddMessageResponse = {
        message: {
          id: 'msg-1',
          content: 'Hello',
          role: 'user',
          timestamp: Date.now(),
          type: 'text',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const message = {
        content: 'Hello',
        role: 'user' as const,
        type: 'text' as const,
      };

      const result = await ChatAPI.addMessage('session-1', message);

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions/session-1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Hello',
          role: 'user',
          type: 'text',
        }),
      });

      expect(result.content).toBe('Hello');
      expect(result.role).toBe('user');
    });

    it('should add a proposal message with proposal group', async () => {
      const proposalGroup: ProposalGroup = {
        proposals: [
          {
            symbol: 'BTCUSDT',
            action: 'BUY',
            timeframe: '1h',
            entry: 50000,
            targets: [51000],
            stopLoss: 49000,
            confidence: 0.8,
            reasoning: 'Test',
          },
        ],
      };

      const mockResponse: AddMessageResponse = {
        message: {
          id: 'msg-1',
          content: 'Proposal',
          role: 'assistant',
          timestamp: Date.now(),
          type: 'proposal',
          proposalGroup,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const message = {
        content: 'Proposal',
        role: 'assistant' as const,
        type: 'proposal' as const,
        proposalGroup,
      };

      const result = await ChatAPI.addMessage('session-1', message);

      expect(result.proposalGroup).toEqual(proposalGroup);
    });

    it('should handle optional fields correctly', async () => {
      const mockResponse: AddMessageResponse = {
        message: {
          id: 'msg-1',
          content: 'Test',
          role: 'user',
          timestamp: Date.now(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const message = {
        content: 'Test',
        role: 'user' as const,
      };

      await ChatAPI.addMessage('session-1', message);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody).toEqual({
        content: 'Test',
        role: 'user',
      });
      expect(sentBody.type).toBeUndefined();
      expect(sentBody.proposalGroup).toBeUndefined();
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      const message = {
        content: 'Test',
        role: 'user' as const,
      };

      await expect(ChatAPI.addMessage('session-1', message)).rejects.toThrow('Failed to add message: Bad Request');
      expect(logger.error).toHaveBeenCalledWith('[ChatAPI] Failed to add message', {
        error: expect.any(Error),
        sessionId: 'session-1',
      });
    });
  });

  describe('getMessages', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should return cached messages if available', async () => {
      const cachedMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Cached message',
          role: 'user',
          timestamp: Date.now(),
        },
      ];

      mockApiCache.createKey.mockReturnValue('chat_messages_session-1');
      mockApiCache.get.mockReturnValue(cachedMessages);

      const result = await ChatAPI.getMessages('session-1');

      expect(result).toEqual(cachedMessages);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch messages from API when cache is empty', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Message 1',
          role: 'user',
          timestamp: Date.now(),
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages }),
      });

      const result = await ChatAPI.getMessages('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions/session-1/messages', {
        method: 'GET',
      });
      expect(mockApiCache.set).toHaveBeenCalledWith('chat_messages_session-1', messages, { useLocalStorage: true });
      expect(result).toEqual(messages);
    });

    it('should handle retry mechanism', async () => {
      mockApiCache.get.mockReturnValue(null);

      const retryFn = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce([]);

      (withRetry as jest.Mock).mockImplementation(async (fn, options) => {
        // Simulate retry behavior
        try {
          return await fn();
        } catch (error) {
          if (options?.onRetry) {
            options.onRetry(error, 1);
          }
          return await fn();
        }
      });

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });

      await ChatAPI.getMessages('session-1');

      expect(logger.warn).toHaveBeenCalledWith('[ChatAPI] Retrying getMessages', {
        error: 'First attempt failed',
        attempt: 1,
        sessionId: 'session-1',
      });
    });
  });

  describe('getSessionWithMessages', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should fetch session with messages successfully', async () => {
      const sessionData = {
        session: {
          id: 'session-1',
          title: 'Test Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        messages: [
          {
            id: 'msg-1',
            content: 'Test message',
            role: 'user',
            timestamp: Date.now(),
          },
        ],
      };

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => sessionData,
      });

      const result = await ChatAPI.getSessionWithMessages('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions/session-1?include=messages', {
        method: 'GET',
      });
      expect(result).toEqual(sessionData);
    });

    it('should return null in development mode when API fails', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await ChatAPI.getSessionWithMessages('session-1');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('[ChatAPI] Returning null in development mode');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('updateSessionTitle', () => {
    it('should update session title successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChatAPI.updateSessionTitle('session-1', 'New Title');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions/session-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Title' }),
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(ChatAPI.updateSessionTitle('session-1', 'New Title')).rejects.toThrow(
        'Failed to update session: Not Found'
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChatAPI.deleteSession('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/sessions/session-1', {
        method: 'DELETE',
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
      });

      await expect(ChatAPI.deleteSession('session-1')).rejects.toThrow('Failed to delete session: Forbidden');
      expect(logger.error).toHaveBeenCalledWith('[ChatAPI] Failed to delete session', {
        error: expect.any(Error),
        sessionId: 'session-1',
      });
    });
  });

  describe('migrateFromLocalStorage', () => {
    it('should migrate data successfully', async () => {
      const migrationData = {
        sessions: {
          'session-1': {
            id: 'session-1',
            title: 'Session 1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        messages: {
          'session-1': [
            {
              id: 'msg-1',
              content: 'Message 1',
              role: 'user' as const,
              timestamp: Date.now(),
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChatAPI.migrateFromLocalStorage(migrationData);

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(migrationData),
      });
    });

    it('should handle migration errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const migrationData = {
        sessions: {},
        messages: {},
      };

      await expect(ChatAPI.migrateFromLocalStorage(migrationData)).rejects.toThrow(
        'Failed to migrate data: Internal Server Error'
      );
      expect(logger.error).toHaveBeenCalledWith('[ChatAPI] Failed to migrate from localStorage', {
        error: expect.any(Error),
      });
    });
  });
});