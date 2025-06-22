import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema';

// Mock dependencies before importing the service
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

jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => false),
}));

// This needs to be set before importing the service
const originalWindow = global.window;

describe('ChartDrawingDatabaseService', () => {
  let ChartDrawingDatabaseService: any;
  let prisma: any;
  let logger: any;
  let isDevelopment: any;
  
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

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Re-import mocked modules
    ({ prisma } = await import('@/lib/db/prisma'));
    ({ logger } = await import('@/lib/utils/logger'));
    ({ isDevelopment } = await import('@/config/env'));
  });

  describe('Browser environment handling', () => {
    beforeEach(async () => {
      // Set up browser environment
      (global as any).window = {};
      
      // Import service after setting up window
      ({ ChartDrawingDatabaseService } = await import('@/lib/services/database/chart-drawing.service'));
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it('should warn and return early in saveDrawings when in browser', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
      expect(prisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      expect(prisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should return empty array in loadDrawings when in browser (development)', async () => {
      (isDevelopment as jest.Mock).mockReturnValue(true);
      
      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');
      
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
    });

    it('should throw error in loadDrawings when in browser (production)', async () => {
      (isDevelopment as jest.Mock).mockReturnValue(false);
      
      await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
        'ChartDrawingDB cannot be used in browser environment'
      );
    });
  });

  describe('Server environment', () => {
    beforeEach(async () => {
      // Ensure no window object
      delete (global as any).window;
      
      // Import service after removing window
      ({ ChartDrawingDatabaseService } = await import('@/lib/services/database/chart-drawing.service'));
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
              type: 'horizontal',
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

        (prisma.chartDrawing.findMany as jest.Mock).mockResolvedValue(dbDrawings);

        const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'drawing-1',
          type: 'trendline',
        });
      });

      it('should handle database unavailability', async () => {
        const { withDatabase } = await import('@/lib/utils/db-connection');
        (withDatabase as jest.Mock).mockImplementation((fn, fallbackFn) => fallbackFn());
        (isDevelopment as jest.Mock).mockReturnValue(true);

        const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

        expect(result).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith(
          '[ChartDrawingDB] Database unavailable, returning empty array',
          { sessionId: 'session-1' }
        );
      });

      it('should throw error in production when database unavailable', async () => {
        const { withDatabase } = await import('@/lib/utils/db-connection');
        (withDatabase as jest.Mock).mockImplementation((fn, fallbackFn) => fallbackFn());
        (isDevelopment as jest.Mock).mockReturnValue(false);

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

        (prisma.chartDrawing.upsert as jest.Mock).mockResolvedValue(dbDrawing);

        const result = await ChartDrawingDatabaseService.saveDrawing(drawing, 'session-1');

        expect(result).toEqual(dbDrawing);
        expect(prisma.chartDrawing.upsert).toHaveBeenCalled();
      });

      it('should return null in browser environment', async () => {
        // Temporarily add window
        (global as any).window = {};
        
        // Re-import to get browser version
        jest.resetModules();
        const { ChartDrawingDatabaseService: BrowserService } = await import('@/lib/services/database/chart-drawing.service');
        
        const result = await BrowserService.saveDrawing(mockDrawings[0], 'session-1');
        
        expect(result).toBeNull();
        
        // Clean up
        delete (global as any).window;
      });
    });

    describe('deleteDrawing', () => {
      it('should delete drawing successfully', async () => {
        await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

        expect(prisma.chartDrawing.delete).toHaveBeenCalledWith({
          where: { id: 'drawing-1' },
        });
      });

      it('should handle delete errors', async () => {
        const error = new Error('Not found');
        (prisma.chartDrawing.delete as jest.Mock).mockRejectedValue(error);

        await expect(ChartDrawingDatabaseService.deleteDrawing('non-existent')).rejects.toThrow('Not found');
      });
    });

    describe('savePattern', () => {
      it('should save pattern successfully', async () => {
        const pattern = {
          id: 'pattern-1',
          type: 'triangle',
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: 1234567890,
          endTime: 1234567900,
          confidence: 0.8,
          tradingImplication: 'bullish',
          visualization: { lines: [], zones: [], markers: [] },
        };

        const dbPattern = {
          id: 'db-pattern-1',
          sessionId: 'session-1',
          ...pattern,
        };

        (prisma.patternAnalysis.create as jest.Mock).mockResolvedValue(dbPattern);

        const result = await ChartDrawingDatabaseService.savePattern(pattern, 'session-1');

        expect(result).toEqual(dbPattern);
        expect(logger.info).toHaveBeenCalledWith(
          '[ChartDrawingDB] Pattern saved',
          expect.objectContaining({ patternId: 'db-pattern-1' })
        );
      });

      it('should handle patterns without sessionId', async () => {
        const pattern = {
          id: 'pattern-1',
          type: 'triangle',
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: 1234567890,
          endTime: 1234567900,
          confidence: 0.8,
          tradingImplication: 'bullish',
          visualization: { lines: [], zones: [], markers: [] },
        };

        (prisma.patternAnalysis.create as jest.Mock).mockResolvedValue({ id: 'db-pattern-1' });

        await ChartDrawingDatabaseService.savePattern(pattern);

        expect(prisma.patternAnalysis.create).toHaveBeenCalled();
      });
    });

    describe('loadPatterns', () => {
      it('should load patterns successfully', async () => {
        const dbPatterns = [
          {
            id: 'pattern-1',
            type: 'triangle',
            symbol: 'BTCUSDT',
            interval: '1h',
            startTime: BigInt(1234567890),
            endTime: BigInt(1234567900),
            confidence: 0.8,
            tradingImplication: 'bullish',
            visualization: {},
            metrics: {},
            description: null,
          },
        ];

        (prisma.patternAnalysis.findMany as jest.Mock).mockResolvedValue(dbPatterns);

        const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'pattern-1',
          type: 'triangle',
        });
      });
    });
  });

  // Restore original window state
  afterEach(() => {
    if (originalWindow) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
  });
});