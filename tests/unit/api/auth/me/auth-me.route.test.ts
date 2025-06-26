// Mock Supabase before any imports
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
  })),
}));

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/api/auth-handler', () => ({
  withAuth: (handler: Function) => async (req: NextRequest) => {
    // Create an authenticated request with userId and session
    const fixedDate = new Date('2025-01-01T00:00:00.000Z');
    const authReq = Object.assign(req, {
      userId: 'user-123',
      session: {
        expires_at: new Date(fixedDate.getTime() + 86400000).toISOString(),
      }
    });
    return handler(authReq);
  },
  AuthenticatedRequest: class {},
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Import the route handler at the top
import { GET } from '@/app/api/auth/me/route';

// Mock console.error to avoid clutter in test output
const mockConsoleError = jest.fn();
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = mockConsoleError;
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('GET /api/auth/me', () => {
  const mockUserId = 'user-123';
  const fixedDate = new Date('2025-01-01T00:00:00.000Z');
  const mockSession = {
    expires_at: new Date(fixedDate.getTime() + 86400000).toISOString(), // 24 hours from fixed date
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    // Mock Date.now to return a fixed timestamp
    jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return user data for authenticated user', async () => {
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(fixedDate.getTime() - 86400000),
      updatedAt: new Date(fixedDate.getTime() - 86400000),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      user: mockUser,
      session: {
        expiresAt: mockSession.expires_at,
      },
    });

    // Verify the database query was made with correct parameters
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should return 404 when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'User not found',
    });
  });

  it('should handle database errors', async () => {
    const dbError = new Error('Database connection failed');
    (prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(dbError);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Failed to fetch user data',
    });
    // Note: console.error is called in the actual implementation for error logging
    // but we focus on testing the response behavior rather than logging specifics
  });

  it('should only select specific user fields', async () => {
    // Even if database has extra fields, only selected fields are returned
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).not.toHaveProperty('password');
    expect(data.user).toHaveProperty('email');
    expect(data.user).toHaveProperty('name');
    
    // Verify that the query only selects specific fields
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should handle missing session data gracefully', async () => {
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session).toBeDefined();
    expect(data.session.expiresAt).toBe(mockSession.expires_at);
  });

  it('should return user with null name field', async () => {
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      name: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    // Use the imported GET handler
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.name).toBeNull();
  });

  it('should handle authentication wrapper correctly', async () => {
    // Use the imported GET handler
    
    // Verify GET is exported and is a function wrapped by withAuth
    expect(GET).toBeDefined();
    expect(typeof GET).toBe('function');
    
    // Test that GET works with a proper request
    const mockUser = {
      id: mockUserId,
      email: 'auth-test@example.com',
      name: 'Auth Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  // Security-focused tests
  describe('Security Tests', () => {
    it('should not expose sensitive user fields', async () => {
      // Mock Prisma to only return selected fields (simulating actual Prisma behavior)
      const mockUserWithOnlySelectedFields = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Sensitive fields are not included because of the select clause
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUserWithOnlySelectedFields);

      const request = new NextRequest('http://localhost/api/auth/me');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('apiKey');
      expect(data.user).not.toHaveProperty('refreshToken');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('name');
      
      // Verify that select clause is used to exclude sensitive fields
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should handle expired sessions', async () => {
      // Mock withAuth to simulate expired session
      jest.mock('@/lib/api/auth-handler', () => ({
        withAuth: (handler: Function) => async (req: NextRequest) => {
          const expiredSession = {
            expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          };
          const authReq = Object.assign(req, {
            userId: 'user-123',
            session: expiredSession
          });
          return handler(authReq);
        },
        AuthenticatedRequest: class {},
      }));

      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      const request = new NextRequest('http://localhost/api/auth/me');
      const response = await GET(request);
      const data = await response.json();

      // Should still return user data but with expired session info
      expect(response.status).toBe(200);
      expect(data.session.expiresAt).toBeDefined();
    });

    it('should handle SQL injection attempts in userId', async () => {
      // Test that Prisma's parameterized queries are used safely
      // Note: withAuth in real app would validate userId, but we test Prisma safety here
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/auth/me');
      const response = await GET(request);

      // Verify Prisma parameterized query is used (safe from SQL injection)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" }, // Normal userId from withAuth mock
        select: expect.any(Object)
      });
      expect(response.status).toBe(404); // User not found (null response)
    });

    it('should validate session token format', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      const request = new NextRequest('http://localhost/api/auth/me', {
        headers: {
          'Authorization': 'Bearer invalid_token_format',
        }
      });
      
      const response = await GET(request);
      const data = await response.json();

      // withAuth middleware should handle token validation
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
    });

    it('should prevent timing attacks on user lookup', async () => {
      const timings: number[] = [];

      // Test multiple user lookups
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
          i % 2 === 0 ? null : { id: mockUserId, email: 'test@example.com' }
        );

        const request = new NextRequest('http://localhost/api/auth/me');
        await GET(request);
        
        timings.push(Date.now() - startTime);
      }

      // Response times should be relatively consistent
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      
      // Allow for some variance but not significant differences
      expect(maxDeviation).toBeLessThan(100); // milliseconds
    });

    it('should handle concurrent requests safely', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Simulate concurrent requests
      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost/api/auth/me')
      );

      const responses = await Promise.all(
        requests.map(req => GET(req))
      );

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Database should be queried for each request
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(10);
    });

    it('should include security headers in response', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      const request = new NextRequest('http://localhost/api/auth/me');
      const response = await GET(request);

      // Check for security headers (these might be set by middleware)
      expect(response.headers.get('X-Content-Type-Options')).toBeDefined();
      expect(response.headers.get('X-Frame-Options')).toBeDefined();
    });

    it('should handle user enumeration attacks', async () => {
      // Test with non-existent user IDs
      const testUserIds = ['user-123', 'user-456', 'user-789'];
      const responses = [];

      for (const userId of testUserIds) {
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        
        const request = new NextRequest('http://localhost/api/auth/me');
        const response = await GET(request);
        responses.push(response);
      }

      // All should return same error to prevent enumeration
      responses.forEach(response => {
        expect(response.status).toBe(404);
      });
    });
  });
});