import { AnalysisService } from '../analysis.service';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    analysisRecord: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    touchEvent: {
      create: jest.fn(),
    },
  },
}));

describe('AnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveAnalysis', () => {
    it('should create analysis record with all required fields', async () => {
      const mockRecord = { id: 'analysis-1', symbol: 'BTCUSDT' };
      (prisma.analysisRecord.create as jest.Mock).mockResolvedValue(mockRecord);

      const data = {
        sessionId: 'session-123',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support' as const,
        proposalData: { price: 50000, confidence: 0.85 },
      };

      const result = await AnalysisService.saveAnalysis(data);

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          timestamp: BigInt(1234567890000),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposalData: { price: 50000, confidence: 0.85 },
          trackingData: {
            status: 'monitoring',
            touches: 0,
            startTime: 1234567890000,
          },
        },
      });

      expect(result).toBe(mockRecord);
    });

    it('should handle optional sessionId', async () => {
      const mockRecord = { id: 'analysis-2', symbol: 'ETHUSDT' };
      (prisma.analysisRecord.create as jest.Mock).mockResolvedValue(mockRecord);

      const data = {
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'resistance' as const,
        proposalData: { price: 3000 },
      };

      await AnalysisService.saveAnalysis(data);

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: undefined,
          symbol: 'ETHUSDT',
          type: 'resistance',
        }),
      });
    });

    it('should handle all analysis types', async () => {
      const types = ['support', 'resistance', 'trendline', 'pattern', 'fibonacci'] as const;

      for (const type of types) {
        await AnalysisService.saveAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          type,
          proposalData: {},
        });
      }

      expect(prisma.analysisRecord.create).toHaveBeenCalledTimes(types.length);
    });
  });

  describe('recordTouchEvent', () => {
    it('should create touch event and update analysis record', async () => {
      const mockTouchEvent = { id: 'touch-1', recordId: 'record-1' };
      const mockUpdatedRecord = { id: 'record-1', trackingData: { touches: 1 } };

      (prisma.touchEvent.create as jest.Mock).mockResolvedValue(mockTouchEvent);
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue(mockUpdatedRecord);

      const data = {
        recordId: 'record-1',
        price: 50100,
        result: 'bounce' as const,
        strength: 0.9,
        volume: 1000000,
      };

      const result = await AnalysisService.recordTouchEvent(data);

      // Verify touch event creation
      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: {
          recordId: 'record-1',
          timestamp: BigInt(1234567890000),
          price: 50100,
          result: 'bounce',
          strength: 0.9,
          volume: 1000000,
        },
      });

      // Verify analysis record update
      expect(prisma.analysisRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: {
          trackingData: {
            update: {
              touches: { increment: 1 },
              lastTouchTime: 1234567890000,
            },
          },
        },
      });

      expect(result).toBe(mockTouchEvent);
    });

    it('should handle optional volume', async () => {
      const mockTouchEvent = { id: 'touch-2' };
      (prisma.touchEvent.create as jest.Mock).mockResolvedValue(mockTouchEvent);
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue({});

      await AnalysisService.recordTouchEvent({
        recordId: 'record-2',
        price: 3050,
        result: 'test',
        strength: 0.5,
      });

      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          volume: undefined,
        }),
      });
    });

    it('should handle all touch result types', async () => {
      const results = ['bounce', 'break', 'test'] as const;
      (prisma.touchEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue({});

      for (const result of results) {
        await AnalysisService.recordTouchEvent({
          recordId: 'record-3',
          price: 50000,
          result,
          strength: 0.8,
        });
      }

      expect(prisma.touchEvent.create).toHaveBeenCalledTimes(results.length);
    });
  });

  describe('getSessionAnalyses', () => {
    it('should fetch analyses for a session with touch events', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          sessionId: 'session-123',
          touchEvents: [
            { id: 'touch-1', timestamp: BigInt(123) },
            { id: 'touch-2', timestamp: BigInt(456) },
          ],
        },
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockAnalyses);

      const result = await AnalysisService.getSessionAnalyses('session-123');

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        include: {
          touchEvents: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toBe(mockAnalyses);
    });

    it('should limit touch events to 10 most recent', async () => {
      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue([]);

      await AnalysisService.getSessionAnalyses('session-456');

      const call = (prisma.analysisRecord.findMany as jest.Mock).mock.calls[0][0];
      expect(call.include.touchEvents.take).toBe(10);
      expect(call.include.touchEvents.orderBy).toEqual({ timestamp: 'desc' });
    });
  });

  describe('getActiveAnalyses', () => {
    it('should fetch all active analyses when no symbol specified', async () => {
      const mockActiveAnalyses = [
        { id: 'analysis-1', trackingData: { status: 'monitoring' } },
        { id: 'analysis-2', trackingData: { status: 'monitoring' } },
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockActiveAnalyses);

      const result = await AnalysisService.getActiveAnalyses();

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: {
          symbol: undefined,
          trackingData: {
            path: ['status'],
            equals: 'monitoring',
          },
        },
        include: {
          touchEvents: true,
        },
      });

      expect(result).toBe(mockActiveAnalyses);
    });

    it('should filter by symbol when specified', async () => {
      const mockActiveAnalyses = [
        { id: 'analysis-1', symbol: 'BTCUSDT', trackingData: { status: 'monitoring' } },
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockActiveAnalyses);

      const result = await AnalysisService.getActiveAnalyses('BTCUSDT');

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          trackingData: {
            path: ['status'],
            equals: 'monitoring',
          },
        },
        include: {
          touchEvents: true,
        },
      });

      expect(result).toBe(mockActiveAnalyses);
    });

    it('should use JSON path query for status', async () => {
      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue([]);

      await AnalysisService.getActiveAnalyses();

      const call = (prisma.analysisRecord.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.trackingData).toEqual({
        path: ['status'],
        equals: 'monitoring',
      });
    });
  });

  describe('error handling', () => {
    it('should propagate database errors from saveAnalysis', async () => {
      const dbError = new Error('Database connection failed');
      (prisma.analysisRecord.create as jest.Mock).mockRejectedValue(dbError);

      await expect(
        AnalysisService.saveAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposalData: {},
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate errors from recordTouchEvent', async () => {
      const dbError = new Error('Constraint violation');
      (prisma.touchEvent.create as jest.Mock).mockRejectedValue(dbError);

      await expect(
        AnalysisService.recordTouchEvent({
          recordId: 'invalid-id',
          price: 50000,
          result: 'bounce',
          strength: 0.9,
        })
      ).rejects.toThrow('Constraint violation');
    });

    it('should handle update failure in recordTouchEvent', async () => {
      (prisma.touchEvent.create as jest.Mock).mockResolvedValue({ id: 'touch-1' });
      (prisma.analysisRecord.update as jest.Mock).mockRejectedValue(
        new Error('Record not found')
      );

      // Should still throw even though touch event was created
      await expect(
        AnalysisService.recordTouchEvent({
          recordId: 'non-existent',
          price: 50000,
          result: 'bounce',
          strength: 0.9,
        })
      ).rejects.toThrow('Record not found');
    });
  });
});