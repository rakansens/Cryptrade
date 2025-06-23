import {
  DatabaseConnection,
  withDatabase,
  batchOperation,
  checkDatabaseHealth,
  type TransactionOptions,
} from '@/lib/utils/db-connection';
// Mock Prisma before importing
jest.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      constructor(message: string, options: any) {
        super(message);
        this.code = options.code;
        this.clientVersion = options.clientVersion || '0.0.0';
        this.meta = options.meta;
      }
      code: string;
      clientVersion: string;
      meta?: any;
    },
    TransactionIsolationLevel: {
      ReadUncommitted: 'ReadUncommitted',
      ReadCommitted: 'ReadCommitted',
      RepeatableRead: 'RepeatableRead',
      Serializable: 'Serializable',
    },
  },
}));

import { Prisma } from '@prisma/client';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock env
jest.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

// Get the mocked prisma instance at module level
const mockPrisma = require('@/lib/db/prisma').prisma;

describe('DatabaseConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    (DatabaseConnection as any).isConnected = false;
    (DatabaseConnection as any).connectionAttempts = 0;
  });

  describe('ensureConnection', () => {
    it('should establish connection successfully', async () => {
      mockPrisma.$connect.mockResolvedValueOnce(undefined);
      
      const result = await DatabaseConnection.ensureConnection();
      
      expect(result).toBe(true);
      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
      expect(DatabaseConnection.isHealthy()).toBe(true);
    });

    it('should return true if already connected', async () => {
      mockPrisma.$connect.mockResolvedValueOnce(undefined);
      
      // First connection
      await DatabaseConnection.ensureConnection();
      jest.clearAllMocks();
      
      // Second attempt should not call connect
      const result = await DatabaseConnection.ensureConnection();
      
      expect(result).toBe(true);
      expect(mockPrisma.$connect).not.toHaveBeenCalled();
    });

    it('should retry on connection failure', async () => {
      mockPrisma.$connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined);
      
      const result = await DatabaseConnection.ensureConnection();
      
      expect(result).toBe(true);
      expect(mockPrisma.$connect).toHaveBeenCalledTimes(3);
    });

    it('should throw after max connection attempts', async () => {
      mockPrisma.$connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(DatabaseConnection.ensureConnection()).rejects.toThrow(
        'Failed to connect to database after 5 attempts'
      );
      
      expect(mockPrisma.$connect).toHaveBeenCalledTimes(5);
    }, 30000);

    it('should use exponential backoff for retries', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      mockPrisma.$connect
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);
      
      await DatabaseConnection.ensureConnection();
      
      // Check exponential backoff delays
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1000);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 2000);
      
      setTimeoutSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockPrisma.$disconnect.mockResolvedValueOnce(undefined);
      
      await DatabaseConnection.disconnect();
      
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
      expect(DatabaseConnection.isHealthy()).toBe(false);
    });

    it('should handle disconnect errors gracefully', async () => {
      mockPrisma.$disconnect.mockRejectedValueOnce(new Error('Disconnect failed'));
      
      // Should not throw
      await expect(DatabaseConnection.disconnect()).resolves.not.toThrow();
      
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('transaction', () => {
    beforeEach(async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      await DatabaseConnection.ensureConnection();
    });

    it('should execute transaction successfully', async () => {
      const mockTx = { user: { create: jest.fn() } };
      const expectedResult = { id: 1, name: 'Test' };
      
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        return fn(mockTx);
      });
      
      const result = await DatabaseConnection.transaction(async (tx) => {
        return expectedResult;
      });
      
      expect(result).toEqual(expectedResult);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxWait: 2000,
          timeout: 5000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        })
      );
    });

    it('should use custom transaction options', async () => {
      const options: TransactionOptions = {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      };
      
      mockPrisma.$transaction.mockResolvedValueOnce('result');
      
      await DatabaseConnection.transaction(async () => 'result', options);
      
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        options
      );
    });

    it('should handle Prisma errors', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '4.0.0',
          meta: { target: ['email'] },
        }
      );
      
      mockPrisma.$transaction.mockRejectedValueOnce(prismaError);
      
      await expect(
        DatabaseConnection.transaction(async () => {})
      ).rejects.toThrow('Unique constraint violation: email');
    });
  });

  describe('handlePrismaError', () => {
    it('should handle unique constraint violation', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '4.0.0',
          meta: { target: ['email'] },
        }
      );
      
      const result = DatabaseConnection.handlePrismaError(error);
      
      expect(result.message).toBe('Unique constraint violation: email');
    });

    it('should handle foreign key constraint violation', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '4.0.0',
          meta: { field_name: 'userId' },
        }
      );
      
      const result = DatabaseConnection.handlePrismaError(error);
      
      expect(result.message).toBe('Foreign key constraint violation: userId');
    });

    it('should handle record not found', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '4.0.0',
        }
      );
      
      const result = DatabaseConnection.handlePrismaError(error);
      
      expect(result.message).toBe('Record not found');
    });

    it('should handle connection pool timeout', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Connection pool timeout',
        {
          code: 'P2024',
          clientVersion: '4.0.0',
        }
      );
      
      const result = DatabaseConnection.handlePrismaError(error);
      
      expect(result.message).toBe('Connection pool timeout');
    });

    it('should handle unknown Prisma errors', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unknown error',
        {
          code: 'P9999',
          clientVersion: '4.0.0',
        }
      );
      
      const result = DatabaseConnection.handlePrismaError(error);
      
      expect(result.message).toBe('Database error: Unknown error');
    });
  });

  describe('isHealthy', () => {
    it('should return false when not connected', () => {
      expect(DatabaseConnection.isHealthy()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockPrisma.$connect.mockResolvedValueOnce(undefined);
      await DatabaseConnection.ensureConnection();
      
      expect(DatabaseConnection.isHealthy()).toBe(true);
    });
  });
});

