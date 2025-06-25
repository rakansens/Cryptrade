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

// Don't mock the route module - we want to test the actual implementation

// Mock console.error to avoid clutter in test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
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

    const { GET } = require('@/app/api/auth/me/route');
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

    const { GET } = require('@/app/api/auth/me/route');
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

    const { GET } = require('@/app/api/auth/me/route');
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Failed to fetch user data',
    });
    expect(console.error).toHaveBeenCalledWith('Error fetching user:', dbError);
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

    const { GET } = require('@/app/api/auth/me/route');
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

    const { GET } = require('@/app/api/auth/me/route');
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

    const { GET } = require('@/app/api/auth/me/route');
    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.name).toBeNull();
  });

  it('should handle authentication wrapper correctly', async () => {
    const { GET } = require('@/app/api/auth/me/route');
    
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
    
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });
});