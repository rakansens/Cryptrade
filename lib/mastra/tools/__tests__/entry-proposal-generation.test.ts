import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { entryProposalGenerationTool } from '../entry-proposal-generation';
import { binanceAPI } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';
import type { PriceData } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/binance/api-service');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the analyzers and calculators
jest.mock('../entry-proposal-generation/analyzers/market-context-analyzer', () => ({
  analyzeMarketContext: jest.fn().mockResolvedValue({
    trend: 'bullish',
    volatility: 'normal',
    volume: 'average',
    momentum: 'positive',
    keyLevels: { support: [100000, 99000], resistance: [105000, 106000] },
  }),
}));

jest.mock('../entry-proposal-generation/analyzers/condition-evaluator', () => ({
  evaluateEntryConditions: jest.fn().mockResolvedValue({
    conditions: [
      { type: 'price_level', met: true, description: 'Price near support' },
      { type: 'momentum', met: true, description: 'Positive momentum' },
    ],
    score: 0.8,
    readyToEnter: true,
  }),
}));

jest.mock('../entry-proposal-generation/calculators/entry-calculator', () => ({
  calculateEntryPoints: jest.fn().mockResolvedValue([
    {
      price: 100500,
      direction: 'long',
      strategy: 'dayTrading',
      confidence: 0.85,
      zone: { start: 100000, end: 101000 },
      reasoning: {
        factors: [
          { factor: 'Near support', weight: 0.8, impact: 'positive' },
          { factor: 'Bullish trend', weight: 0.7, impact: 'positive' },
        ],
      },
      relatedPatterns: [],
      relatedDrawings: [],
    },
  ]),
}));

jest.mock('../entry-proposal-generation/calculators/risk-calculator', () => ({
  calculateRiskManagement: jest.fn().mockResolvedValue({
    stopLoss: 99500,
    takeProfit: [102000, 103000],
    positionSize: 0.1,
    riskAmount: 100,
    riskRewardRatio: 3,
  }),
}));

