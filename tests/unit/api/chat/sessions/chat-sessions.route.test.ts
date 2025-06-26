import { GET, PATCH, DELETE } from '@/app/api/chat/sessions/[sessionId]/route';
import { NextRequest } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';
import { getServerSession } from '@/lib/auth/server';

// Mock dependencies
jest.mock('@/lib/services/database/chat.service', () => ({
  ChatDatabaseService: {
    getSession: jest.fn(),
    getSessionWithMessages: jest.fn(),
    updateSessionTitle: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn()
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('/api/chat/sessions/[sessionId]', () => {
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
    it('should return session info without messages by default', async () => {
      const mockSession = {
        id: sessionId,
        summary: 'Test Session',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z'),
      };

      (ChatDatabaseService.getSession as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        session: {
          id: sessionId,
          title: 'Test Session',
          createdAt: mockSession.createdAt.getTime(),
          updatedAt: mockSession.updatedAt.getTime(),
        },
      });

      expect(ChatDatabaseService.getSession).toHaveBeenCalledWith(sessionId);
      expect(ChatDatabaseService.getSessionWithMessages).not.toHaveBeenCalled();
    });

    it('should return session with messages when include=messages', async () => {
      const mockSessionData = {
        id: sessionId,
        summary: 'Test Session',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z'),
        messages: [
          {
            id: 'msg-1',
            content: 'Hello',
            role: 'user',
            timestamp: new Date('2024-01-01T10:30:00Z'),
            agentId: null,
            metadata: {},
          },
          {
            id: 'msg-2',
            content: 'Hi there!',
            role: 'assistant',
            timestamp: new Date('2024-01-01T10:31:00Z'),
            agentId: 'test-agent',
            metadata: { confidence: 0.9 },
          },
        ],
      };

      (ChatDatabaseService.getSessionWithMessages as jest.Mock).mockResolvedValue(mockSessionData);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123?include=messages');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        session: {
          id: sessionId,
          title: 'Test Session',
          createdAt: mockSessionData.createdAt.getTime(),
          updatedAt: mockSessionData.updatedAt.getTime(),
        },
        messages: [
          {
            id: 'msg-1',
            content: 'Hello',
            role: 'user',
            timestamp: mockSessionData.messages[0].timestamp.getTime(),
            type: 'text',
            agentId: null,
            metadata: {},
          },
          {
            id: 'msg-2',
            content: 'Hi there!',
            role: 'assistant',
            timestamp: mockSessionData.messages[1].timestamp.getTime(),
            type: 'text',
            agentId: 'test-agent',
            metadata: { confidence: 0.9 },
          },
        ],
      });

      expect(ChatDatabaseService.getSessionWithMessages).toHaveBeenCalledWith(sessionId);
      expect(ChatDatabaseService.getSession).not.toHaveBeenCalled();
    });

    it('should handle untitled sessions', async () => {
      const mockSession = {
        id: sessionId,
        summary: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z'),
      };

      (ChatDatabaseService.getSession as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.title).toBe('Untitled Session');
    });

    it('should return 404 when session not found', async () => {
      (ChatDatabaseService.getSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Session not found' });
    });

    it('should return 404 when session with messages not found', async () => {
      (ChatDatabaseService.getSessionWithMessages as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123?include=messages');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Session not found' });
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      (ChatDatabaseService.getSession as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to get session' });
      expect(logger.error).toHaveBeenCalledWith('[API] Failed to get session', { error: mockError });
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
        const response = await GET(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized - Please login' });
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.getSession).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        const mockSession = {
          id: sessionId,
          summary: 'Test Session',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (ChatDatabaseService.getSession as jest.Mock).mockResolvedValue(mockSession);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
        const response = await GET(request, mockRouteContext);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.getSession).toHaveBeenCalled();
      });

      it('should handle session validation errors', async () => {
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123');
        const response = await GET(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Failed to get session' });
      });
    });
  });

  describe('PATCH', () => {
    it('should update session title successfully', async () => {
      const newTitle = 'Updated Session Title';
      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle }),
      });

      const response = await PATCH(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(ChatDatabaseService.updateSessionTitle).toHaveBeenCalledWith(sessionId, newTitle);
    });

    it('should handle empty title', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'PATCH',
        body: JSON.stringify({ title: '' }),
      });

      const response = await PATCH(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(ChatDatabaseService.updateSessionTitle).toHaveBeenCalledWith(sessionId, '');
    });

    it('should handle database errors during update', async () => {
      const mockError = new Error('Update failed');
      (ChatDatabaseService.updateSessionTitle as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New Title' }),
      });

      const response = await PATCH(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to update session' });
      expect(logger.error).toHaveBeenCalledWith('[API] Failed to update session', { error: mockError });
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'PATCH',
        body: 'invalid json',
      });

      const response = await PATCH(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to update session' });
      expect(logger.error).toHaveBeenCalled();
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'New Title' }),
        });

        const response = await PATCH(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized - Please login' });
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.updateSessionTitle).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        // Mock successful update
        (ChatDatabaseService.updateSessionTitle as jest.Mock).mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'Authenticated Update' }),
        });

        const response = await PATCH(request, mockRouteContext);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.updateSessionTitle).toHaveBeenCalledWith(sessionId, 'Authenticated Update');
      });
    });
  });

  describe('DELETE', () => {
    it('should delete session successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(ChatDatabaseService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle database errors during deletion', async () => {
      const mockError = new Error('Delete failed');
      (ChatDatabaseService.deleteSession as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to delete session' });
      expect(logger.error).toHaveBeenCalledWith('[API] Failed to delete session', { error: mockError });
    });

    it('should handle non-existent session deletion', async () => {
      // Simulate deleteSession not throwing error for non-existent session
      (ChatDatabaseService.deleteSession as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions/non-existent-session', {
        method: 'DELETE',
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ sessionId: 'non-existent-session' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(ChatDatabaseService.deleteSession).toHaveBeenCalledWith('non-existent-session');
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
          method: 'DELETE',
        });

        const response = await DELETE(request, mockRouteContext);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized - Please login' });
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.deleteSession).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        // Mock successful deletion
        (ChatDatabaseService.deleteSession as jest.Mock).mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions/test-session-123', {
          method: 'DELETE',
        });

        const response = await DELETE(request, mockRouteContext);

        expect(response.status).toBe(200);
        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(ChatDatabaseService.deleteSession).toHaveBeenCalledWith(sessionId);
      });
    });
  });
});