// Mock logger before imports
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedPostgreSQLStorage } from '../postgres';
import type { LogEntry, LogQuery, LogLevel } from '../types';

describe('UnifiedPostgreSQLStorage', () => {
  let storage: UnifiedPostgreSQLStorage;
  
  const mockLogEntry: LogEntry = {
    id: 'test-123',
    timestamp: Date.now(),
    level: 'info' as LogLevel,
    category: 'test',
    message: 'Test message',
    source: 'test-source',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-123',
      extra: { key: 'value' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      storage = new UnifiedPostgreSQLStorage({});
      expect(storage).toBeDefined();
    });

    it('should use provided connection URL', () => {
      storage = new UnifiedPostgreSQLStorage({
        connectionUrl: 'postgresql://user:pass@host:5432/db',
      });
      expect(storage).toBeDefined();
    });

    it('should use environment variable for connection', () => {
      process.env.DATABASE_URL = 'postgresql://env:pass@host:5432/db';
      storage = new UnifiedPostgreSQLStorage({});
      expect(storage).toBeDefined();
    });

    it('should use custom table name', () => {
      storage = new UnifiedPostgreSQLStorage({
        tableName: 'custom_logs',
      });
      expect(storage).toBeDefined();
    });

    it('should mask password in logs', () => {
      const { logger } = require('@/lib/utils/logger');
      storage = new UnifiedPostgreSQLStorage({
        connectionUrl: 'postgresql://user:secretpass@host:5432/db',
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PostgreSQLStorage] Initialized (placeholder)',
        expect.objectContaining({
          connectionUrl: 'postgresql://user:****@host:5432/db',
        })
      );
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should initialize successfully', async () => {
      await expect(storage.initialize()).resolves.not.toThrow();
    });

    it('should simulate connection delay', async () => {
      const start = Date.now();
      await storage.initialize();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should set connected flag', async () => {
      await storage.initialize();
      expect((storage as any).isConnected).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock setTimeout to throw error
      jest.spyOn(global, 'setTimeout').mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await expect(storage.initialize()).rejects.toThrow(
        'PostgreSQL initialization failed: Connection failed'
      );
    });
  });

  describe('store', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should store single log entry', async () => {
      await storage.initialize();
      await expect(storage.store(mockLogEntry)).resolves.not.toThrow();
    });

    it('should store multiple log entries', async () => {
      await storage.initialize();
      const entries = [
        mockLogEntry,
        { ...mockLogEntry, id: 'test-124' },
        { ...mockLogEntry, id: 'test-125' },
      ];
      
      await expect(storage.store(entries)).resolves.not.toThrow();
    });

    it('should initialize if not connected', async () => {
      await expect(storage.store(mockLogEntry)).resolves.not.toThrow();
      expect((storage as any).isConnected).toBe(true);
    });

    it('should validate log entries', async () => {
      const invalidEntry = { invalid: 'data' } as any;
      await expect(storage.store(invalidEntry)).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      await storage.initialize();
      
      // Mock internal method to throw error
      (storage as any).executeInsert = jest.fn().mockRejectedValue(
        new Error('Insert failed')
      );
      
      await expect(storage.store(mockLogEntry)).rejects.toThrow();
    });
  });

  describe('query', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should query with empty filter', async () => {
      await storage.initialize();
      const result = await storage.query({});
      
      expect(result).toEqual({
        entries: [],
        total: 0,
        hasMore: false,
      });
    });

    it('should query with filters', async () => {
      const query: LogQuery = {
        levels: ['error', 'warn'],
        categories: ['api', 'worker'],
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        search: 'error message',
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
        metadata: {
          userId: 'user-123',
          sessionId: 'session-123',
        },
      };
      
      await storage.initialize();
      const result = await storage.query(query);
      
      expect(result).toBeDefined();
    });

    it('should initialize if not connected', async () => {
      const result = await storage.query({});
      expect(result).toBeDefined();
      expect((storage as any).isConnected).toBe(true);
    });

    it('should handle query errors', async () => {
      await storage.initialize();
      
      // Mock internal method to throw error
      (storage as any).executeQuery = jest.fn().mockRejectedValue(
        new Error('Query failed')
      );
      
      await expect(storage.query({})).rejects.toThrow();
    });
  });

  describe('count', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should count all entries', async () => {
      await storage.initialize();
      const count = await storage.count({});
      
      expect(count).toBe(0);
    });

    it('should count with filters', async () => {
      const query: LogQuery = {
        levels: ['error'],
        categories: ['api'],
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
      };
      
      await storage.initialize();
      const count = await storage.count(query);
      
      expect(count).toBe(0);
    });

    it('should initialize if not connected', async () => {
      const count = await storage.count({});
      expect(count).toBe(0);
      expect((storage as any).isConnected).toBe(true);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should delete entries by query', async () => {
      const query: LogQuery = {
        levels: ['debug'],
        startTime: 0,
        endTime: Date.now() - 86400000, // Older than 24h
      };
      
      await storage.initialize();
      const deletedCount = await storage.delete(query);
      
      expect(deletedCount).toBe(0);
    });

    it('should require at least one filter', async () => {
      await storage.initialize();
      await expect(storage.delete({})).rejects.toThrow(
        'At least one filter must be specified for delete operations'
      );
    });

    it('should initialize if not connected', async () => {
      const query: LogQuery = { levels: ['debug'] };
      const deletedCount = await storage.delete(query);
      
      expect(deletedCount).toBe(0);
      expect((storage as any).isConnected).toBe(true);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should return storage metrics', async () => {
      await storage.initialize();
      const metrics = await storage.getMetrics();
      
      expect(metrics).toMatchObject({
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
        sizeBytes: 0,
        entriesByLevel: {
          debug: 0,
          info: 0,
          warn: 0,
          error: 0,
        },
        entriesByCategory: {},
      });
    });

    it('should initialize if not connected', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics).toBeDefined();
      expect((storage as any).isConnected).toBe(true);
    });
  });

  describe('vacuum', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should vacuum old entries', async () => {
      await storage.initialize();
      const vacuumed = await storage.vacuum(7); // 7 days
      
      expect(vacuumed).toBe(0);
    });

    it('should validate retention days', async () => {
      await storage.initialize();
      
      await expect(storage.vacuum(0)).rejects.toThrow(
        'Retention days must be positive'
      );
      
      await expect(storage.vacuum(-1)).rejects.toThrow(
        'Retention days must be positive'
      );
    });

    it('should initialize if not connected', async () => {
      const vacuumed = await storage.vacuum(7);
      expect(vacuumed).toBe(0);
      expect((storage as any).isConnected).toBe(true);
    });
  });

  describe('close', () => {
    beforeEach(() => {
      storage = new UnifiedPostgreSQLStorage({});
    });

    it('should close connection', async () => {
      await storage.initialize();
      await expect(storage.close()).resolves.not.toThrow();
      expect((storage as any).isConnected).toBe(false);
    });

    it('should handle close when not connected', async () => {
      await expect(storage.close()).resolves.not.toThrow();
    });

    it('should handle close errors', async () => {
      await storage.initialize();
      
      // Mock internal method to throw error
      (storage as any).closeConnection = jest.fn().mockRejectedValue(
        new Error('Close failed')
      );
      
      // Should not throw, but log error
      await expect(storage.close()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent operations', async () => {
      storage = new UnifiedPostgreSQLStorage({});
      
      const operations = [
        storage.store(mockLogEntry),
        storage.query({}),
        storage.count({}),
        storage.getMetrics(),
      ];
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should handle special characters in queries', async () => {
      storage = new UnifiedPostgreSQLStorage({});
      await storage.initialize();
      
      const query: LogQuery = {
        search: "'; DROP TABLE logs; --",
      };
      
      // Should safely handle SQL injection attempts
      await expect(storage.query(query)).resolves.not.toThrow();
    });

    it('should handle large batch inserts', async () => {
      storage = new UnifiedPostgreSQLStorage({});
      await storage.initialize();
      
      const largeEntries = Array.from({ length: 1000 }, (_, i) => ({
        ...mockLogEntry,
        id: `test-${i}`,
      }));
      
      await expect(storage.store(largeEntries)).resolves.not.toThrow();
    });

    it('should handle reconnection', async () => {
      storage = new UnifiedPostgreSQLStorage({});
      
      await storage.initialize();
      await storage.close();
      await storage.initialize();
      
      expect((storage as any).isConnected).toBe(true);
    });
  });
});