import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatDatabaseService } from '../../database/chat.service';
import { PrismaClient } from '@prisma/client';
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
    message: {
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
    message: {
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
  let service: ChatDatabaseService;
  const mockPrismaClient = mockPrisma as jest.Mocked<typeof mockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatDatabaseService();
  });

  describe('getOrCreateUser', () => {
    it('should return existing user if found', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.getOrCreateUser('test@example.com');

      expect(result).toEqual(existingUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'new@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue(newUser);

      const result = await service.getOrCreateUser('new@example.com');

      expect(result).toEqual(newUser);
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: { email: 'new@example.com' },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await expect(service.getOrCreateUser('error@example.com')).rejects.toThrow('DB Error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get or create user',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const userId = 'user-123';
      const sessionId = 'session-456';
      const title = 'Test Session';
      const metadata = { theme: 'dark' };

      const newSession = {
        id: sessionId,
        userId,
        title,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.create.mockResolvedValue(newSession);

      const result = await service.createSession(userId, sessionId, title, metadata);

      expect(result).toEqual(newSession);
      expect(mockPrismaClient.conversationSession.create).toHaveBeenCalledWith({
        data: {
          id: sessionId,
          userId,
          title,
          metadata,
        },
      });
    });

    it('should handle creation errors', async () => {
      mockPrismaClient.conversationSession.create.mockRejectedValue(new Error('Creation failed'));

      await expect(
        service.createSession('user-123', 'session-456', 'Test')
      ).rejects.toThrow('Creation failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create session',
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
          title: 'Session 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
        {
          id: 'session-2',
          userId,
          title: 'Session 2',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
      ];

      mockPrismaClient.conversationSession.findMany.mockResolvedValue(sessions);

      const result = await service.getSessions(userId);

      expect(result).toEqual(sessions);
      expect(mockPrismaClient.conversationSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { messages: true },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should return empty array for user with no sessions', async () => {
      mockPrismaClient.conversationSession.findMany.mockResolvedValue([]);

      const result = await service.getSessions('user-no-sessions');

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

      mockPrismaClient.message.create.mockResolvedValue(newMessage);

      const result = await service.addMessage(sessionId, messageData);

      expect(result).toEqual(newMessage);
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          sessionId,
          ...messageData,
        },
      });
    });

    it('should handle message creation errors', async () => {
      mockPrismaClient.message.create.mockRejectedValue(new Error('Message creation failed'));

      await expect(
        service.addMessage('session-123', {
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

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession);

      const result = await service.updateSession(sessionId, updates);

      expect(result).toEqual(updatedSession);
      expect(mockPrismaClient.conversationSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: updates,
      });
    });

    it('should update session metadata', async () => {
      const sessionId = 'session-123';
      const updates = { metadata: { theme: 'light', lang: 'ja' } };

      const updatedSession = {
        id: sessionId,
        userId: 'user-123',
        title: 'Test Session',
        metadata: updates.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.conversationSession.update.mockResolvedValue(updatedSession);

      const result = await service.updateSession(sessionId, updates);

      expect(result).toEqual(updatedSession);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and all messages', async () => {
      const sessionId = 'session-123';

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await service.deleteSession(sessionId);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const sessionId = 'session-123';

      mockPrismaClient.$transaction.mockRejectedValue(new Error('Deletion failed'));

      await expect(service.deleteSession(sessionId)).rejects.toThrow('Deletion failed');
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

      mockPrismaClient.message.findMany.mockResolvedValue(messages);

      const result = await service.getMessages(sessionId);

      expect(result).toEqual(messages);
      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should apply limit when specified', async () => {
      const sessionId = 'session-123';
      const limit = 10;

      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await service.getMessages(sessionId, limit);

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
    });
  });

  describe('deleteMessage', () => {
    it('should delete a specific message', async () => {
      const messageId = 'msg-123';

      await service.deleteMessage(messageId);

      expect(mockPrismaClient.message.delete).toHaveBeenCalledWith({
        where: { id: messageId },
      });
    });

    it('should handle message not found', async () => {
      mockPrismaClient.message.delete.mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      await expect(service.deleteMessage('non-existent')).rejects.toThrow();
    });
  });

  describe('transaction handling', () => {
    it('should handle complex transactions', async () => {
      const userId = 'user-123';
      const sessionId = 'session-456';

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        const result = await callback(mockPrismaClient);
        return result;
      });

      // Simulate a complex operation
      const complexOperation = async () => {
        return service.prisma.$transaction(async (tx) => {
          const session = await tx.conversationSession.create({
            data: { id: sessionId, userId, title: 'New Session' },
          });
          
          const message = await tx.message.create({
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
      });

      mockPrismaClient.message.create.mockResolvedValue({
        id: 'msg-789',
        sessionId,
        role: 'system',
        content: 'Session initialized',
      });

      const result = await complexOperation();

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('message');
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });
});