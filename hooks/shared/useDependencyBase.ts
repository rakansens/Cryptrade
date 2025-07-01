/**
 * 複雑な依存配列管理の基盤
 * useChartInstance ↔ useWebSocket ↔ useStreamBase の依存配列重複（Score 265.6+）を解消
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';

export interface DependencyBaseConfig {
  hookName?: string;
  enableAutoCleanup?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface DependencyEntry {
  dependencies: any[];
  accessCount: number;
  lastChangeIndex: number;
  hasChanged: boolean;
}

interface DependencyStats {
  totalKeys: number;
  totalAccess: number;
  keysWithChanges: number;
}

/**
 * 複雑な依存配列を管理するフック
 * 長い依存配列パターンの重複を解消し、統一された管理を提供
 */
export function useDependencyBase(config: DependencyBaseConfig = {}) {
  const { 
    hookName = 'useDependencyBase', 
    enableAutoCleanup = true,
    logLevel = 'info' 
  } = config;

  const dependencyCache = useRef<Map<string, DependencyEntry>>(new Map());
  const stableReferenceCache = useRef<Map<string, any>>(new Map());
  const isMountedRef = useRef(true);
  const cacheLimit = 100; // Prevent memory leaks

  // Safe logging function
  const safeLog = useCallback((level: string, message: string, data?: any) => {
    const shouldLog = 
      (level === 'error') ||
      (level === 'warn' && ['debug', 'info', 'warn', 'error'].includes(logLevel)) ||
      (level === 'info' && ['debug', 'info'].includes(logLevel)) ||
      (level === 'debug' && logLevel === 'debug');

    if (shouldLog && typeof console !== 'undefined') {
      switch (level) {
        case 'error':
          if (console.error) console.error(`[${hookName}] ${message}`, data || '');
          break;
        case 'warn':
          if (console.warn) console.warn(`[${hookName}] ${message}`, data || '');
          break;
        case 'info':
          if (console.info) console.info(`[${hookName}] ${message}`, data || '');
          break;
        case 'debug':
          if (console.log) console.log(`[${hookName}] ${message}`, data || '');
          break;
      }
    }
  }, [hookName, logLevel]);

  // Deep equality comparison
  const isDeepEqual = useCallback((a: any, b: any): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => isDeepEqual(item, b[index]));
      } else {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => isDeepEqual(a[key], b[key]));
      }
    }
    
    return false;
  }, []);

  // Default comparison function
  const defaultCompare = useCallback((prev: any[], current: any[]): boolean => {
    if (prev.length !== current.length) return false;
    return prev.every((item, index) => isDeepEqual(item, current[index]));
  }, [isDeepEqual]);

  // Detect dependency changes
  const detectDependencyChange = useCallback((
    key: string,
    dependencies: any[],
    customCompare?: (prev: any[], current: any[]) => boolean
  ): boolean => {
    try {
      // Handle null/undefined dependencies
      const safeDependencies = dependencies == null ? [] : Array.isArray(dependencies) ? dependencies : [dependencies];
      
      const cache = dependencyCache.current;
      const entry = cache.get(key);
      
      if (!entry) {
        cache.set(key, {
          dependencies: [...safeDependencies],
          accessCount: 1,
          lastChangeIndex: 0,
          hasChanged: true
        });
        
        // Limit cache size
        if (cache.size > cacheLimit) {
          const firstKey = cache.keys().next().value;
          if (firstKey) {
            cache.delete(firstKey);
          }
        }
        
        safeLog('debug', `Dependency change detected for ${key}`);
        return true;
      }

      entry.accessCount++;
      
      const compare = customCompare || defaultCompare;
      const areEqual = compare(entry.dependencies, safeDependencies);
      
      if (!areEqual) {
        entry.dependencies = [...safeDependencies];
        entry.lastChangeIndex = entry.accessCount - 1;
        entry.hasChanged = true;
        safeLog('debug', `Dependency change detected for ${key}`);
        return true;
      }
      
      return false;
    } catch (error) {
      safeLog('error', `Error in custom dependency comparison for ${key}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return true; // Fallback to true on error
    }
  }, [defaultCompare, safeLog]);

  // Create stable reference
  const createStableReference = useCallback((key: string, value: any): any => {
    const cache = stableReferenceCache.current;
    const cached = cache.get(key);
    
    if (cached !== undefined && isDeepEqual(cached, value)) {
      return cached;
    }
    
    cache.set(key, value);
    
    // Limit cache size
    if (cache.size > cacheLimit) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    return value;
  }, [isDeepEqual]);

  // Get dependency count
  const getDependencyCount = useCallback((): number => {
    return dependencyCache.current.size;
  }, []);

  // Get dependency access count
  const getDependencyAccessCount = useCallback((key: string): number => {
    const entry = dependencyCache.current.get(key);
    return entry ? entry.accessCount : 0;
  }, []);

  // Get dependency statistics
  const getDependencyStats = useCallback((): DependencyStats => {
    const cache = dependencyCache.current;
    const stats = {
      totalKeys: cache.size,
      totalAccess: 0,
      keysWithChanges: 0
    };
    
    for (const entry of cache.values()) {
      stats.totalAccess += entry.accessCount;
      if (entry.lastChangeIndex >= 0) {
        stats.keysWithChanges++;
      }
    }
    
    return stats;
  }, []);

  // Get dependency keys
  const getDependencyKeys = useCallback((): string[] => {
    return Array.from(dependencyCache.current.keys());
  }, []);

  // Get dependency info
  const getDependencyInfo = useCallback((key: string) => {
    const entry = dependencyCache.current.get(key);
    
    if (!entry) {
      return {
        key,
        accessCount: 0,
        lastChangeIndex: -1,
        hasChanged: false
      };
    }
    
    return {
      key,
      accessCount: entry.accessCount,
      lastChangeIndex: entry.lastChangeIndex,
      hasChanged: entry.hasChanged
    };
  }, []);

  // Reset dependency tracking
  const resetDependencyTracking = useCallback(() => {
    dependencyCache.current.clear();
    stableReferenceCache.current.clear();
  }, []);

  // Log dependency stats
  const logDependencyStats = useCallback(() => {
    const stats = getDependencyStats();
    safeLog('info', 'Dependency stats', stats);
  }, [getDependencyStats, safeLog]);

  // Check if mounted
  const isMounted = useCallback((): boolean => {
    return isMountedRef.current;
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (enableAutoCleanup) {
        dependencyCache.current.clear();
        stableReferenceCache.current.clear();
      }
    };
  }, [enableAutoCleanup]);

  return {
    // Core functionality
    detectDependencyChange,
    createStableReference,
    
    // Statistics and monitoring
    getDependencyCount,
    getDependencyAccessCount,
    getDependencyStats,
    getDependencyKeys,
    getDependencyInfo,
    
    // Utilities
    resetDependencyTracking,
    logDependencyStats,
    isMounted,
    
    // Configuration
    hookName,
    logLevel
  };
}

export type DependencyBase = ReturnType<typeof useDependencyBase>;