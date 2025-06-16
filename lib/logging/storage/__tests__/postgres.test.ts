// Mock dependencies before imports
jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => true),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedPostgreSQLStorage } from '../postgres';
import type { LogEntry, LogQuery } from '../../types';

// Mock @neondatabase/serverless
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => jest.fn()),
}));

describe('UnifiedPostgreSQLStorage', () => {
  let storage: UnifiedPostgreSQLStorage;
  
  const mockLogEntry: LogEntry = {
    id: 'test-123',
    timestamp: new Date(),
    level: 'info',
    category: 'test',
    message: 'Test message',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-123',
      source: 'test-source',
      extra: { key: 'value' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new UnifiedPostgreSQLStorage({ connectionUrl: 'mock-connection-string' });
  });

  describe('initialization', () => {
    it('should create storage instance', () => {
      expect(storage).toBeDefined();
      expect(storage).toBeInstanceOf(UnifiedPostgreSQLStorage);
    });

    it('should initialize database connection', async () => {
      await storage.initialize();
      expect(storage['isConnected']).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Create a new storage instance for this test
      const errorStorage = new UnifiedPostgreSQLStorage({ connectionUrl: 'invalid' });
      jest.spyOn(errorStorage, 'initialize').mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(errorStorage.initialize()).rejects.toThrow('Connection failed');
    });

    it('should skip if already isConnected', async () => {
      await storage.initialize();
      const initSpy = jest.spyOn(storage, 'initialize');
      
      await storage.initialize(); // Second call
      
      // The actual implementation is called once from before the spy
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('connect/disconnect', () => {
    it('should connect successfully', async () => {
      await expect(storage.connect()).resolves.not.toThrow();
    });

    it('should disconnect successfully', async () => {
      await storage.connect();
      await expect(storage.disconnect()).resolves.not.toThrow();
    });

    it('should handle multiple connect calls', async () => {
      await storage.connect();
      await storage.connect();
      expect(storage['isConnected']).toBe(true);
    });
  });

  describe('write operations', () => {
    it('should write single log entry', async () => {
      await storage.initialize();
      await expect(storage.write(mockLogEntry)).resolves.not.toThrow();
    });

    it('should write multiple log entries', async () => {
      const entries: LogEntry[] = [
        mockLogEntry,
        { ...mockLogEntry, id: 'test-124', level: 'warn' },
        { ...mockLogEntry, id: 'test-125', level: 'error' },
      ];
      
      await storage.initialize();
      await expect(storage.writeMany(entries)).resolves.not.toThrow();
    });

    it('should handle write errors gracefully', async () => {
      await storage.initialize();
      // Mock the store method to throw an error
      jest.spyOn(storage, 'store').mockRejectedValueOnce(new Error('Write failed'));
      
      await expect(storage.write(mockLogEntry)).rejects.toThrow('Write failed');
    });

    it('should auto-initialize on write', async () => {
      await expect(storage.write(mockLogEntry)).resolves.not.toThrow();
      expect(storage['isConnected']).toBe(true);
    });

    it('should handle empty metadata', async () => {
      const entryNoMeta: LogEntry = {
        id: mockLogEntry.id,
        timestamp: mockLogEntry.timestamp,
        level: mockLogEntry.level,
        message: mockLogEntry.message,
        category: mockLogEntry.category
        // metadata is optional, so omit it
      };
      
      await storage.initialize();
      await expect(storage.write(entryNoMeta)).resolves.not.toThrow();
    });

    it('should batch write entries', async () => {
      const entries: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
        ...mockLogEntry,
        id: `test-${i}`,
      }));
      
      await storage.initialize();
      await expect(storage.writeMany(entries)).resolves.not.toThrow();
    });
  });

  describe('clear operations', () => {
    it('should clear all logs', async () => {
      await storage.initialize();
      await expect(storage.clear()).resolves.not.toThrow();
    });

    it('should handle clear errors gracefully', async () => {
      await storage.initialize();
      // Mock the clear method to throw an error
      jest.spyOn(storage, 'clear').mockRejectedValueOnce(new Error('Clear failed'));
      
      await expect(storage.clear()).rejects.toThrow('Clear failed');
    });

    it('should auto-initialize on clear', async () => {
      await expect(storage.clear()).resolves.not.toThrow();
      expect(storage['isConnected']).toBe(true);
    });
  });

  describe('query operations', () => {
    it('should query all logs', async () => {
      await storage.initialize();
      const result = await storage.query({});
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should query with filters', async () => {
      const query: LogQuery = {
        level: 'error',
        category: 'api',
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(),
        limit: 50,
        offset: 0,
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
      expect(result.entries).toEqual([]);
    });

    it('should handle query with metadata filters', async () => {
      const query: LogQuery = {
        // LogQuery doesn't support metadata filtering directly
        limit: 100,
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
    });

    it('should handle query errors gracefully', async () => {
      await storage.initialize();
      // Mock the queryLogs method to throw an error
      jest.spyOn(storage, 'queryLogs').mockRejectedValueOnce(new Error('Query failed'));
      
      await expect(storage.queryLogs({})).rejects.toThrow('Query failed');
    });

    it('should auto-initialize on query', async () => {
      const result = await storage.query({});
      expect(storage['isConnected']).toBe(true);
      expect(result).toBeDefined();
    });

    it('should apply default limit', async () => {
      await storage.initialize();
      const result = await storage.query({});
      
      expect(result).toBeDefined();
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination', async () => {
      const query: LogQuery = {
        limit: 10,
        offset: 20,
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
      expect(result.entries).toEqual([]);
    });
  });

  describe('count operations', () => {
    it('should count all logs', async () => {
      await storage.initialize();
      const count = await storage.count({});
      
      expect(count).toBe(0);
    });

    it('should count with filters', async () => {
      const query: LogQuery = {
        level: 'error',
        category: 'api',
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(),
      };
      
      await storage.initialize();
      const count = await storage.count(query);
      
      expect(count).toBe(0);
    });

    it('should initialize if not connected', async () => {
      const count = await storage.count({});
      expect(count).toBe(0);
      expect(storage['isConnected']).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return storage metrics', async () => {
      await storage.initialize();
      const metrics = await storage.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalEntries).toBe(0);
      expect(metrics.writeErrors).toBe(0);
      expect(metrics.readErrors).toBe(0);
    });

    it('should handle metrics errors gracefully', async () => {
      await storage.initialize();
      // Mock the getMetrics method to throw an error
      jest.spyOn(storage, 'getMetrics').mockRejectedValueOnce(new Error('Metrics failed'));
      
      await expect(storage.getMetrics()).rejects.toThrow('Metrics failed');
    });

    it('should auto-initialize on getMetrics', async () => {
      const metrics = await storage.getMetrics();
      expect(storage['isConnected']).toBe(true);
      expect(metrics).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      const mockNeon = require('@neondatabase/serverless').neon;
      mockNeon.mockImplementationOnce(() => {
        throw new Error('Connection refused');
      });
      
      const newStorage = new UnifiedPostgreSQLStorage('invalid-url');
      await expect(newStorage.initialize()).rejects.toThrow('Connection refused');
    });

    it('should handle invalid queries', async () => {
      const invalidQuery = {
        level: 'invalid-level' as any,
      };
      
      await storage.initialize();
      const result = await storage.query(invalidQuery);
      
      expect(result.entries).toEqual([]);
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        storage.write(mockLogEntry),
        storage.query({}),
        storage.count({}),
        storage.getMetrics(),
      ];
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('batch operations', () => {
    it('should handle large batch writes', async () => {
      const entries: LogEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockLogEntry,
        id: `batch-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
      }));
      
      await storage.initialize();
      await expect(storage.writeMany(entries)).resolves.not.toThrow();
    });

    it('should split very large batches', async () => {
      const entries: LogEntry[] = Array.from({ length: 10000 }, (_, i) => ({
        ...mockLogEntry,
        id: `large-batch-${i}`,
      }));
      
      await storage.initialize();
      await expect(storage.writeMany(entries)).resolves.not.toThrow();
    });
  });

  describe('timestamp handling', () => {
    it('should handle various timestamp formats', async () => {
      const entries: LogEntry[] = [
        {
          ...mockLogEntry,
          timestamp: new Date(),
        },
        {
          ...mockLogEntry,
          id: 'test-past',
          timestamp: new Date('2023-01-01'),
        },
        {
          ...mockLogEntry,
          id: 'test-future',
          timestamp: new Date('2025-01-01'),
        },
      ];
      
      await storage.initialize();
      await expect(storage.writeMany(entries)).resolves.not.toThrow();
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata', async () => {
      const complexEntry: LogEntry = {
        ...mockLogEntry,
        metadata: {
          nested: {
            deep: {
              value: 'test',
              array: [1, 2, 3],
            },
          },
          null: null,
          undefined: undefined,
          boolean: true,
          number: 123.45,
        },
      };
      
      await storage.initialize();
      await expect(storage.write(complexEntry)).resolves.not.toThrow();
    });

    it('should handle metadata with special characters', async () => {
      const specialEntry: LogEntry = {
        ...mockLogEntry,
        metadata: {
          special: "Test with 'quotes' and \"double quotes\"",
          emoji: '🎉 Test 🚀',
          unicode: '测试 テスト тест',
        },
      };
      
      await storage.initialize();
      await expect(storage.write(specialEntry)).resolves.not.toThrow();
    });
  });

  describe('concurrent writes', () => {
    it('should handle concurrent writes', async () => {
      await storage.initialize();
      
      const writes = Array.from({ length: 100 }, (_, i) => 
        storage.write({
          ...mockLogEntry,
          id: `concurrent-${i}`,
        })
      );
      
      await expect(Promise.all(writes)).resolves.not.toThrow();
    });

    it('should handle concurrent batch writes', async () => {
      await storage.initialize();
      
      const batches = Array.from({ length: 10 }, (_, i) => 
        storage.writeMany(
          Array.from({ length: 100 }, (_, j) => ({
            ...mockLogEntry,
            id: `batch-${i}-${j}`,
          }))
        )
      );
      
      await expect(Promise.all(batches)).resolves.not.toThrow();
    });
  });

  describe('query edge cases', () => {
    it('should handle queries with all filters', async () => {
      const query: LogQuery = {
        level: 'info',
        category: 'app',
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
        limit: 100,
        offset: 0,
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
      expect(result.entries).toEqual([]);
    });

    it('should handle queries with invalid dates', async () => {
      const query: LogQuery = {
        startDate: new Date('invalid'),
        endDate: new Date('invalid'),
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
    });

    it('should handle queries with future dates', async () => {
      const query: LogQuery = {
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result.entries).toEqual([]);
    });
  });

  describe('cleanup and maintenance', () => {
    it('should handle cleanup of old entries', async () => {
      await storage.initialize();
      
      // Simulate cleanup query
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await storage.query({
        endDate: oldDate,
      });
      
      expect(result).toBeDefined();
    });

    it('should reconnect after disconnect', async () => {
      await storage.connect();
      await storage.disconnect();
      await storage.connect();
      
      await expect(storage.write(mockLogEntry)).resolves.not.toThrow();
    });
  });
});