describe('withDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DatabaseConnection as any).isConnected = false;
  });

  it('should execute operation with database connection', async () => {
    mockPrisma.$connect.mockResolvedValueOnce(undefined);
    const operation = jest.fn().mockResolvedValue('result');
    
    const result = await withDatabase(operation);
    
    expect(result).toBe('result');
    expect(mockPrisma.$connect).toHaveBeenCalled();
    expect(operation).toHaveBeenCalled();
  });

  it('should use fallback on error in development', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
    const fallback = jest.fn().mockResolvedValue('fallback result');
    
    jest.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'development' },
    }));
    
    const result = await withDatabase(operation, fallback);
    
    expect(result).toBe('fallback result');
    expect(fallback).toHaveBeenCalled();
  });

  it('should throw enhanced error in production', async () => {
    jest.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'production' },
    }));
    
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '4.0.0',
      }
    );
    
    const operation = jest.fn().mockRejectedValue(prismaError);
    
    await expect(withDatabase(operation)).rejects.toThrow('Record not found');
  });

  it('should handle generic errors', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Generic error'));
    
    await expect(withDatabase(operation)).rejects.toThrow(
      'Database operation failed: Generic error'
    );
  });
});

describe('batchOperation', () => {
  it('should process items in batches', async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const operation = jest.fn().mockImplementation((item) => Promise.resolve(item * 2));
    
    const results = await batchOperation(items, operation, 10);
    
    expect(results).toHaveLength(25);
    expect(results).toEqual(items.map(i => i * 2));
    expect(operation).toHaveBeenCalledTimes(25);
  });

  it('should respect batch size', async () => {
    const items = Array.from({ length: 15 }, (_, i) => i);
    const operation = jest.fn().mockResolvedValue('result');
    
    // Track concurrent calls
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    
    operation.mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      currentConcurrent--;
      return 'result';
    });
    
    await batchOperation(items, operation, 5);
    
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  it('should handle empty array', async () => {
    const operation = jest.fn();
    
    const results = await batchOperation([], operation);
    
    expect(results).toEqual([]);
    expect(operation).not.toHaveBeenCalled();
  });

  it('should handle operation errors', async () => {
    const items = [1, 2, 3];
    const operation = jest.fn()
      .mockResolvedValueOnce('success')
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce('success');
    
    await expect(batchOperation(items, operation, 10)).rejects.toThrow('Failed');
  });
});

describe('checkDatabaseHealth', () => {
  it('should return healthy status with latency', async () => {
    // Mock with a slight delay to simulate actual database query time
    mockPrisma.$queryRaw.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([{ '?column?': 1 }]), 10))
    );
    
    const result = await checkDatabaseHealth();
    
    expect(result.healthy).toBe(true);
    expect(result.latency).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });

  it('should return unhealthy status on error', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'));
    
    const result = await checkDatabaseHealth();
    
    expect(result.healthy).toBe(false);
    expect(result.error).toBe('Connection failed');
    expect(result.latency).toBeUndefined();
  });

  it('should handle non-Error objects', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce('String error');
    
    const result = await checkDatabaseHealth();
    
    expect(result.healthy).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});

export {};