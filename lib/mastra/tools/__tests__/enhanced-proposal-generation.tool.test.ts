import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { enhancedProposalGeneration, type EnhancedProposalGenerationInput } from '../enhanced-proposal-generation.tool';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import { StreamingMLAnalyzer } from '@/lib/ml/streaming-ml-analyzer';
import { logger } from '@/lib/utils/logger';
import type { PriceData } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/analysis/pattern-detector');
jest.mock('@/lib/ml/streaming-ml-analyzer');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('enhancedProposalGeneration', () => {
  const mockPriceData: PriceData[] = [
    { time: 1735830000000, open: 100000, high: 101000, low: 99000, close: 100500, volume: 1000 },
    { time: 1735833600000, open: 100500, high: 102000, low: 100000, close: 101500, volume: 1200 },
    { time: 1735837200000, open: 101500, high: 103000, low: 101000, close: 102500, volume: 1500 },
    { time: 1735840800000, open: 102500, high: 104000, low: 102000, close: 103500, volume: 1800 },
    { time: 1735844400000, open: 103500, high: 105000, low: 103000, close: 104500, volume: 2000 },
    { time: 1735848000000, open: 104500, high: 106000, low: 104000, close: 105500, volume: 2200 },
    { time: 1735851600000, open: 105500, high: 107000, low: 105000, close: 106500, volume: 2500 },
    { time: 1735855200000, open: 106500, high: 108000, low: 106000, close: 107500, volume: 2800 },
    { time: 1735858800000, open: 107500, high: 109000, low: 107000, close: 108500, volume: 3000 },
    { time: 1735862400000, open: 108500, high: 110000, low: 108000, close: 109500, volume: 3200 },
  ];

  const mockPatternDetectorResponse = {
    patterns: [
      {
        type: 'head_and_shoulders',
        description: 'ヘッドアンドショルダーパターンが検出されました',
        confidence: 0.85,
        visualization: {
          keyPoints: [
            { time: 1735830000000, value: 101000 },
            { time: 1735837200000, value: 103000 },
            { time: 1735844400000, value: 105000 },
          ],
        },
        metrics: {
          leftShoulderHeight: 101000,
          headHeight: 105000,
          rightShoulderHeight: 103000,
          necklineLevel: 100000,
        },
        trading_implication: 'ベアリッシュ反転の可能性',
      },
      {
        type: 'triangle',
        description: '上昇三角形パターンが形成されています',
        confidence: 0.78,
        visualization: {
          keyPoints: [
            { time: 1735833600000, value: 102000 },
            { time: 1735840800000, value: 104000 },
          ],
        },
        metrics: {
          upperBound: 104000,
          lowerBound: 102000,
        },
        trading_implication: 'ブレイクアウトの可能性',
      },
    ],
  };

  const mockMLPrediction = {
    successProbability: 0.82,
    expectedBounces: 3,
    reasoning: [
      {
        factor: 'Historical touch points',
        impact: 'positive' as const,
        weight: 0.8,
        description: '過去に3回以上タッチポイントがあります',
      },
      {
        factor: 'Current trend alignment',
        impact: 'positive' as const,
        weight: 0.6,
        description: '現在のトレンドと整合性があります',
      },
    ],
  };

  let mockPatternDetector: jest.Mocked<PatternDetector>;
  let mockMLAnalyzer: jest.Mocked<StreamingMLAnalyzer>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup PatternDetector mock
    mockPatternDetector = {
      detectPatterns: jest.fn().mockReturnValue(mockPatternDetectorResponse),
    } as any;
    (PatternDetector as jest.MockedClass<typeof PatternDetector>).mockImplementation(() => mockPatternDetector);

    // Setup StreamingMLAnalyzer mock
    mockMLAnalyzer = {
      analyzeLineWithProgress: jest.fn().mockImplementation(function* () {
        yield { stage: 'feature_extraction', progress: 0.33, message: 'Extracting features...' };
        yield { stage: 'ml_analysis', progress: 0.66, message: 'Running ML analysis...' };
        yield { stage: 'complete', progress: 1.0, message: 'Analysis complete' };
        return mockMLPrediction;
      }),
    } as any;
    (StreamingMLAnalyzer as jest.MockedClass<typeof StreamingMLAnalyzer>).mockImplementation(() => mockMLAnalyzer);
  });

  describe('Pattern Detection', () => {
    it('should detect patterns when analysisType is pattern', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'pattern',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals).toHaveLength(2);
      expect(result.proposals[0].type).toBe('pattern');
      expect(result.proposals[0].description).toContain('ヘッドアンドショルダー');
      expect(result.proposals[0].confidence).toBe(0.85);
      expect(mockPatternDetector.detectPatterns).toHaveBeenCalledWith({
        lookbackPeriod: 100,
        minConfidence: 0.6,
        includePartialPatterns: false,
      });
    });

    it('should limit patterns to maxProposals', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'pattern',
        priceData: mockPriceData,
        maxProposals: 1,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].description).toContain('ヘッドアンドショルダー');
    });
  });

  describe('Support/Resistance Detection', () => {
    it('should detect support and resistance levels', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'support-resistance',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals.length).toBeGreaterThan(0);
      expect(result.proposals.some(p => p.type === 'horizontalLine')).toBe(true);
    });

    it('should apply ML validation to support/resistance levels when enabled', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'support-resistance',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(mockMLAnalyzer.analyzeLineWithProgress).toHaveBeenCalled();
      
      const mlValidatedProposals = result.proposals.filter(p => p.mlPrediction);
      expect(mlValidatedProposals.length).toBeGreaterThan(0);
      
      if (mlValidatedProposals.length > 0) {
        expect(mlValidatedProposals[0].mlPrediction?.successProbability).toBe(0.82);
        expect(mlValidatedProposals[0].mlPrediction?.expectedBounces).toBe(3);
      }
    });
  });

  describe('Trendline Detection', () => {
    it('should detect trendlines', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'trendline',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals.some(p => p.type === 'trendline')).toBe(true);
      
      const trendlineProposal = result.proposals.find(p => p.type === 'trendline');
      if (trendlineProposal) {
        expect(trendlineProposal.description).toMatch(/トレンドライン/);
        expect(trendlineProposal.drawingData.type).toBe('trendline');
        expect(trendlineProposal.drawingData.points).toBeInstanceOf(Array);
      }
    });

    it('should enhance trendlines with ML predictions when enabled', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'trendline',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      const trendlineWithML = result.proposals.find(p => p.type === 'trendline' && p.mlPrediction);
      
      if (trendlineWithML) {
        expect(trendlineWithML.mlPrediction?.successProbability).toBe(0.82);
        expect(trendlineWithML.mlPrediction?.reasoning).toHaveLength(2);
      }
    });
  });

  describe('Combined Analysis', () => {
    it('should analyze all types when analysisType is all', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: mockPriceData,
        maxProposals: 10,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals.length).toBeGreaterThan(0);
      
      const types = new Set(result.proposals.map(p => p.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should sort proposals by confidence', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: mockPriceData,
        maxProposals: 10,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      for (let i = 1; i < result.proposals.length; i++) {
        expect(result.proposals[i - 1].confidence).toBeGreaterThanOrEqual(result.proposals[i].confidence);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle PatternDetector errors gracefully', async () => {
      mockPatternDetector.detectPatterns.mockImplementation(() => {
        throw new Error('Pattern detection failed');
      });

      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'pattern',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false,
      };

      await expect(enhancedProposalGeneration(input)).rejects.toThrow('Pattern detection failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should continue without ML when ML analyzer fails', async () => {
      mockMLAnalyzer.analyzeLineWithProgress.mockImplementation(function* () {
        throw new Error('ML analysis failed');
      });

      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'trendline',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals.length).toBeGreaterThan(0);
      expect(result.proposals[0].mlPrediction).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty price data', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: [],
        maxProposals: 5,
        useMLValidation: false,
      };

      await expect(enhancedProposalGeneration(input)).rejects.toThrow();
    });

    it('should handle insufficient price data for pattern detection', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: mockPriceData.slice(0, 3),
        maxProposals: 5,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.success).toBe(true);
      expect(result.proposals.length).toBeLessThanOrEqual(input.maxProposals);
    });
  });

  describe('Summary Generation', () => {
    it('should generate appropriate summary for no proposals', async () => {
      mockPatternDetector.detectPatterns.mockReturnValue({ patterns: [] });

      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'pattern',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.summary).toBe('有効な提案が見つかりませんでした。');
    });

    it('should include ML validation info in summary when used', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      if (result.proposals.some(p => p.mlPrediction)) {
        expect(result.summary).toMatch(/ML検証済み/);
      }
    });
  });

  describe('Performance', () => {
    it('should track total analysis time', async () => {
      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'all',
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.totalAnalysisTime).toBeGreaterThan(0);
      expect(result.totalAnalysisTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});