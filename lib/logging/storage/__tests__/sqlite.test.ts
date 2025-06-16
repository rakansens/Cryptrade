// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 1 }),
      get: jest.fn().mockReturnValue({ total: 5 }),
      all: jest.fn().mockReturnValue([]),
    }),
    exec: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn),
  }));
});

// Mock fs and path
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('path', () => ({
  dirname: jest.fn().mockReturnValue('./logs'),
}));

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UnifiedSQLiteStorage } from '../sqlite';
import type {
  UnifiedLogEntry,
  UnifiedLoggerConfig,
  LogFilter,
  LogLevel,
} from '../../unified-logger';

describe('UnifiedSQLiteStorage', () => {
  let storage: UnifiedSQLiteStorage;
  const mockConfig: UnifiedLoggerConfig = {
    environment: 'test',
    storageType: 'sqlite',
    connectionString: './test-logs/test.db',
    logLevel: 'debug',
  };

  const mockLogEntry: UnifiedLogEntry = {
    id: 'test-id-123',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    level: 'info' as LogLevel,
    source: 'test-source',
    message: 'Test message',
    environment: 'test',
    meta: { key: 'value' },
    error: { message: 'Test error', stack: 'Test stack' },
    correlationId: 'corr-123',
    userId: 'user-123',
    sessionId: 'session-123',
    agentName: 'test-agent',
    toolName: 'test-tool',
    stack: 'Test stack trace',
    duration: 100,
    tags: ['test', 'unit'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new UnifiedSQLiteStorage(mockConfig);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('init', () => {
    it('should initialize the database successfully', async () => {
      await expect(storage.init()).resolves.not.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      await storage.init();
      await storage.init();
      
      const Database = (await import('better-sqlite3')).default;
      expect(Database).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const Database = (await import('better-sqlite3')).default;
      (Database as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const newStorage = new UnifiedSQLiteStorage(mockConfig);
      await expect(newStorage.init()).rejects.toThrow('Database connection failed');
    });

    it('should use default path when connectionString is not provided', async () => {
      const configWithoutConnection = { ...mockConfig, connectionString: undefined };
      const storageWithoutConnection = new UnifiedSQLiteStorage(configWithoutConnection);
      
      await storageWithoutConnection.init();
      
      const Database = (await import('better-sqlite3')).default;
      expect(Database).toHaveBeenCalledWith('./logs/unified.db');
    });
  });

  describe('save', () => {
    it('should save log entries successfully', async () => {
      await storage.init();
      
      const entries = [mockLogEntry];
      await expect(storage.save(entries)).resolves.not.toThrow();
    });

    it('should handle multiple entries in a transaction', async () => {
      await storage.init();
      
      const entries = [
        mockLogEntry,
        { ...mockLogEntry, id: 'test-id-124' },
        { ...mockLogEntry, id: 'test-id-125' },
      ];
      
      await expect(storage.save(entries)).resolves.not.toThrow();
    });

    it('should initialize if not already initialized', async () => {
      const entries = [mockLogEntry];
      await expect(storage.save(entries)).resolves.not.toThrow();
    });

    it('should handle entries with null optional fields', async () => {
      await storage.init();
      
      const minimalEntry: UnifiedLogEntry = {
        id: 'minimal-id',
        timestamp: new Date(),
        level: 'info' as LogLevel,
        source: 'test',
        message: 'Minimal message',
        environment: 'test',
      };
      
      await expect(storage.save([minimalEntry])).resolves.not.toThrow();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should query with empty filter', async () => {
      const result = await storage.query({});
      
      expect(result).toEqual({
        data: [],
        pagination: {
          total: 5,
          page: 1,
          pages: 1,
          limit: 50,
          hasNext: false,
          hasPrev: false,
        },
        executionTime: expect.any(Number),
      });
    });

    it('should query with level filter', async () => {
      const filter: LogFilter = { level: ['info', 'error'] };
      const result = await storage.query(filter);
      
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(5);
    });

    it('should query with time range filter', async () => {
      const filter: LogFilter = {
        timeRange: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-02T00:00:00Z'),
        },
      };
      
      const result = await storage.query(filter);
      expect(result.data).toEqual([]);
    });

    it('should query with pagination', async () => {
      const result = await storage.query({}, { page: 2, limit: 10 });
      
      expect(result.pagination).toMatchObject({
        page: 2,
        limit: 10,
        hasPrev: true,
      });
    });

    it('should query with sorting', async () => {
      const result = await storage.query({}, { 
        sortBy: 'level', 
        order: 'asc' 
      });
      
      expect(result).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle complex filters', async () => {
      const filter: LogFilter = {
        level: 'error',
        source: ['api', 'worker'],
        correlationId: 'corr-123',
        userId: 'user-123',
        sessionId: 'session-123',
        agentName: 'agent-1',
        toolName: 'tool-1',
        search: 'error',
        minDuration: 100,
        maxDuration: 1000,
      };
      
      const result = await storage.query(filter);
      expect(result.data).toEqual([]);
    });

    it('should map sort fields correctly', async () => {
      const sortFields = [
        'timestamp', 'level', 'source', 'message', 'environment',
        'correlationId', 'userId', 'sessionId', 'agentName', 
        'toolName', 'duration'
      ];
      
      for (const field of sortFields) {
        const result = await storage.query({}, { sortBy: field });
        expect(result).toBeDefined();
      }
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should get stats without filter', async () => {
      const stats = await storage.getStats();
      
      expect(stats).toMatchObject({
        total: 5,
        byLevel: {
          debug: 0,
          info: 0,
          warn: 0,
          error: 0,
          critical: 0,
        },
        bySource: {},
      });
    });

    it('should get stats with filter', async () => {
      const filter: LogFilter = { level: 'error' };
      const stats = await storage.getStats(filter);
      
      expect(stats.total).toBe(5);
    });

    it('should include agent and tool stats when available', async () => {
      const mockDb = {
        prepare: jest.fn().mockImplementation((query: string) => {
          if (query.includes('agent_name')) {
            return {
              all: jest.fn().mockReturnValue([
                { agent_name: 'agent1', count: 10 },
                { agent_name: 'agent2', count: 5 },
              ]),
            };
          }
          if (query.includes('tool_name')) {
            return {
              all: jest.fn().mockReturnValue([
                { tool_name: 'tool1', count: 8 },
                { tool_name: 'tool2', count: 3 },
              ]),
            };
          }
          return {
            get: jest.fn().mockReturnValue({ total: 5 }),
            all: jest.fn().mockReturnValue([]),
          };
        }),
        exec: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn((fn) => fn),
      };

      const Database = (await import('better-sqlite3')).default;
      (Database as jest.Mock).mockImplementationOnce(() => mockDb);

      const newStorage = new UnifiedSQLiteStorage(mockConfig);
      await newStorage.init();
      
      const stats = await newStorage.getStats();
      
      expect(stats.byAgent).toEqual({
        agent1: 10,
        agent2: 5,
      });
      expect(stats.byTool).toEqual({
        tool1: 8,
        tool2: 3,
      });
    });

    it('should calculate performance stats when durations are available', async () => {
      const mockDb = {
        prepare: jest.fn().mockImplementation((query: string) => {
          if (query.includes('AVG(duration)')) {
            return {
              all: jest.fn().mockReturnValue([
                { avg_duration: 100, value: 50 },
                { avg_duration: 100, value: 100 },
                { avg_duration: 100, value: 150 },
                { avg_duration: 100, value: 200 },
                { avg_duration: 100, value: 500 },
              ]),
            };
          }
          return {
            get: jest.fn().mockReturnValue({ total: 5 }),
            all: jest.fn().mockReturnValue([]),
          };
        }),
        exec: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn((fn) => fn),
      };

      const Database = (await import('better-sqlite3')).default;
      (Database as jest.Mock).mockImplementationOnce(() => mockDb);

      const newStorage = new UnifiedSQLiteStorage(mockConfig);
      await newStorage.init();
      
      const stats = await newStorage.getStats();
      
      expect(stats.performance).toBeDefined();
      expect(stats.performance?.avgDuration).toBe(200);
      expect(stats.performance?.p50Duration).toBe(150);
      expect(stats.performance?.p95Duration).toBe(500);
      expect(stats.performance?.p99Duration).toBe(500);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should delete entries matching filter', async () => {
      const filter: LogFilter = { level: 'error' };
      const deletedCount = await storage.delete(filter);
      
      expect(deletedCount).toBe(1);
    });

    it('should delete with complex filter', async () => {
      const filter: LogFilter = {
        level: ['debug', 'info'],
        timeRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-02'),
        },
        source: 'test-source',
      };
      
      const deletedCount = await storage.delete(filter);
      expect(deletedCount).toBe(1);
    });

    it('should initialize if not already initialized', async () => {
      const newStorage = new UnifiedSQLiteStorage(mockConfig);
      const filter: LogFilter = { level: 'error' };
      
      const deletedCount = await newStorage.delete(filter);
      expect(deletedCount).toBe(1);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await storage.init();
      await storage.close();
      
      // Should be able to reinitialize after closing
      await expect(storage.init()).resolves.not.toThrow();
    });

    it('should handle close when not initialized', async () => {
      await expect(storage.close()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays gracefully', async () => {
      await storage.init();
      await expect(storage.save([])).resolves.not.toThrow();
    });

    it('should handle invalid sort fields', async () => {
      await storage.init();
      const result = await storage.query({}, { sortBy: 'invalidField' });
      expect(result).toBeDefined();
    });

    it('should handle search in message and meta fields', async () => {
      await storage.init();
      const filter: LogFilter = { search: 'test search term' };
      const result = await storage.query(filter);
      
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
    });

    it('should properly convert row data to log entries', async () => {
      const mockRows = [{
        id: 'test-id',
        timestamp: 1704110400000,
        level: 'error',
        source: 'api',
        message: 'Test message',
        environment: 'production',
        meta: JSON.stringify({ key: 'value' }),
        error: JSON.stringify({ message: 'Error', stack: 'Stack' }),
        correlation_id: 'corr-123',
        user_id: 'user-123',
        session_id: 'session-123',
        agent_name: 'agent-1',
        tool_name: 'tool-1',
        stack: 'Stack trace',
        duration: 150,
        tags: JSON.stringify(['tag1', 'tag2']),
      }];

      const mockDb = {
        prepare: jest.fn().mockImplementation(() => ({
          get: jest.fn().mockReturnValue({ total: 1 }),
          all: jest.fn().mockReturnValue(mockRows),
        })),
        exec: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn((fn) => fn),
      };

      const Database = (await import('better-sqlite3')).default;
      (Database as jest.Mock).mockImplementationOnce(() => mockDb);

      const newStorage = new UnifiedSQLiteStorage(mockConfig);
      await newStorage.init();
      
      const result = await newStorage.query({});
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'test-id',
        level: 'error',
        source: 'api',
        message: 'Test message',
        meta: { key: 'value' },
        error: { message: 'Error', stack: 'Stack' },
      });
    });
  });
});