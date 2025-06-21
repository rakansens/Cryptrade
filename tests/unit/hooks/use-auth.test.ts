import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';;
import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/app/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Mock dependencies
jest.mock('@supabase/ssr');

// Get router mock from jest.setup.js
const mockRouter = jest.mocked(useRouter)();
const mockPush = mockRouter.push;
const mockReplace = mockRouter.replace;

// Mock Supabase client
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

const mockSupabaseClient = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createBrowserClient).mockReturnValue(mockSupabaseClient);
    
    // Default mock implementations
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(AuthProvider, null, children)
  );

  describe('initialization', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('should handle missing Supabase environment variables', async () => {
      const originalEnv = process.env;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      jest.mocked(createBrowserClient).mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
      });

      process.env = originalEnv;
    });

    it('should load existing session on mount', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should handle auth state changes', async () => {
      let authStateCallback: any;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: jest.fn() },
          },
        };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const newUser = { id: '456', email: 'new@example.com' };
      
      act(() => {
        authStateCallback('SIGNED_IN', { user: newUser });
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(newUser);
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      let response;
      await act(async () => {
        response = await result.current.signIn('test@example.com', 'password');
      });

      expect(response.error).toBeNull();
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle sign in errors', async () => {
      const error = new Error('Invalid credentials');
      mockSignInWithPassword.mockResolvedValue({ error });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signIn('test@example.com', 'wrong');
        expect(response.error).toBe(error);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle missing Supabase client', async () => {
      jest.mocked(createBrowserClient).mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signIn('test@example.com', 'password');
        expect(response.error?.message).toBe('Supabase client not initialized');
      });
    });
  });

  describe('signUp', () => {
    it('should sign up successfully without metadata', async () => {
      mockSignUp.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signUp('new@example.com', 'password');
        expect(response.error).toBeNull();
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password',
        options: {
          data: undefined,
        },
      });
    });

    it('should sign up with metadata', async () => {
      mockSignUp.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signUp('new@example.com', 'password', { name: 'John Doe' });
        expect(response.error).toBeNull();
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password',
        options: {
          data: { name: 'John Doe' },
        },
      });
    });

    it('should handle sign up errors', async () => {
      const error = new Error('Email already exists');
      mockSignUp.mockResolvedValue({ error });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signUp('existing@example.com', 'password');
        expect(response.error).toBe(error);
      });
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      let response;
      await act(async () => {
        response = await result.current.signOut();
      });

      expect(response.error).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should handle sign out errors', async () => {
      const error = new Error('Sign out failed');
      mockSignOut.mockResolvedValue({ error });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.signOut();
        expect(response.error).toBe(error);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email successfully', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.resetPassword('forgot@example.com');
        expect(response.error).toBeNull();
      });

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('forgot@example.com', {
        redirectTo: 'http://localhost/reset-password',
      });
    });

    it('should handle reset password errors', async () => {
      const error = new Error('User not found');
      mockResetPasswordForEmail.mockResolvedValue({ error });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.resetPassword('unknown@example.com');
        expect(response.error).toBe(error);
      });
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      mockUpdateUser.mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.updatePassword('newPassword123');
        expect(response.error).toBeNull();
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newPassword123',
      });
    });

    it('should handle update password errors', async () => {
      const error = new Error('Password too weak');
      mockUpdateUser.mockResolvedValue({ error });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const response = await result.current.updatePassword('weak');
        expect(response.error).toBe(error);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null session gracefully', async () => {
      mockGetSession.mockResolvedValue({ data: null });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle session check errors', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });

    it('should cleanup subscription on unmount', () => {
      const unsubscribe = jest.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: {
          subscription: { unsubscribe },
        },
      });

      const { unmount } = renderHook(() => useAuth(), { wrapper });
      
      unmount();
      
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should handle server-side rendering', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      jest.mocked(createBrowserClient).mockReturnValue(null);
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      (global as any).window = originalWindow;
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple sign in attempts', async () => {
      mockSignInWithPassword
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: new Error('Too many attempts') });
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const [response1, response2] = await Promise.all([
          result.current.signIn('test@example.com', 'password'),
          result.current.signIn('test@example.com', 'password'),
        ]);
        
        expect(response1.error).toBeNull();
        expect(response2.error?.message).toBe('Too many attempts');
      });
    });

    it('should handle auth state change during operation', async () => {
      let authStateCallback: any;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: jest.fn() },
          },
        };
      });

      mockSignOut.mockImplementation(() => {
        // Simulate auth state change during sign out
        authStateCallback('SIGNED_OUT', { user: null });
        return Promise.resolve({ error: null });
      });

      const mockUser = { id: '123', email: 'test@example.com' };
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set initial user
      act(() => {
        authStateCallback('SIGNED_IN', { user: mockUser });
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Sign out
      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
    });
  });
});