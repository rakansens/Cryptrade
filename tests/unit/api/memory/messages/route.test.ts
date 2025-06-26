import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { POST } from '@/app/api/memory/messages/route';
import { getServerSession } from '@/lib/auth/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import type { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationMessage: {
      create: jest.fn()
    }
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Memory Messages API Route', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // By default, mock as authenticated for all tests
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);

    mockRequest = {
      json: jest.fn() as jest.MockedFunction<() => Promise<any>>,
      method: 'POST'
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/memory/messages', () => {
    it('should create a message successfully with authentication', async () => {
      const messageData = {
        sessionId: 'test-session-123',
        role: 'user' as const,
        content: 'Test message content',
        agentId: 'test-agent',
        metadata: { source: 'test' }
      };

      const mockCreatedMessage = {
        id: 'msg-123',
        sessionId: messageData.sessionId,
        role: messageData.role,
        content: messageData.content,
        agentId: messageData.agentId,
        metadata: messageData.metadata,
        timestamp: new Date()
      };

      (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
      (mockedPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(mockCreatedMessage);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(mockedGetServerSession).toHaveBeenCalled();
      expect(mockedPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: messageData.sessionId,
          role: messageData.role,
          content: messageData.content,
          agentId: messageData.agentId,
          metadata: messageData.metadata
        }
      });
      expect(responseData.message).toMatchObject({
        ...mockCreatedMessage,
        timestamp: mockCreatedMessage.timestamp.toISOString()
      });
      expect(mockedLogger.info).toHaveBeenCalledWith(
        '[API] Conversation message created',
        {
          messageId: mockCreatedMessage.id,
          sessionId: mockCreatedMessage.sessionId
        }
      );
    });

    it('should handle optional fields', async () => {
      const messageData = {
        sessionId: 'test-session-456',
        role: 'assistant' as const,
        content: 'Response without metadata'
      };

      const mockCreatedMessage = {
        id: 'msg-456',
        sessionId: messageData.sessionId,
        role: messageData.role,
        content: messageData.content,
        agentId: null,
        metadata: null,
        timestamp: new Date()
      };

      (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
      (mockedPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(mockCreatedMessage);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(mockedPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: messageData.sessionId,
          role: messageData.role,
          content: messageData.content,
          agentId: null,
          metadata: undefined
        }
      });
      expect(responseData.message.agentId).toBeNull();
      expect(responseData.message.metadata).toBeNull();
    });

    it('should validate message schema', async () => {
      const invalidData = {
        sessionId: 'test-session',
        role: 'invalid-role', // Invalid role
        content: 'Test message'
      };

      (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(invalidData);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request data');
      expect(responseData.details).toBeDefined();
      expect(mockedPrisma.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('should reject empty content', async () => {
      const invalidData = {
        sessionId: 'test-session',
        role: 'user',
        content: '' // Empty content
      };

      (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(invalidData);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request data');
      expect(mockedPrisma.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const messageData = {
        sessionId: 'test-session-789',
        role: 'user' as const,
        content: 'Test message'
      };

      (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
      (mockedPrisma.conversationMessage.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to create message');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        '[API] Failed to create conversation message',
        { error: expect.any(Error) }
      );
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        // Mock no session (unauthenticated)
        mockedGetServerSession.mockResolvedValue(null);

        const messageData = {
          sessionId: 'test-session',
          role: 'user' as const,
          content: 'Test message'
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(401);
        expect(responseData.error).toBe('Unauthorized - Please login');
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(mockedPrisma.conversationMessage.create).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        // Already mocked as authenticated in beforeEach
        const messageData = {
          sessionId: 'auth-test-session',
          role: 'user' as const,
          content: 'Authenticated message'
        };

        const mockCreatedMessage = {
          id: 'msg-auth',
          sessionId: messageData.sessionId,
          role: messageData.role,
          content: messageData.content,
          agentId: null,
          metadata: null,
          timestamp: new Date()
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
        (mockedPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(mockCreatedMessage);

        const response = await POST(mockRequest as NextRequest);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(mockedPrisma.conversationMessage.create).toHaveBeenCalled();
      });

      it('should handle session validation errors', async () => {
        // Mock getServerSession throwing an error
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const messageData = {
          sessionId: 'test-session',
          role: 'user' as const,
          content: 'Test message'
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(500);
        expect(responseData.error).toBe('Failed to create message');
        expect(mockedPrisma.conversationMessage.create).not.toHaveBeenCalled();
      });

      it('should handle expired sessions', async () => {
        // Mock expired session (null session indicates expired or invalid)
        mockedGetServerSession.mockResolvedValue(null);

        const messageData = {
          sessionId: 'expired-session-id',
          role: 'user' as const,
          content: 'Message with expired session'
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(401);
        expect(responseData.error).toBe('Unauthorized - Please login');
        expect(mockedPrisma.conversationMessage.create).not.toHaveBeenCalled();
      });
    });

    describe('Message roles', () => {
      const validRoles = ['user', 'assistant', 'system'] as const;

      validRoles.forEach(role => {
        it(`should accept ${role} role`, async () => {
          const messageData = {
            sessionId: 'test-session',
            role,
            content: `Test message from ${role}`
          };

          const mockCreatedMessage = {
            id: `msg-${role}`,
            sessionId: messageData.sessionId,
            role: messageData.role,
            content: messageData.content,
            agentId: null,
            metadata: null,
            timestamp: new Date()
          };

          (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
          (mockedPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(mockCreatedMessage);

          const response = await POST(mockRequest as NextRequest);

          expect(response.status).toBe(200);
          expect(mockedPrisma.conversationMessage.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              role: role
            })
          });
        });
      });
    });

    describe('Metadata handling', () => {
      it('should store complex metadata', async () => {
        const messageData = {
          sessionId: 'test-session',
          role: 'assistant' as const,
          content: 'Response with metadata',
          metadata: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2048,
            tools: ['search', 'calculator'],
            context: {
              previousMessages: 5,
              sessionDuration: 3600
            }
          }
        };

        const mockCreatedMessage = {
          id: 'msg-metadata',
          ...messageData,
          agentId: null,
          timestamp: new Date()
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(messageData);
        (mockedPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(mockCreatedMessage);

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(mockedPrisma.conversationMessage.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            metadata: messageData.metadata
          })
        });
        expect(responseData.message.metadata).toEqual(messageData.metadata);
      });
    });

    describe('Error handling', () => {
      it('should handle malformed JSON', async () => {
        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockRejectedValue(
          new SyntaxError('Invalid JSON')
        );

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(500);
        expect(responseData.error).toBe('Failed to create message');
        expect(mockedLogger.error).toHaveBeenCalled();
      });

      it('should handle missing required fields', async () => {
        const invalidData = {
          role: 'user',
          content: 'Missing sessionId'
          // sessionId is missing
        };

        (mockRequest.json as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(invalidData);

        const response = await POST(mockRequest as NextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.error).toBe('Invalid request data');
        expect(responseData.details).toBeDefined();
        expect(responseData.details[0].path).toContain('sessionId');
      });
    });
  });
});