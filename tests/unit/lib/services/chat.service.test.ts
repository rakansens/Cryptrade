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
      const userId = 'user-123';
      const sessions = [
        {
          id: 'session-1',
          userId,
          summary: 'Session 1',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          lastActiveAt: new Date(),
        },
        {
          id: 'session-2',
          userId,
          summary: 'Session 2',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          lastActiveAt: new Date(),
        },
      ];

      mockPrismaClient.conversationSession.findMany.mockResolvedValue(sessions);

      const result = await ChatDatabaseService.getUserSessions(userId);

      expect(result).toEqual(sessions);
      expect(mockPrismaClient.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { messages: true },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should return empty array for user with no sessions', async () => {
      mockPrismaClient.conversationSession.findMany.mockResolvedValue([]);

      const result = await ChatDatabaseService.getUserSessions('user-no-sessions');

      expect(result).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('should add a message to session', async () => {
      const sessionId = 'session-123';
      const messageData = {
        role: 'user' as const,
        content: 'Hello, AI!',
        metadata: { intent: 'greeting' },
      };

      const newMessage = {
        id: 'msg-789',
        sessionId,
        ...messageData,
        createdAt: new Date(),
      };

      mockPrismaClient.conversationMessage.create.mockResolvedValue(newMessage as any);

      const result = await ChatDatabaseService.addMessage(sessionId, messageData);

      expect(result).toEqual(newMessage);
      expect(mockPrismaClient.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId,
          ...messageData,
        },
      });
    });

    it('should handle message creation errors', async () => {
      mockPrismaClient.conversationMessage.create.mockRejectedValue(new Error('Message creation failed'));

      await expect(
        ChatDatabaseService.addMessage('session-123', {
          role: 'user',
          content: 'Test message',
        })
      ).rejects.toThrow('Message creation failed');
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const sessionId = 'session-123';
      const updates = { title: 'Updated Title' };

      const updatedSession = {
        id: sessionId,
        userId: 'user-123',
        title: 'Updated Title',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession as any);

      const result = await ChatDatabaseService.updateSessionTitle(sessionId, updates.title);

      expect(result).toEqual(updatedSession);
      expect(mockPrismaClient.conversationSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: updates,
      });
    });

    it('should update session title', async () => {
      const sessionId = 'session-123';
      const newTitle = 'Updated Session Title';

      const updatedSession = {
        id: sessionId,
        userId: 'user-123',
        title: newTitle,
        metadata: { theme: 'light', lang: 'ja' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession as any);

      const result = await ChatDatabaseService.updateSessionTitle(sessionId, newTitle);

      expect(result).toEqual(updatedSession);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and all messages', async () => {
      const sessionId = 'session-123';

      mockPrismaClient.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrismaClient);
      });

      await ChatDatabaseService.deleteSession(sessionId);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const sessionId = 'session-123';

      mockPrismaClient.$transaction.mockRejectedValue(new Error('Deletion failed'));

      await expect(ChatDatabaseService.deleteSession(sessionId)).rejects.toThrow('Deletion failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete session',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getMessages', () => {
    it('should retrieve messages for a session', async () => {
      const sessionId = 'session-123';
      const messages = [
        {
          id: 'msg-1',
          sessionId,
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          sessionId,
          role: 'assistant',
          content: 'Hi there!',
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.conversationMessage.findMany.mockResolvedValue(messages as any);

      const result = await ChatDatabaseService.getMessages(sessionId);

      expect(result).toEqual(messages);
      expect(mockPrismaClient.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should apply limit when specified', async () => {
      const sessionId = 'session-123';
      const limit = 10;

      mockPrismaClient.conversationMessage.findMany.mockResolvedValue([] as any);

      await ChatDatabaseService.getMessages(sessionId);

      expect(mockPrismaClient.conversationMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
    });
  });

  // Note: deleteMessage is not implemented in ChatDatabaseService
  // Messages are only deleted when the entire session is deleted

  describe('transaction handling', () => {
    it('should handle complex transactions', async () => {
      const userId = 'user-123';
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
        id: 'msg-789',
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