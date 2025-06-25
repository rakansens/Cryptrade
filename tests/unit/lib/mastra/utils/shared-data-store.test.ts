// Ensure the actual SharedDataStore is used, not a mock
jest.unmock('@/lib/mastra/utils/shared-data-store');

import { SharedDataStore, sharedData, StoredData } from '@/lib/mastra/utils/shared-data-store';
import { logger } from '@/lib/utils/logger';
import { isDevelopment } from '@/config/env';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => false)
}));

describe('SharedDataStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    SharedDataStore.destroy();
  });

  afterEach(() => {
    jest.useRealTimers();
    SharedDataStore.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SharedDataStore.getInstance();
      const instance2 = SharedDataStore.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should start cleanup interval', () => {
      const instance = SharedDataStore.getInstance();
      // Verify instance is created (cleanup interval is started in constructor)
      expect(instance).toBeDefined();
      
      // Test that cleanup actually works by setting expired data
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      SharedDataStore.set('test', 'key', 'value', { ttl: 1000 });
      
      // Move time forward and trigger cleanup
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      jest.advanceTimersByTime(30000);
      
      expect(SharedDataStore.get('test', 'key')).toBeNull();
    });
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      const result = SharedDataStore.get('namespace1', 'key1');
      
      expect(result).toBe('value1');
    });

    it('should store data with type safety', () => {
      interface TestData {
        id: number;
        name: string;
      }

      const data: TestData = { id: 1, name: 'test' };
      SharedDataStore.set<TestData>('namespace1', 'key1', data);
      
      const result = SharedDataStore.get<TestData>('namespace1', 'key1');
      
      expect(result).toEqual(data);
    });

    it('should store data with TTL', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      
      // Before expiry
      expect(SharedDataStore.get('namespace1', 'key1')).toBe('value1');
      
      // After expiry
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
    });

    it('should store data with metadata', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1', {
        metadata: { source: 'test', priority: 1 }
      });
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBe('value1');
    });

    it('should return null for non-existent namespace', () => {
      const result = SharedDataStore.get('nonexistent', 'key1');
      
      expect(result).toBeNull();
    });

    it('should return null for non-existent key', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      const result = SharedDataStore.get('namespace1', 'nonexistent');
      
      expect(result).toBeNull();
    });

    it('should log data storage', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 5000 });
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[SharedDataStore] Data stored',
        {
          namespace: 'namespace1',
          key: 'key1',
          ttl: 5000,
          hasMetadata: false
        }
      );
    });
  });

  describe('has', () => {
    it('should return true for existing data', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      expect(SharedDataStore.has('namespace1', 'key1')).toBe(true);
    });

    it('should return false for non-existent namespace', () => {
      expect(SharedDataStore.has('nonexistent', 'key1')).toBe(false);
    });

    it('should return false for non-existent key', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      expect(SharedDataStore.has('namespace1', 'nonexistent')).toBe(false);
    });

    it('should return false for expired data', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      
      expect(SharedDataStore.has('namespace1', 'key1')).toBe(false);
    });

    it('should delete expired data on check', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      
      SharedDataStore.has('namespace1', 'key1');
      
      // Should be deleted after expiry check
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing data', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      const result = SharedDataStore.delete('namespace1', 'key1');
      
      expect(result).toBe(true);
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
    });

    it('should return false for non-existent namespace', () => {
      const result = SharedDataStore.delete('nonexistent', 'key1');
      
      expect(result).toBe(false);
    });

    it('should return false for non-existent key', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      const result = SharedDataStore.delete('namespace1', 'nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('clearNamespace', () => {
    it('should clear all data in namespace', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace1', 'key2', 'value2');
      SharedDataStore.set('namespace2', 'key1', 'value3');
      
      SharedDataStore.clearNamespace('namespace1');
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
      expect(SharedDataStore.get('namespace1', 'key2')).toBeNull();
      expect(SharedDataStore.get('namespace2', 'key1')).toBe('value3');
    });

    it('should log namespace clearing', () => {
      SharedDataStore.clearNamespace('namespace1');
      
      expect(logger.info).toHaveBeenCalledWith(
        '[SharedDataStore] Namespace cleared',
        { namespace: 'namespace1' }
      );
    });
  });

  describe('clearAll', () => {
    it('should clear all data', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace2', 'key1', 'value2');
      
      SharedDataStore.clearAll();
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
      expect(SharedDataStore.get('namespace2', 'key1')).toBeNull();
    });

    it('should log clearing all data', () => {
      SharedDataStore.clearAll();
      
      expect(logger.info).toHaveBeenCalledWith('[SharedDataStore] All data cleared');
    });
  });

  describe('getKeys', () => {
    it('should return all keys in namespace', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace1', 'key2', 'value2');
      SharedDataStore.set('namespace1', 'key3', 'value3');
      
      const keys = SharedDataStore.getKeys('namespace1');
      
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should throw error for non-existent namespace in production', () => {
      jest.mocked(isDevelopment).mockReturnValue(false);
      
      expect(() => SharedDataStore.getKeys('nonexistent')).toThrow(
        "Namespace 'nonexistent' does not exist in SharedDataStore"
      );
    });

    it('should return empty array for non-existent namespace in development', () => {
      jest.mocked(isDevelopment).mockReturnValue(true);
      
      const keys = SharedDataStore.getKeys('nonexistent');
      
      expect(keys).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        "[SharedDataStore] Namespace 'nonexistent' not found"
      );
    });
  });

  describe('getAll', () => {
    it('should return all data in namespace', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace1', 'key2', 'value2');
      SharedDataStore.set('namespace2', 'key1', 'value3');
      
      const data = SharedDataStore.getAll('namespace1');
      
      expect(data).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should exclude expired data', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      SharedDataStore.set('namespace1', 'key2', 'value2');
      
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      
      const data = SharedDataStore.getAll('namespace1');
      
      expect(data).toEqual({
        key2: 'value2'
      });
    });

    it('should return empty object for non-existent namespace', () => {
      const data = SharedDataStore.getAll('nonexistent');
      
      expect(data).toEqual({});
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace1', 'key2', 'value2');
      SharedDataStore.set('namespace2', 'key1', 'value3');
      
      const stats = SharedDataStore.getStats();
      
      expect(stats).toEqual({
        namespaces: 2,
        totalKeys: 3,
        namespaceDetails: {
          namespace1: 2,
          namespace2: 1
        }
      });
    });

    it('should return empty stats for empty store', () => {
      const stats = SharedDataStore.getStats();
      
      expect(stats).toEqual({
        namespaces: 0,
        totalKeys: 0,
        namespaceDetails: {}
      });
    });
  });

  describe('cleanup', () => {
    it('should automatically clean expired data', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      SharedDataStore.set('namespace1', 'key2', 'value2');
      
      // Advance time past TTL
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      
      // Trigger cleanup interval
      jest.advanceTimersByTime(30000);
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
      expect(SharedDataStore.get('namespace1', 'key2')).toBe('value2');
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[SharedDataStore] Cleanup completed',
        { cleanedCount: 1 }
      );
    });

    it('should remove empty namespaces during cleanup', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1000 });
      
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1001);
      jest.advanceTimersByTime(30000);
      
      const stats = SharedDataStore.getStats();
      expect(stats.namespaces).toBe(0);
    });

    it('should not log if no data cleaned', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      jest.clearAllMocks();
      jest.advanceTimersByTime(30000);
      
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear interval and data', () => {
      SharedDataStore.set('namespace1', 'key1', 'value1');
      
      SharedDataStore.destroy();
      
      // After destroy, getting data should return null
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
    });

    it('should handle multiple destroy calls', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      SharedDataStore.getInstance();
      
      SharedDataStore.destroy();
      SharedDataStore.destroy(); // Should not throw
      
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      clearIntervalSpy.mockRestore();
    });
  });

  describe('convenience functions', () => {
    it('should expose all methods through sharedData', () => {
      expect(sharedData.set).toBe(SharedDataStore.set);
      expect(sharedData.get).toBe(SharedDataStore.get);
      expect(sharedData.has).toBe(SharedDataStore.has);
      expect(sharedData.delete).toBe(SharedDataStore.delete);
      expect(sharedData.clearNamespace).toBe(SharedDataStore.clearNamespace);
      expect(sharedData.clearAll).toBe(SharedDataStore.clearAll);
      expect(sharedData.getKeys).toBe(SharedDataStore.getKeys);
      expect(sharedData.getAll).toBe(SharedDataStore.getAll);
      expect(sharedData.getStats).toBe(SharedDataStore.getStats);
    });

    it('should work with convenience functions', () => {
      sharedData.set('namespace1', 'key1', 'value1');
      
      expect(sharedData.get('namespace1', 'key1')).toBe('value1');
      expect(sharedData.has('namespace1', 'key1')).toBe(true);
      
      sharedData.delete('namespace1', 'key1');
      
      expect(sharedData.has('namespace1', 'key1')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      SharedDataStore.set('namespace1', 'key1', undefined);
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBeUndefined();
      expect(SharedDataStore.has('namespace1', 'key1')).toBe(true);
    });

    it('should handle null values', () => {
      SharedDataStore.set('namespace1', 'key1', null);
      
      // null値が保存されていることを確認
      const storedValue = SharedDataStore.get('namespace1', 'key1');
      expect(storedValue).toBeNull();
      expect(SharedDataStore.has('namespace1', 'key1')).toBe(true);
      
      // 存在しない値とは区別される
      expect(SharedDataStore.get('namespace1', 'nonexistent')).toBeNull();
      expect(SharedDataStore.has('namespace1', 'nonexistent')).toBe(false);
    });

    it('should handle complex objects', () => {
      const complexData = {
        nested: {
          array: [1, 2, { deep: 'value' }],
          map: new Map([['key', 'value']]),
          date: new Date()
        }
      };
      
      SharedDataStore.set('namespace1', 'key1', complexData);
      
      const retrieved = SharedDataStore.get('namespace1', 'key1');
      expect(retrieved).toEqual(complexData);
    });

    it('should handle very short TTLs', () => {
      const mockNow = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      SharedDataStore.set('namespace1', 'key1', 'value1', { ttl: 1 });
      
      // Move time forward by 2ms to ensure TTL has expired
      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 2);
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBeNull();
    });

    it('should handle concurrent operations', () => {
      // Simulate concurrent sets
      SharedDataStore.set('namespace1', 'key1', 'value1');
      SharedDataStore.set('namespace1', 'key1', 'value2');
      SharedDataStore.set('namespace1', 'key1', 'value3');
      
      expect(SharedDataStore.get('namespace1', 'key1')).toBe('value3');
    });
  });
});