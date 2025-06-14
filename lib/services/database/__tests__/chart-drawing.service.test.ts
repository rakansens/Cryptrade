import { ChartDrawingDatabaseService } from '../chart-drawing.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

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
    $connect: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ChartDrawingDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window object to simulate server environment
    Object.defineProperty(window, 'window', {
      value: undefined,
      writable: true,
    });
  });

  describe('Browser environment checks', () => {
    beforeEach(() => {
      // Simulate browser environment
      Object.defineProperty(window, 'window', {
        value: {},
        writable: true,
      });
    });

    it('should return early from saveDrawings in browser', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-123');
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
    });

    it('should return empty array from loadDrawings in browser', async () => {
      const result = await ChartDrawingDatabaseService.loadDrawings('session-123');
      
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
    });

    it('should return null from saveDrawing in browser', async () => {
      const drawing = {
        id: 'drawing-1',
        type: 'trendline' as const,
        points: [{ time: 1000, value: 100 }],
        style: { color: '#00ff00' },
      };
      
      const result = await ChartDrawingDatabaseService.saveDrawing(drawing);
      
      expect(result).toBeNull();
      expect(prisma.chartDrawing.upsert).not.toHaveBeenCalled();
    });
  });

  describe('saveDrawings', () => {
    beforeEach(() => {
      // Simulate server environment
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should delete existing and create new drawings', async () => {
      const drawings = [
        {
          id: 'drawing-1',
          type: 'trendline' as const,
          points: [{ time: 1000, value: 100 }, { time: 2000, value: 110 }],
          style: { color: '#00ff00', lineWidth: 2 },
          visible: true,
          interactive: true,
        },
        {
          id: 'drawing-2',
          type: 'horizontal' as const,
          price: 50000,
          style: { color: '#ff0000' },
        },
      ];

      await ChartDrawingDatabaseService.saveDrawings(drawings, 'session-123');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
      });

      expect(prisma.chartDrawing.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: 'drawing-1',
            sessionId: 'session-123',
            type: 'trendline',
            points: drawings[0].points,
            style: drawings[0].style,
            price: null,
            time: null,
            levels: null,
            metadata: null,
            visible: true,
            interactive: true,
          },
          {
            id: 'drawing-2',
            sessionId: 'session-123',
            type: 'horizontal',
            points: undefined,
            style: drawings[1].style,
            price: 50000,
            time: null,
            levels: null,
            metadata: null,
            visible: true,
            interactive: true,
          },
        ],
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDrawingDB] Drawings saved',
        { count: 2, sessionId: 'session-123' }
      );
    });

    it('should handle empty drawings array', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-123');

      expect(prisma.chartDrawing.deleteMany).toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (prisma.chartDrawing.deleteMany as jest.Mock).mockRejectedValue(error);

      await expect(
        ChartDrawingDatabaseService.saveDrawings([{ id: '1', type: 'trendline' }])
      ).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDrawingDB] Failed to save drawings',
        { error }
      );
    });
  });

  describe('loadDrawings', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should load and convert drawings', async () => {
      const dbDrawings = [
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [{ time: 1000, value: 100 }],
          style: { color: '#00ff00' },
          price: null,
          time: BigInt(1234567890),
          levels: null,
          metadata: { custom: 'data' },
          visible: true,
          interactive: false,
          createdAt: new Date(),
        },
      ];

      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValue(dbDrawings);

      const result = await ChartDrawingDatabaseService.loadDrawings('session-123');

      expect(prisma.$connect).toHaveBeenCalled();
      expect(prisma.chartDrawing.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toEqual([
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [{ time: 1000, value: 100 }],
          style: { color: '#00ff00' },
          price: undefined,
          time: 1234567890,
          levels: null,
          metadata: { custom: 'data' },
          visible: true,
          interactive: false,
        },
      ]);
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Connection failed');
      (prisma.$connect as jest.Mock).mockRejectedValue(error);

      const result = await ChartDrawingDatabaseService.loadDrawings();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDrawingDB] Failed to load drawings',
        {
          error: 'Connection failed',
          stack: expect.any(String),
        }
      );
    });
  });

  describe('saveDrawing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should upsert a single drawing', async () => {
      const drawing = {
        id: 'drawing-1',
        type: 'fibonacci' as const,
        points: [{ time: 1000, value: 100 }],
        levels: [0, 0.236, 0.382, 0.5, 0.618, 1],
        style: { color: '#00ff00' },
        metadata: { symbol: 'BTCUSDT' },
      };

      const dbDrawing = { ...drawing, createdAt: new Date() };
      (prisma.chartDrawing.upsert as jest.Mock).mockResolvedValue(dbDrawing);

      const result = await ChartDrawingDatabaseService.saveDrawing(drawing, 'session-123');

      expect(prisma.chartDrawing.upsert).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
        update: {
          type: 'fibonacci',
          points: drawing.points,
          style: drawing.style,
          price: null,
          time: null,
          levels: drawing.levels,
          metadata: drawing.metadata,
          visible: true,
          interactive: true,
        },
        create: {
          id: 'drawing-1',
          sessionId: 'session-123',
          type: 'fibonacci',
          points: drawing.points,
          style: drawing.style,
          price: null,
          time: null,
          levels: drawing.levels,
          metadata: drawing.metadata,
          visible: true,
          interactive: true,
        },
      });

      expect(result).toBe(dbDrawing);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDrawingDB] Drawing saved',
        { drawingId: 'drawing-1', type: 'fibonacci' }
      );
    });
  });

  describe('deleteDrawing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should delete a drawing by id', async () => {
      await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

      expect(prisma.chartDrawing.delete).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDrawingDB] Drawing deleted',
        { drawingId: 'drawing-1' }
      );
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Drawing not found');
      (prisma.chartDrawing.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        ChartDrawingDatabaseService.deleteDrawing('non-existent')
      ).rejects.toThrow('Drawing not found');

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDrawingDB] Failed to delete drawing',
        { error }
      );
    });
  });

  describe('Pattern operations', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should save pattern analysis', async () => {
      const pattern = {
        id: 'pattern-1',
        type: 'headAndShoulders' as const,
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: 1000000,
        endTime: 2000000,
        confidence: 0.85,
        visualization: { lines: [] },
        metrics: { height: 500 },
        description: 'Clear head and shoulders pattern',
        tradingImplication: 'bearish' as const,
      };

      const dbPattern = {
        ...pattern,
        startTime: BigInt(pattern.startTime),
        endTime: BigInt(pattern.endTime),
        confidence: pattern.confidence,
        createdAt: new Date(),
      };

      (prisma.patternAnalysis.create as jest.Mock).mockResolvedValue(dbPattern);

      const result = await ChartDrawingDatabaseService.savePattern(pattern, 'session-123');

      expect(prisma.patternAnalysis.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          type: 'headAndShoulders',
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: BigInt(1000000),
          endTime: BigInt(2000000),
          confidence: 0.85,
          visualization: pattern.visualization,
          metrics: pattern.metrics,
          description: pattern.description,
          tradingImplication: 'bearish',
        },
      });

      expect(result).toBe(dbPattern);
    });

    it('should load and convert patterns', async () => {
      const dbPatterns = [
        {
          id: 'pattern-1',
          type: 'doubleTop',
          symbol: 'ETHUSDT',
          interval: '4h',
          startTime: BigInt(1000000),
          endTime: BigInt(2000000),
          confidence: 0.75,
          visualization: {},
          metrics: {},
          description: 'Double top formation',
          tradingImplication: 'bearish',
          createdAt: new Date(),
        },
      ];

      (prisma.patternAnalysis.findMany as jest.Mock).mockResolvedValue(dbPatterns);

      const result = await ChartDrawingDatabaseService.loadPatterns('session-123');

      expect(result).toEqual([
        {
          id: 'pattern-1',
          type: 'doubleTop',
          symbol: 'ETHUSDT',
          interval: '4h',
          startTime: 1000000,
          endTime: 2000000,
          confidence: 0.75,
          visualization: {},
          metrics: {},
          description: 'Double top formation',
          tradingImplication: 'bearish',
        },
      ]);
    });

    it('should delete pattern', async () => {
      await ChartDrawingDatabaseService.deletePattern('pattern-1');

      expect(prisma.patternAnalysis.delete).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
      });
    });
  });

  describe('migrateFromLocalStorage', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should migrate drawings and patterns', async () => {
      const drawings = [
        { id: 'd1', type: 'trendline' as const, points: [] },
        { id: 'd2', type: 'horizontal' as const, price: 50000 },
      ];
      
      const patterns = [
        {
          id: 'p1',
          type: 'flag' as const,
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: 1000,
          endTime: 2000,
          confidence: 0.8,
          visualization: {},
          tradingImplication: 'bullish' as const,
        },
      ];

      // Mock the internal methods
      const saveDrawingsSpy = jest.spyOn(ChartDrawingDatabaseService, 'saveDrawings');
      const savePatternSpy = jest.spyOn(ChartDrawingDatabaseService, 'savePattern');

      await ChartDrawingDatabaseService.migrateFromLocalStorage(
        drawings,
        patterns,
        'session-123'
      );

      expect(saveDrawingsSpy).toHaveBeenCalledWith(drawings, 'session-123');
      expect(savePatternSpy).toHaveBeenCalledWith(patterns[0], 'session-123');

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDrawingDB] Migration completed',
        { drawingCount: 2, patternCount: 1 }
      );
    });
  });

  describe('getTimeframeDrawings', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should filter drawings by symbol and timeframe', async () => {
      const dbDrawings = [
        {
          id: 'd1',
          type: 'trendline',
          metadata: { symbol: 'BTCUSDT', timeframe: '1h' },
          points: [],
          style: {},
          visible: true,
          interactive: true,
        },
        {
          id: 'd2',
          type: 'horizontal',
          metadata: { symbol: 'BTCUSDT', timeframe: '4h' },
          points: [],
          style: {},
          visible: true,
          interactive: true,
        },
        {
          id: 'd3',
          type: 'trendline',
          metadata: { symbol: 'ETHUSDT', timeframe: '1h' },
          points: [],
          style: {},
          visible: true,
          interactive: true,
        },
      ];

      (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValue(dbDrawings);

      const result = await ChartDrawingDatabaseService.getTimeframeDrawings(
        'BTCUSDT',
        '1h',
        'session-123'
      );

      expect(prisma.chartDrawing.findMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-123',
          metadata: {
            path: ['symbol'],
            equals: 'BTCUSDT',
          },
        },
      });

      // Should only return BTCUSDT 1h drawing
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('d1');
    });
  });
});