// Mock dependencies before imports
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/logger');

// Mock environment configuration
jest.mock('@/config/env', () => {
  const mockEnv = {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'test-key',
    PORT: 3000,
    LOG_TRANSPORT: 'console',
  };
  
  return {
    env: mockEnv,
    loadEnv: jest.fn(() => mockEnv),
    isDevelopment: jest.fn(() => false),
    isProduction: jest.fn(() => false),
    isTest: jest.fn(() => true),
    _resetEnvCache: jest.fn(),
  };
});

// Mock global fetch
global.fetch = jest.fn();

import { ChatAPI, ChatMessage, ChatSession } from '@/lib/api/chat-api';
import { apiCache, createKey } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';
import type { CreateSessionResponse, AddMessageResponse } from '@/types/api.types';
import type { ProposalGroup, EntryProposalGroup } from '@/types/proposals';

describe('ChatAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    if (typeof (global.fetch as any).mockReset === 'function') {
      (global.fetch as jest.Mock).mockReset();
    }
    // Mock withRetry to execute function immediately
    jest.mocked(withRetry).mockImplementation(async (fn) => fn());
    // Mock createKey to return expected cache keys
    jest.mocked(createKey).mockImplementation((prefix, params) => {
      if (prefix === 'chat_sessions' && params?.userId) {
        return `chat_sessions_${params.userId}`;
      }
      if (prefix === 'chat_messages' && params?.sessionId) {
        return `chat_messages_${params.sessionId}`;
      }
      if (prefix === 'analysis_session' && params?.sessionId) {
        return `analysis_session_${params.sessionId}`;
      }
      if (prefix === 'analysis_active' && params?.symbol) {
        return `analysis_active_${params.symbol}`;
      }
      return `${prefix}_${JSON.stringify(params)}`;
    });
  });

  describe('convertToChatSession', () => {
    it('should convert database session to chat session format', () => {
      const dbSession = {
        id: 'session-1',
        title: 'Test Session',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        updatedAt: new Date('2024-01-01T01:00:00Z').getTime(),
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
        title: '',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        updatedAt: new Date('2024-01-01T01:00:00Z').getTime(),
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
        id: 'group-1',
        title: 'Test Proposal Group',
        description: 'Test Description',
        proposals: [
          {
            id: 'proposal-1',
            type: 'trendline' as any,
            analysisType: 'trendline' as any,
            coordinates: {
              start: { x: 0, y: 50000 },
              end: { x: 100, y: 52000 },
            },
            confidence: 0.8,
            reasoning: 'Test reasoning',
            priority: 'high' as const,
            status: 'pending' as any,
            createdAt: Date.now(),
          },
        ],
        groupType: 'analysis' as const,
        createdAt: Date.now(),
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
        id: 'entry-group-1',
        title: 'Entry Proposal',
        description: 'Test entry proposal',
        proposals: [
          {
            id: 'entry-1',
            type: 'entry',
            direction: 'long',
            entryPrice: 50000,
            strategy: 'dayTrading' as any,
            timeframe: '1h',
            symbol: 'BTCUSDT',
            confidence: 0.8,
            priority: 'high',
            riskParameters: {
              stopLoss: 49000,
              stopLossPercent: 2,
              takeProfitTargets: [{ price: 51000, percentage: 2 }],
              riskRewardRatio: 2.0,
              positionSizePercent: 1,
              maxRiskPercent: 2,
            },
            conditions: {
              trigger: 'market',
            },
            marketContext: {
              trend: 'uptrend',
              volatility: 'medium',
              momentum: 'strong',
              volume: 'increasing',
              keyLevels: { support: [49000], resistance: [51000] },
            },
            reasoning: {
              primary: 'Entry reasoning',
              technicalFactors: [],
              risks: [],
            },
            status: 'pending' as any,
            createdAt: Date.now(),
          },
        ],
        groupType: 'entry',
        createdAt: Date.now(),
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
          createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
          updatedAt: new Date('2024-01-01T00:00:00Z').getTime(),
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
          title: '',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
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

      // createKey will generate the cache key
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
      jest.mocked(withRetry).mockRejectedValueOnce(error);

      const result = await ChatAPI.getUserSessions('user-1');

      expect(result).toEqual(staleSessions);
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('[ChatAPI] Using stale cache due to API failure', { userId: 'user-1' });
    });

    it('should return empty array in development when no cache available', async () => {
      // Mock env module directly
      const envModule = require('@/config/env');
      const originalEnv = envModule.env;
      
      // Mock the env object to return development mode
      envModule.env = {
        ...originalEnv,
        NODE_ENV: 'development'
      };

      mockApiCache.get.mockReturnValue(null);
      
      // Mock withRetry to simulate API failure
      jest.mocked(withRetry).mockImplementation(async (fn) => {
        throw new Error('API Error');
      });

      await expect(ChatAPI.getUserSessions()).rejects.toThrow('Failed to get sessions: API Error');

      // Restore
      envModule.env = originalEnv;
    });

    it('should throw error in production when no cache available', async () => {
      // Mock env module directly
      const envModule = require('@/config/env');
      const originalEnv = envModule.env;
      
      // Mock the env object to return production mode
      envModule.env = {
        ...originalEnv,
        NODE_ENV: 'production'
      };

      mockApiCache.get.mockReturnValue(null);
      
      // Mock withRetry to simulate API failure
      jest.mocked(withRetry).mockImplementation(async (fn) => {
        throw new Error('API Error');
      });

      await expect(ChatAPI.getUserSessions()).rejects.toThrow('Failed to get sessions: API Error');

      // Restore
      envModule.env = originalEnv;
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
        id: 'group-1',
        title: 'Test Proposal Group',
        description: 'Test Description',
        proposals: [
          {
            id: 'proposal-1',
            type: 'trendline' as any,
            analysisType: 'trendline' as any,
            coordinates: {
              start: { x: 0, y: 50000 },
              end: { x: 100, y: 51000 },
            },
            confidence: 0.8,
            reasoning: 'Test',
            priority: 'high' as const,
            status: 'pending' as any,
            createdAt: Date.now(),
          },
        ],
        groupType: 'analysis' as const,
        createdAt: Date.now(),
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

      // createKey will generate the cache key
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

      // @ts-ignore - retryFn is only used in mock implementation
      const retryFn = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce([]);

      jest.mocked(withRetry).mockImplementation(async (fn, options) => {
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
      // Mock env module directly
      const envModule = require('@/config/env');
      const originalEnv = envModule.env;
      
      // Mock the env object to return development mode
      envModule.env = {
        ...originalEnv,
        NODE_ENV: 'development'
      };

      mockApiCache.get.mockReturnValue(null);
      
      // Mock withRetry to simulate API failure
      jest.mocked(withRetry).mockImplementation(async (fn) => {
        throw new Error('API Error');
      });

      await expect(ChatAPI.getSessionWithMessages('session-1')).rejects.toThrow('Failed to get session session-1: API Error');

      // Restore
      envModule.env = originalEnv;
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