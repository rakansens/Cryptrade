import { ChartDrawingDatabaseService } from '../chart-drawing.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { withDatabase } from '@/lib/utils/db-connection';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';
import type { ChartDrawing as PrismaChartDrawing, PatternAnalysis } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    chartDrawing: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    patternAnalysis: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/db-connection');

// Mock browser environment
const mockWindow = global.window;

describe('ChartDrawingDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window to simulate server environment by default
    delete (global as any).window;
    // Mock withDatabase to execute the main function directly
    (withDatabase as jest.Mock).mockImplementation(async (mainFn) => mainFn());
  });

  afterEach(() => {
    // Restore window if it was originally defined
    if (mockWindow) {
      global.window = mockWindow;
    }
  });

  describe('Browser environment handling', () => {
    beforeEach(() => {
      // Simulate browser environment
      global.window = {} as any;
    });

    it('should warn and return early in saveDrawings when in browser', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');
      
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');
      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
    });

    it('should return empty array in loadDrawings when in browser (development)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');
      
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');

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
    beforeEach(() => {
      delete (global as any).window; // Ensure server environment
    });

    it('should save drawings successfully', async () => {
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
          style: { color: '#FF0000', width: 2 },
          visible: true,
          interactive: true,
        },
        {
          id: 'drawing-2',
          type: 'horizontalLine',
          points: [{ x: 0, y: 50 }],
          price: 50000,
          time: 1640995200000,
        },
      ];

      await ChartDrawingDatabaseService.saveDrawings(drawings, 'session-1');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });

      expect(prisma.chartDrawing.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: 'drawing-1',
            sessionId: 'session-1',
            type: 'trendline',
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            style: { color: '#FF0000', width: 2 },
            price: null,
            time: null,
            levels: null,
            metadata: null,
            visible: true,
            interactive: true,
          },
          {
            id: 'drawing-2',
            sessionId: 'session-1',
            type: 'horizontalLine',
            points: [{ x: 0, y: 50 }],
            style: undefined,
            price: 50000,
            time: BigInt(1640995200000),
            levels: null,
            metadata: null,
            visible: true,
            interactive: true,
          },
        ],
      });

      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Drawings saved', {
        count: 2,
        sessionId: 'session-1',
      });
    });

    it('should handle empty drawings array', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should handle drawings without sessionId', async () => {
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'rectangle',
          points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        },
      ];

      await ChartDrawingDatabaseService.saveDrawings(drawings);

      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({
          id: 'drawing-1',
          sessionId: undefined,
          type: 'rectangle',
        })],
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (prisma.chartDrawing.deleteMany as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChartDrawingDatabaseService.saveDrawings([], 'session-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingDB] Failed to save drawings', { error });
    });
  });

  describe('loadDrawings', () => {
    const mockDbDrawings: PrismaChartDrawing[] = [
      {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'trendline',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        style: { color: '#FF0000' },
        price: null,
        time: null,
        levels: null,
        metadata: null,
        visible: true,
        interactive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'drawing-2',
        sessionId: 'session-1',
        type: 'fibonacci',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        style: {},
        price: new Decimal(50000),
        time: BigInt(1640995200000),
        levels: [0, 0.236, 0.382, 0.5, 0.618, 1],
        metadata: { symbol: 'BTCUSDT' },
        visible: false,
        interactive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should load drawings successfully', async () => {
      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValueOnce(mockDbDrawings);

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(prisma.chartDrawing.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'drawing-1',
        type: 'trendline',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        style: { color: '#FF0000' },
        visible: true,
        interactive: true,
      });
      expect(result[1]).toEqual({
        id: 'drawing-2',
        type: 'fibonacci',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        style: {},
        price: 50000,
        time: 1640995200000,
        levels: [0, 0.236, 0.382, 0.5, 0.618, 1],
        metadata: { symbol: 'BTCUSDT' },
        visible: false,
        interactive: false,
      });
    });

    it('should handle database unavailability', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      (withDatabase as jest.Mock).mockImplementation(async (mainFn, fallbackFn) => fallbackFn());

      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingDB] Database unavailable, returning empty array', {
        sessionId: 'session-1',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production when database unavailable', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      (withDatabase as jest.Mock).mockImplementation(async (mainFn, fallbackFn) => fallbackFn());

      await expect(ChartDrawingDatabaseService.loadDrawings()).rejects.toThrow('Database unavailable for loading drawings');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('saveDrawing', () => {
    it('should save a single drawing', async () => {
      const drawing: ChartDrawing = {
        id: 'drawing-1',
        type: 'verticalLine',
        points: [{ x: 50, y: 0 }],
        time: 1640995200000,
      };

      const mockDbDrawing = {
        ...drawing,
        sessionId: 'session-1',
        time: BigInt(1640995200000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.chartDrawing.upsert as jest.Mock).mockResolvedValueOnce(mockDbDrawing);

      const result = await ChartDrawingDatabaseService.saveDrawing(drawing, 'session-1');

      expect(prisma.chartDrawing.upsert).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
        update: expect.objectContaining({
          type: 'verticalLine',
          points: [{ x: 50, y: 0 }],
          time: BigInt(1640995200000),
        }),
        create: expect.objectContaining({
          id: 'drawing-1',
          sessionId: 'session-1',
          type: 'verticalLine',
        }),
      });

      expect(result).toEqual(mockDbDrawing);
      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Drawing saved', {
        drawingId: 'drawing-1',
        type: 'verticalLine',
      });
    });

    it('should return null in browser environment', async () => {
      global.window = {} as any;

      const result = await ChartDrawingDatabaseService.saveDrawing({ id: 'test', type: 'trendline', points: [] });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingDB] Cannot use database in browser environment');
    });
  });

  describe('deleteDrawing', () => {
    it('should delete drawing successfully', async () => {
      await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

      expect(prisma.chartDrawing.delete).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
      });
      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Drawing deleted', { drawingId: 'drawing-1' });
    });

    it('should handle delete errors', async () => {
      const error = new Error('Not found');
      (prisma.chartDrawing.delete as jest.Mock).mockRejectedValueOnce(error);

      await expect(ChartDrawingDatabaseService.deleteDrawing('invalid-id')).rejects.toThrow('Not found');
      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingDB] Failed to delete drawing', { error });
    });
  });

  describe('savePattern', () => {
    it('should save pattern successfully', async () => {
      const pattern: PatternData = {
        id: 'pattern-1',
        type: 'triangle',
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: 1640995200000,
        endTime: 1641081600000,
        confidence: 0.85,
        visualization: {
          points: [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }],
          lines: [],
          areas: [],
        },
        metrics: {
          breakoutProbability: 0.7,
          targetPrice: 55000,
        },
        description: 'Ascending triangle pattern',
        tradingImplication: 'Bullish breakout expected',
      };

      const mockDbPattern = {
        id: 'db-pattern-1',
        sessionId: 'session-1',
        ...pattern,
        startTime: BigInt(pattern.startTime),
        endTime: BigInt(pattern.endTime),
        confidence: new Decimal(pattern.confidence),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.patternAnalysis.create as jest.Mock).mockResolvedValueOnce(mockDbPattern);

      const result = await ChartDrawingDatabaseService.savePattern(pattern, 'session-1');

      expect(prisma.patternAnalysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'triangle',
          symbol: 'BTCUSDT',
          sessionId: 'session-1',
          startTime: BigInt(1640995200000),
          endTime: BigInt(1641081600000),
          confidence: 0.85,
        }),
      });

      expect(result).toEqual(mockDbPattern);
      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Pattern saved', {
        patternId: 'db-pattern-1',
        type: 'triangle',
      });
    });

    it('should handle patterns without sessionId', async () => {
      const pattern: PatternData = {
        id: 'pattern-1',
        type: 'flag',
        symbol: 'ETHUSDT',
        interval: '4h',
        startTime: 1640995200000,
        endTime: 1641081600000,
        confidence: 0.75,
        visualization: { points: [], lines: [], areas: [] },
        tradingImplication: 'Continuation pattern',
      };

      (prisma.patternAnalysis.create as jest.Mock).mockResolvedValueOnce({});

      await ChartDrawingDatabaseService.savePattern(pattern);

      const createCall = (prisma.patternAnalysis.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.sessionId).toBeUndefined();
    });
  });

  describe('loadPatterns', () => {
    const mockDbPatterns: PatternAnalysis[] = [
      {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'head-and-shoulders',
        symbol: 'BTCUSDT',
        interval: '1d',
        startTime: BigInt(1640995200000),
        endTime: BigInt(1641081600000),
        confidence: new Decimal(0.9),
        visualization: {
          points: [],
          lines: [],
          areas: [],
        },
        metrics: {},
        description: 'Classic head and shoulders',
        tradingImplication: 'Bearish reversal',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should load patterns successfully', async () => {
      (prisma.patternAnalysis.findMany as jest.Mock).mockResolvedValueOnce(mockDbPatterns);

      const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

      expect(prisma.patternAnalysis.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'pattern-1',
        type: 'head-and-shoulders',
        symbol: 'BTCUSDT',
        interval: '1d',
        startTime: 1640995200000,
        endTime: 1641081600000,
        confidence: 0.9,
        visualization: {
          points: [],
          lines: [],
          areas: [],
        },
        metrics: {},
        description: 'Classic head and shoulders',
        tradingImplication: 'Bearish reversal',
      });
    });
  });

  describe('getTimeframeDrawings', () => {
    it('should filter drawings by symbol and timeframe', async () => {
      const mockDbDrawings = [
        {
          id: 'drawing-1',
          metadata: { symbol: 'BTCUSDT', timeframe: '1h' },
          type: 'trendline',
          points: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'drawing-2',
          metadata: { symbol: 'BTCUSDT', timeframe: '4h' },
          type: 'horizontalLine',
          points: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValueOnce(mockDbDrawings);

      const result = await ChartDrawingDatabaseService.getTimeframeDrawings('BTCUSDT', '1h', 'session-1');

      expect(prisma.chartDrawing.findMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-1',
          metadata: {
            path: ['symbol'],
            equals: 'BTCUSDT',
          },
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('drawing-1');
    });

    it('should handle drawings without metadata', async () => {
      const mockDbDrawings = [
        {
          id: 'drawing-1',
          metadata: null,
          type: 'trendline',
          points: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'drawing-2',
          metadata: { symbol: 'BTCUSDT' }, // Missing timeframe
          type: 'horizontalLine',
          points: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValueOnce(mockDbDrawings);

      const result = await ChartDrawingDatabaseService.getTimeframeDrawings('BTCUSDT', '1h');

      expect(result).toHaveLength(0);
    });
  });

  describe('migrateFromLocalStorage', () => {
    it('should migrate drawings and patterns', async () => {
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [],
        },
      ];

      const patterns: PatternData[] = [
        {
          id: 'pattern-1',
          type: 'triangle',
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: 1640995200000,
          endTime: 1641081600000,
          confidence: 0.8,
          visualization: { points: [], lines: [], areas: [] },
          tradingImplication: 'Bullish',
        },
      ];

      await ChartDrawingDatabaseService.migrateFromLocalStorage(drawings, patterns, 'session-1');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).toHaveBeenCalled();
      expect(prisma.patternAnalysis.create).toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Starting migration from localStorage');
      expect(logger.info).toHaveBeenCalledWith('[ChartDrawingDB] Migration completed', {
        drawingCount: 1,
        patternCount: 1,
      });
    });

    it('should handle migration errors', async () => {
      const error = new Error('Migration failed');
      (prisma.chartDrawing.deleteMany as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        ChartDrawingDatabaseService.migrateFromLocalStorage([{ id: 'test', type: 'trendline', points: [] }], [], 'session-1')
      ).rejects.toThrow('Migration failed');

      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingDB] Migration failed', { error });
    });
  });
});

// Helper to create Decimal mock
class Decimal {
  constructor(private value: number) {}
  toNumber() {
    return this.value;
  }
}