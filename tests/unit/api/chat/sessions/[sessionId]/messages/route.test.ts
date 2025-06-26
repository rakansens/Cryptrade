import { GET, POST } from '@/app/api/chat/sessions/[sessionId]/messages/route';
import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';
import { getServerSession } from '@/lib/auth/server';

// Mock dependencies
jest.mock('@/lib/services/database/chat.service', () => ({
  ChatDatabaseService: {
    getMessages: jest.fn(),
    addMessage: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => false),
}));

jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn()
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('/api/chat/sessions/[sessionId]/messages', () => {
  const sessionId = 'test-session-123';
  const mockRouteContext = {
    params: Promise.resolve({ sessionId }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // By default, mock as authenticated for all tests
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);
  });

  describe('GET', () => {
    it('should return messages for a session', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sessionId,
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          sessionId,
          role: 'assistant',
          content: 'I am doing well, thank you!',
          timestamp: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      (ChatDatabaseService.getMessages as jest.Mock).mockResolvedValue(mockMessages);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ messages: mockMessages });
      expect(ChatDatabaseService.getMessages).toHaveBeenCalledWith(sessionId);
    });

    it('should return empty array when no messages exist', async () => {
      (ChatDatabaseService.getMessages as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ messages: [] });
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      (ChatDatabaseService.getMessages as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to get messages' });
      expect(logger.error).toHaveBeenCalledWith('[API] Failed to get messages', { error: mockError });
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
        const response = await GET(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized - Please login' });
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.getMessages).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        const mockMessages = [{ id: 'msg-1', content: 'Test' }];
        (ChatDatabaseService.getMessages as jest.Mock).mockResolvedValue(mockMessages);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
        const response = await GET(request, mockRouteContext);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.getMessages).toHaveBeenCalled();
      });

      it('should handle session validation errors', async () => {
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages');
        const response = await GET(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Failed to get messages' });
      });
    });
  });

  describe('POST', () => {
    it('should add a message to the session', async () => {
      const messageData = {
        role: 'user',
        content: 'New message content',
        metadata: { source: 'test' },
      };

      const mockDbMessage = {
        id: 'msg-new',
        sessionId,
        ...messageData,
        timestamp: new Date(),
      };

      (ChatDatabaseService.addMessage as jest.Mock).mockResolvedValue(mockDbMessage);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });

      const response = await POST(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: mockDbMessage });
      expect(ChatDatabaseService.addMessage).toHaveBeenCalledWith(sessionId, messageData);
    });

    it('should handle invalid message data', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to add message' });
      expect(logger.error).toHaveBeenCalledWith(
        '[API] Failed to add message',
        expect.objectContaining({ sessionId })
      );
    });

    it('should handle database errors during message creation', async () => {
      const messageData = {
        role: 'user',
        content: 'Test message',
      };

      const mockError = new Error('Database error');
      (ChatDatabaseService.addMessage as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });

      const response = await POST(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to add message' });
      expect(logger.error).toHaveBeenCalledWith(
        '[API] Failed to add message',
        expect.objectContaining({ error: mockError, sessionId })
      );
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
          method: 'POST',
          body: JSON.stringify({ role: 'user', content: 'Test' }),
        });

        const response = await POST(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized - Please login' });
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.addMessage).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        const messageData = { role: 'user', content: 'Authenticated message' };
        const mockDbMessage = { id: 'msg-auth', ...messageData };
        (ChatDatabaseService.addMessage as jest.Mock).mockResolvedValue(mockDbMessage);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
          method: 'POST',
          body: JSON.stringify(messageData),
        });

        const response = await POST(request, mockRouteContext);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.addMessage).toHaveBeenCalled();
      });

      it('should handle session validation errors', async () => {
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123/messages', {
          method: 'POST',
          body: JSON.stringify({ role: 'user', content: 'Test' }),
        });

        const response = await POST(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Failed to add message' });
      });
    });

  });
});