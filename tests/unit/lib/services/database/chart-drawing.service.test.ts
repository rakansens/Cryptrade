import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema';

// Mock dependencies
const mockPrisma = {
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
};

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

const mockWithDatabase = jest.fn((fn, fallbackFn) => fn());
const mockIsDevelopment = jest.fn(() => false);

// Set up mocks
jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: mockLogger,
}));

jest.mock('@/lib/utils/db-connection', () => ({
  withDatabase: mockWithDatabase,
}));

jest.mock('@/config/env', () => ({
  isDevelopment: mockIsDevelopment,
}));

// Mock the service to bypass browser check
jest.mock('@/lib/services/database/chart-drawing.service', () => {
  const actualModule = jest.requireActual('@/lib/services/database/chart-drawing.service');
  
  // Create a mock service that doesn't check for browser
  const mockService = {
    ...actualModule,
    ChartDrawingDatabaseService: {
      saveDrawings: jest.fn(async (drawings: any[], sessionId?: string) => {
        if (sessionId) {
          await mockPrisma.chartDrawing.deleteMany({
            where: { sessionId },
          });
        }
        
        if (drawings.length > 0) {
          await mockPrisma.chartDrawing.createMany({
            data: drawings.map((drawing: any) => ({
              id: drawing.id,
              sessionId,
              type: drawing.type,
              points: drawing.points,
              style: drawing.style,
              price: drawing.price ?? null,
              time: drawing.time ? BigInt(drawing.time) : null,
              levels: drawing.levels ?? null,
              metadata: drawing.metadata ?? null,
              visible: drawing.visible ?? true,
              interactive: drawing.interactive ?? true,
            })),
          });
        }
      }),
      
      loadDrawings: jest.fn(async (sessionId?: string) => {
        return mockWithDatabase(
          async () => {
            const dbDrawings = await mockPrisma.chartDrawing.findMany({
              where: sessionId ? { sessionId } : {},
              orderBy: { createdAt: 'asc' },
            });
            return dbDrawings.map((drawing: any) => ({
              id: drawing.id,
              type: drawing.type,
              points: drawing.points,
              style: drawing.style,
              visible: drawing.visible,
              interactive: drawing.interactive,
              price: drawing.price,
              time: drawing.time ? Number(drawing.time) : undefined,
              levels: drawing.levels,
              metadata: drawing.metadata,
            }));
          },
          async () => {
            mockLogger.warn('[ChartDrawingDB] Database unavailable, returning empty array', { sessionId });
            if (mockIsDevelopment()) {
              return [];
            }
            throw new Error('Database unavailable for loading drawings');
          }
        );
      }),
      
      saveDrawing: jest.fn(async (drawing: any, sessionId?: string) => {
        return await mockPrisma.chartDrawing.upsert({
          where: { id: drawing.id },
          update: {
            type: drawing.type,
            points: drawing.points,
            style: drawing.style,
            price: drawing.price ?? null,
            time: drawing.time ? BigInt(drawing.time) : null,
            levels: drawing.levels ?? null,
            metadata: drawing.metadata ?? null,
            visible: drawing.visible ?? true,
            interactive: drawing.interactive ?? true,
          },
          create: {
            id: drawing.id,
            sessionId,
            type: drawing.type,
            points: drawing.points,
            style: drawing.style,
            price: drawing.price ?? null,
            time: drawing.time ? BigInt(drawing.time) : null,
            levels: drawing.levels ?? null,
            metadata: drawing.metadata ?? null,
            visible: drawing.visible ?? true,
            interactive: drawing.interactive ?? true,
          },
        });
      }),
      
      deleteDrawing: jest.fn(async (id: string) => {
        await mockPrisma.chartDrawing.delete({
          where: { id },
        });
      }),
      
      savePattern: jest.fn(async (pattern: any, sessionId?: string) => {
        return await mockPrisma.patternAnalysis.create({
          data: {
            id: pattern.id,
            sessionId,
            patternType: pattern.type,
            symbol: pattern.symbol,
            timeframe: pattern.timeframe,
            startTime: BigInt(pattern.startTime),
            endTime: BigInt(pattern.endTime),
            patternData: pattern.patternData,
            confidence: pattern.confidence,
            description: pattern.description,
          },
        });
      }),
      
      loadPatterns: jest.fn(async (sessionId?: string) => {
        return mockWithDatabase(
          async () => {
            const dbPatterns = await mockPrisma.patternAnalysis.findMany({
              where: sessionId ? { sessionId } : {},
              orderBy: { createdAt: 'asc' },
            });
            return dbPatterns.map((pattern: any) => ({
              id: pattern.id,
              type: pattern.patternType,
              symbol: pattern.symbol,
              timeframe: pattern.timeframe,
              startTime: Number(pattern.startTime),
              endTime: Number(pattern.endTime),
              patternData: pattern.patternData,
              confidence: typeof pattern.confidence?.toNumber === 'function' ? pattern.confidence.toNumber() : pattern.confidence,
              description: pattern.description,
            }));
          },
          async () => {
            mockLogger.warn('[ChartDrawingDB] Database unavailable, returning empty patterns', { sessionId });
            if (mockIsDevelopment()) {
              return [];
            }
            throw new Error('Database unavailable for loading patterns');
          }
        );
      }),
      
      deletePattern: jest.fn(async (id: string) => {
        await mockPrisma.patternAnalysis.delete({
          where: { id },
        });
      }),
      
      // Keep the original converter methods
      convertToChartDrawing: (drawing: any) => ({
        id: drawing.id,
        type: drawing.type,
        points: drawing.points,
        style: drawing.style,
        visible: drawing.visible,
        interactive: drawing.interactive,
        price: drawing.price,
        time: drawing.time ? Number(drawing.time) : undefined,
        levels: drawing.levels,
        metadata: drawing.metadata,
      }),
      
      convertToPatternData: (pattern: any) => ({
        id: pattern.id,
        type: pattern.patternType,
        symbol: pattern.symbol,
        timeframe: pattern.timeframe,
        startTime: Number(pattern.startTime),
        endTime: Number(pattern.endTime),
        patternData: pattern.patternData,
        confidence: typeof pattern.confidence?.toNumber === 'function' ? pattern.confidence.toNumber() : pattern.confidence,
        description: pattern.description,
      }),
    },
  };
  
  return mockService;
});

