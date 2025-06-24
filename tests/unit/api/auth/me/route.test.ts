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
import { GET } from '@/app/api/auth/me/route';
import { withAuth } from '@/lib/api/auth-handler';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/api/auth-handler');
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

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
  const mockSession = {
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup withAuth mock to call the handler with authenticated request
    (withAuth as jest.Mock).mockImplementation((handler) => {
      return async (req: NextRequest) => {
        const authenticatedReq = Object.assign(req, {
          userId: mockUserId,
          session: mockSession,
        });
        return handler(authenticatedReq);
      };
    });
  });

  it('should return user data for authenticated user', async () => {
    const mockUser = {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      user: {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      },
      session: {
        expiresAt: mockSession.expires_at,
      },
    });

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
    const mockUserWithExtraFields = {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed-password', // Should not be returned
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUserWithExtraFields);

    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).not.toHaveProperty('password');
    expect(data.user).toHaveProperty('email');
    expect(data.user).toHaveProperty('name');
  });

  it('should handle missing session data gracefully', async () => {
    // Mock withAuth to not include session data
    (withAuth as jest.Mock).mockImplementationOnce((handler) => {
      return async (req: NextRequest) => {
        const authenticatedReq = Object.assign(req, {
          userId: mockUserId,
          session: {},
        });
        return handler(authenticatedReq);
      };
    });

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

    expect(response.status).toBe(200);
    expect(data.session).toEqual({
      expiresAt: undefined,
    });
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

    const request = new NextRequest('http://localhost/api/auth/me');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.name).toBeNull();
  });

  it('should handle authentication wrapper correctly', async () => {
    // Verify that withAuth wrapper is properly used
    expect(withAuth).toHaveBeenCalledWith(expect.any(Function));
    
    // Verify the wrapped handler is the correct function
    const wrappedHandler = (withAuth as jest.Mock).mock.calls[0][0];
    expect(wrappedHandler).toBeInstanceOf(Function);
  });
});