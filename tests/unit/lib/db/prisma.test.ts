/**
 * Prisma Database Configuration Tests
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { mockEnv, createTestEnv } from '@/tests/helpers/setupEnvMock'
import type { PrismaClient } from '@prisma/client'

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $on: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn()
  })),
  Prisma: {
    TransactionIsolationLevel: {
      ReadUncommitted: 'ReadUncommitted',
      ReadCommitted: 'ReadCommitted',
      RepeatableRead: 'RepeatableRead',
      Serializable: 'Serializable'
    }
  }
}))

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))

describe('Prisma Configuration', () => {
  let restoreEnv: () => void
  let mockPrismaClient: jest.MockedClass<any>
  let mockLogger: any
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Setup environment
    restoreEnv = mockEnv(createTestEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      NODE_ENV: 'test'
    }))

    // Get mocked modules
    const prismaClient = require('@prisma/client')
    mockPrismaClient = prismaClient.PrismaClient as jest.MockedClass<any>
    
    const loggerModule = require('@/lib/utils/logger')
    mockLogger = loggerModule.logger

    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    // Reset global prisma instance
    const globalAny = global as any
    delete globalAny.prisma
  })

  afterEach(() => {
    restoreEnv()
    consoleWarnSpy.mockRestore()
  })

  describe('createPrismaClient', () => {
    it('creates client with correct configuration in development', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'development'
      }))
      jest.resetModules()

      // Act
      const { prisma } = await import('@/lib/db/prisma')

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ],
        errorFormat: 'pretty'
      })
      expect(prisma).toBeDefined()
    })

    it('creates client with minimal configuration in production', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'production'
      }))
      jest.resetModules()

      // Act
      const { prisma } = await import('@/lib/db/prisma')

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ],
        errorFormat: 'minimal'
      })
      expect(prisma).toBeDefined()
    })

    it('throws error when DATABASE_URL is missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        // Missing DATABASE_URL
      }))
      jest.resetModules()

      // Act & Assert
      await expect(async () => {
        await import('@/lib/db/prisma')
      }).rejects.toThrow('DATABASE_URL is not configured')
    })

    it('sets up event listeners in development', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'development'
      }))
      jest.resetModules()

      const mockOn = jest.fn()
      mockPrismaClient.mockImplementation(() => ({
        $on: mockOn,
        $connect: jest.fn(),
        $disconnect: jest.fn()
      }))

      // Act
      await import('@/lib/db/prisma')

      // Assert
      expect(mockOn).toHaveBeenCalledWith('query', expect.any(Function))
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockOn).toHaveBeenCalledWith('warn', expect.any(Function))
    })

    it('logs queries in development', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'development'
      }))
      jest.resetModules()

      let queryHandler: any
      const mockOn = jest.fn((event, handler) => {
        if (event === 'query') queryHandler = handler
      })
      mockPrismaClient.mockImplementation(() => ({
        $on: mockOn,
        $connect: jest.fn(),
        $disconnect: jest.fn()
      }))

      // Act
      await import('@/lib/db/prisma')
      
      // Simulate query event
      const queryEvent = {
        query: 'SELECT * FROM users',
        params: '[]',
        duration: 10
      }
      queryHandler(queryEvent)

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith('[Prisma Query]', {
        query: 'SELECT * FROM users',
        params: '[]',
        duration: 10
      })
    })

    it('logs errors always', async () => {
      // Arrange
      let errorHandler: any
      const mockOn = jest.fn((event, handler) => {
        if (event === 'error') errorHandler = handler
      })
      mockPrismaClient.mockImplementation(() => ({
        $on: mockOn,
        $connect: jest.fn(),
        $disconnect: jest.fn()
      }))

      // Act
      await import('@/lib/db/prisma')
      
      // Simulate error event
      const errorEvent = { message: 'Database error' }
      errorHandler(errorEvent)

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('[Prisma Error]', {
        error: errorEvent
      })
    })

    it('logs warnings', async () => {
      // Arrange
      let warnHandler: any
      const mockOn = jest.fn((event, handler) => {
        if (event === 'warn') warnHandler = handler
      })
      mockPrismaClient.mockImplementation(() => ({
        $on: mockOn,
        $connect: jest.fn(),
        $disconnect: jest.fn()
      }))

      // Act
      await import('@/lib/db/prisma')
      
      // Simulate warning event
      const warnEvent = { message: 'Database warning' }
      warnHandler(warnEvent)

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith('[Prisma Warning]', {
        warning: warnEvent
      })
    })
  })

  describe('Singleton Pattern', () => {
    it('returns same instance in non-production', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'development'
      }))
      jest.resetModules()

      // Act
      const module1 = await import('@/lib/db/prisma')
      const module2 = await import('@/lib/db/prisma')

      // Assert
      expect(module1.prisma).toBe(module2.prisma)
      expect(mockPrismaClient).toHaveBeenCalledTimes(1) // Only created once
    })

    it('stores instance on global in non-production', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'development'
      }))
      jest.resetModules()

      // Act
      const { prisma } = await import('@/lib/db/prisma')

      // Assert
      const globalAny = global as any
      expect(globalAny.prisma).toBe(prisma)
    })

    it('does not store on global in production', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        NODE_ENV: 'production'
      }))
      jest.resetModules()

      // Act
      await import('@/lib/db/prisma')

      // Assert
      const globalAny = global as any
      expect(globalAny.prisma).toBeUndefined()
    })
  })

  describe('serializeBigInt', () => {
    it('converts BigInt to string in objects', async () => {
      // Act
      const { serializeBigInt } = await import('@/lib/db/prisma')
      const result = serializeBigInt({
        id: BigInt(123),
        name: 'Test',
        count: BigInt(456)
      })

      // Assert
      expect(result).toEqual({
        id: '123',
        name: 'Test',
        count: '456'
      })
    })

    it('handles nested objects with BigInt', async () => {
      // Act
      const { serializeBigInt } = await import('@/lib/db/prisma')
      const result = serializeBigInt({
        user: {
          id: BigInt(789),
          profile: {
            views: BigInt(1000)
          }
        }
      })

      // Assert
      expect(result).toEqual({
        user: {
          id: '789',
          profile: {
            views: '1000'
          }
        }
      })
    })

    it('handles arrays with BigInt', async () => {
      // Act
      const { serializeBigInt } = await import('@/lib/db/prisma')
      const result = serializeBigInt([
        BigInt(1),
        BigInt(2),
        { value: BigInt(3) }
      ])

      // Assert
      expect(result).toEqual([
        '1',
        '2',
        { value: '3' }
      ])
    })

    it('preserves other data types', async () => {
      // Act
      const { serializeBigInt } = await import('@/lib/db/prisma')
      const result = serializeBigInt({
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        object: { key: 'value' }
      })

      // Assert
      expect(result).toEqual({
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { key: 'value' }
      })
    })
  })

  describe('withTransaction', () => {
    it('executes transaction with default options', async () => {
      // Arrange
      const mockTransaction = jest.fn().mockResolvedValue('result')
      const mockPrisma = {
        $on: jest.fn(),
        $transaction: mockTransaction
      }
      mockPrismaClient.mockImplementation(() => mockPrisma)

      // Act
      const { withTransaction } = await import('@/lib/db/prisma')
      const callback = jest.fn().mockResolvedValue('test-result')
      const result = await withTransaction(callback)

      // Assert
      expect(result).toBe('result')
      expect(mockTransaction).toHaveBeenCalledWith(callback, undefined)
    })

    it('passes transaction options correctly', async () => {
      // Arrange
      const mockTransaction = jest.fn().mockResolvedValue('result')
      const mockPrisma = {
        $on: jest.fn(),
        $transaction: mockTransaction
      }
      mockPrismaClient.mockImplementation(() => mockPrisma)

      const { Prisma } = await import('@prisma/client')

      // Act
      const { withTransaction } = await import('@/lib/db/prisma')
      const callback = jest.fn()
      const options = {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
      await withTransaction(callback, options)

      // Assert
      expect(mockTransaction).toHaveBeenCalledWith(callback, options)
    })

    it('provides transaction client to callback', async () => {
      // Arrange
      const mockTx = { user: { findMany: jest.fn() } }
      const mockTransaction = jest.fn((cb) => cb(mockTx))
      const mockPrisma = {
        $on: jest.fn(),
        $transaction: mockTransaction
      }
      mockPrismaClient.mockImplementation(() => mockPrisma)

      // Act
      const { withTransaction } = await import('@/lib/db/prisma')
      const callback = jest.fn((tx) => {
        expect(tx).toBe(mockTx)
        return 'callback-result'
      })
      await withTransaction(callback)

      // Assert
      expect(callback).toHaveBeenCalledWith(mockTx)
    })

    it('propagates transaction errors', async () => {
      // Arrange
      const error = new Error('Transaction failed')
      const mockTransaction = jest.fn().mockRejectedValue(error)
      const mockPrisma = {
        $on: jest.fn(),
        $transaction: mockTransaction
      }
      mockPrismaClient.mockImplementation(() => mockPrisma)

      // Act & Assert
      const { withTransaction } = await import('@/lib/db/prisma')
      await expect(withTransaction(jest.fn())).rejects.toThrow('Transaction failed')
    })
  })

  describe('Type Exports', () => {
    it('exports required types', async () => {
      // Act
      const types = await import('@/lib/db/prisma')

      // Assert
      expect(types).toHaveProperty('prisma')
      expect(types).toHaveProperty('serializeBigInt')
      expect(types).toHaveProperty('withTransaction')
    })
  })
})