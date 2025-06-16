import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EntryProposalGenerationTool } from '../index';
import type { EntryProposalGenerationInput } from '../index';
import type { PriceData as CandlestickData } from '@/types/market';
import type { EntryProposal, MarketContext } from '@/types/trading';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/binance/api-service', () => ({
  binanceAPI: {
    fetchKlines: jest.fn(),
  },
}));

jest.mock('@/lib/utils/ui-event-dispatcher', () => ({
  uiEventDispatcher: {
    dispatchProposalGenerated: jest.fn(),
  },
}));

jest.mock('../calculators/entry-calculator', () => ({
  calculateEntryPoints: jest.fn(),
}));

jest.mock('../calculators/risk-calculator', () => ({
  calculateRiskManagement: jest.fn(),
}));

jest.mock('../analyzers/market-context-analyzer', () => ({
  analyzeMarketContext: jest.fn(),
}));

jest.mock('../analyzers/condition-evaluator', () => ({
  evaluateEntryConditions: jest.fn(),
}));

describe('EntryProposalGenerationTool', () => {
  const mockMarketData: CandlestickData[] = Array.from({ length: 100 }, (_, i) => ({
    time: 1234567890000 + i * 3600000,
    open: 50000 + Math.random() * 1000,
    high: 50500 + Math.random() * 1000,
    low: 49500 + Math.random() * 1000,
    close: 50000 + Math.random() * 1000,
    volume: 100 + Math.random() * 50,
  }));

  const mockMarketContext: MarketContext = {
    trend: 'bullish',
    volatility: 'normal',
    momentum: 'positive',
    volume: 'increasing',
    keyLevels: {
      support: [49000, 48500],
      resistance: [51000, 51500],
    },
    marketStructure: 'uptrend',
  };

  const mockEntryPoints = [
    {
      price: 50100,
      direction: 'long' as const,
      zone: { start: 50000, end: 50200 },
      strategy: 'swingTrading' as const,
      confidence: 0.85,
      reasoning: 'Strong support bounce',
      relatedPatterns: ['pattern-1'],
      relatedDrawings: ['drawing-1'],
    },
    {
      price: 51000,
      direction: 'short' as const,
      zone: { start: 50900, end: 51100 },
      strategy: 'dayTrading' as const,
      confidence: 0.75,
      reasoning: 'Resistance rejection',
      relatedPatterns: ['pattern-2'],
      relatedDrawings: ['drawing-2'],
    },
  ];

  const mockRiskParams = {
    stopLoss: 49500,
    takeProfits: [
      { price: 51000, percentage: 50 },
      { price: 52000, percentage: 30 },
      { price: 53000, percentage: 20 },
    ],
    positionSize: 0.1,
    riskAmount: 100,
    riskRewardRatio: 2.5,
    maxLoss: 100,
    expectedProfit: 250,
  };

  const mockConditions = {
    immediate: [
      { type: 'price_action' as const, description: 'Price above MA', met: true },
    ],
    pending: [
      { type: 'volume' as const, description: 'Volume confirmation', trigger: 'Volume > 150' },
    ],
    alerts: [
      { level: 'info' as const, message: 'Near key support level' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { binanceAPI } = require('@/lib/binance/api-service');
    binanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

    const { analyzeMarketContext } = require('../analyzers/market-context-analyzer');
    analyzeMarketContext.mockResolvedValue(mockMarketContext);

    const { calculateEntryPoints } = require('../calculators/entry-calculator');
    calculateEntryPoints.mockResolvedValue(mockEntryPoints);

    const { calculateRiskManagement } = require('../calculators/risk-calculator');
    calculateRiskManagement.mockResolvedValue(mockRiskParams);

    const { evaluateEntryConditions } = require('../analyzers/condition-evaluator');
    evaluateEntryConditions.mockResolvedValue(mockConditions);
  });

  describe('execute', () => {
    const baseInput: EntryProposalGenerationInput = {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategyPreference: 'auto',
      riskPercentage: 1,
      maxProposals: 3,
    };

    it('should generate entry proposals successfully', async () => {
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      expect(result.proposalGroup?.proposals).toHaveLength(2);
      
      const proposal = result.proposalGroup?.proposals[0];
      expect(proposal).toMatchObject({
        symbol: 'BTCUSDT',
        direction: 'long',
        strategy: 'swingTrading',
        entryPrice: 50100,
        confidence: 0.85,
      });
    });

    it('should handle market data fetch failure', async () => {
      const { binanceAPI } = require('@/lib/binance/api-service');
      binanceAPI.fetchKlines.mockRejectedValue(new Error('API error'));

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('市場データの取得に失敗しました');
    });

    it('should handle insufficient market data', async () => {
      const { binanceAPI } = require('@/lib/binance/api-service');
      binanceAPI.fetchKlines.mockResolvedValue(mockMarketData.slice(0, 30));

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('十分な市場データがありません');
    });

    it('should handle no valid entry points', async () => {
      const { calculateEntryPoints } = require('../calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValue([]);

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('有効なエントリーポイントが見つかりませんでした');
    });

    it('should respect maxProposals limit', async () => {
      const { calculateEntryPoints } = require('../calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValue([
        ...mockEntryPoints,
        ...mockEntryPoints,
        ...mockEntryPoints,
      ]);

      const result = await EntryProposalGenerationTool.execute({ 
        context: { ...baseInput, maxProposals: 2 }
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup?.proposals).toHaveLength(2);
    });

    it('should use analysis results when provided', async () => {
      const analysisResults = {
        patterns: [{ id: 'pattern-1', type: 'triangle' }],
        supportResistance: [{ level: 50000, type: 'support' }],
        trendlines: [{ start: { x: 0, y: 49000 }, end: { x: 100, y: 51000 } }],
        indicators: { rsi: 45, macd: { signal: 'bullish' } },
      };

      const result = await EntryProposalGenerationTool.execute({ 
        context: { ...baseInput, analysisResults }
      });

      expect(result.success).toBe(true);
      
      const { calculateEntryPoints } = require('../calculators/entry-calculator');
      expect(calculateEntryPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisResults,
        })
      );
    });

    it('should handle different strategy preferences', async () => {
      const strategies = ['scalping', 'dayTrading', 'swingTrading', 'position'] as const;
      
      for (const strategy of strategies) {
        const result = await EntryProposalGenerationTool.execute({ 
          context: { ...baseInput, strategyPreference: strategy }
        });

        expect(result.success).toBe(true);
        expect(result.proposalGroup?.title).toContain(
          strategy === 'scalping' ? 'スキャルピング' :
          strategy === 'dayTrading' ? 'デイトレード' :
          strategy === 'swingTrading' ? 'スイングトレード' :
          'ポジショントレード'
        );
      }
    });

    it('should handle different risk percentages', async () => {
      const result = await EntryProposalGenerationTool.execute({ 
        context: { ...baseInput, riskPercentage: 2.5 }
      });

      expect(result.success).toBe(true);
      
      const { calculateRiskManagement } = require('../calculators/risk-calculator');
      expect(calculateRiskManagement).toHaveBeenCalledWith(
        expect.objectContaining({
          riskPercentage: 2.5,
        })
      );
    });

    it('should calculate priority correctly', async () => {
      const { calculateRiskManagement } = require('../calculators/risk-calculator');
      
      // High priority: high confidence and good risk/reward
      calculateRiskManagement.mockResolvedValueOnce({
        ...mockRiskParams,
        riskRewardRatio: 3,
      });
      
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.proposalGroup?.proposals[0]?.priority).toBe('high');
    });

    it('should generate appropriate group description', async () => {
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      const description = result.proposalGroup?.description;
      expect(description).toContain('2個のエントリー提案を生成しました');
      expect(description).toContain('ロング: 1個、ショート: 1個');
      expect(description).toContain('通常のボラティリティ');
      expect(description).toContain('上昇トレンド');
    });

    it('should handle only long positions', async () => {
      const { calculateEntryPoints } = require('../calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValue([mockEntryPoints[0]]);

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.proposalGroup?.description).toContain('全てロングポジション');
    });

    it('should handle only short positions', async () => {
      const { calculateEntryPoints } = require('../calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValue([mockEntryPoints[1]]);

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.proposalGroup?.description).toContain('全てショートポジション');
    });

    it('should dispatch UI event on success', async () => {
      const { uiEventDispatcher } = require('@/lib/utils/ui-event-dispatcher');
      
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(uiEventDispatcher.dispatchProposalGenerated).toHaveBeenCalledWith(
        result.proposalGroup
      );
    });

    it('should handle unexpected errors', async () => {
      const { analyzeMarketContext } = require('../analyzers/market-context-analyzer');
      analyzeMarketContext.mockRejectedValue(new Error('Unexpected error'));

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('エントリー提案の生成中にエラーが発生しました');
    });

    it('should skip entries with missing candle data', async () => {
      const { binanceAPI } = require('@/lib/binance/api-service');
      binanceAPI.fetchKlines.mockResolvedValue([
        ...mockMarketData.slice(0, -1),
        undefined,
      ]);

      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      // Should still succeed but with fewer proposals
      expect(result.success).toBe(true);
    });

    it('should generate unique IDs for proposals and groups', async () => {
      const result1 = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });
      const result2 = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      expect(result1.proposalGroup?.id).not.toBe(result2.proposalGroup?.id);
      expect(result1.proposalGroup?.proposals[0]?.id).not.toBe(
        result2.proposalGroup?.proposals[0]?.id
      );
    });

    it('should set correct expiration time', async () => {
      const now = Date.now();
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      const proposal = result.proposalGroup?.proposals[0];
      expect(proposal?.expiresAt).toBeGreaterThan(now);
      expect(proposal?.expiresAt).toBeLessThanOrEqual(now + 24 * 60 * 60 * 1000);
    });

    it('should calculate average confidence correctly', async () => {
      const result = await EntryProposalGenerationTool.execute({ 
        context: baseInput 
      });

      const avgConfidence = result.proposalGroup?.summary.averageConfidence;
      expect(avgConfidence).toBe((0.85 + 0.75) / 2);
    });

    it('should handle different market volatility levels', async () => {
      const volatilityLevels = ['low', 'normal', 'high'] as const;
      
      for (const volatility of volatilityLevels) {
        const { analyzeMarketContext } = require('../analyzers/market-context-analyzer');
        analyzeMarketContext.mockResolvedValue({
          ...mockMarketContext,
          volatility,
        });

        const result = await EntryProposalGenerationTool.execute({ 
          context: baseInput 
        });

        expect(result.proposalGroup?.description).toContain(
          volatility === 'low' ? '低ボラティリティ' :
          volatility === 'normal' ? '通常のボラティリティ' :
          '高ボラティリティ'
        );
      }
    });

    it('should handle different market trends', async () => {
      const trends = ['bullish', 'bearish', 'neutral'] as const;
      
      for (const trend of trends) {
        const { analyzeMarketContext } = require('../analyzers/market-context-analyzer');
        analyzeMarketContext.mockResolvedValue({
          ...mockMarketContext,
          trend,
        });

        const result = await EntryProposalGenerationTool.execute({ 
          context: baseInput 
        });

        expect(result.proposalGroup?.description).toContain(
          trend === 'bullish' ? '上昇トレンド' :
          trend === 'bearish' ? '下降トレンド' :
          'レンジ相場'
        );
      }
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool properties', () => {
      expect(EntryProposalGenerationTool.id).toBe('entry-proposal-generation');
      expect(EntryProposalGenerationTool.description).toBe(
        'Generates specific trade entry proposals with entry points, stop loss, and take profit levels'
      );
    });

    it('should validate input schema', () => {
      const validInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        strategyPreference: 'auto',
        riskPercentage: 1,
        maxProposals: 3,
      };

      const parsed = EntryProposalGenerationTool.inputSchema.parse(validInput);
      expect(parsed).toEqual(validInput);
    });

    it('should reject invalid strategy preference', () => {
      const invalidInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        strategyPreference: 'invalid',
        riskPercentage: 1,
        maxProposals: 3,
      };

      expect(() => 
        EntryProposalGenerationTool.inputSchema.parse(invalidInput)
      ).toThrow();
    });

    it('should reject invalid risk percentage', () => {
      const invalidInput = {
        symbol: 'BTCUSDT',
        interval: '1h',
        strategyPreference: 'auto',
        riskPercentage: 10, // Too high
        maxProposals: 3,
      };

      expect(() => 
        EntryProposalGenerationTool.inputSchema.parse(invalidInput)
      ).toThrow();
    });
  });
});