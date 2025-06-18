import { AnalysisService } from '@/lib/services/database/analysis.service';
import { prisma } from '@/lib/db/prisma';
import type { DrawingProposal, EntryProposal } from '@/types/proposals';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    analysisRecord: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    touchEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

describe('AnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveAnalysis', () => {
    it('should save analysis with drawing proposal', async () => {
      const drawingProposal: DrawingProposal = {
        id: 'draw-1',
        type: 'trendline',
        confidence: 0.85,
        reasoning: 'Strong uptrend detected',
        coordinates: {
          start: { x: 100, y: 50000 },
          end: { x: 200, y: 60000 }
        },
        style: {
          color: '#00ff00',
          lineWidth: 2
        }
      };

      const mockRecord = {
        id: 'analysis-1',
        sessionId: 'session-1',
        timestamp: BigInt(Date.now()),
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'trendline',
        proposalData: drawingProposal,
        trackingData: {
          status: 'monitoring',
          touches: 0,
          startTime: Date.now()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.analysisRecord.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await AnalysisService.saveAnalysis({
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'trendline',
        proposalData: drawingProposal
      });

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          timestamp: expect.any(BigInt),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'trendline',
          proposalData: drawingProposal,
          trackingData: {
            status: 'monitoring',
            touches: 0,
            startTime: expect.any(Number)
          }
        }
      });

      expect(result).toEqual(mockRecord);
    });

    it('should save analysis with entry proposal', async () => {
      const entryProposal: EntryProposal = {
        id: 'entry-1',
        type: 'long',
        confidence: 0.75,
        reasoning: 'Bullish breakout pattern',
        entry: 50000,
        stopLoss: 48000,
        targets: [52000, 54000, 56000],
        riskReward: 3.0,
        timeframe: '4h'
      };

      await AnalysisService.saveAnalysis({
        symbol: 'BTCUSDT',
        interval: '4h',
        type: 'pattern',
        proposalData: entryProposal
      });

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: {
          timestamp: expect.any(BigInt),
          symbol: 'BTCUSDT',
          interval: '4h',
          type: 'pattern',
          proposalData: entryProposal,
          trackingData: {
            status: 'monitoring',
            touches: 0,
            startTime: expect.any(Number)
          }
        }
      });
    });

    it('should handle optional sessionId', async () => {
      await AnalysisService.saveAnalysis({
        symbol: 'ETHUSDT',
        interval: '15m',
        type: 'support',
        proposalData: {
          id: 'support-1',
          type: 'horizontal',
          confidence: 0.8,
          reasoning: 'Multiple bounces',
          price: 3000
        }
      });

      expect(prisma.analysisRecord.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          sessionId: expect.anything()
        })
      });
    });
  });

  describe('recordTouchEvent', () => {
    it('should record touch event and update analysis record', async () => {
      const mockTouchEvent = {
        id: 'touch-1',
        recordId: 'analysis-1',
        timestamp: BigInt(Date.now()),
        price: 51000,
        result: 'bounce',
        strength: 0.8,
        volume: 1000000
      };

      (prisma.touchEvent.create as jest.Mock).mockResolvedValue(mockTouchEvent);
      (prisma.analysisRecord.update as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        trackingData: {
          touches: 1,
          lastTouchTime: Date.now()
        }
      });

      const result = await AnalysisService.recordTouchEvent({
        recordId: 'analysis-1',
        price: 51000,
        result: 'bounce',
        strength: 0.8,
        volume: 1000000
      });

      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: {
          recordId: 'analysis-1',
          timestamp: expect.any(BigInt),
          price: 51000,
          result: 'bounce',
          strength: 0.8,
          volume: 1000000
        }
      });

      expect(prisma.analysisRecord.update).toHaveBeenCalledWith({
        where: { id: 'analysis-1' },
        data: {
          trackingData: {
            update: {
              touches: { increment: 1 },
              lastTouchTime: expect.any(Number)
            }
          }
        }
      });

      expect(result).toEqual(mockTouchEvent);
    });

    it('should handle touch event without volume', async () => {
      await AnalysisService.recordTouchEvent({
        recordId: 'analysis-1',
        price: 49000,
        result: 'test',
        strength: 0.5
      });

      expect(prisma.touchEvent.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          volume: expect.anything()
        })
      });
    });
  });

  describe('getSessionAnalyses', () => {
    it('should get analyses for a session with touch events', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          sessionId: 'session-1',
          symbol: 'BTCUSDT',
          touchEvents: [
            { id: 'touch-1', result: 'bounce' },
            { id: 'touch-2', result: 'break' }
          ]
        },
        {
          id: 'analysis-2',
          sessionId: 'session-1',
          symbol: 'ETHUSDT',
          touchEvents: []
        }
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockAnalyses);

      const result = await AnalysisService.getSessionAnalyses('session-1');

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        include: {
          touchEvents: {
            orderBy: { timestamp: 'desc' },
            take: 10
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toEqual(mockAnalyses);
    });
  });

  describe('getActiveAnalyses', () => {
    it('should get active analyses with optional symbol filter', async () => {
      const mockActiveAnalyses = [
        {
          id: 'analysis-1',
          symbol: 'BTCUSDT',
          trackingData: { status: 'monitoring' },
          touchEvents: []
        }
      ];

      (prisma.analysisRecord.findMany as jest.Mock).mockResolvedValue(mockActiveAnalyses);

      const result = await AnalysisService.getActiveAnalyses('BTCUSDT');

      expect(prisma.analysisRecord.findMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          trackingData: {
            path: ['status'],
            equals: 'monitoring'
          }
        },
        include: {
          touchEvents: true
        }
      });


      expect(result).toEqual(mockActiveAnalyses);
    });
  });
});
