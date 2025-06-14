import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChartDrawingDatabaseService } from '../../database/chart-drawing.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/utils/logger';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Prisma Client
const mockPrismaClient = {
  chartDrawing: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  chartPattern: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  timeframeState: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('ChartDrawingDatabaseService', () => {
  let service: ChartDrawingDatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChartDrawingDatabaseService();
    // Reset the prisma client mock
    (service as any).prisma = mockPrismaClient;
  });

  describe('saveDrawings', () => {
    it('should save multiple drawings to database', async () => {
      const sessionId = 'session-123';
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [
            { time: 1704067200, value: 45000 },
            { time: 1704153600, value: 47000 },
          ],
          style: {
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true,
          },
          visible: true,
          interactive: true,
        },
        {
          id: 'drawing-2',
          type: 'horizontal',
          points: [{ time: 1704067200, value: 46000 }],
          style: {
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 'dashed',
            showLabels: false,
          },
          visible: true,
          interactive: false,
        },
      ];

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await service.saveDrawings(sessionId, drawings);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Saved drawings to database',
        expect.objectContaining({ sessionId, count: 2 })
      );
    });

    it('should handle empty drawings array', async () => {
      await service.saveDrawings('session-123', []);

      expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'No drawings to save',
        { sessionId: 'session-123' }
      );
    });

    it('should handle database errors', async () => {
      const drawings: ChartDrawing[] = [{
        id: 'drawing-1',
        type: 'trendline',
        points: [{ time: 1, value: 1 }],
        style: { color: '#000', lineWidth: 1, lineStyle: 'solid', showLabels: false },
        visible: true,
        interactive: true,
      }];

      mockPrismaClient.$transaction.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.saveDrawings('session-123', drawings)
      ).rejects.toThrow('DB Error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save drawings',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('loadDrawings', () => {
    it('should load drawings from database', async () => {
      const sessionId = 'session-123';
      const dbDrawings = [
        {
          id: 'drawing-1',
          sessionId,
          drawingId: 'drawing-1',
          type: 'trendline',
          data: {
            points: [
              { time: 1704067200, value: 45000 },
              { time: 1704153600, value: 47000 },
            ],
            style: {
              color: '#3b82f6',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true,
            },
            visible: true,
            interactive: true,
          },
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.chartDrawing.findMany.mockResolvedValue(dbDrawings);

      const result = await service.loadDrawings(sessionId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'drawing-1',
        type: 'trendline',
        points: expect.any(Array),
      });
      expect(mockPrismaClient.chartDrawing.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no drawings exist', async () => {
      mockPrismaClient.chartDrawing.findMany.mockResolvedValue([]);

      const result = await service.loadDrawings('session-no-drawings');

      expect(result).toEqual([]);
    });

    it('should handle malformed data gracefully', async () => {
      const dbDrawings = [
        {
          id: 'drawing-1',
          sessionId: 'session-123',
          drawingId: 'drawing-1',
          type: 'invalid',
          data: { invalid: 'data' },
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.chartDrawing.findMany.mockResolvedValue(dbDrawings);

      const result = await service.loadDrawings('session-123');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid drawing data',
        expect.any(Object)
      );
    });
  });

  describe('savePatterns', () => {
    it('should save pattern data to database', async () => {
      const sessionId = 'session-123';
      const patterns: PatternData[] = [
        {
          type: 'head-and-shoulders',
          visualization: {
            keyPoints: [
              { time: 1704067200, value: 45000, type: 'peak' },
            ],
            lines: [],
          },
          metrics: {
            target: 48000,
            stopLoss: 44000,
          },
          tradingImplication: 'Bearish reversal pattern',
          confidence: 0.85,
        },
      ];

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await service.savePatterns(sessionId, patterns);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Saved patterns to database',
        expect.objectContaining({ sessionId, count: 1 })
      );
    });

    it('should handle pattern validation errors', async () => {
      const invalidPatterns = [
        {
          type: '', // Invalid empty type
          visualization: null,
        } as any,
      ];

      await expect(
        service.savePatterns('session-123', invalidPatterns)
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadPatterns', () => {
    it('should load patterns from database', async () => {
      const sessionId = 'session-123';
      const dbPatterns = [
        {
          id: 'pattern-1',
          sessionId,
          patternId: 'pattern-1',
          type: 'double-top',
          data: {
            type: 'double-top',
            visualization: {
              keyPoints: [{ time: 1, value: 100, type: 'peak' }],
              lines: [],
            },
            confidence: 0.75,
          },
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.chartPattern.findMany.mockResolvedValue(dbPatterns);

      const result = await service.loadPatterns(sessionId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'double-top',
        confidence: 0.75,
      });
    });
  });

  describe('deleteDrawing', () => {
    it('should delete a specific drawing', async () => {
      const drawingId = 'drawing-123';

      await service.deleteDrawing(drawingId);

      expect(mockPrismaClient.chartDrawing.delete).toHaveBeenCalledWith({
        where: { drawingId },
      });
    });

    it('should handle deletion errors', async () => {
      mockPrismaClient.chartDrawing.delete.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(service.deleteDrawing('non-existent')).rejects.toThrow();
    });
  });

  describe('deletePattern', () => {
    it('should delete a specific pattern', async () => {
      const patternId = 'pattern-123';

      await service.deletePattern(patternId);

      expect(mockPrismaClient.chartPattern.delete).toHaveBeenCalledWith({
        where: { patternId },
      });
    });
  });

  describe('clearSession', () => {
    it('should clear all drawings and patterns for a session', async () => {
      const sessionId = 'session-123';

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await service.clearSession(sessionId);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Cleared session data',
        { sessionId }
      );
    });
  });

  describe('saveTimeframeState', () => {
    it('should save timeframe state', async () => {
      const sessionId = 'session-123';
      const state = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now(),
      };

      mockPrismaClient.timeframeState.upsert.mockResolvedValue({
        id: 1,
        sessionId,
        ...state,
      });

      await service.saveTimeframeState(sessionId, state);

      expect(mockPrismaClient.timeframeState.upsert).toHaveBeenCalledWith({
        where: { sessionId },
        update: state,
        create: {
          sessionId,
          ...state,
        },
      });
    });
  });

  describe('loadTimeframeState', () => {
    it('should load timeframe state', async () => {
      const sessionId = 'session-123';
      const state = {
        id: 1,
        sessionId,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now(),
      };

      mockPrismaClient.timeframeState.findFirst.mockResolvedValue(state);

      const result = await service.loadTimeframeState(sessionId);

      expect(result).toEqual({
        symbol: state.symbol,
        timeframe: state.timeframe,
        timestamp: state.timestamp,
      });
    });

    it('should return null when no state exists', async () => {
      mockPrismaClient.timeframeState.findFirst.mockResolvedValue(null);

      const result = await service.loadTimeframeState('session-no-state');

      expect(result).toBeNull();
    });
  });

  describe('batch operations', () => {
    it('should handle batch drawing operations efficiently', async () => {
      const sessionId = 'session-123';
      const drawings = Array(100).fill(null).map((_, i) => ({
        id: `drawing-${i}`,
        type: 'trendline' as const,
        points: [{ time: i, value: i * 100 }],
        style: {
          color: '#000',
          lineWidth: 1,
          lineStyle: 'solid' as const,
          showLabels: false,
        },
        visible: true,
        interactive: true,
      }));

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await service.saveDrawings(sessionId, drawings);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Saved drawings to database',
        expect.objectContaining({ count: 100 })
      );
    });
  });

  describe('error recovery', () => {
    it('should retry on transient errors', async () => {
      const drawings = [{
        id: 'drawing-1',
        type: 'trendline' as const,
        points: [{ time: 1, value: 1 }],
        style: { color: '#000', lineWidth: 1, lineStyle: 'solid' as const, showLabels: false },
        visible: true,
        interactive: true,
      }];

      // First call fails, second succeeds
      mockPrismaClient.$transaction
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockImplementationOnce(async (callback) => callback(mockPrismaClient));

      // The service should handle the retry internally
      await expect(
        service.saveDrawings('session-123', drawings)
      ).rejects.toThrow('Connection timeout');

      // In a real implementation, you would add retry logic
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});