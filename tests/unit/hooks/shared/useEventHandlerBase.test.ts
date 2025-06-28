import { renderHook, act } from '@testing-library/react';
import { useEventHandlerBase } from '@/hooks/shared/useEventHandlerBase';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useEventHandlerBase', () => {
  const defaultConfig = {
    hookName: 'useEventHandlerBase-test',
    enableAutoCleanup: true,
    logLevel: 'info' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear any existing event listeners
    const events = ['test:event', 'chart:addPattern', 'chart:removePattern'];
    events.forEach(event => {
      const listeners = (window as any).listeners?.(event) || [];
      listeners.forEach((listener: any) => {
        window.removeEventListener(event, listener);
      });
    });
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.getRegisteredEventsCount()).toBe(0);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-event-handler',
        enableAutoCleanup: false,
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useEventHandlerBase(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('event registration', () => {
    it('should register event listeners', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('test:event', expect.any(Function));
      expect(result.current.getRegisteredEventsCount()).toBe(1);
      
      addEventListenerSpy.mockRestore();
    });

    it('should register multiple event listeners', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event1', mockHandler1);
        result.current.registerEventListener('test:event2', mockHandler2);
      });
      
      expect(result.current.getRegisteredEventsCount()).toBe(2);
    });

    it('should handle duplicate event registration', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      // Should only register once
      expect(result.current.getRegisteredEventsCount()).toBe(1);
    });
  });

  describe('event handling', () => {
    it('should execute event handlers when events are dispatched', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle multiple handlers for the same event', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler1);
        result.current.registerEventListener('test:event', mockHandler2);
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockHandler1).toHaveBeenCalledWith(testEvent);
      expect(mockHandler2).toHaveBeenCalledWith(testEvent);
    });

    it('should not execute handlers when unmounted', () => {
      const { result, unmount } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      unmount();
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      window.dispatchEvent(testEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('safe execution', () => {
    it('should execute safely when mounted', async () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation);
      });
      
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should not execute when unmounted', async () => {
      const { result, unmount } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      unmount();
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation);
      });
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should handle errors in safe execution', async () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation, {
          data: { test: 'context' }
        });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useEventHandlerBase-test] Error in test operation',
        expect.objectContaining({
          error: 'Test error',
          data: { test: 'context' }
        })
      );
    });
  });

  describe('validation', () => {
    it('should validate events with custom validator', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockValidator = jest.fn().mockReturnValue({ success: true, data: { valid: true } });
      
      const isValid = result.current.validateEvent('test:event', { test: 'data' }, mockValidator);
      
      expect(mockValidator).toHaveBeenCalledWith('test:event', { test: 'data' });
      expect(isValid).toEqual({ success: true, data: { valid: true } });
    });

    it('should handle validation errors', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockValidator = jest.fn().mockReturnValue({ success: false, error: 'Invalid data' });
      
      const isValid = result.current.validateEvent('test:event', { test: 'data' }, mockValidator);
      
      expect(isValid).toEqual({ success: false, error: 'Invalid data' });
    });

    it('should return success for events without validator', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const isValid = result.current.validateEvent('test:event', { test: 'data' });
      
      expect(isValid).toEqual({ success: true, data: { test: 'data' } });
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handlers gracefully', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const mockHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useEventHandlerBase-test] Error handling event test:event',
        expect.objectContaining({
          error: 'Handler error'
        })
      );
    });

    it('should continue processing other handlers when one fails', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler1 = jest.fn().mockImplementation(() => {
        throw new Error('Handler 1 error');
      });
      const mockHandler2 = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler1);
        result.current.registerEventListener('test:event', mockHandler2);
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockHandler1).toHaveBeenCalled();
      expect(mockHandler2).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log event registration', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[useEventHandlerBase-test] Registered event listener for test:event'
      );
    });

    it('should log event cleanup', () => {
      const { result, unmount } = renderHook(() => useEventHandlerBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      unmount();
      
      expect(logger.info).toHaveBeenCalledWith(
        '[useEventHandlerBase-test] Cleaned up 1 event listeners'
      );
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { result, unmount } = renderHook(() => useEventHandlerBase(defaultConfig));
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('test:event', expect.any(Function));
      expect(result.current.isMounted()).toBe(false);
      expect(result.current.getRegisteredEventsCount()).toBe(0);
      
      removeEventListenerSpy.mockRestore();
    });

    it('should handle cleanup when auto cleanup is disabled', () => {
      const { result, unmount } = renderHook(() => useEventHandlerBase({
        ...defaultConfig,
        enableAutoCleanup: false
      }));
      
      const mockHandler = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler);
      });
      
      expect(result.current.getRegisteredEventsCount()).toBe(1);
      
      unmount();
      
      // Should still clean up to prevent memory leaks
      expect(result.current.isMounted()).toBe(false);
      expect(result.current.getRegisteredEventsCount()).toBe(0);
    });
  });

  describe('advanced features', () => {
    it('should support conditional event handler execution', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler = jest.fn();
      const mockCondition = jest.fn().mockReturnValue(false);
      
      act(() => {
        result.current.registerEventListener('test:event', (event) => {
          if (mockCondition()) {
            mockHandler(event);
          }
        });
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockCondition).toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Change condition and test again
      mockCondition.mockReturnValue(true);
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle event propagation control', () => {
      const { result } = renderHook(() => useEventHandlerBase(defaultConfig));
      
      const mockHandler1 = jest.fn().mockImplementation((event) => {
        event.stopPropagation();
      });
      const mockHandler2 = jest.fn();
      
      act(() => {
        result.current.registerEventListener('test:event', mockHandler1);
        result.current.registerEventListener('test:event', mockHandler2);
      });
      
      const testEvent = new CustomEvent('test:event', { detail: { test: 'data' } });
      
      act(() => {
        window.dispatchEvent(testEvent);
      });
      
      expect(mockHandler1).toHaveBeenCalled();
      expect(mockHandler2).toHaveBeenCalled(); // Both should be called as they're on the same element
    });
  });
});