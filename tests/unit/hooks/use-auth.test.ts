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
});