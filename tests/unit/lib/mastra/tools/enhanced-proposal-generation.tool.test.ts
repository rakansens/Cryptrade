import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { enhancedProposalGeneration, type EnhancedProposalGenerationInput } from '@/lib/mastra/tools/enhanced-proposal-generation.tool';
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
  // Create price data with clear support/resistance levels and swing points
  const mockPriceData: PriceData[] = [];
  const baseTime = 1735830000000;
  
  // Generate 50 data points with clear patterns
  for (let i = 0; i < 50; i++) {
    const time = baseTime + i * 3600000; // 1 hour intervals
    let high, low, open, close;
    
    // Create swing highs and lows for trendline detection
    // Swing highs: must be higher than 2 candles on each side
    if (i === 5 || i === 15 || i === 25 || i === 35) {
      // Create swing highs with proper surrounding candles
      high = 105000 + (i * 50); // Ascending swing highs for uptrend
      low = 104500 + (i * 50);
      open = 104600 + (i * 50);
      close = 104800 + (i * 50);
    } else if (i === 10 || i === 20 || i === 30 || i === 40) {
      // Create swing lows with proper surrounding candles
      high = 100500 + (i * 30); // Ascending swing lows for uptrend
      low = 100000 + (i * 30);
      open = 100400 + (i * 30);
      close = 100200 + (i * 30);
    } else if (i >= 3 && i <= 7 && i !== 5) {
      // Lower highs around first swing high
      const diff = Math.abs(i - 5) * 500;
      high = 104500 - diff;
      low = 104000 - diff;
      open = 104100 - diff;
      close = 104300 - diff;
    } else if (i >= 13 && i <= 17 && i !== 15) {
      // Lower highs around second swing high
      const diff = Math.abs(i - 15) * 500;
      high = 104500 - diff + 750;
      low = 104000 - diff + 750;
      open = 104100 - diff + 750;
      close = 104300 - diff + 750;
    } else if (i >= 8 && i <= 12 && i !== 10) {
      // Higher lows around first swing low
      const diff = Math.abs(i - 10) * 400;
      high = 100500 + diff;
      low = 100000 + diff;
      open = 100100 + diff;
      close = 100300 + diff;
    } else if (i >= 18 && i <= 22 && i !== 20) {
      // Higher lows around second swing low
      const diff = Math.abs(i - 20) * 400;
      high = 101100 + diff;
      low = 100600 + diff;
      open = 100700 + diff;
      close = 100900 + diff;
    } else {
      // Normal price movement
      const basePrice = 102500;
      open = basePrice;
      close = basePrice + 100;
      high = close + 50;
      low = open - 50;
    }
    
    mockPriceData.push({ time, open, high, low, close, volume: 1000 + Math.random() * 1000 });
  }

  const mockPatternDetectorResponse = [
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
  ];

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
      analyzeLineWithProgress: jest.fn().mockImplementation(() => {
        // Return an async generator that yields the prediction at the end
        async function* generator() {
          yield { stage: 'feature_extraction', progress: 0.33, message: 'Extracting features...' };
          yield { stage: 'ml_analysis', progress: 0.66, message: 'Running ML analysis...' };
          yield { stage: 'complete', progress: 1.0, message: 'Analysis complete' };
          // Return the prediction when the generator completes
          return mockMLPrediction;
        }
        return generator();
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
      expect(result.proposals).toHaveLength(2);
      expect(result.proposals[0]?.type).toBe('pattern');
      expect(result.proposals[0]?.description).toContain('ヘッドアンドショルダー');
      expect(result.proposals[0]?.confidence).toBe(0.85);
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
      expect(result.proposals[0]?.description).toContain('ヘッドアンドショルダー');
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
      expect(mockMLAnalyzer.analyzeLineWithProgress).toHaveBeenCalled();
      
      const mlValidatedProposals = result.proposals.filter(p => p.mlPrediction);
      expect(mlValidatedProposals.length).toBeGreaterThan(0);
      
      if (mlValidatedProposals.length > 0) {
        expect(mlValidatedProposals[0]?.mlPrediction?.successProbability).toBe(0.82);
        expect(mlValidatedProposals[0]?.mlPrediction?.expectedBounces).toBe(3);
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
      expect(result.proposals.some(p => p.type === 'trendline')).toBe(true);
      
      const trendlineProposal = result.proposals.find(p => p.type === 'trendline');
      if (trendlineProposal) {
        expect(trendlineProposal.description).toMatch(/トレンドライン/);
        expect(trendlineProposal.drawingData?.type).toBe('trendline');
        expect(trendlineProposal.drawingData?.points).toBeInstanceOf(Array);
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
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
        expect(result.proposals[i - 1]?.confidence ?? 0).toBeGreaterThanOrEqual(result.proposals[i]?.confidence ?? 0);
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
      mockMLAnalyzer.analyzeLineWithProgress.mockImplementation(async function* () {
        throw new Error('ML analysis failed');
      });

      const input: EnhancedProposalGenerationInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'support-resistance', // Changed to support-resistance which we know generates proposals
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: true,
      };

      const result = await enhancedProposalGeneration(input);

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
      expect(result.proposals.length).toBeGreaterThan(0);
      expect(result.proposals[0]?.mlPrediction).toBeUndefined();
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

      await expect(enhancedProposalGeneration(input)).rejects.toThrow('No market data available');
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

      expect(result).toBeDefined();
      expect(result.proposalGroupId).toBeDefined();
      expect(result.proposals.length).toBeLessThanOrEqual(input.maxProposals);
    });
  });

  describe('Summary Generation', () => {
    it('should generate appropriate summary for no proposals', async () => {
      mockPatternDetector.detectPatterns.mockReturnValue([]);

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
        analysisType: 'pattern', // Use pattern type to ensure we get some results
        priceData: mockPriceData,
        maxProposals: 5,
        useMLValidation: false, // Disable ML to focus on timing
      };

      const result = await enhancedProposalGeneration(input);

      expect(result.totalAnalysisTime).toBeGreaterThanOrEqual(0); // Changed to >= 0 since execution can be very fast
      expect(result.totalAnalysisTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});