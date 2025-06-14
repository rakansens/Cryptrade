import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AnalysisService } from '../../database/analysis.service';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
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
  });

  describe('saveAnalysis', () => {
    it('should save analysis record with correct data', async () => {
      const mockData = {
        sessionId: 'session-123',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support' as const,
        proposalData: { price: 45000, strength: 0.8 },
      };

      const mockCreatedRecord = {
        id: 'record-123',
        ...mockData,
        timestamp: BigInt(Date.now()),
        trackingData: {
          status: 'monitoring',
          touches: 0,
          startTime: Date.now(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.analysisRecord.create as jest.Mock).mockResolvedValue(mockCreatedRecord);

      const result = await AnalysisService.saveAnalysis(mockData);

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: {
          sessionId: mockData.sessionId,
          timestamp: expect.any(BigInt),
          symbol: mockData.symbol,
          interval: mockData.interval,
          type: mockData.type,
          proposalData: mockData.proposalData,
          trackingData: {
            status: 'monitoring',
            touches: 0,
            startTime: expect.any(Number),
          },
        },
      });

      expect(result).toEqual(mockCreatedRecord);
    });

    it('should handle analysis without sessionId', async () => {
      const mockData = {
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'resistance' as const,
        proposalData: { price: 2500, strength: 0.9 },
      };

      const mockCreatedRecord = {
        id: 'record-456',
        sessionId: null,
        ...mockData,
        timestamp: BigInt(Date.now()),
        trackingData: {
          status: 'monitoring',
          touches: 0,
          startTime: Date.now(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.analysisRecord.create as jest.Mock).mockResolvedValue(mockCreatedRecord);

      const result = await AnalysisService.saveAnalysis(mockData);

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: {
          sessionId: undefined,
          timestamp: expect.any(BigInt),
          symbol: mockData.symbol,
          interval: mockData.interval,
          type: mockData.type,
          proposalData: mockData.proposalData,
          trackingData: expect.any(Object),
        },
      });

      expect(result.sessionId).toBeNull();
    });

    it('should handle all analysis types', async () => {
      const types = ['support', 'resistance', 'trendline', 'pattern', 'fibonacci'] as const;
      
      for (const type of types) {
        const mockData = {
          symbol: 'BTCUSDT',
          interval: '1d',
          type,
          proposalData: { test: true },
        };

        (prisma.analysisRecord.create as jest.Mock).mockResolvedValue({
          id: `record-${type}`,
          ...mockData,
        });

        await AnalysisService.saveAnalysis(mockData);

        expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ type }),
        });
      }
    });

    it('should throw error when database operation fails', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support' as const,
        proposalData: { price: 45000 },
      };

      const mockError = new Error('Database connection failed');
      (prisma.analysisRecord.create as jest.Mock).mockRejectedValue(mockError);

      await expect(AnalysisService.saveAnalysis(mockData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('recordTouchEvent', () => {
    it('should record touch event and update analysis record', async () => {
      const mockData = {
        recordId: 'record-123',
        price: 45100,
        result: 'bounce' as const,
        strength: 0.85,
        volume: 1000000,
      };

      const mockTouchEvent = {
        id: 'touch-123',
        ...mockData,
        timestamp: BigInt(Date.now()),
        createdAt: new Date(),
      };

      const mockUpdatedRecord = {
        id: mockData.recordId,
        trackingData: {
          touches: 1,
          lastTouchTime: Date.now(),
        },
      };

      (prisma.touchEvent.create as jest.Mock).mockResolvedValue(mockTouchEvent);
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue(mockUpdatedRecord);

      const result = await AnalysisService.recordTouchEvent(mockData);

      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: {
          recordId: mockData.recordId,
          timestamp: expect.any(BigInt),
          price: mockData.price,
          result: mockData.result,
          strength: mockData.strength,
          volume: mockData.volume,
        },
      });

      expect(prisma.analysisRecord.update).toHaveBeenCalledWith({
        where: { id: mockData.recordId },
        data: {
          trackingData: {
            update: {
              touches: { increment: 1 },
              lastTouchTime: expect.any(Number),
            },
          },
        },
      });

      expect(result).toEqual(mockTouchEvent);
    });

    it('should handle touch event without volume', async () => {
      const mockData = {
        recordId: 'record-456',
        price: 2450,
        result: 'break' as const,
        strength: 0.75,
      };

      const mockTouchEvent = {
        id: 'touch-456',
        ...mockData,
        volume: null,
        timestamp: BigInt(Date.now()),
        createdAt: new Date(),
      };

      (prisma.touchEvent.create as jest.Mock).mockResolvedValue(mockTouchEvent);
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue({});

      const result = await AnalysisService.recordTouchEvent(mockData);

      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          volume: undefined,
        }),
      });

      expect(result.volume).toBeNull();
    });

    it('should handle all touch event results', async () => {
      const results = ['bounce', 'break', 'test'] as const;
      
      for (const result of results) {
        const mockData = {
          recordId: 'record-123',
          price: 45000,
          result,
          strength: 0.8,
        };

        (prisma.touchEvent.create as jest.Mock).mockResolvedValue({
          id: `touch-${result}`,
          ...mockData,
        });
        (prisma.analysisRecord.update as jest.Mock).mockResolvedValue({});

        await AnalysisService.recordTouchEvent(mockData);

        expect(prisma.touchEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ result }),
        });
      }
    });

    it('should handle database errors', async () => {
      const mockData = {
        recordId: 'record-123',
        price: 45000,
        result: 'bounce' as const,
        strength: 0.8,
      };

      const mockError = new Error('Foreign key constraint failed');
      (prisma.touchEvent.create as jest.Mock).mockRejectedValue(mockError);

      await expect(AnalysisService.recordTouchEvent(mockData)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('getSessionAnalyses', () => {
    it('should retrieve session analyses with touch events', async () => {
      const sessionId = 'session-123';
      const mockAnalyses = [
        {
          id: 'record-1',
          sessionId,
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposalData: { price: 45000 },
          touchEvents: [
            { id: 'touch-1', price: 44950, result: 'bounce', timestamp: BigInt(Date.now()) },
            { id: 'touch-2', price: 45050, result: 'test', timestamp: BigInt(Date.now()) },
          ],
          createdAt: new Date(),
        },
        {
          id: 'record-2',
          sessionId,
          symbol: 'ETHUSDT',
          interval: '4h',
          type: 'resistance',
          proposalData: { price: 2500 },
          touchEvents: [],
          createdAt: new Date(),
        },
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockAnalyses);

      const result = await AnalysisService.getSessionAnalyses(sessionId);

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        include: {
          touchEvents: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockAnalyses);
      expect(result).toHaveLength(2);
      expect(result[0].touchEvents).toHaveLength(2);
    });

    it('should return empty array for non-existent session', async () => {
      const sessionId = 'non-existent';
      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await AnalysisService.getSessionAnalyses(sessionId);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const sessionId = 'session-123';
      const mockError = new Error('Query timeout');
      (prisma.analysisRecord.findMany as jest.Mock).mockRejectedValue(mockError);

      await expect(AnalysisService.getSessionAnalyses(sessionId)).rejects.toThrow('Query timeout');
    });
  });

  describe('getActiveAnalyses', () => {
    it('should retrieve active analyses for specific symbol', async () => {
      const symbol = 'BTCUSDT';
      const mockActiveAnalyses = [
        {
          id: 'record-1',
          symbol,
          trackingData: { status: 'monitoring', touches: 3 },
          touchEvents: [
            { id: 'touch-1', price: 45000, result: 'bounce' },
            { id: 'touch-2', price: 44950, result: 'test' },
          ],
        },
        {
          id: 'record-2',
          symbol,
          trackingData: { status: 'monitoring', touches: 1 },
          touchEvents: [
            { id: 'touch-3', price: 46000, result: 'break' },
          ],
        },
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockActiveAnalyses);

      const result = await AnalysisService.getActiveAnalyses(symbol);

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: {
          symbol,
          trackingData: {
            path: ['status'],
            equals: 'monitoring',
          },
        },
        include: {
          touchEvents: true,
        },
      });

      expect(result).toEqual(mockActiveAnalyses);
      expect(result).toHaveLength(2);
    });

    it('should retrieve all active analyses when symbol is not provided', async () => {
      const mockActiveAnalyses = [
        {
          id: 'record-1',
          symbol: 'BTCUSDT',
          trackingData: { status: 'monitoring' },
          touchEvents: [],
        },
        {
          id: 'record-2',
          symbol: 'ETHUSDT',
          trackingData: { status: 'monitoring' },
          touchEvents: [],
        },
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

      expect(result).toHaveLength(2);
      expect(result.map(r => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('should return empty array when no active analyses exist', async () => {
      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await AnalysisService.getActiveAnalyses('XRPUSDT');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Invalid JSON path');
      (prisma.analysisRecord.findMany as jest.Mock).mockRejectedValue(mockError);

      await expect(AnalysisService.getActiveAnalyses()).rejects.toThrow('Invalid JSON path');
    });
  });
});