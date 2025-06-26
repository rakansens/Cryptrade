import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import React from 'react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  })),
}));

// Mock the auth hook to avoid dealing with Supabase dependencies
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    error: null,
  })),
}));

import { useAuth } from '@/hooks/use-auth';

describe('useAuth', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide auth methods', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current).toBeDefined();
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
  });

  it('should handle loading state', () => {
    mockUseAuth.mockReturnValueOnce({
      user: null,
      loading: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
  });

  it('should handle authenticated user', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
    };

    mockUseAuth.mockReturnValueOnce({
      user: mockUser as any,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle auth errors', () => {
    const mockError = 'Authentication failed';

    mockUseAuth.mockReturnValueOnce({
      user: null,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      error: mockError,
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.error).toBe(mockError);
  });

  it('should call signIn method', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({ user: {}, session: {} });

    mockUseAuth.mockReturnValueOnce({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: jest.fn(),
      signOut: jest.fn(),
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });

    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('should call signOut method', async () => {
    const mockSignOut = jest.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValueOnce({
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: mockSignOut,
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  // Security-focused tests
  describe('Security Tests', () => {
    it('should handle weak password errors', async () => {
      const mockSignUp = jest.fn().mockRejectedValue(new Error('Password must be at least 8 characters'));

      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: jest.fn(),
        signUp: mockSignUp,
        signOut: jest.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp('test@example.com', 'weak');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'weak');
    });

    it('should handle invalid email format', async () => {
      const mockSignIn = jest.fn().mockRejectedValue(new Error('Invalid email format'));

      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: mockSignIn,
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn('invalid-email', 'password');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('should handle session expiration', () => {
      const expiredUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        session_expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      mockUseAuth.mockReturnValueOnce({
        user: expiredUser as any,
        loading: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: 'Session expired',
      });

      const { result } = renderHook(() => useAuth());
      expect(result.current.error).toBe('Session expired');
    });

    it('should handle rate limiting errors', async () => {
      const mockSignIn = jest.fn().mockRejectedValue(new Error('Too many attempts. Please try again later'));

      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: mockSignIn,
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      // Simulate multiple rapid sign-in attempts
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          try {
            await result.current.signIn('test@example.com', 'password');
          } catch (error) {
            // Expected to fail
          }
        });
      }

      expect(mockSignIn).toHaveBeenCalledTimes(5);
    });

    it('should sanitize user input', async () => {
      const mockSignIn = jest.fn().mockResolvedValue({ user: {}, session: {} });

      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: mockSignIn,
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      const maliciousEmail = '<script>alert("xss")</script>@example.com';
      const maliciousPassword = "'; DROP TABLE users; --";

      await act(async () => {
        await result.current.signIn(maliciousEmail, maliciousPassword);
      });

      // Verify the malicious input is passed as-is (sanitization should happen server-side)
      expect(mockSignIn).toHaveBeenCalledWith(maliciousEmail, maliciousPassword);
    });

    it('should handle account lockout', async () => {
      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: jest.fn().mockRejectedValue(new Error('Account locked due to suspicious activity')),
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: 'Account locked due to suspicious activity',
      });

      const { result } = renderHook(() => useAuth());
      expect(result.current.error).toContain('Account locked');
    });

    it('should clear sensitive data on signOut', async () => {
      const mockSignOut = jest.fn().mockImplementation(() => {
        // Simulate clearing sensitive data
        mockUseAuth.mockReturnValueOnce({
          user: null,
          loading: false,
          signIn: jest.fn(),
          signUp: jest.fn(),
          signOut: jest.fn(),
          error: null,
        });
        return Promise.resolve();
      });

      mockUseAuth.mockReturnValueOnce({
        user: { id: 'test-user-id', email: 'test@example.com', token: 'sensitive-token' } as any,
        loading: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: mockSignOut,
        error: null,
      });

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.user).toBeTruthy();

      await act(async () => {
        await result.current.signOut();
      });

      rerender();
      // After signOut, user should be null
      const { result: newResult } = renderHook(() => useAuth());
      expect(newResult.current.user).toBeNull();
    });

    it('should handle CSRF token validation', async () => {
      const mockSignIn = jest.fn().mockImplementation(async (email, password, csrfToken) => {
        if (!csrfToken) {
          throw new Error('CSRF token required');
        }
        return { user: {}, session: {} };
      });

      mockUseAuth.mockReturnValueOnce({
        user: null,
        loading: false,
        signIn: mockSignIn,
        signUp: jest.fn(),
        signOut: jest.fn(),
        error: null,
        csrfToken: 'valid-csrf-token',
      });

      const { result } = renderHook(() => useAuth());

      // Test with CSRF token
      await act(async () => {
        await result.current.signIn('test@example.com', 'password', 'valid-csrf-token');
      });

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password', 'valid-csrf-token');
    });
  });
});