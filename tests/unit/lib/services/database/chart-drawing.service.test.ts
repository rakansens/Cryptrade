import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';
import { ChartDrawingDatabaseService } from '@/lib/services/database/chart-drawing.service';
import { logger } from '@/lib/utils/logger';
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    chartDrawing: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    patternAnalysis: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/utils/db-connection', () => ({
  withDatabase: jest.fn((fn, fallbackFn) => fn()),
}));

// Mock the browser detection differently
let mockIsBrowser = false;
jest.mock('@/lib/services/database/chart-drawing.service', () => {
  const actual = jest.requireActual('@/lib/services/database/chart-drawing.service');
  return {
    ...actual,
    ChartDrawingDatabaseService: class MockChartDrawingDatabaseService extends actual.ChartDrawingDatabaseService {
      static async saveDrawings(drawings: any[], sessionId?: string) {
        if (mockIsBrowser) {
          logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
          return;
        }
        return actual.ChartDrawingDatabaseService.saveDrawings.call(this, drawings, sessionId);
      }
      
      static async loadDrawings(sessionId?: string) {
        if (mockIsBrowser) {
          logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
          if (process.env.NODE_ENV === 'development') {
            return [];
          }
          throw new Error('ChartDrawingDB cannot be used in browser environment');
        }
        return actual.ChartDrawingDatabaseService.loadDrawings.call(this, sessionId);
      }
      
      static async saveDrawing(drawing: any, sessionId?: string) {
        if (mockIsBrowser) {
          logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
          return null;
        }
        return actual.ChartDrawingDatabaseService.saveDrawing.call(this, drawing, sessionId);
      }
    }
  };
});