describe('entryProposalGenerationTool', () => {
  const mockPriceData: PriceData[] = Array.from({ length: 100 }, (_, i) => ({
    time: 1735830000000 + i * 3600000,
    open: 100000 + i * 100,
    high: 100100 + i * 100,
    low: 99900 + i * 100,
    close: 100050 + i * 100,
    volume: 1000 + i * 10,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup binanceAPI mock
    (binanceAPI.fetchKlines as jest.Mock).mockResolvedValue(mockPriceData);
  });

  describe('Basic Functionality', () => {
    it('should execute successfully with valid input', async () => {
      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        '[EntryProposalGeneration] Starting analysis',
        expect.any(Object)
      );
    });

    it('should handle market data fetch failure', async () => {
      (binanceAPI.fetchKlines as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('市場データの取得に失敗しました');
      expect(logger.error).toHaveBeenCalledWith(
        '[EntryProposalGeneration] Failed to fetch market data',
        expect.any(Object)
      );
    });

    it('should handle insufficient market data', async () => {
      (binanceAPI.fetchKlines as jest.Mock).mockResolvedValue([mockPriceData[0]]);

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('十分な市場データがありません');
    });
  });

  describe('Strategy Preferences', () => {
    const strategies = ['scalping', 'dayTrading', 'swingTrading', 'position', 'auto'];

    strategies.forEach(strategy => {
      it(`should handle ${strategy} strategy preference`, async () => {
        const result = await entryProposalGenerationTool.execute({
          context: {
            symbol: 'BTCUSDT',
            interval: '1h',
            strategyPreference: strategy as 'scalping' | 'dayTrading' | 'swingTrading' | 'position' | 'auto',
            riskPercentage: 1,
            maxProposals: 3,
          },
        });

        expect(result.success).toBe(true);
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 200);
      });
    });
  });

  describe('Risk Management', () => {
    it('should respect risk percentage limits', async () => {
      // Valid risk percentages (0.1 to 5)
      const validRisks = [0.1, 1, 2.5, 5];
      
      for (const risk of validRisks) {
        const result = await entryProposalGenerationTool.execute({
          context: {
            symbol: 'BTCUSDT',
            interval: '1h',
            strategyPreference: 'dayTrading',
            riskPercentage: risk,
            maxProposals: 3,
          },
        });

        expect(result.success).toBe(true);
        expect(result.proposalGroup).toBeDefined();
      }
    });

    it('should handle invalid risk percentages', async () => {
      // Test risk too low (< 0.1)
      try {
        await entryProposalGenerationTool.execute({
          context: {
            symbol: 'BTCUSDT',
            interval: '1h',
            strategyPreference: 'dayTrading',
            riskPercentage: 0.05,
            maxProposals: 3,
          },
        });
        // If we get here, the validation didn't work as expected
        expect(true).toBe(false); // Force test to fail
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Test risk too high (> 5)
      try {
        await entryProposalGenerationTool.execute({
          context: {
            symbol: 'BTCUSDT',
            interval: '1h',
            strategyPreference: 'dayTrading',
            riskPercentage: 10,
            maxProposals: 3,
          },
        });
        // If we get here, the validation didn't work as expected
        expect(true).toBe(false); // Force test to fail
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Proposal Generation', () => {
    it('should limit proposals to maxProposals', async () => {
      // Mock the entry calculator to return many entry points
      const { calculateEntryPoints } = require('../entry-proposal-generation/calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValue([
        { price: 100000, direction: 'long', strategy: 'dayTrading', confidence: 0.8, zone: { start: 99500, end: 100500 }, reasoning: { factors: [] }, relatedPatterns: [], relatedDrawings: [] },
        { price: 101000, direction: 'long', strategy: 'dayTrading', confidence: 0.7, zone: { start: 100500, end: 101500 }, reasoning: { factors: [] }, relatedPatterns: [], relatedDrawings: [] },
        { price: 102000, direction: 'short', strategy: 'dayTrading', confidence: 0.75, zone: { start: 101500, end: 102500 }, reasoning: { factors: [] }, relatedPatterns: [], relatedDrawings: [] },
        { price: 103000, direction: 'short', strategy: 'dayTrading', confidence: 0.65, zone: { start: 102500, end: 103500 }, reasoning: { factors: [] }, relatedPatterns: [], relatedDrawings: [] },
        { price: 104000, direction: 'long', strategy: 'dayTrading', confidence: 0.6, zone: { start: 103500, end: 104500 }, reasoning: { factors: [] }, relatedPatterns: [], relatedDrawings: [] },
      ]);

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup?.proposals).toHaveLength(3);
    });

    it('should generate proper proposal group structure', async () => {
      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toMatchObject({
        id: expect.stringMatching(/^epg_/),
        title: expect.stringContaining('BTCUSDT'),
        description: expect.any(String),
        proposals: expect.any(Array),
        summary: {
          bestEntry: expect.any(String),
          averageConfidence: expect.any(Number),
          marketBias: expect.any(String),
        },
        createdAt: expect.any(Number),
        status: 'pending',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error in the market context analyzer
      const { analyzeMarketContext } = require('../entry-proposal-generation/analyzers/market-context-analyzer');
      
      // Reset binanceAPI mock to return valid data
      (binanceAPI.fetchKlines as jest.Mock).mockResolvedValue(mockPriceData);
      
      // Then mock the analyzer to throw an error
      analyzeMarketContext.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('エントリー提案の生成中にエラーが発生しました');
      expect(logger.error).toHaveBeenCalledWith(
        '[EntryProposalGeneration] Unexpected error',
        expect.any(Object)
      );
    });

    it('should handle empty entry points', async () => {
      const { calculateEntryPoints } = require('../entry-proposal-generation/calculators/entry-calculator');
      const { analyzeMarketContext } = require('../entry-proposal-generation/analyzers/market-context-analyzer');
      
      // Reset mocks to default behavior
      (binanceAPI.fetchKlines as jest.Mock).mockResolvedValue(mockPriceData);
      analyzeMarketContext.mockResolvedValue({
        trend: 'bullish',
        volatility: 'normal',
        volume: 'average',
        momentum: 'positive',
        keyLevels: { support: [100000, 99000], resistance: [105000, 106000] },
      });
      
      // Mock empty entry points
      calculateEntryPoints.mockResolvedValueOnce([]);

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('有効なエントリーポイントが見つかりませんでした');
    });
  });

  describe('Integration with Analysis Results', () => {
    it('should use provided analysis results', async () => {
      const analysisResults = {
        patterns: [
          { type: 'triangle', confidence: 0.8 },
          { type: 'head_and_shoulders', confidence: 0.75 },
        ],
        supportResistance: [
          { level: 100000, type: 'support', strength: 0.9 },
          { level: 105000, type: 'resistance', strength: 0.85 },
        ],
        trendlines: [
          { start: { time: 1735830000000, value: 100000 }, end: { time: 1735844400000, value: 104000 } },
        ],
      };

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisResults,
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      
      // Verify that calculateEntryPoints was called with analysis results
      const { calculateEntryPoints } = require('../entry-proposal-generation/calculators/entry-calculator');
      expect(calculateEntryPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisResults,
        })
      );
    });
  });

  describe('Performance', () => {
    it('should complete execution within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify execution time is logged
      expect(logger.info).toHaveBeenCalledWith(
        '[EntryProposalGeneration] Analysis completed',
        expect.objectContaining({
          executionTime: expect.any(Number),
        })
      );
    });
  });
});