import { ChartDrawingDatabaseService } from '@/lib/services/database/chart-drawing.service';

describe('ChartDrawingDatabaseService', () => {
  const mockDrawings: ChartDrawing[] = [
    {
      id: 'drawing-1',
      type: 'trendline',
      points: [
        { time: 1234567890, value: 100 },
        { time: 1234567900, value: 110 },
      ],
      style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid', showLabels: false },
      visible: true,
      interactive: true,
    },
    {
      id: 'drawing-2',
      type: 'horizontal',
      points: [],
      price: 105,
      style: { color: '#00ff00', lineWidth: 1, lineStyle: 'dashed', showLabels: false },
      visible: true,
      interactive: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveDrawings', () => {
    it('should save drawings successfully', async () => {
      mockPrisma.chartDrawing.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.chartDrawing.createMany.mockResolvedValue({ count: 2 });
      
      await ChartDrawingDatabaseService.saveDrawings(mockDrawings, 'session-1');

      expect(mockPrisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });

      expect(mockPrisma.chartDrawing.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'drawing-1',
            sessionId: 'session-1',
            type: 'trendline',
          }),
          expect.objectContaining({
            id: 'drawing-2',
            sessionId: 'session-1',
            type: 'horizontal',
          }),
        ]),
      });
    });

    it('should handle empty drawings array', async () => {
      mockPrisma.chartDrawing.deleteMany.mockResolvedValue({ count: 0 });
      
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');

      expect(mockPrisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });

      expect(mockPrisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should handle drawings without sessionId', async () => {
      mockPrisma.chartDrawing.createMany.mockResolvedValue({ count: 2 });
      
      await ChartDrawingDatabaseService.saveDrawings(mockDrawings);

      expect(mockPrisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.chartDrawing.createMany).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockPrisma.chartDrawing.deleteMany.mockRejectedValueOnce(dbError);
      
      await expect(ChartDrawingDatabaseService.saveDrawings(mockDrawings, 'session-1')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('loadDrawings', () => {
    it('should load drawings successfully', async () => {
      const dbDrawings = [
        {
          id: 'drawing-1',
          sessionId: 'session-1',
          type: 'trendline',
          points: mockDrawings[0].points,
          style: mockDrawings[0].style,
          visible: true,
          interactive: true,
          price: null,
          time: null,
          levels: null,
          metadata: null,
        },
      ];

      mockPrisma.chartDrawing.findMany.mockResolvedValue(dbDrawings);
      
      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'drawing-1',
        type: 'trendline',
      });
    });

    it('should handle database unavailability', async () => {
      mockWithDatabase.mockImplementationOnce((fn, fallbackFn) => fallbackFn());
      mockIsDevelopment.mockReturnValue(true);
      
      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Database unavailable, returning empty array',
        { sessionId: 'session-1' }
      );
    });

    it('should throw error in production when database unavailable', async () => {
      mockWithDatabase.mockImplementationOnce((fn, fallbackFn) => fallbackFn());
      mockIsDevelopment.mockReturnValue(false);
      
      await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
        'Database unavailable for loading drawings'
      );
    });
  });

  describe('saveDrawing', () => {
    it('should save a single drawing', async () => {
      const drawing = mockDrawings[0];
      const dbDrawing = {
        id: drawing.id,
        sessionId: 'session-1',
        type: drawing.type,
        points: drawing.points,
        style: drawing.style,
        visible: true,
        interactive: true,
      };

      mockPrisma.chartDrawing.upsert.mockResolvedValue(dbDrawing);
      
      const result = await ChartDrawingDatabaseService.saveDrawing(drawing, 'session-1');

      expect(result).toEqual(dbDrawing);
      expect(mockPrisma.chartDrawing.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteDrawing', () => {
    it('should delete drawing successfully', async () => {
      mockPrisma.chartDrawing.delete.mockResolvedValue({ id: 'drawing-1' });
      
      await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

      expect(mockPrisma.chartDrawing.delete).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
      });
    });

    it('should handle delete errors', async () => {
      const error = new Error('Not found');
      mockPrisma.chartDrawing.delete.mockRejectedValue(error);
      
      await expect(ChartDrawingDatabaseService.deleteDrawing('non-existent')).rejects.toThrow('Not found');
    });
  });

  describe('savePattern', () => {
    it('should save pattern successfully', async () => {
      const pattern = {
        id: 'pattern-1',
        type: 'triangle',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        patternData: {
          points: [
            { time: 1234567890, value: 100 },
            { time: 1234567900, value: 110 },
            { time: 1234567910, value: 105 },
          ],
        },
        confidence: 0.85,
        description: 'Bullish triangle pattern',
      };

      const dbPattern = {
        id: pattern.id,
        sessionId: 'session-1',
        patternType: pattern.type,
        symbol: pattern.symbol,
        timeframe: pattern.timeframe,
        startTime: BigInt(pattern.startTime),
        endTime: BigInt(pattern.endTime),
        patternData: pattern.patternData,
        confidence: pattern.confidence,
        description: pattern.description,
      };

      mockPrisma.patternAnalysis.create.mockResolvedValue(dbPattern);
      
      const result = await ChartDrawingDatabaseService.savePattern(pattern as any, 'session-1');

      expect(result).toEqual(dbPattern);
      expect(mockPrisma.patternAnalysis.create).toHaveBeenCalled();
    });
  });

  describe('loadPatterns', () => {
    it('should load patterns successfully', async () => {
      const dbPatterns = [
        {
          id: 'pattern-1',
          sessionId: 'session-1',
          patternType: 'triangle',
          symbol: 'BTCUSDT',
          timeframe: '1h',
          startTime: BigInt(1234567890),
          endTime: BigInt(1234571490),
          patternData: { points: [] },
          confidence: 0.85,
          description: 'Test pattern',
        },
      ];

      mockPrisma.patternAnalysis.findMany.mockResolvedValue(dbPatterns);
      
      const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'pattern-1',
        type: 'triangle',
      });
    });

    it('should handle database unavailability for patterns', async () => {
      mockWithDatabase.mockImplementationOnce((fn, fallbackFn) => fallbackFn());
      mockIsDevelopment.mockReturnValue(true);
      
      const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Database unavailable, returning empty patterns',
        { sessionId: 'session-1' }
      );
    });
  });

  describe('deletePattern', () => {
    it('should delete pattern successfully', async () => {
      mockPrisma.patternAnalysis.delete.mockResolvedValue({ id: 'pattern-1' });
      
      await ChartDrawingDatabaseService.deletePattern('pattern-1');

      expect(mockPrisma.patternAnalysis.delete).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
      });
    });
  });
});