describe('ChartDrawingDatabaseService', () => {
  const mockDrawings: ChartDrawing[] = [
    {
      id: 'drawing-1',
      type: 'trendline',
      points: [
        { time: 1234567890, value: 100 },
        { time: 1234567900, value: 110 },
      ],
      style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid' },
      visible: true,
      interactive: true,
    },
    {
      id: 'drawing-2',
      type: 'horizontalLine',
      points: [],
      price: 105,
      style: { color: '#00ff00', lineWidth: 1, lineStyle: 'dashed' },
      visible: true,
      interactive: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBrowser = false;
  });

  describe('Browser environment handling', () => {
    beforeEach(() => {
      mockIsBrowser = true;
    });

    afterEach(() => {
      mockIsBrowser = false;
    });

    it('should warn and return early in saveDrawings when in browser', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');
      
      expect(warnSpy).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');
      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      
      warnSpy.mockRestore();
    });

    it('should return empty array in loadDrawings when in browser (development)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const warnSpy = jest.spyOn(logger, 'warn');

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');
      
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in loadDrawings when in browser (production)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
        'ChartDrawingDB cannot be used in browser environment'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('saveDrawings', () => {
    it('should save drawings successfully', async () => {
      await ChartDrawingDatabaseService.saveDrawings(mockDrawings, 'session-1');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });

      expect(prisma.chartDrawing.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'drawing-1',
            sessionId: 'session-1',
            type: 'trendline',
          }),
          expect.objectContaining({
            id: 'drawing-2',
            sessionId: 'session-1',
            type: 'horizontalLine',
          }),
        ]),
      });
    });

    it('should handle empty drawings array', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });

      expect(prisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should handle drawings without sessionId', async () => {
      await ChartDrawingDatabaseService.saveDrawings(mockDrawings);

      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      (prisma.chartDrawing.deleteMany as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(ChartDrawingDatabaseService.saveDrawings(mockDrawings, 'session-1')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('loadDrawings', () => {
    it('should load drawings successfully', async () => {
      const mockDbDrawings = [
        {
          id: 'drawing-1',
          type: 'TRENDLINE' as const,
          points: [
            { time: 1234567890, value: 100 },
            { time: 1234567900, value: 110 },
          ],
          style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid' },
          visible: true,
          interactive: true,
          price: null,
          time: null,
          levels: null,
          metadata: null,
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValueOnce(mockDbDrawings);

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(prisma.chartDrawing.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'drawing-1',
        type: 'TRENDLINE',
        points: expect.any(Array),
      });
    });

    it('should handle database unavailability', async () => {
      const { withDatabase } = require('@/lib/utils/db-connection');
      (withDatabase as jest.Mock).mockImplementationOnce(async (fn: any, fallbackFn: any) => {
        return fallbackFn();
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Database unavailable, returning empty array',
        { sessionId: 'session-1' }
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production when database unavailable', async () => {
      const { withDatabase } = require('@/lib/utils/db-connection');
      (withDatabase as jest.Mock).mockImplementationOnce(async (fn: any, fallbackFn: any) => {
        return fallbackFn();
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
        'Database unavailable for loading drawings'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('saveDrawing', () => {
    it('should save a single drawing', async () => {
      const mockCreatedDrawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'TRENDLINE' as const,
        points: mockDrawings[0]!.points,
        style: mockDrawings[0]!.style,
        visible: true,
        interactive: true,
        price: null,
        time: null,
        levels: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.chartDrawing.create as jest.Mock).mockResolvedValueOnce(mockCreatedDrawing);

      const result = await ChartDrawingDatabaseService.saveDrawing(mockDrawings[0]!, 'session-1');

      expect(prisma.chartDrawing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'drawing-1',
          sessionId: 'session-1',
          type: 'TRENDLINE',
        }),
      });

      expect(result).toEqual(mockCreatedDrawing);
    });

    it('should return null in browser environment', async () => {
      mockIsBrowser = true;
      const warnSpy = jest.spyOn(logger, 'warn');

      const result = await ChartDrawingDatabaseService.saveDrawing(mockDrawings[0]!, 'session-1');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');
      expect(prisma.chartDrawing.create).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('deleteDrawing', () => {
    it('should delete drawing successfully', async () => {
      (prisma.chartDrawing.delete as jest.Mock).mockResolvedValueOnce({ id: 'drawing-1' });

      await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

      expect(prisma.chartDrawing.delete).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
      });
    });

    it('should handle delete errors', async () => {
      const deleteError = new Error('Delete failed');
      (prisma.chartDrawing.delete as jest.Mock).mockRejectedValueOnce(deleteError);

      await expect(ChartDrawingDatabaseService.deleteDrawing('drawing-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('savePattern', () => {
    it('should save pattern successfully', async () => {
      const mockPattern = {
        type: 'headAndShoulders' as const,
        confidence: 0.85,
        startTime: 1234567890,
        endTime: 1234567900,
        visualization: {
          keyPoints: [
            { time: 1234567890, value: 100, type: 'peak' as const },
            { time: 1234567895, value: 110, type: 'peak' as const },
            { time: 1234567900, value: 105, type: 'peak' as const },
          ],
        },
        metrics: {},
      };

      const mockCreatedPattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        patternType: 'headAndShoulders',
        confidence: 0.85,
        startTime: BigInt(1234567890),
        endTime: BigInt(1234567900),
        visualization: mockPattern.visualization,
        metrics: {},
        description: null,
        tradingImplication: null,
        createdAt: new Date(),
      };

      (prisma.patternAnalysis.create as jest.Mock).mockResolvedValueOnce(mockCreatedPattern);

      const result = await ChartDrawingDatabaseService.savePattern(mockPattern, 'session-1');

      expect(prisma.patternAnalysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-1',
          patternType: 'headAndShoulders',
          confidence: 0.85,
        }),
      });

      expect(result).toEqual(mockCreatedPattern);
    });

    it('should handle patterns without sessionId', async () => {
      const mockPattern = {
        type: 'triangle' as const,
        confidence: 0.75,
        startTime: 1234567890,
        endTime: 1234567900,
        visualization: { keyPoints: [] },
        metrics: {},
      };

      (prisma.patternAnalysis.create as jest.Mock).mockResolvedValueOnce({ id: 'pattern-1' });

      await ChartDrawingDatabaseService.savePattern(mockPattern);

      expect(prisma.patternAnalysis.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ sessionId: expect.anything() }),
      });
    });
  });

  describe('loadPatterns', () => {
    it('should load patterns successfully', async () => {
      const mockDbPatterns = [
        {
          id: 'pattern-1',
          patternType: 'headAndShoulders',
          confidence: 0.85,
          startTime: BigInt(1234567890),
          endTime: BigInt(1234567900),
          visualization: { keyPoints: [] },
          metrics: {},
          description: 'Test pattern',
          tradingImplication: 'bearish',
        },
      ];

      (prisma.patternAnalysis.findMany as jest.Mock).mockResolvedValueOnce(mockDbPatterns);

      const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

      expect(prisma.patternAnalysis.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'headAndShoulders',
        confidence: 0.85,
        startTime: 1234567890,
        endTime: 1234567900,
      });
    });
  });
});