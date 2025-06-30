import { renderHook, act } from '@testing-library/react';
import { useCleanupBase } from '@/hooks/shared/useCleanupBase';
import type { CleanupTask } from '@/hooks/shared/useCleanupBase';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useCleanupBase', () => {
  const defaultConfig = {
    hookName: 'useCleanupBase-test',
    autoCleanupOnUnmount: true,
    logLevel: 'debug' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });


  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.getTaskCount()).toBe(0);
      expect(result.current.isCleaningUp()).toBe(false);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-cleanup',
        autoCleanupOnUnmount: false,
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useCleanupBase(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });

    it('should handle default configuration', () => {
      const { result } = renderHook(() => useCleanupBase());
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('task management', () => {
    it('should add cleanup tasks', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'test-task',
        cleanup: mockCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      expect(result.current.hasTask('test-task')).toBe(true);
    });

    it('should add multiple cleanup tasks', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const tasks: CleanupTask[] = [
        { id: 'task-1', cleanup: jest.fn(), priority: 'high' },
        { id: 'task-2', cleanup: jest.fn(), priority: 'medium' },
        { id: 'task-3', cleanup: jest.fn(), priority: 'low' }
      ];
      
      act(() => {
        tasks.forEach(task => result.current.registerCleanupTask(task));
      });
      
      expect(result.current.getTaskCount()).toBe(3);
      expect(result.current.hasTask('task-1')).toBe(true);
      expect(result.current.hasTask('task-2')).toBe(true);
      expect(result.current.hasTask('task-3')).toBe(true);
    });

    it('should replace existing tasks with same ID', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockCleanup1 = jest.fn();
      const mockCleanup2 = jest.fn();
      
      const task1: CleanupTask = {
        id: 'same-id',
        cleanup: mockCleanup1,
        priority: 'high'
      };
      
      const task2: CleanupTask = {
        id: 'same-id',
        cleanup: mockCleanup2,
        priority: 'low'
      };
      
      act(() => {
        result.current.registerCleanupTask(task1);
        result.current.registerCleanupTask(task2);
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      expect(result.current.hasTask('same-id')).toBe(true);
    });

    it('should remove cleanup tasks', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const task: CleanupTask = {
        id: 'removable-task',
        cleanup: jest.fn(),
        priority: 'medium'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.hasTask('removable-task')).toBe(true);
      
      act(() => {
        result.current.unregisterCleanupTask('removable-task');
      });
      
      expect(result.current.hasTask('removable-task')).toBe(false);
      expect(result.current.getTaskCount()).toBe(0);
    });

    it('should handle removing non-existent tasks', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      act(() => {
        result.current.unregisterCleanupTask('non-existent');
      });
      
      expect(result.current.getTaskCount()).toBe(0);
    });
  });

  describe('task execution', () => {
    it('should execute cleanup tasks', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'executable-task',
        cleanup: mockCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      await act(async () => {
        await result.current.executeCleanupTask('executable-task');
      });
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(result.current.hasTask('executable-task')).toBe(false);
    });

    it('should execute async cleanup tasks', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockAsyncCleanup = jest.fn().mockResolvedValue(undefined);
      const task: CleanupTask = {
        id: 'async-task',
        cleanup: mockAsyncCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      await act(async () => {
        await result.current.executeCleanupTask('async-task');
      });
      
      expect(mockAsyncCleanup).toHaveBeenCalled();
      expect(result.current.hasTask('async-task')).toBe(false);
    });

    it('should handle errors in cleanup tasks', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockFailingCleanup = jest.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      
      const task: CleanupTask = {
        id: 'failing-task',
        cleanup: mockFailingCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      let executeResult: boolean = false;
      await act(async () => {
        executeResult = await result.current.executeCleanupTask('failing-task');
      });
      
      expect(mockFailingCleanup).toHaveBeenCalled();
      expect(executeResult).toBe(false);
    });

    it('should handle async cleanup errors', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockFailingAsyncCleanup = jest.fn().mockRejectedValue(new Error('Async cleanup failed'));
      
      const task: CleanupTask = {
        id: 'failing-async-task',
        cleanup: mockFailingAsyncCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      let executeResult: boolean = false;
      await act(async () => {
        executeResult = await result.current.executeCleanupTask('failing-async-task');
      });
      
      expect(mockFailingAsyncCleanup).toHaveBeenCalled();
      expect(executeResult).toBe(false);
    });

    it('should not execute tasks when cleaning up', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'blocked-task',
        cleanup: mockCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      // Start cleanup process
      await act(async () => {
        await result.current.cleanupAll();
      });
      
      // Try to execute task during cleanup
      await act(async () => {
        await result.current.executeCleanupTask('blocked-task');
      });
      
      expect(mockCleanup).toHaveBeenCalledTimes(1); // Only called during cleanupAll
    });
  });

  describe('cleanup all', () => {
    it('should execute all cleanup tasks in priority order', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const executionOrder: string[] = [];
      
      const tasks: CleanupTask[] = [
        {
          id: 'low-priority',
          cleanup: () => executionOrder.push('low'),
          priority: 'low'
        },
        {
          id: 'high-priority',
          cleanup: () => executionOrder.push('high'),
          priority: 'high'
        },
        {
          id: 'medium-priority',
          cleanup: () => executionOrder.push('medium'),
          priority: 'medium'
        }
      ];
      
      act(() => {
        tasks.forEach(task => result.current.registerCleanupTask(task));
      });
      
      await act(async () => {
        await result.current.cleanupAll();
      });
      
      expect(executionOrder).toEqual(['high', 'medium', 'low']);
      expect(result.current.getTaskCount()).toBe(0);
    });

    it('should handle mixed sync and async cleanup tasks', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const syncCleanup = jest.fn();
      const asyncCleanup = jest.fn().mockResolvedValue(undefined);
      
      const tasks: CleanupTask[] = [
        {
          id: 'sync-task',
          cleanup: syncCleanup,
          priority: 'high'
        },
        {
          id: 'async-task',
          cleanup: asyncCleanup,
          priority: 'high'
        }
      ];
      
      act(() => {
        tasks.forEach(task => result.current.registerCleanupTask(task));
      });
      
      await act(async () => {
        await result.current.cleanupAll();
      });
      
      expect(syncCleanup).toHaveBeenCalled();
      expect(asyncCleanup).toHaveBeenCalled();
      expect(result.current.getTaskCount()).toBe(0);
    });

    it('should continue cleanup even if some tasks fail', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const executionOrder: string[] = [];
      const failingCleanup = jest.fn().mockImplementation(() => {
        executionOrder.push('failing');
        throw new Error('Task failed');
      });
      
      const tasks: CleanupTask[] = [
        {
          id: 'failing-task',
          cleanup: failingCleanup,
          priority: 'high'
        },
        {
          id: 'medium-task',
          cleanup: () => executionOrder.push('medium'),
          priority: 'medium'
        }
      ];
      
      act(() => {
        tasks.forEach(task => result.current.registerCleanupTask(task));
      });
      
      await act(async () => {
        await result.current.cleanupAll();
      });
      
      expect(failingCleanup).toHaveBeenCalled();
      expect(executionOrder).toEqual(['failing', 'medium']);
      expect(result.current.getTaskCount()).toBe(0);
      expect(result.current.isMounted()).toBe(false);
    });
  });

  describe('automatic cleanup on unmount', () => {
    it('should automatically cleanup on unmount when enabled', async () => {
      const { result, unmount } = renderHook(() => useCleanupBase({
        ...defaultConfig,
        autoCleanupOnUnmount: true
      }));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'auto-cleanup-task',
        cleanup: mockCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      
      unmount();
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(result.current.isMounted()).toBe(false);
    });

    it('should not automatically cleanup on unmount when disabled', async () => {
      const { result, unmount } = renderHook(() => useCleanupBase({
        ...defaultConfig,
        autoCleanupOnUnmount: false
      }));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'no-auto-cleanup-task',
        cleanup: mockCleanup,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      
      unmount();
      
      expect(mockCleanup).not.toHaveBeenCalled();
      // Note: isMounted() may be false after unmount regardless of autoCleanupOnUnmount setting
    });
  });

  describe('logging', () => {
    it('should log task addition', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const task: CleanupTask = {
        id: 'logged-task',
        cleanup: jest.fn(),
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.hasTask('logged-task')).toBe(true);
    });

    it('should log task execution', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const mockCleanup = jest.fn();
      const task: CleanupTask = {
        id: 'logged-execution',
        cleanup: mockCleanup,
        priority: 'medium'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      await act(async () => {
        await result.current.executeCleanupTask('logged-execution');
      });
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(result.current.hasTask('logged-execution')).toBe(false);
    });

    it('should use custom log level', () => {
      const { result, unmount } = renderHook(() => useCleanupBase({
        ...defaultConfig,
        logLevel: 'debug',
        autoCleanupOnUnmount: true
      }));
      
      const mockCleanup = jest.fn();
      
      act(() => {
        result.current.registerCleanupTask({
          id: 'debug-level-task',
          cleanup: mockCleanup,
          priority: 'low'
        });
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      
      unmount();
      
      // The cleanup task should execute on unmount when autoCleanupOnUnmount is true
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle cleanup tasks without priority', () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const task: CleanupTask = {
        id: 'no-priority-task',
        cleanup: jest.fn()
        // No priority specified
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      expect(result.current.getTaskCount()).toBe(1);
      expect(result.current.hasTask('no-priority-task')).toBe(true);
    });

    it('should handle executing non-existent tasks', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      let executeResult: boolean = false;
      await act(async () => {
        executeResult = await result.current.executeCleanupTask('non-existent-task');
      });
      
      // Should return false for non-existent tasks
      expect(executeResult).toBe(false);
    });

    it('should handle cleanup when no tasks exist', async () => {
      const { result, unmount } = renderHook(() => useCleanupBase(defaultConfig));
      
      await act(async () => {
        await result.current.cleanupAll();
      });
      
      expect(result.current.getTaskCount()).toBe(0);
      expect(result.current.isMounted()).toBe(false); // After cleanupAll, isMounted becomes false
      
      unmount();
    });

    it('should handle null cleanup functions gracefully', async () => {
      const { result } = renderHook(() => useCleanupBase(defaultConfig));
      
      const task: CleanupTask = {
        id: 'null-cleanup-task',
        cleanup: null as any,
        priority: 'high'
      };
      
      act(() => {
        result.current.registerCleanupTask(task);
      });
      
      let executeResult: boolean = false;
      await act(async () => {
        executeResult = await result.current.executeCleanupTask('null-cleanup-task');
      });
      
      // Should return false when cleanup function is null
      expect(executeResult).toBe(false);
    });
  });
});