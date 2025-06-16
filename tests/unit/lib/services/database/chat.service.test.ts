import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { checkDatabaseHealth } from '@/lib/db/health-check';
import { withDatabase } from '@/lib/utils/db-connection';
import { validateAndSanitizeChatMessage } from '@/lib/services/database/chat.validation';
import { chatRateLimiters, enforceRateLimit } from '@/lib/services/database/rate-limiter';
import { chatCaches, invalidateSessionCache, invalidateUserCache } from '@/lib/services/database/chat-cache';
import type { ConversationSession, ConversationMessage } from '@prisma/client';
import type { ChatMessage, ChatSession } from '@/lib/services/database/chat.service';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger');
jest.mock('@/lib/db/health-check');
jest.mock('@/lib/utils/db-connection');
jest.mock('../chat.validation');
jest.mock('../rate-limiter');
jest.mock('../chat-cache');

describe('ChatDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock withDatabase to execute main function by default
    (withDatabase as jest.Mock).mockImplementation(async (mainFn) => mainFn());
    // Mock validation to pass through by default
    (validateAndSanitizeChatMessage as jest.Mock).mockImplementation((msg) => msg);
    // Mock rate limiting to pass through
    (enforceRateLimit as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createSession', () => {
    const mockSession: ConversationSession = {
      id: 'session-1',
      userId: 'user-1',
      summary: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
      startedAt: new Date(),
      metadata: null,
    };

    it('should create a session successfully', async () => {
      (checkDatabaseHealth as jest.Mock).mockResolvedValueOnce({ status: 'healthy' });
      (prisma.conversationSession.create as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await ChatDatabaseService.createSession('user-1', 'Test Session');

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          summary: 'Test Session',
        },
      });
      expect(result).toEqual(mockSession);
      expect(invalidateUserCache).toHaveBeenCalledWith('user-1');
      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Session created', { sessionId: 'session-1' });
    });

    it('should create session with default title when not provided', async () => {
      (checkDatabaseHealth as jest.Mock).mockResolvedValueOnce({ status: 'healthy' });
      (prisma.conversationSession.create as jest.Mock).mockResolvedValueOnce(mockSession);

      await ChatDatabaseService.createSession('user-1');

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          summary: expect.stringContaining('Chat session'),
        },
      });
    });

    it('should create anonymous session when userId not provided', async () => {
      const anonymousSession = { ...mockSession, userId: null };
      (checkDatabaseHealth as jest.Mock).mockResolvedValueOnce({ status: 'healthy' });
      (prisma.conversationSession.create as jest.Mock).mockResolvedValueOnce(anonymousSession);

      await ChatDatabaseService.createSession();

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          summary: expect.any(String),
        },
      });
      expect(invalidateUserCache).not.toHaveBeenCalled();
    });

    it('should apply rate limiting', async () => {
      (checkDatabaseHealth as jest.Mock).mockResolvedValueOnce({ status: 'healthy' });
      (prisma.conversationSession.create as jest.Mock).mockResolvedValueOnce(mockSession);

      await ChatDatabaseService.createSession('user-1');

      expect(enforceRateLimit).toHaveBeenCalledWith(chatRateLimiters.sessionCreation, 'user-1');
    });

    it('should handle database health check failure gracefully', async () => {
      (checkDatabaseHealth as jest.Mock).mockRejectedValueOnce(new Error('Health check failed'));
      (prisma.conversationSession.create as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await ChatDatabaseService.createSession('user-1');

      expect(result).toEqual(mockSession);
      expect(logger.warn).toHaveBeenCalledWith('[ChatDB] Database health check failed', {
        error: expect.any(Error),
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('Database error');
      (checkDatabaseHealth as jest.Mock).mockResolvedValueOnce({ status: 'healthy' });
      (prisma.conversationSession.create as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChatDatabaseService.createSession('user-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('[ChatDB] Failed to create session', {
        error,
        userId: 'user-1',
        title: undefined,
      });
    });
  });

  describe('getUserSessions', () => {
    const mockSessions: ConversationSession[] = [
      {
        id: 'session-1',
        userId: 'user-1',
        summary: 'Session 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
        startedAt: new Date(),
        metadata: null,
      },
      {
        id: 'session-2',
        userId: 'user-1',
        summary: 'Session 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(Date.now() - 3600000),
        startedAt: new Date(),
        metadata: null,
      },
    ];

    it('should return cached sessions if available', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(mockSessions);

      const result = await ChatDatabaseService.getUserSessions('user-1');

      expect(result).toEqual(mockSessions);
      expect(prisma.conversationSession.findMany).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('[ChatDB] Sessions retrieved from cache', {
        userId: 'user-1',
        count: 2,
      });
    });

    it('should fetch sessions from database when cache miss', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValueOnce(mockSessions);

      const result = await ChatDatabaseService.getUserSessions('user-1');

      expect(prisma.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { lastActiveAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(mockSessions);
      expect(chatCaches.sessionLists.set).toHaveBeenCalledWith('user-1', mockSessions);
    });

    it('should handle pagination', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValueOnce([mockSessions[1]]);

      const result = await ChatDatabaseService.getUserSessions('user-1', {
        limit: 1,
        cursor: 'session-1',
      });

      expect(prisma.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { lastActiveAt: 'desc' },
        take: 1,
        cursor: { id: 'session-1' },
        skip: 1,
      });
      expect(result).toEqual([mockSessions[1]]);
      // Should not cache paginated results
      expect(chatCaches.sessionLists.set).not.toHaveBeenCalled();
    });

    it('should return anonymous sessions when userId not provided', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValueOnce(mockSessions);

      await ChatDatabaseService.getUserSessions();

      expect(prisma.conversationSession.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { lastActiveAt: 'desc' },
        take: 50,
      });
    });

    it('should use stale cache on database error', async () => {
      chatCaches.sessionLists.get = jest.fn()
        .mockReturnValueOnce(null) // First call - no fresh cache
        .mockReturnValueOnce(mockSessions); // Second call - stale cache

      (withDatabase as jest.Mock).mockImplementation(async (mainFn, fallbackFn) => fallbackFn());

      const result = await ChatDatabaseService.getUserSessions('user-1');

      expect(result).toEqual(mockSessions);
      expect(logger.warn).toHaveBeenCalledWith('[ChatDB] Using stale cache due to database error', {
        userId: 'user-1',
      });
    });

    it('should return empty array in development when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env['NODE_ENV'] = 'development';

      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (withDatabase as jest.Mock).mockImplementation(async (mainFn, fallbackFn) => fallbackFn());

      const result = await ChatDatabaseService.getUserSessions('user-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChatDB] Returning empty array in development mode');

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should apply rate limiting', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValueOnce([]);

      await ChatDatabaseService.getUserSessions('user-1');

      expect(enforceRateLimit).toHaveBeenCalledWith(chatRateLimiters.sessionQuery, 'user-1');
    });
  });

  describe('getSession', () => {
    const mockSession: ConversationSession = {
      id: 'session-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      startedAt: new Date(),
      lastActiveAt: new Date(),
      summary: 'Test Session',
      metadata: null,
    };

    it('should get session successfully', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await ChatDatabaseService.getSession('session-1');

      expect(prisma.conversationSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null on error', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

      const result = await ChatDatabaseService.getSession('invalid-id');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    const mockMessages: ConversationMessage[] = [
      {
        id: 'msg-1',
        createdAt: new Date(),
        timestamp: new Date(),
        sessionId: 'session-1',
        role: 'user' as const,
        content: 'Hello',
        agentId: null,
        metadata: { type: 'text' },
      },
      {
        id: 'msg-2',
        createdAt: new Date(),
        timestamp: new Date(Date.now() + 1000),
        sessionId: 'session-1',
        role: 'assistant' as const,
        content: 'Hi there!',
        agentId: null,
        metadata: { type: 'text' },
      },
    ];

    it('should return cached messages if available', async () => {
      chatCaches.messages.get = jest.fn().mockReturnValue(mockMessages);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        content: 'Hello',
        role: 'user',
        type: 'text',
      });
      expect(prisma.conversationMessage.findMany).not.toHaveBeenCalled();
    });

    it('should fetch messages from database when cache miss', async () => {
      chatCaches.messages.get = jest.fn().mockReturnValue(null);
      (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValueOnce(mockMessages);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { timestamp: 'asc' },
      });
      expect(chatCaches.messages.set).toHaveBeenCalledWith('session-1', mockMessages);
      expect(result).toHaveLength(2);
    });

    it('should handle empty metadata correctly', async () => {
      const messagesWithoutMetadata = [
        {
          ...mockMessages[0],
          metadata: null,
        },
      ];

      chatCaches.messages.get = jest.fn().mockReturnValue(messagesWithoutMetadata);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(result[0].type).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    const mockMessage: ConversationMessage = {
      id: 'msg-1',
      createdAt: new Date(),
      timestamp: new Date(),
      sessionId: 'session-1',
      role: 'user' as const,
      content: 'Test message',
      agentId: null,
      metadata: { type: 'text' },
    };

    const mockSession: ConversationSession = {
      id: 'session-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      startedAt: new Date(),
      lastActiveAt: new Date(),
      summary: 'Test Session',
      metadata: null,
    };

    it('should add message successfully', async () => {
      const transactionMock = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue(mockSession),
            update: jest.fn().mockResolvedValue(mockSession),
          },
          conversationMessage: {
            create: jest.fn().mockResolvedValue(mockMessage),
          },
        };
        return callback(tx);
      });

      (prisma.$transaction as jest.Mock).mockImplementation(transactionMock);

      const result = await ChatDatabaseService.addMessage('session-1', {
        content: 'Test message',
        role: 'user',
        type: 'text',
      });

      expect(enforceRateLimit).toHaveBeenCalledWith(chatRateLimiters.messageCreation, 'session-1');
      expect(validateAndSanitizeChatMessage).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
      expect(invalidateSessionCache).toHaveBeenCalledWith('session-1', 'user-1');
      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Message added', {
        sessionId: 'session-1',
        messageId: 'msg-1',
        role: 'user',
      });
    });

    it('should handle proposal group messages', async () => {
      const proposalMessage = {
        content: 'Here is a trading proposal',
        role: 'assistant' as const,
        type: 'proposal' as const,
        proposalGroup: {
          proposals: [
            {
              symbol: 'BTCUSDT',
              action: 'BUY',
              entry: 50000,
              targets: [51000],
              stopLoss: 49000,
              confidence: 0.8,
            },
          ],
        },
      };

      (validateAndSanitizeChatMessage as jest.Mock).mockReturnValue(proposalMessage);

      const transactionMock = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue(mockSession),
            update: jest.fn().mockResolvedValue(mockSession),
          },
          conversationMessage: {
            create: jest.fn().mockResolvedValue({
              ...mockMessage,
              metadata: {
                type: 'proposal',
                proposalGroup: proposalMessage.proposalGroup,
              },
            }),
          },
        };
        return callback(tx);
      });

      (prisma.$transaction as jest.Mock).mockImplementation(transactionMock);

      await ChatDatabaseService.addMessage('session-1', proposalMessage);

      const txCall = transactionMock.mock.calls[0][0];
      const tx = {
        conversationSession: {
          findUnique: jest.fn().mockResolvedValue(mockSession),
          update: jest.fn(),
        },
        conversationMessage: {
          create: jest.fn(),
        },
      };
      await txCall(tx);

      expect(tx.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'proposal',
            proposalGroup: proposalMessage.proposalGroup,
          }),
        }),
      });
    });

    it('should throw error if session not found', async () => {
      const transactionMock = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      (prisma.$transaction as jest.Mock).mockImplementation(transactionMock);

      await expect(
        ChatDatabaseService.addMessage('invalid-session', {
          content: 'Test',
          role: 'user',
        })
      ).rejects.toThrow('Session not found: invalid-session');
    });
  });

  describe('updateSessionTitle', () => {
    const mockUpdatedSession: ConversationSession = {
      id: 'session-1',
      userId: 'user-1',
      summary: 'Updated Title',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    };

    it('should update session title successfully', async () => {
      (prisma.conversationSession.update as jest.Mock).mockResolvedValueOnce(mockUpdatedSession);

      const result = await ChatDatabaseService.updateSessionTitle('session-1', 'Updated Title');

      expect(prisma.conversationSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { summary: 'Updated Title' },
      });
      expect(result).toEqual(mockUpdatedSession);
      expect(chatCaches.sessions.delete).toHaveBeenCalledWith('session-1');
      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Session title updated', {
        sessionId: 'session-1',
        title: 'Updated Title',
      });
    });

    it('should handle update errors', async () => {
      const error = new Error('Update failed');
      (prisma.conversationSession.update as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChatDatabaseService.updateSessionTitle('session-1', 'New Title')).rejects.toThrow(
        'Update failed'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValueOnce({
        userId: 'user-1',
      });
      (prisma.conversationSession.delete as jest.Mock).mockResolvedValueOnce({});

      await ChatDatabaseService.deleteSession('session-1');

      expect(prisma.conversationSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
      expect(invalidateSessionCache).toHaveBeenCalledWith('session-1', 'user-1');
      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Session deleted', { sessionId: 'session-1' });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Not found');
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValueOnce({ userId: 'user-1' });
      (prisma.conversationSession.delete as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChatDatabaseService.deleteSession('session-1')).rejects.toThrow('Not found');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('convertToChatMessage', () => {
    it('should convert database message to chat message format', () => {
      const dbMessage: ConversationMessage = {
        id: 'msg-1',
        createdAt: new Date(),
        timestamp: new Date('2024-01-01T00:00:00Z'),
        sessionId: 'session-1',
        role: 'user' as const,
        content: 'Test message',
        agentId: null,
        metadata: {
          type: 'text',
          proposalGroup: {
            proposals: [],
          },
        },
      };

      const result = ChatDatabaseService.convertToChatMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-1',
        content: 'Test message',
        role: 'user',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime(),
        type: 'text',
        proposalGroup: {
          proposals: [],
        },
        isTyping: undefined,
        entryProposalGroup: undefined,
      });
    });

    it('should handle null metadata', () => {
      const dbMessage: ConversationMessage = {
        id: 'msg-1',
        createdAt: new Date(),
        timestamp: new Date(),
        sessionId: 'session-1',
        role: 'assistant' as const,
        content: 'Response',
        agentId: null,
        metadata: null,
      };

      const result = ChatDatabaseService.convertToChatMessage(dbMessage);

      expect(result.type).toBeUndefined();
      expect(result.proposalGroup).toBeUndefined();
    });
  });

  describe('convertToChatSession', () => {
    it('should convert database session to chat session format', () => {
      const dbSession: ConversationSession = {
        id: 'session-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T01:00:00Z'),
        userId: 'user-1',
        startedAt: new Date(),
        lastActiveAt: new Date(),
        summary: 'Test Session',
        metadata: null,
      };

      const result = ChatDatabaseService.convertToChatSession(dbSession);

      expect(result).toEqual({
        id: 'session-1',
        title: 'Test Session',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        updatedAt: new Date('2024-01-01T01:00:00Z').getTime(),
      });
    });

    it('should use default title when summary is null', () => {
      const dbSession: ConversationSession = {
        id: 'session-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        startedAt: new Date(),
        lastActiveAt: new Date(),
        summary: null,
        metadata: null,
      };

      const result = ChatDatabaseService.convertToChatSession(dbSession);

      expect(result.title).toBe('Untitled session');
    });
  });

  describe('migrateFromLocalStorage', () => {
    const localData = {
      sessions: {
        'local-session-1': {
          id: 'local-session-1',
          title: 'Local Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      messagesBySession: {
        'local-session-1': [
          {
            id: 'local-msg-1',
            content: 'Local message',
            role: 'user' as const,
            timestamp: Date.now(),
            type: 'text' as const,
          },
        ],
      },
    };

    it('should migrate data successfully', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.conversationSession.create as jest.Mock).mockResolvedValue({});
      (prisma.conversationMessage.create as jest.Mock).mockResolvedValue({});

      await ChatDatabaseService.migrateFromLocalStorage(localData, 'user-1');

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'local-session-1',
          userId: 'user-1',
          summary: 'Local Session',
        }),
      });

      expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'local-msg-1',
          sessionId: 'local-session-1',
          content: 'Local message',
          role: 'user',
        }),
      });

      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Migration completed successfully');
    });

    it('should skip existing sessions', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue({ id: 'local-session-1' });

      await ChatDatabaseService.migrateFromLocalStorage(localData);

      expect(prisma.conversationSession.create).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('[ChatDB] Session already exists, skipping', {
        sessionId: 'local-session-1',
      });
    });

    it('should handle migration errors', async () => {
      const error = new Error('Migration failed');
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.conversationSession.create as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChatDatabaseService.migrateFromLocalStorage(localData)).rejects.toThrow(
        'Migration failed'
      );
      expect(logger.error).toHaveBeenCalledWith('[ChatDB] Migration failed', { error });
    });
  });
});