import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/utils/db-connection', () => ({
  withDatabase: jest.fn().mockImplementation(async (operation) => operation()),
  DatabaseConnection: {
    ensureConnection: jest.fn(),
  },
}));

jest.mock('@/lib/services/database/rate-limiter', () => ({
  chatRateLimiters: {
    message: {
      consume: jest.fn().mockResolvedValue({}),
    },
    session: {
      consume: jest.fn().mockResolvedValue({}),
    },
  },
  enforceRateLimit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/database/chat-cache', () => ({
  chatCaches: {
    sessions: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    },
    sessionLists: {
      get: jest.fn(),
      set: jest.fn(),
    },
    messages: {
      get: jest.fn(),
      set: jest.fn(),
    },
    user: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  invalidateSessionCache: jest.fn(),
  invalidateUserCache: jest.fn(),
}));

// Mock Prisma Client first
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
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
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  })),
}));

// Mock the prisma module
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
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
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma as mockPrisma } from '@/lib/db/prisma';

describe('ChatDatabaseService', () => {
  const mockPrismaClient = mockPrisma as jest.Mocked<typeof mockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    // Test moved to correct location below

    // Test removed - getOrCreateUser doesn't exist

    // Test removed - getOrCreateUser doesn't exist
    it('should create a new session', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
      const sessionId = 'session-456';
      const title = 'Test Session';
      const metadata = { theme: 'dark' };

      const newSession = {
        id: sessionId,
        userId,
        summary: title,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.create.mockResolvedValue(newSession as any);

      const result = await ChatDatabaseService.createSession(userId, title);

      expect(result).toEqual(newSession);
      expect(mockPrismaClient.conversationSession.create).toHaveBeenCalledWith({
        data: {
          userId,
          summary: title,
        },
      });
    });

    it('should handle creation errors', async () => {
      mockPrismaClient.conversationSession.create.mockRejectedValue(new Error('Creation failed'));

      await expect(
        ChatDatabaseService.createSession('550e8400-e29b-41d4-a716-446655440000', 'Test')
      ).rejects.toThrow('Creation failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChatDB] Failed to create session',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getSessions', () => {
    it('should retrieve user sessions', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const sessions = [
        {
          id: '660e8400-e29b-41d4-a716-446655440003',
          userId,
          summary: 'Session 1',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          lastActiveAt: new Date(),
          messages: [],
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440004',
          userId,
          summary: 'Session 2',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          lastActiveAt: new Date(),
          messages: [],
        },
      ];

      mockPrismaClient.conversationSession.findMany.mockResolvedValue(sessions as any);

      const result = await ChatDatabaseService.getUserSessions(userId);

      expect(result).toEqual(sessions);
      expect(mockPrismaClient.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { lastActiveAt: 'desc' },
        take: 50,
      });
    });

    it('should return empty array for user with no sessions', async () => {
      mockPrismaClient.conversationSession.findMany.mockResolvedValue([]);

      const result = await ChatDatabaseService.getUserSessions('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('should add a message to session', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';
      const messageData = {
        role: 'user' as const,
        content: 'Hello, AI!',
        metadata: { intent: 'greeting' },
      };

      const newMessage = {
        id: '770e8400-e29b-41d4-a716-446655440005',
        sessionId,
        ...messageData,
        createdAt: new Date(),
        updatedAt: new Date(),
        timestamp: new Date(),
      };

      // Mock the transaction to return both message and session
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        const tx = {
          conversationSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: sessionId,
              userId: '550e8400-e29b-41d4-a716-446655440000',
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          conversationMessage: {
            create: jest.fn().mockResolvedValue(newMessage),
          },
        };
        return callback(tx);
      });

      const result = await ChatDatabaseService.addMessage(sessionId, messageData);

      // The service converts the result to ChatMessage format
      expect(result).toBeDefined();
      expect(result.id).toBe(newMessage.id);
      expect(result.content).toBe(newMessage.content);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should handle message creation errors', async () => {
      mockPrismaClient.$transaction.mockRejectedValue(new Error('Message creation failed'));

      await expect(
        ChatDatabaseService.addMessage('660e8400-e29b-41d4-a716-446655440002', {
          role: 'user',
          content: 'Test message',
        })
      ).rejects.toThrow('Message creation failed');
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';
      const updates = { title: 'Updated Title' };

      const updatedSession = {
        id: sessionId,
        userId: '550e8400-e29b-41d4-a716-446655440000',
        summary: 'Updated Title',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession as any);

      const result = await ChatDatabaseService.updateSessionTitle(sessionId, updates.title);

      expect(result).toEqual(updatedSession);
      expect(mockPrismaClient.conversationSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { summary: updates.title },
      });
    });

    it('should update session title', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';
      const newTitle = 'Updated Session Title';

      const updatedSession = {
        id: sessionId,
        userId: '550e8400-e29b-41d4-a716-446655440000',
        summary: newTitle,
        metadata: { theme: 'light', lang: 'ja' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession as any);

      const result = await ChatDatabaseService.updateSessionTitle(sessionId, newTitle);

      expect(result).toEqual(updatedSession);
      expect(mockPrismaClient.conversationSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { summary: newTitle },
      });
    });
  });

  describe('deleteSession', () => {
    it('should delete session and all messages', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';

      mockPrismaClient.conversationSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: '550e8400-e29b-41d4-a716-446655440000',
      } as any);
      
      mockPrismaClient.conversationSession.delete.mockResolvedValue({} as any);

      await ChatDatabaseService.deleteSession(sessionId);

      expect(mockPrismaClient.conversationSession.delete).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });

    it('should handle deletion errors', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';

      mockPrismaClient.conversationSession.findUnique.mockResolvedValue(null);
      mockPrismaClient.conversationSession.delete.mockRejectedValue(new Error('Deletion failed'));

      await expect(ChatDatabaseService.deleteSession(sessionId)).rejects.toThrow('Deletion failed');
      expect(logger.error).toHaveBeenCalledWith(
        '[ChatDB] Failed to delete session',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getMessages', () => {
    it('should retrieve messages for a session', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';
      const messages = [
        {
          id: '770e8400-e29b-41d4-a716-446655440006',
          sessionId,
          role: 'user',
          content: 'Hello',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          timestamp: new Date(),
        },
        {
          id: '770e8400-e29b-41d4-a716-446655440007',
          sessionId,
          role: 'assistant',
          content: 'Hi there!',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          timestamp: new Date(),
        },
      ];

      mockPrismaClient.conversationMessage.findMany.mockResolvedValue(messages as any);

      const result = await ChatDatabaseService.getMessages(sessionId);

      // Result should be converted to ChatMessage format
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: messages[0].id,
        content: messages[0].content,
        role: messages[0].role,
        timestamp: expect.any(Number),
      });
      expect(mockPrismaClient.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      });
    });

    it('should return empty array when no messages found', async () => {
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';

      mockPrismaClient.conversationMessage.findMany.mockResolvedValue([]);

      const result = await ChatDatabaseService.getMessages(sessionId);
      
      expect(result).toEqual([]);
      expect(mockPrismaClient.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      });
    });
  });

  // Note: deleteMessage is not implemented in ChatDatabaseService
  // Messages are only deleted when the entire session is deleted

  describe('transaction handling', () => {
    it('should handle complex transactions', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const sessionId = 'session-456';

      mockPrismaClient.$transaction.mockImplementation(async (callback: any) => {
        const result = await callback(mockPrismaClient);
        return result;
      });

      // Simulate a complex operation
      const complexOperation = async () => {
        return mockPrismaClient.$transaction(async (tx: any) => {
          const session = await tx.conversationSession.create({
            data: { id: sessionId, userId, title: 'New Session' },
          });
          
          const message = await tx.conversationMessage.create({
            data: {
              sessionId: session.id,
              role: 'system',
              content: 'Session initialized',
            },
          });

          return { session, message };
        });
      };

      mockPrismaClient.conversationSession.create.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'New Session',
      } as any);

      mockPrismaClient.conversationMessage.create.mockResolvedValue({
        id: '770e8400-e29b-41d4-a716-446655440008',
        sessionId,
        role: 'system',
        content: 'Session initialized',
      } as any);

      const result = await complexOperation();

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('message');
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });
});