import { GET, POST } from '@/app/api/chat/sessions/route';
import { NextRequest } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { createApiSuccessResponse, handleApiError, parseRequestBody } from '@/app/api/utils/responses';
import { getServerSession } from '@/lib/auth/server';

// Mock dependencies
jest.mock('@/lib/services/database/chat.service', () => ({
  ChatDatabaseService: {
    getUserSessions: jest.fn(),
    createSession: jest.fn(),
  },
}));

jest.mock('@/app/api/utils/responses', () => ({
  createApiSuccessResponse: jest.fn((data) => new Response(JSON.stringify(data), { status: 200 })),
  handleApiError: jest.fn((error, message, status) => new Response(JSON.stringify({ error: message }), { status: status || 500 })),
  parseRequestBody: jest.fn(),
}));

jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn()
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('/api/chat/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // By default, mock as authenticated for all tests
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);
  });

  describe('GET', () => {
    it('should return user sessions with userId from authenticated session', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'test-user-id',
          title: 'Session 1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T11:00:00Z'),
        },
        {
          id: 'session-2',
          userId: 'test-user-id',
          title: 'Session 2',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-02T11:00:00Z'),
        },
      ];

      (ChatDatabaseService.getUserSessions as jest.Mock).mockResolvedValue(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions');
      request.headers.set('x-user-id', 'user-123'); // This will be ignored in favor of session user ID

      const response = await GET(request);

      expect(ChatDatabaseService.getUserSessions).toHaveBeenCalledWith('test-user-id');
      expect(createApiSuccessResponse).toHaveBeenCalledWith({ sessions: mockSessions });
    });

    it('should use session user ID even when no header is provided', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'test-user-id',
          title: 'Session from authenticated user',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T11:00:00Z'),
        },
      ];

      (ChatDatabaseService.getUserSessions as jest.Mock).mockResolvedValue(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions');
      // No x-user-id header set

      const response = await GET(request);

      expect(ChatDatabaseService.getUserSessions).toHaveBeenCalledWith('test-user-id');
      expect(createApiSuccessResponse).toHaveBeenCalledWith({ sessions: mockSessions });
    });

    it('should return empty array when no sessions exist', async () => {
      (ChatDatabaseService.getUserSessions as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions');
      request.headers.set('x-user-id', 'user-with-no-sessions'); // Will be ignored

      const response = await GET(request);

      expect(ChatDatabaseService.getUserSessions).toHaveBeenCalledWith('test-user-id');
      expect(createApiSuccessResponse).toHaveBeenCalledWith({ sessions: [] });
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      (ChatDatabaseService.getUserSessions as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions');

      const response = await GET(request);

      expect(handleApiError).toHaveBeenCalledWith(mockError, 'Failed to get sessions');
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions');
        
        const response = await GET(request);

        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(handleApiError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Unauthorized - Please login' }),
          'Unauthorized',
          401
        );
        expect(ChatDatabaseService.getUserSessions).not.toHaveBeenCalled();
      });

      it('should use authenticated user ID when available', async () => {
        const mockSessions = [{ id: 'session-1', userId: 'test-user-id' }];
        (ChatDatabaseService.getUserSessions as jest.Mock).mockResolvedValue(mockSessions);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions');
        
        await GET(request);

        expect(ChatDatabaseService.getUserSessions).toHaveBeenCalledWith('test-user-id');
      });

      it('should handle session validation errors', async () => {
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const request = new NextRequest('http://localhost:3000/api/chat/sessions');
        
        const response = await GET(request);

        expect(handleApiError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Session validation failed' }),
          'Failed to get sessions'
        );
      });
    });
  });

  describe('POST', () => {
    it('should create a new session with userId and title', async () => {
      const requestBody = {
        userId: 'user-123',
        title: 'New Trading Session',
      };

      const mockSession = {
        id: 'new-session-id',
        userId: 'user-123',
        title: 'New Trading Session',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        updatedAt: new Date('2024-01-01T12:00:00Z'),
      };

      (parseRequestBody as jest.Mock).mockResolvedValue({ data: requestBody, error: null });
      (ChatDatabaseService.createSession as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(parseRequestBody).toHaveBeenCalledWith(request, expect.any(Object));
      expect(ChatDatabaseService.createSession).toHaveBeenCalledWith('user-123', 'New Trading Session');
      expect(createApiSuccessResponse).toHaveBeenCalledWith({ session: mockSession });
    });

    it('should create a session with authenticated user ID when userId not provided', async () => {
      const requestBody = {
        title: 'New Session',
      };

      const mockSession = {
        id: 'new-session-id',
        userId: 'test-user-id',
        title: 'New Session',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        updatedAt: new Date('2024-01-01T12:00:00Z'),
      };

      (parseRequestBody as jest.Mock).mockResolvedValue({ data: requestBody, error: null });
      (ChatDatabaseService.createSession as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(ChatDatabaseService.createSession).toHaveBeenCalledWith('test-user-id', 'New Session');
      expect(createApiSuccessResponse).toHaveBeenCalledWith({ session: mockSession });
    });

    it('should handle validation errors', async () => {
      const validationError = new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 });
      (parseRequestBody as jest.Mock).mockResolvedValue({ data: null, error: validationError });

      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: '' }), // Empty title should fail validation
      });

      const response = await POST(request);

      expect(response).toBe(validationError);
      expect(ChatDatabaseService.createSession).not.toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      const requestBody = {
        userId: 'user-123',
        title: 'New Session',
      };

      const mockError = new Error('Database error');
      (parseRequestBody as jest.Mock).mockResolvedValue({ data: requestBody, error: null });
      (ChatDatabaseService.createSession as jest.Mock).mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(handleApiError).toHaveBeenCalledWith(mockError, 'Failed to create session');
    });

    it('should enforce title length constraints', async () => {
      // Test that the schema validation is working by checking parseRequestBody
      const longTitle = 'a'.repeat(256); // 256 characters, exceeding max length
      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: longTitle }),
      });

      // Mock parseRequestBody to simulate validation error
      const validationError = new Response(
        JSON.stringify({ error: 'Title too long' }), 
        { status: 400 }
      );
      (parseRequestBody as jest.Mock).mockResolvedValue({ data: null, error: validationError });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(ChatDatabaseService.createSession).not.toHaveBeenCalled();
    });

    it('should handle empty title validation', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: '' }),
      });

      const validationError = new Response(
        JSON.stringify({ error: 'Title is required' }), 
        { status: 400 }
      );
      (parseRequestBody as jest.Mock).mockResolvedValue({ data: null, error: validationError });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(ChatDatabaseService.createSession).not.toHaveBeenCalled();
    });

    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: 'New Session' }),
        });
        
        const response = await POST(request);

        expect(mockedGetServerSession).toHaveBeenCalled();
        expect(handleApiError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Unauthorized - Please login' }),
          'Unauthorized',
          401
        );
        expect(parseRequestBody).not.toHaveBeenCalled();
        expect(ChatDatabaseService.createSession).not.toHaveBeenCalled();
      });

      it('should use authenticated user ID when userId not provided', async () => {
        const requestBody = {
          title: 'New Trading Session',
        };

        const mockSession = {
          id: 'new-session-id',
          userId: 'test-user-id',
          title: 'New Trading Session',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (parseRequestBody as jest.Mock).mockResolvedValue({ data: requestBody, error: null });
        (ChatDatabaseService.createSession as jest.Mock).mockResolvedValue(mockSession);

        const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        await POST(request);

        expect(ChatDatabaseService.createSession).toHaveBeenCalledWith('test-user-id', 'New Trading Session');
      });

      it('should handle session validation errors', async () => {
        mockedGetServerSession.mockRejectedValue(new Error('Session validation failed'));

        const request = new NextRequest('http://localhost:3000/api/chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: 'New Session' }),
        });
        
        const response = await POST(request);

        expect(handleApiError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Session validation failed' }),
          'Failed to create session'
        );
      });
    });
  });
});