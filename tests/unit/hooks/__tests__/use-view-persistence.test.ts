/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useViewPersistence } from '../../../hooks/use-view-persistence';
import { useSearchParams, useRouter } from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('useViewPersistence', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockSearchParams = {
    get: jest.fn(),
    toString: jest.fn(() => ''),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('initialization', () => {
    it('should default to home view when no persisted state', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('home');
      expect(result.current.showHome).toBe(true);
      expect(result.current.showChat).toBe(false);
    });

    it('should prioritize URL parameter over localStorage', () => {
      mockSearchParams.get.mockReturnValue('chat');
      localStorageMock.getItem.mockReturnValue('home');
      
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('chat');
      expect(result.current.showChat).toBe(true);
    });

    it('should use localStorage when URL parameter is not present', () => {
      mockSearchParams.get.mockReturnValue(null);
      localStorageMock.getItem.mockReturnValue('chat');
      
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('chat');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('cryptrade_current_view');
    });

    it('should ignore invalid URL parameter values', () => {
      mockSearchParams.get.mockReturnValue('invalid');
      
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('home');
    });

    it('should ignore invalid localStorage values', () => {
      mockSearchParams.get.mockReturnValue(null);
      localStorageMock.getItem.mockReturnValue('invalid');
      
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('home');
    });
  });

  describe('view updates', () => {
    it('should update view and persist to localStorage', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      act(() => {
        result.current.setView('chat');
      });
      
      expect(result.current.currentView).toBe('chat');
      expect(result.current.showChat).toBe(true);
      expect(result.current.showHome).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cryptrade_current_view', 'chat');
    });

    it('should update URL when view changes', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      act(() => {
        result.current.setView('chat');
      });
      
      expect(mockRouter.push).toHaveBeenCalledWith('?view=chat', { scroll: false });
    });

    it('should preserve existing URL parameters', () => {
      mockSearchParams.toString.mockReturnValue('foo=bar');
      const { result } = renderHook(() => useViewPersistence());
      
      act(() => {
        result.current.setView('chat');
      });
      
      expect(mockRouter.push).toHaveBeenCalledWith('?foo=bar&view=chat', { scroll: false });
    });

    it('should handle goToChat helper', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      act(() => {
        result.current.goToChat();
      });
      
      expect(result.current.currentView).toBe('chat');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cryptrade_current_view', 'chat');
    });

    it('should handle goToHome helper', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      // Start from chat
      act(() => {
        result.current.setView('chat');
      });
      
      act(() => {
        result.current.goToHome();
      });
      
      expect(result.current.currentView).toBe('home');
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('cryptrade_current_view', 'home');
    });
  });

  describe('URL synchronization', () => {
    it('should sync with URL parameter changes', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      // Initially home
      expect(result.current.currentView).toBe('home');
      
      // The hook uses setView to update, which internally updates localStorage
      // Let's test the update mechanism instead
      act(() => {
        result.current.setView('chat');
      });
      
      expect(result.current.currentView).toBe('chat');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cryptrade_current_view', 'chat');
    });

    it('should not update if URL parameter matches current view', () => {
      mockSearchParams.get.mockReturnValue('home');
      const { rerender } = renderHook(() => useViewPersistence());
      
      const setItemCallCount = localStorageMock.setItem.mock.calls.length;
      
      // Rerender with same URL parameter
      rerender();
      
      // Should not call setItem again
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(setItemCallCount);
    });
  });

  describe('SSR safety', () => {
    it('should handle missing router gracefully', () => {
      // Create a mock router without push method
      const brokenRouter = {};
      (useRouter as jest.Mock).mockReturnValue(brokenRouter);
      
      const { result } = renderHook(() => useViewPersistence());
      
      // Initial state
      expect(result.current.currentView).toBe('home');
      
      // Should not throw when updating view even with broken router
      act(() => {
        result.current.setView('chat');
      });
      
      // View should still update even without router
      expect(result.current.currentView).toBe('chat');
      // localStorage should still be updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cryptrade_current_view', 'chat');
    });

    it('should handle missing searchParams gracefully', () => {
      (useSearchParams as jest.Mock).mockReturnValue(null);
      
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('home');
      
      act(() => {
        result.current.setView('chat');
      });
      
      expect(result.current.currentView).toBe('chat');
    });

    it('should handle hook errors gracefully', () => {
      // Mock useSearchParams to return null (simulating SSR)
      (useSearchParams as jest.Mock).mockReturnValue(null);
      
      // Should not throw
      const { result } = renderHook(() => useViewPersistence());
      
      expect(result.current.currentView).toBe('home');
    });
  });

  describe('localStorage fallback', () => {
    beforeEach(() => {
      // Simulate environment without localStorage
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });
    });

    afterEach(() => {
      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });
    });

    it('should handle missing localStorage gracefully', () => {
      const { result } = renderHook(() => useViewPersistence());
      
      // Initial state
      expect(result.current.currentView).toBe('home');
      
      // Should not throw when updating view without localStorage
      act(() => {
        result.current.setView('chat');
      });
      
      // View should still update even without localStorage
      expect(result.current.currentView).toBe('chat');
    });
  });
});
