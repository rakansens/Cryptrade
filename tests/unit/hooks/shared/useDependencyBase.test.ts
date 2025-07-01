import { renderHook, act } from '@testing-library/react';
import { useDependencyBase } from '@/hooks/shared/useDependencyBase';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useDependencyBase', () => {
  const defaultConfig = {
    hookName: 'useDependencyBase-test',
    enableAutoCleanup: true,
    logLevel: 'info' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.getDependencyCount()).toBe(0);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-dependency',
        enableAutoCleanup: false,
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useDependencyBase(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });

    it('should handle default configuration', () => {
      const { result } = renderHook(() => useDependencyBase());
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('dependency detection', () => {
    it('should detect changes in simple dependencies', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const deps1 = ['a', 'b', 'c'];
      const deps2 = ['a', 'b', 'c'];
      const deps3 = ['a', 'b', 'd'];
      
      const hasChanged1 = result.current.detectDependencyChange('test-deps', deps1);
      expect(hasChanged1).toBe(true); // First time should always be true
      
      const hasChanged2 = result.current.detectDependencyChange('test-deps', deps2);
      expect(hasChanged2).toBe(false); // Same dependencies
      
      const hasChanged3 = result.current.detectDependencyChange('test-deps', deps3);
      expect(hasChanged3).toBe(true); // Different dependencies
    });

    it('should detect changes in object dependencies', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const deps1 = [{ a: 1, b: 2 }, { c: 3 }];
      const deps2 = [{ a: 1, b: 2 }, { c: 3 }];
      const deps3 = [{ a: 1, b: 2 }, { c: 4 }];
      
      const hasChanged1 = result.current.detectDependencyChange('object-deps', deps1);
      expect(hasChanged1).toBe(true);
      
      const hasChanged2 = result.current.detectDependencyChange('object-deps', deps2);
      expect(hasChanged2).toBe(false);
      
      const hasChanged3 = result.current.detectDependencyChange('object-deps', deps3);
      expect(hasChanged3).toBe(true);
    });

    it('should detect changes in array length', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const deps1 = ['a', 'b'];
      const deps2 = ['a', 'b', 'c'];
      
      result.current.detectDependencyChange('length-deps', deps1);
      const hasChanged = result.current.detectDependencyChange('length-deps', deps2);
      
      expect(hasChanged).toBe(true);
    });

    it('should handle multiple dependency keys', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const hasChanged1 = result.current.detectDependencyChange('key1', ['a', 'b']);
      const hasChanged2 = result.current.detectDependencyChange('key2', ['c', 'd']);
      
      expect(hasChanged1).toBe(true);
      expect(hasChanged2).toBe(true);
      expect(result.current.getDependencyCount()).toBe(2);
    });
  });

  describe('custom comparison', () => {
    it('should use custom comparison function', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const customCompare = (a: any[], b: any[]) => {
        return a.length === b.length && a.every((val, index) => val.id === b[index].id);
      };
      
      const deps1 = [{ id: 1, name: 'old' }, { id: 2, name: 'old' }];
      const deps2 = [{ id: 1, name: 'new' }, { id: 2, name: 'new' }];
      const deps3 = [{ id: 1, name: 'new' }, { id: 3, name: 'new' }];
      
      result.current.detectDependencyChange('custom-deps', deps1, customCompare);
      
      const hasChanged1 = result.current.detectDependencyChange('custom-deps', deps2, customCompare);
      expect(hasChanged1).toBe(false); // Same IDs, different names
      
      const hasChanged2 = result.current.detectDependencyChange('custom-deps', deps3, customCompare);
      expect(hasChanged2).toBe(true); // Different IDs
    });

    it('should handle custom comparison errors gracefully', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      // Mock console.error for this test since the implementation uses console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const faultyCompare = () => {
        throw new Error('Comparison failed');
      };
      
      const deps = ['a', 'b'];
      
      result.current.detectDependencyChange('faulty-deps', deps);
      const hasChanged = result.current.detectDependencyChange('faulty-deps', deps, faultyCompare);
      
      expect(hasChanged).toBe(true); // Should fallback to true on error
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useDependencyBase-test] Error in custom dependency comparison for faulty-deps',
        expect.objectContaining({
          error: 'Comparison failed'
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('dependency tracking', () => {
    it('should track dependency access patterns', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      result.current.detectDependencyChange('pattern1', ['a']);
      result.current.detectDependencyChange('pattern2', ['b']);
      result.current.detectDependencyChange('pattern1', ['a', 'b']);
      
      const accessCount = result.current.getDependencyAccessCount('pattern1');
      expect(accessCount).toBe(2);
      
      const nonExistentAccessCount = result.current.getDependencyAccessCount('non-existent');
      expect(nonExistentAccessCount).toBe(0);
    });

    it('should provide dependency statistics', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      result.current.detectDependencyChange('stats1', ['a']);
      result.current.detectDependencyChange('stats2', ['b']);
      result.current.detectDependencyChange('stats1', ['a']);
      
      const stats = result.current.getDependencyStats();
      
      expect(stats.totalKeys).toBe(2);
      expect(stats.totalAccess).toBe(3);
      expect(stats.keysWithChanges).toBe(1); // Only stats1 had a change
    });

    it('should reset dependency tracking', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      result.current.detectDependencyChange('reset1', ['a']);
      result.current.detectDependencyChange('reset2', ['b']);
      
      expect(result.current.getDependencyCount()).toBe(2);
      
      act(() => {
        result.current.resetDependencyTracking();
      });
      
      expect(result.current.getDependencyCount()).toBe(0);
      
      const stats = result.current.getDependencyStats();
      expect(stats.totalKeys).toBe(0);
      expect(stats.totalAccess).toBe(0);
    });
  });

  describe('memoization helpers', () => {
    it('should create stable references for objects', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const obj3 = { a: 1, b: 3 };
      
      const stable1 = result.current.createStableReference('stable-obj', obj1);
      const stable2 = result.current.createStableReference('stable-obj', obj2);
      const stable3 = result.current.createStableReference('stable-obj', obj3);
      
      expect(stable1).toBe(stable2); // Same content, same reference
      expect(stable2).not.toBe(stable3); // Different content, different reference
    });

    it('should create stable references for arrays', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const arr3 = [1, 2, 4];
      
      const stable1 = result.current.createStableReference('stable-arr', arr1);
      const stable2 = result.current.createStableReference('stable-arr', arr2);
      const stable3 = result.current.createStableReference('stable-arr', arr3);
      
      expect(stable1).toBe(stable2);
      expect(stable2).not.toBe(stable3);
    });

    it('should handle primitive values', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const stable1 = result.current.createStableReference('primitive', 'hello');
      const stable2 = result.current.createStableReference('primitive', 'hello');
      const stable3 = result.current.createStableReference('primitive', 'world');
      
      expect(stable1).toBe(stable2);
      expect(stable2).not.toBe(stable3);
    });
  });

  describe('performance optimization', () => {
    it('should limit cache size to prevent memory leaks', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      // Add more dependencies than the cache limit (assuming limit is around 100)
      for (let i = 0; i < 150; i++) {
        result.current.detectDependencyChange(`key-${i}`, [i]);
      }
      
      // Cache should be limited
      expect(result.current.getDependencyCount()).toBeLessThan(150);
    });

    it('should handle high-frequency dependency changes efficiently', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const startTime = performance.now();
      
      // Simulate high-frequency changes
      for (let i = 0; i < 1000; i++) {
        result.current.detectDependencyChange('high-freq', [i % 10]);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('debugging and monitoring', () => {
    it('should provide dependency keys list', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      result.current.detectDependencyChange('debug1', ['a']);
      result.current.detectDependencyChange('debug2', ['b']);
      result.current.detectDependencyChange('debug3', ['c']);
      
      const keys = result.current.getDependencyKeys();
      
      expect(keys).toContain('debug1');
      expect(keys).toContain('debug2');
      expect(keys).toContain('debug3');
      expect(keys).toHaveLength(3);
    });

    it('should provide detailed dependency info', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      result.current.detectDependencyChange('detailed', ['initial']);
      result.current.detectDependencyChange('detailed', ['changed']);
      
      const info = result.current.getDependencyInfo('detailed');
      
      expect(info).toEqual({
        key: 'detailed',
        accessCount: 2,
        lastChangeIndex: 1,
        hasChanged: true
      });
    });

    it('should handle getting info for non-existent dependencies', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const info = result.current.getDependencyInfo('non-existent');
      
      expect(info).toEqual({
        key: 'non-existent',
        accessCount: 0,
        lastChangeIndex: -1,
        hasChanged: false
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup dependencies on unmount when enabled', () => {
      const { result, unmount } = renderHook(() => useDependencyBase({
        ...defaultConfig,
        enableAutoCleanup: true
      }));
      
      result.current.detectDependencyChange('cleanup1', ['a']);
      result.current.detectDependencyChange('cleanup2', ['b']);
      
      expect(result.current.getDependencyCount()).toBe(2);
      
      unmount();
      
      expect(result.current.isMounted()).toBe(false);
      expect(result.current.getDependencyCount()).toBe(0);
    });

    it('should not cleanup dependencies on unmount when disabled', () => {
      const { result, unmount } = renderHook(() => useDependencyBase({
        ...defaultConfig,
        enableAutoCleanup: false
      }));
      
      result.current.detectDependencyChange('no-cleanup1', ['a']);
      result.current.detectDependencyChange('no-cleanup2', ['b']);
      
      expect(result.current.getDependencyCount()).toBe(2);
      
      unmount();
      
      expect(result.current.isMounted()).toBe(false);
      expect(result.current.getDependencyCount()).toBe(2);
    });
  });

  describe('logging', () => {
    it('should log dependency changes when enabled', () => {
      const { result } = renderHook(() => useDependencyBase({
        ...defaultConfig,
        logLevel: 'debug'
      }));
      
      // Mock console.log for this test since the implementation uses console.log for debug
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      result.current.detectDependencyChange('logged-deps', ['a']);
      result.current.detectDependencyChange('logged-deps', ['b']);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useDependencyBase-test] Dependency change detected for logged-deps'
      );
      
      consoleSpy.mockRestore();
    });

    it('should log dependency statistics', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      // Mock console.info for this test since the implementation uses console.info
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      
      result.current.detectDependencyChange('stats-log1', ['a']);
      result.current.detectDependencyChange('stats-log2', ['b']);
      
      result.current.logDependencyStats();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useDependencyBase-test] Dependency stats',
        expect.objectContaining({
          totalKeys: 2,
          totalAccess: 2,
          keysWithChanges: 2
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined dependencies', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const hasChanged1 = result.current.detectDependencyChange('null-deps', null as any);
      const hasChanged2 = result.current.detectDependencyChange('null-deps', null as any);
      const hasChanged3 = result.current.detectDependencyChange('undefined-deps', undefined as any);
      
      expect(hasChanged1).toBe(true);
      expect(hasChanged2).toBe(false);
      expect(hasChanged3).toBe(true);
    });

    it('should handle circular references in objects', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const circular: any = { a: 1 };
      circular.self = circular;
      
      // Should not throw error
      expect(() => {
        result.current.detectDependencyChange('circular', [circular]);
      }).not.toThrow();
    });

    it('should handle very large dependency arrays', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const largeDeps = Array.from({ length: 10000 }, (_, i) => i);
      
      const startTime = performance.now();
      result.current.detectDependencyChange('large-deps', largeDeps);
      const endTime = performance.now();
      
      // Should handle large arrays efficiently (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle empty dependency arrays', () => {
      const { result } = renderHook(() => useDependencyBase(defaultConfig));
      
      const hasChanged1 = result.current.detectDependencyChange('empty-deps', []);
      const hasChanged2 = result.current.detectDependencyChange('empty-deps', []);
      
      expect(hasChanged1).toBe(true);
      expect(hasChanged2).toBe(false);
    });
  });
});