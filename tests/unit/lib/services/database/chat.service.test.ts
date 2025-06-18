import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { prisma } from '@/lib/db/prisma';
import { checkDatabaseHealth } from '@/lib/db/health-check';
import { chatRateLimiters, enforceRateLimit } from '@/lib/services/database/rate-limiter';
import { chatCaches, invalidateSessionCache, invalidateUserCache } from '@/lib/services/database/chat-cache';
import { logger } from '@/lib/utils/logger';
import type { ConversationSession, ConversationMessage } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock('@/lib/db/health-check');
jest.mock('@/lib/services/database/rate-limiter');
jest.mock('@/lib/services/database/chat-cache');
jest.mock('@/lib/utils/logger');

describe('ChatDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkDatabaseHealth as jest.Mock).mockResolvedValue({ status: 'healthy' });
    (enforceRateLimit as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createSession', () => {
    it('should create a new session with userId and title', async () => {
      const mockSession: ConversationSession = {
        id: 'session-1',
        userId: 'user-123',
        summary: 'Test Session',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date()
      };

      (prisma.conversationSession.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await ChatDatabaseService.createSession('user-123', 'Test Session');

      expect(enforceRateLimit).toHaveBeenCalledWith(
        chatRateLimiters.sessionCreation,
        'user-123'
      );

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          summary: 'Test Session'
        }
      });

      expect(invalidateUserCache).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockSession);
    });

    it('should create anonymous session without userId', async () => {
      const mockSession: ConversationSession = {
        id: 'session-2',
        userId: null,
        summary: expect.stringContaining('Chat session'),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date()
      };

      (prisma.conversationSession.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await ChatDatabaseService.createSession();

      expect(enforceRateLimit).toHaveBeenCalledWith(
        chatRateLimiters.sessionCreation,
        'anonymous'
      );

      expect(result).toEqual(mockSession);
    });

    it('should handle database health check failure gracefully', async () => {
      (checkDatabaseHealth as jest.Mock).mockRejectedValue(new Error('Health check failed'));

      const mockSession = { id: 'session-3' };
      (prisma.conversationSession.create as jest.Mock).mockResolvedValue(mockSession);

      await expect(ChatDatabaseService.createSession()).resolves.toEqual(mockSession);

      expect(logger.warn).toHaveBeenCalledWith(
        '[ChatDB] Database health check failed',
        expect.any(Object)
      );
    });

    it('should sanitize title input', async () => {
      await ChatDatabaseService.createSession('user-123', '<script>alert("xss")</script>');

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          summary: expect.not.stringContaining('<script>')
        }
      });
    });

    it('should handle rate limit errors', async () => {
      (enforceRateLimit as jest.Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(ChatDatabaseService.createSession())
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getUserSessions', () => {
    const mockSessions: ConversationSession[] = [
      {
        id: 'session-1',
        userId: 'user-123',
        summary: 'Session 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date()
      },
      {
        id: 'session-2',
        userId: 'user-123',
        summary: 'Session 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date()
      }
    ];

    it('should return cached sessions if available', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(mockSessions);

      const result = await ChatDatabaseService.getUserSessions('user-123');

      expect(result).toEqual(mockSessions);
      expect(prisma.conversationSession.findMany).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[ChatDB] Sessions retrieved from cache',
        expect.any(Object)
      );
    });

    it('should fetch from database if not cached', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValue(mockSessions);

      const result = await ChatDatabaseService.getUserSessions('user-123');

      expect(prisma.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { lastActiveAt: 'desc' },
        take: 50
      });

      expect(chatCaches.sessionLists.set).toHaveBeenCalledWith('user-123', mockSessions);
      expect(result).toEqual(mockSessions);
    });

    it('should handle pagination with cursor', async () => {
      chatCaches.sessionLists.get = jest.fn().mockReturnValue(null);
      (prisma.conversationSession.findMany as jest.Mock).mockResolvedValue(mockSessions);

      await ChatDatabaseService.getUserSessions('user-123', {
        limit: 10,
        cursor: 'session-0'
      });

      expect(prisma.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { lastActiveAt: 'desc' },
        take: 10,
        cursor: { id: 'session-0' },
        skip: 1
      });

      // Should not cache paginated results
      expect(chatCaches.sessionLists.set).not.toHaveBeenCalled();
    });

    it('should use stale cache on database error', async () => {
      chatCaches.sessionLists.get = jest.fn()
        .mockReturnValueOnce(null) // First call - no cache
        .mockReturnValueOnce(mockSessions); // Fallback call - stale cache

      (prisma.conversationSession.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await ChatDatabaseService.getUserSessions('user-123');

      expect(result).toEqual(mockSessions);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChatDB] Using stale cache due to database error',
        { userId: 'user-123' }
      );
    });
  });

  describe('getMessages', () => {
    const mockMessages: ConversationMessage[] = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(Date.now() - 1000),
        metadata: null
      },
      {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
        metadata: { type: 'text' }
      }
    ];

    it('should return cached messages if available', async () => {
      chatCaches.messages.get = jest.fn().mockReturnValue(mockMessages);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        content: 'Hello',
        role: 'user',
        timestamp: expect.any(Number)
      });
      expect(prisma.conversationMessage.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache results', async () => {
      chatCaches.messages.get = jest.fn().mockReturnValue(null);
      (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { timestamp: 'asc' }
      });

      expect(chatCaches.messages.set).toHaveBeenCalledWith('session-1', mockMessages);
      expect(result).toHaveLength(2);
    });

    it('should convert metadata correctly', async () => {
      const messageWithMetadata: ConversationMessage = {
        id: 'msg-3',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Analysis',
        timestamp: new Date(),
        metadata: {
          type: 'proposal',
          proposalGroup: {
            id: 'pg-1',
            proposals: []
          }
        }
      };

      chatCaches.messages.get = jest.fn().mockReturnValue([messageWithMetadata]);

      const result = await ChatDatabaseService.getMessages('session-1');

      expect(result[0]).toMatchObject({
        type: 'proposal',
        proposalGroup: {
          id: 'pg-1',
          proposals: []
        }
      });
    });
  });

  describe('addMessage', () => {
    it('should add a message and update session', async () => {
      const mockMessage: ConversationMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
        metadata: null
      };

      const mockSession = {
        id: 'session-1',
        userId: 'user-123'
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue(mockSession),
            update: jest.fn().mockResolvedValue(mockSession)
          },
          conversationMessage: {
            create: jest.fn().mockResolvedValue(mockMessage)
          }
        };
        return fn(tx);
      });

      const result = await ChatDatabaseService.addMessage('session-1', {
        content: 'Test message',
        role: 'user'
      });

      expect(enforceRateLimit).toHaveBeenCalledWith(
        chatRateLimiters.messageCreation,
        'session-1'
      );

      expect(result).toEqual(mockMessage);
      expect(invalidateSessionCache).toHaveBeenCalledWith('session-1', 'user-123');
    });

    it('should handle message with metadata', async () => {
      const messageWithMetadata = {
        content: 'Analysis result',
        role: 'assistant' as const,
        type: 'proposal' as const,
        proposalGroup: {
          id: 'pg-1',
          proposals: []
        }
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue({ id: 'session-1' }),
            update: jest.fn()
          },
          conversationMessage: {
            create: jest.fn((args) => {
              expect(args.data.metadata).toEqual({
                type: 'proposal',
                proposalGroup: messageWithMetadata.proposalGroup
              });
              return Promise.resolve({ id: 'msg-1' });
            })
          }
        };
        return fn(tx);
      });

      await ChatDatabaseService.addMessage('session-1', messageWithMetadata);
    });

    it('should throw error if session not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue(null)
          }
        };
        return fn(tx);
      });

      await expect(ChatDatabaseService.addMessage('invalid-session', {
        content: 'Test',
        role: 'user'
      })).rejects.toThrow('Session not found: invalid-session');
    });

    it('should sanitize message content', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue({ id: 'session-1' }),
            update: jest.fn()
          },
          conversationMessage: {
            create: jest.fn((args) => {
              expect(args.data.content).not.toContain('<script>');
              return Promise.resolve({ id: 'msg-1' });
            })
          }
        };
        return fn(tx);
      });

      await ChatDatabaseService.addMessage('session-1', {
        content: '<script>alert("xss")</script>Hello',
        role: 'user'
      });
    });
  });

  describe('updateSessionTitle', () => {
    it('should update session title and invalidate cache', async () => {
      const updatedSession = {
        id: 'session-1',
        summary: 'New Title'
      };

      (prisma.conversationSession.update as jest.Mock).mockResolvedValue(updatedSession);

      const result = await ChatDatabaseService.updateSessionTitle('session-1', 'New Title');

      expect(prisma.conversationSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { summary: 'New Title' }
      });

      expect(chatCaches.sessions.delete).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(updatedSession);
    });

    it('should sanitize title', async () => {
      await ChatDatabaseService.updateSessionTitle(
        'session-1',
        '<b>Bold</b> Title'
      );

      expect(prisma.conversationSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { summary: expect.not.stringContaining('<b>') }
      });
    });
  });

  describe('deleteSession', () => {
    it('should delete session and invalidate caches', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        userId: 'user-123'
      });

      (prisma.conversationSession.delete as jest.Mock).mockResolvedValue({
        id: 'session-1'
      });

      await ChatDatabaseService.deleteSession('session-1');

      expect(prisma.conversationSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        select: { userId: true }
      });

      expect(prisma.conversationSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' }
      });

      expect(invalidateSessionCache).toHaveBeenCalledWith('session-1', 'user-123');
    });

    it('should handle deletion errors', async () => {
      (prisma.conversationSession.delete as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(ChatDatabaseService.deleteSession('session-1'))
        .rejects.toThrow('Delete failed');

      expect(logger.error).toHaveBeenCalledWith(
        '[ChatDB] Failed to delete session',
        expect.any(Object)
      );
    });
  });

  describe('migrateFromLocalStorage', () => {
    const localData = {
      sessions: {
        'local-session-1': {
          id: 'local-session-1',
          title: 'Migrated Session',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now()
        }
      },
      messagesBySession: {
        'local-session-1': [
          {
            id: 'local-msg-1',
            content: 'Hello from local',
            role: 'user' as const,
            timestamp: Date.now() - 3600000
          },
          {
            id: 'local-msg-2',
            content: 'Response from local',
            role: 'assistant' as const,
            timestamp: Date.now() - 3500000,
            type: 'text' as const
          }
        ]
      }
    };

    it('should migrate sessions and messages', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.conversationSession.create as jest.Mock).mockResolvedValue({ id: 'local-session-1' });
      (prisma.conversationMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });

      await ChatDatabaseService.migrateFromLocalStorage(localData, 'user-123');

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          id: 'local-session-1',
          userId: 'user-123',
          summary: 'Migrated Session',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      });

      expect(prisma.conversationMessage.create).toHaveBeenCalledTimes(2);
      expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          id: 'local-msg-1',
          sessionId: 'local-session-1',
          role: 'user',
          content: 'Hello from local',
          timestamp: expect.any(Date),
          metadata: null
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[ChatDB] Migration completed successfully'
      );
    });

    it('should skip existing sessions', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'local-session-1'
      });

      await ChatDatabaseService.migrateFromLocalStorage(localData);

      expect(prisma.conversationSession.create).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[ChatDB] Session already exists, skipping',
        { sessionId: 'local-session-1' }
      );
    });

    it('should handle migration errors', async () => {
      (prisma.conversationSession.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(ChatDatabaseService.migrateFromLocalStorage(localData))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        '[ChatDB] Migration failed',
        expect.any(Object)
      );
    });
  });

  describe('convertToChatMessage', () => {
    it('should convert database message to chat format', () => {
      const dbMessage: ConversationMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Test content',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        metadata: {
          type: 'proposal',
          proposalGroup: { id: 'pg-1' },
          isTyping: false
        }
      };

      const result = ChatDatabaseService.convertToChatMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-1',
        content: 'Test content',
        role: 'assistant',
        timestamp: new Date('2024-01-01T12:00:00Z').getTime(),
        type: 'proposal',
        proposalGroup: { id: 'pg-1' },
        isTyping: false
      });
    });

    it('should handle null metadata', () => {
      const dbMessage: ConversationMessage = {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'user',
        content: 'Simple message',
        timestamp: new Date(),
        metadata: null
      };

      const result = ChatDatabaseService.convertToChatMessage(dbMessage);

      expect(result).not.toHaveProperty('type');
      expect(result).not.toHaveProperty('proposalGroup');
      expect(result).not.toHaveProperty('isTyping');
    });
  });

  describe('convertToChatSession', () => {
    it('should convert database session to chat format', () => {
      const dbSession: ConversationSession = {
        id: 'session-1',
        userId: 'user-123',
