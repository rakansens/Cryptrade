import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema';

// Save original window state
const originalWindow = global.window;

// Mock dependencies before importing the service
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

// Clear any existing mocks
jest.unmock('@/lib/services/database/chart-drawing.service');
jest.unmock('@/lib/db/prisma');
jest.unmock('@/lib/utils/logger');
jest.unmock('@/lib/utils/db-connection');
jest.unmock('@/config/env');

// Set up mocks
jest.doMock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

jest.doMock('@/lib/utils/logger', () => ({
  logger: mockLogger,
}));

jest.doMock('@/lib/utils/db-connection', () => ({
  withDatabase: mockWithDatabase,
}));

jest.doMock('@/config/env', () => ({
  isDevelopment: mockIsDevelopment,
}));

describe('ChartDrawingDatabaseService', () => {
  let ChartDrawingDatabaseService: any;
  
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
    jest.resetModules();
  });

  describe('Browser environment handling', () => {
    beforeEach(() => {
      // Set up browser environment
      (global as any).window = {};
      
      jest.isolateModules(() => {
        // Import service after setting up window
        const module = require('@/lib/services/database/chart-drawing.service');
        ChartDrawingDatabaseService = module.ChartDrawingDatabaseService;
      });
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it('should warn and return early in saveDrawings when in browser', async () => {
      await ChartDrawingDatabaseService.saveDrawings([], 'session-1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
      expect(mockPrisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.chartDrawing.createMany).not.toHaveBeenCalled();
    });

    it('should return empty array in loadDrawings when in browser (development)', async () => {
      mockIsDevelopment.mockReturnValue(true);
      
      const result = await ChartDrawingDatabaseService.loadDrawings('session-1');
      
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ChartDrawingDB] Cannot use database in browser environment'
      );
    });

    it('should throw error in loadDrawings when in browser (production)', async () => {
      mockIsDevelopment.mockReturnValue(false);
      
      await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
        'ChartDrawingDB cannot be used in browser environment'
      );
    });
  });

  describe('Server environment', () => {
    beforeEach(() => {
      // Ensure no window object
      delete (global as any).window;
      
      jest.isolateModules(() => {
        // Import service after removing window
        const module = require('@/lib/services/database/chart-drawing.service');
        ChartDrawingDatabaseService = module.ChartDrawingDatabaseService;
      });
    });

    describe('saveDrawings', () => {
      it('should save drawings successfully', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockPrisma.chartDrawing.deleteMany.mockResolvedValue({ count: 0 });
          mockPrisma.chartDrawing.createMany.mockResolvedValue({ count: 2 });
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
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
      });

      it('should handle empty drawings array', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockPrisma.chartDrawing.deleteMany.mockResolvedValue({ count: 0 });
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await ChartDrawingDatabaseService.saveDrawings([], 'session-1');

          expect(mockPrisma.chartDrawing.deleteMany).toHaveBeenCalledWith({
            where: { sessionId: 'session-1' },
          });

          expect(mockPrisma.chartDrawing.createMany).not.toHaveBeenCalled();
        });
      });

      it('should handle drawings without sessionId', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockPrisma.chartDrawing.createMany.mockResolvedValue({ count: 2 });
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await ChartDrawingDatabaseService.saveDrawings(mockDrawings);

          expect(mockPrisma.chartDrawing.deleteMany).not.toHaveBeenCalled();
          expect(mockPrisma.chartDrawing.createMany).toHaveBeenCalled();
        });
      });

      it('should handle database errors', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          const dbError = new Error('Database error');
          mockPrisma.chartDrawing.deleteMany.mockRejectedValueOnce(dbError);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await expect(ChartDrawingDatabaseService.saveDrawings(mockDrawings, 'session-1')).rejects.toThrow(
            'Database error'
          );
        });
      });
    });

    describe('loadDrawings', () => {
      it('should load drawings successfully', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
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
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: 'drawing-1',
            type: 'trendline',
          });
        });
      });

      it('should handle database unavailability', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockWithDatabase.mockImplementation((fn, fallbackFn) => fallbackFn());
          mockIsDevelopment.mockReturnValue(true);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          const result = await ChartDrawingDatabaseService.loadDrawings('session-1');

          expect(result).toEqual([]);
          expect(mockLogger.warn).toHaveBeenCalledWith(
            '[ChartDrawingDB] Database unavailable, returning empty array',
            { sessionId: 'session-1' }
          );
        });
      });

      it('should throw error in production when database unavailable', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockWithDatabase.mockImplementation((fn, fallbackFn) => fallbackFn());
          mockIsDevelopment.mockReturnValue(false);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await expect(ChartDrawingDatabaseService.loadDrawings('session-1')).rejects.toThrow(
            'Database unavailable for loading drawings'
          );
        });
      });
    });

    describe('saveDrawing', () => {
      it('should save a single drawing', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
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
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          const result = await ChartDrawingDatabaseService.saveDrawing(drawing, 'session-1');

          expect(result).toEqual(dbDrawing);
          expect(mockPrisma.chartDrawing.upsert).toHaveBeenCalled();
        });
      });

      it('should return null in browser environment', async () => {
        // Temporarily add window
        (global as any).window = {};
        
        // Re-import to get browser version
        jest.resetModules();
        let BrowserService: any;
        jest.isolateModules(() => {
          const module = require('@/lib/services/database/chart-drawing.service');
          BrowserService = module.ChartDrawingDatabaseService;
        });
        
        const result = await BrowserService.saveDrawing(mockDrawings[0], 'session-1');
        
        expect(result).toBeNull();
        
        // Clean up
        delete (global as any).window;
      });
    });

    describe('deleteDrawing', () => {
      it('should delete drawing successfully', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          mockPrisma.chartDrawing.delete.mockResolvedValue({ id: 'drawing-1' });
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await ChartDrawingDatabaseService.deleteDrawing('drawing-1');

          expect(mockPrisma.chartDrawing.delete).toHaveBeenCalledWith({
            where: { id: 'drawing-1' },
          });
        });
      });

      it('should handle delete errors', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
          const error = new Error('Not found');
          mockPrisma.chartDrawing.delete.mockRejectedValue(error);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await expect(ChartDrawingDatabaseService.deleteDrawing('non-existent')).rejects.toThrow('Not found');
        });
      });
    });

    describe('savePattern', () => {
      it('should save pattern successfully', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
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

          mockPrisma.patternAnalysis.create.mockResolvedValue(dbPattern);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          const result = await ChartDrawingDatabaseService.savePattern(pattern, 'session-1');

          expect(result).toEqual(dbPattern);
          expect(mockLogger.info).toHaveBeenCalledWith(
            '[ChartDrawingDB] Pattern saved',
            expect.objectContaining({ patternId: 'db-pattern-1' })
          );
        });
      });

      it('should handle patterns without sessionId', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
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

          mockPrisma.patternAnalysis.create.mockResolvedValue({ id: 'db-pattern-1' });
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          await ChartDrawingDatabaseService.savePattern(pattern);

          expect(mockPrisma.patternAnalysis.create).toHaveBeenCalled();
        });
      });
    });

    describe('loadPatterns', () => {
      it('should load patterns successfully', async () => {
        jest.isolateModules(async () => {
          // Ensure server environment
          delete (global as any).window;
          
          // Set up mocks
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

          mockPrisma.patternAnalysis.findMany.mockResolvedValue(dbPatterns);
          
          jest.doMock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
          jest.doMock('@/lib/utils/logger', () => ({ logger: mockLogger }));
          jest.doMock('@/lib/utils/db-connection', () => ({ withDatabase: mockWithDatabase }));
          jest.doMock('@/config/env', () => ({ isDevelopment: mockIsDevelopment }));
          
          // Import service in server environment
          const { ChartDrawingDatabaseService } = require('@/lib/services/database/chart-drawing.service');
          
          const result = await ChartDrawingDatabaseService.loadPatterns('session-1');

          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: 'pattern-1',
            type: 'triangle',
          });
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