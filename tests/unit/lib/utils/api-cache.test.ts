import { ApiCache, createKey } from '@/lib/utils/api-cache';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ApiCache', () => {
  let cache: ApiCache;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    cache = ApiCache.getInstance();
    cache.clear();
    
    // Mock localStorage for browser environment tests
    originalLocalStorage = global.localStorage;
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
      store: {} as Record<string, string>,
    };
    
    // Override setItem to simulate quota exceeded
    localStorageMock.setItem = jest.fn((key, value) => {
      if (Object.keys(localStorageMock.store).length > 100 && value.length > 1000) {
        throw new Error('QuotaExceededError');
      }
      localStorageMock.store[key] = value;
    });
    
    localStorageMock.getItem = jest.fn((key) => localStorageMock.store[key] || null);
    localStorageMock.removeItem = jest.fn((key) => {
      delete localStorageMock.store[key];
    });
    localStorageMock.clear = jest.fn(() => {
      localStorageMock.store = {};
    });
    
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ApiCache.getInstance();
      const instance2 = ApiCache.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('get/set operations', () => {
    it('should store and retrieve data from memory cache', () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      cache.set(key, data);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      const key = 'ttl-test';
      const data = { value: 'test' };
      const ttl = 100; // 100ms
      
      cache.set(key, data, { ttl });
      expect(cache.get(key, { ttl })).toEqual(data);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get(key, { ttl })).toBeNull();
    });

    it('should handle memory cache size limits', () => {
      // Fill cache to max capacity
      for (let i = 0; i < 105; i++) {
        cache.set(`key-${i}`, { value: i });
      }
      
      // Oldest items should be evicted
      expect(cache.get('key-0')).toBeNull();
      expect(cache.get('key-104')).toEqual({ value: 104 });
    });
  });

  describe('localStorage integration', () => {
    it('should save to localStorage when enabled', () => {
      const key = 'localStorage-test';
      const data = { value: 'test' };
      
      cache.set(key, data, { useLocalStorage: true });
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining(key),
        expect.stringContaining('test')
      );
    });

    it('should retrieve from localStorage when memory cache misses', () => {
      const key = 'localStorage-get-test';
      const data = { value: 'from-storage' };
      const cacheItem = {
        data,
        timestamp: Date.now(),
        key,
      };
      
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify(cacheItem));
      
      const result = cache.get(key, { useLocalStorage: true });
      expect(result).toEqual(data);
    });

    it('should handle localStorage errors gracefully', () => {
      const key = 'error-test';
      const data = { value: 'test' };
      
      (global.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      // Should not throw
      expect(() => cache.set(key, data, { useLocalStorage: true })).not.toThrow();
    });

    it('should cleanup localStorage when quota exceeded', () => {
      const key = 'quota-test';
      
      // Fill localStorage to trigger quota exceeded
      const mockStorage = (global.localStorage as any);
      for (let i = 0; i < 101; i++) {
        mockStorage.store[`api_cache_old${i}`] = JSON.stringify({ data: 'x'.repeat(100), timestamp: Date.now() - 1000000 });
      }
      
      // Override Object.keys for localStorage cleanup simulation
      const originalObjectKeys = Object.keys;
      Object.keys = jest.fn((obj) => {
        if (obj === mockStorage || obj === mockStorage.store) {
          return originalObjectKeys(mockStorage.store);
        }
        return originalObjectKeys(obj);
      });
      
      // This should trigger quota exceeded and cleanup
      cache.set(key, { value: 'x'.repeat(2000) }, { useLocalStorage: true });
      
      // Check that some old items were removed
      const remainingKeys = originalObjectKeys(mockStorage.store).filter(k => k.startsWith('api_cache_old'));
      // Should have cleaned up some items (quota exceeded triggered cleanup)
      expect(remainingKeys.length).toBeLessThanOrEqual(51);
      
      // Restore Object.keys
      Object.keys = originalObjectKeys;
    });
  });

  describe('delete operation', () => {
    it('should delete from memory cache', () => {
      const key = 'delete-test';
      cache.set(key, { value: 'test' });
      
      cache.delete(key);
      expect(cache.get(key)).toBeNull();
    });

    it('should delete from localStorage when enabled', () => {
      const key = 'delete-localStorage';
      
      cache.delete(key, { useLocalStorage: true });
      
      expect(global.localStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining(key)
      );
    });
  });

  describe('clear operation', () => {
    it('should clear all memory cache entries', () => {
      cache.set('key1', { value: 1 });
      cache.set('key2', { value: 2 });
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should clear localStorage entries with prefix', () => {
      // Setup localStorage with test items
      const mockStorage = (global.localStorage as any);
      mockStorage.store['api_cache_key1'] = 'value1';
      mockStorage.store['api_cache_key2'] = 'value2';
      mockStorage.store['other_key'] = 'value3';
      
      // Override Object.keys for localStorage cleanup simulation
      const originalObjectKeys = Object.keys;
      Object.keys = jest.fn((obj) => {
        if (obj === mockStorage || obj === mockStorage.store) {
          return originalObjectKeys(mockStorage.store);
        }
        return originalObjectKeys(obj);
      });
      
      // Override removeItem to actually remove from store
      const originalRemoveItem = mockStorage.removeItem;
      mockStorage.removeItem = jest.fn((key) => {
        delete mockStorage.store[key];
        originalRemoveItem(key);
      });
      
      cache.clear();
      
      // Check that only api_cache_ prefixed keys were removed
      expect(mockStorage.store['api_cache_key1']).toBeUndefined();
      expect(mockStorage.store['api_cache_key2']).toBeUndefined();
      expect(mockStorage.store['other_key']).toEqual('value3');
      
      // Restore methods
      Object.keys = originalObjectKeys;
      mockStorage.removeItem = originalRemoveItem;
    });
  });

  describe('createKey helper', () => {
    it('should create consistent keys from parameters', () => {
      const params1 = { symbol: 'BTC', interval: '1h' };
      const params2 = { interval: '1h', symbol: 'BTC' }; // Different order
      
      const key1 = createKey('market', params1);
      const key2 = createKey('market', params2);
      
      expect(key1).toEqual(key2); // Should be the same despite order
    });

    it('should handle empty parameters', () => {
      const key = createKey('test', {});
      expect(key).toEqual('test_');
    });

    it('should handle complex parameter values', () => {
      const params = {
        array: [1, 2, 3],
        object: { nested: 'value' },
        number: 123,
        boolean: true,
      };
      
      const key = createKey('complex', params);
      expect(key).toMatch(/array.*1,2,3/);
      expect(key).toMatch(/boolean.*true/);
      expect(key).toMatch(/number.*123/);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined window object', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      const key = 'no-window-test';
      const data = { value: 'test' };
      
      // Should work without window
      cache.set(key, data, { useLocalStorage: true });
      expect(cache.get(key)).toEqual(data);
      
      (global as any).window = originalWindow;
    });

    it('should handle invalid JSON in localStorage', () => {
      const key = 'invalid-json';
      
      (global.localStorage.getItem as any).mockReturnValue('invalid json');
      
      const result = cache.get(key, { useLocalStorage: true });
      expect(result).toBeNull();
    });

    it('should handle expired items in localStorage', () => {
      const key = 'expired-item';
      const cacheItem = {
        data: { value: 'old' },
        timestamp: Date.now() - 1000000, // Very old
        key,
      };
      
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify(cacheItem));
      
      const result = cache.get(key, { useLocalStorage: true, ttl: 1000 });
      expect(result).toBeNull();
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent set operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => cache.set(`concurrent-${i}`, { value: i }))
        );
      }
      
      await Promise.all(promises);
      
      for (let i = 0; i < 10; i++) {
        expect(cache.get(`concurrent-${i}`)).toEqual({ value: i });
      }
    });
  });
});

export {};