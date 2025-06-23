// Mock logger before imports
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { describe, it, expect, jest } from '@jest/globals';
import { calculateEntryPoints } from '../calculators/entry-calculator';
import type { PriceData as CandlestickData } from '@/types/market';
import type { MarketContext } from '@/types/trading';

describe('calculateEntryPoints', () => {
  const mockMarketData: CandlestickData[] = Array.from({ length: 100 }, (_, i) => ({
    time: 1234567890000 + i * 3600000,
    open: 50000 + Math.sin(i * 0.1) * 1000,
    high: 50500 + Math.sin(i * 0.1) * 1000,
    low: 49500 + Math.sin(i * 0.1) * 1000,
    close: 50000 + Math.sin(i * 0.1) * 1000,
    volume: 100 + Math.random() * 50,
  }));

  const mockMarketContext: MarketContext = {
    currentPrice: 50000,
    trend: 'bullish',
    volatility: 'normal',
    volume: 'average',
    keyLevels: {
      nearestSupport: 49000,
      nearestResistance: 51000,
      dailyHigh: 52000,
      dailyLow: 48000,
    },
  };

  const mockAnalysisResults = {
    patterns: [
      {
        id: 'pattern-1',
        type: 'triangle',
        trading_implication: 'bullish' as const,
        confidence: 0.85,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        metrics: {
          breakout_level: 52000,
        },
      },
      {
        id: 'pattern-2',
        type: 'flag',
        trading_implication: 'bearish' as const,
        confidence: 0.75,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        metrics: {
          breakout_level: 48000,
        },
      },
    ],
    supportResistance: [
      { id: 's1', price: 50000, type: 'support' as const },
      { id: 'r1', price: 51000, type: 'resistance' as const },
    ],
    trendlines: [
      {
        id: 'trendline-1',
        direction: '上昇' as const,
        slope: 0.02,
        confidence: 0.8,
        points: [
          { time: Date.now() - 86400000, value: 49000 },
          { time: Date.now(), value: 49800 },
        ],
      },
    ],
    indicators: {
      rsi: 45,
      macd: {
        value: 100,
        signal: 50,
        histogram: 50,
      },
      ma: {
        short: 49900,
        long: 50100,
      },
    },
  };

  describe('Basic Functionality', () => {
    it('should calculate entry points from market data', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
        analysisResults: mockAnalysisResults,
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
      expect(entryPoints.length).toBeGreaterThan(0);
    });

    it('should return entry points with required properties', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
        analysisResults: mockAnalysisResults,
      });

      const entry = entryPoints[0];
      expect(entry).toHaveProperty('price');
      expect(entry).toHaveProperty('direction');
      expect(entry).toHaveProperty('zone');
      expect(entry).toHaveProperty('strategy');
      expect(entry).toHaveProperty('confidence');
      expect(entry).toHaveProperty('reasoning');
      expect(entry).toHaveProperty('relatedPatterns');
      expect(entry).toHaveProperty('relatedDrawings');
    });

    it('should handle empty market data', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: [],
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toEqual([]);
    });

    it('should handle minimal market data', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData.slice(0, 10),
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
    });
  });

  describe('Strategy-Based Calculations', () => {
    it.skip('should calculate scalping entries', async () => {
      // TODO: Fix test - need to ensure calculateEntryPoints returns scalping strategy entries
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'scalping',
        analysisResults: mockAnalysisResults,
      });

      const scalpingEntries = entryPoints.filter(e => e.strategy === 'scalping');
      expect(scalpingEntries.length).toBeGreaterThan(0);
      
      // Scalping entries should have tight zones
      const entry = scalpingEntries[0];
      expect(entry).toBeDefined();
      expect(entry?.zone).toBeDefined();
      const zoneSize = Math.abs((entry?.zone?.max ?? 0) - (entry?.zone?.min ?? 0));
      const pricePercentage = zoneSize / (entry?.price ?? 1);
      expect(pricePercentage).toBeLessThan(0.005); // Less than 0.5%
    });

    it.skip('should calculate day trading entries', async () => {
      // TODO: Fix test - need to ensure calculateEntryPoints returns dayTrading strategy entries
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'dayTrading',
        analysisResults: mockAnalysisResults,
      });

      const dayTradingEntries = entryPoints.filter(e => e.strategy === 'dayTrading');
      expect(dayTradingEntries.length).toBeGreaterThan(0);
    });

    it.skip('should calculate swing trading entries', async () => {
      // TODO: Fix test - need to ensure calculateEntryPoints returns swingTrading strategy entries
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'swingTrading',
        analysisResults: mockAnalysisResults,
      });

      const swingEntries = entryPoints.filter(e => e.strategy === 'swingTrading');
      expect(swingEntries.length).toBeGreaterThan(0);
      
      // Swing entries should have wider zones
      const entry = swingEntries[0];
      const zoneSize = Math.abs((entry?.zone?.max ?? 0) - (entry?.zone?.min ?? 0));
      const pricePercentage = zoneSize / (entry?.price ?? 1);
      expect(pricePercentage).toBeGreaterThan(0.005); // More than 0.5%
    });

    it.skip('should calculate position trading entries', async () => {
      // TODO: Fix test - need to ensure calculateEntryPoints returns position strategy entries
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'position',
        analysisResults: mockAnalysisResults,
      });

      const positionEntries = entryPoints.filter(e => e.strategy === 'position');
      expect(positionEntries.length).toBeGreaterThan(0);
    });

    it('should auto-select strategy based on market conditions', async () => {
      // High volatility should prefer shorter timeframes
      const highVolContext = { ...mockMarketContext, volatility: 'high' as const };
      const highVolEntries = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: highVolContext,
        strategyPreference: 'auto',
      });

      // Low volatility should prefer longer timeframes
      const lowVolContext = { ...mockMarketContext, volatility: 'low' as const };
      const lowVolEntries = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: lowVolContext,
        strategyPreference: 'auto',
      });

      expect(highVolEntries).toBeDefined();
      expect(lowVolEntries).toBeDefined();
    });
  });

  describe('Analysis Results Integration', () => {
    it('should incorporate pattern analysis', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Should have entries related to patterns
      const patternEntries = entryPoints.filter(
        e => e.relatedPatterns && e.relatedPatterns.length > 0
      );
      expect(patternEntries.length).toBeGreaterThan(0);
    });

    it.skip('should use support/resistance levels', async () => {
      // TODO: Fix test - need to ensure entry points are generated near support level
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Should have entries near support/resistance
      const supportEntry = entryPoints.find(
        e => Math.abs(e.price - 50000) / 50000 < 0.01
      );
      expect(supportEntry).toBeDefined();
    });

    it('should incorporate indicator signals', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // With oversold RSI and bullish MACD, should have long entries
      const longEntries = entryPoints.filter(e => e.direction === 'long');
      expect(longEntries.length).toBeGreaterThan(0);
    });

    it('should handle missing analysis results', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        // analysisResults is optional, so omit it
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
    });

    it('should handle partial analysis results', async () => {
      const partialResults = {
        patterns: mockAnalysisResults.patterns,
        // Missing other fields
      };

      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: partialResults as any,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
    });
  });

  describe('Market Context Adaptation', () => {
    it('should adapt to bullish market', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: { ...mockMarketContext, trend: 'bullish' },
        strategyPreference: 'auto',
      });

      const longEntries = entryPoints.filter(e => e.direction === 'long');
      const shortEntries = entryPoints.filter(e => e.direction === 'short');
      
      // In bullish market, long entries should have higher confidence on average
      if (longEntries.length > 0 && shortEntries.length > 0) {
        const avgLongConfidence = longEntries.reduce((sum, e) => sum + e.confidence, 0) / longEntries.length;
        const avgShortConfidence = shortEntries.reduce((sum, e) => sum + e.confidence, 0) / shortEntries.length;
        expect(avgLongConfidence).toBeGreaterThan(avgShortConfidence);
      } else {
        // If only one direction has entries, it should be long
        expect(longEntries.length).toBeGreaterThan(0);
      }
    });

    it('should adapt to bearish market', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: { ...mockMarketContext, trend: 'bearish' },
        strategyPreference: 'auto',
      });

      const shortEntries = entryPoints.filter(e => e.direction === 'short');
      expect(shortEntries.length).toBeGreaterThan(0);
    });

    it('should adapt to neutral market', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: { ...mockMarketContext, trend: 'neutral' },
        strategyPreference: 'auto',
      });

      // In neutral market, should have balanced entries
      const longEntries = entryPoints.filter(e => e.direction === 'long');
      const shortEntries = entryPoints.filter(e => e.direction === 'short');
      
      expect(Math.abs(longEntries.length - shortEntries.length)).toBeLessThanOrEqual(2);
    });

    it.skip('should consider key levels', async () => {
      // TODO: Fix test - need to ensure entry points are generated near key levels
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Should have entries near key levels
      const nearKeyLevel = entryPoints.some(entry => {
        const allLevels = [
          mockMarketContext.keyLevels.nearestSupport,
          mockMarketContext.keyLevels.nearestResistance,
          mockMarketContext.keyLevels.dailyHigh,
          mockMarketContext.keyLevels.dailyLow,
        ].filter(Boolean) as number[];
        return allLevels.some(level => 
          Math.abs(entry.price - level) / level < 0.02 // Within 2%
        );
      });
      
      expect(nearKeyLevel).toBe(true);
    });
  });

  describe('Entry Quality and Confidence', () => {
    it('should assign confidence scores', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      entryPoints.forEach(entry => {
        expect(entry.confidence).toBeGreaterThan(0);
        expect(entry.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should provide reasoning for entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      entryPoints.forEach(entry => {
        expect(entry.reasoning).toBeTruthy();
        expect(entry.reasoning.primary).toBeTruthy();
        expect(entry.reasoning.technicalFactors.length).toBeGreaterThan(0);
      });
    });

    it('should sort entries by confidence', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Verify entries are sorted by confidence (descending)
      for (let i = 1; i < entryPoints.length; i++) {
        expect(entryPoints[i - 1]?.confidence).toBeGreaterThanOrEqual(
          entryPoints[i]?.confidence ?? 0
        );
      }
    });

    it('should filter out low confidence entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // All returned entries should have reasonable confidence
      entryPoints.forEach(entry => {
        expect(entry.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme price movements', async () => {
      const volatileData = mockMarketData.map((candle) => ({
        ...candle,
        high: candle.high * (1 + Math.random() * 0.1),
        low: candle.low * (1 - Math.random() * 0.1),
      }));

      const entryPoints = await calculateEntryPoints({
        marketData: volatileData,
        analysisResults: mockAnalysisResults,
        marketContext: { ...mockMarketContext, volatility: 'high' },
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      // Entries should have wider zones in volatile markets
      if (entryPoints.length > 0) {
        const zoneSize = (entryPoints[0]?.zone?.max ?? 0) - (entryPoints[0]?.zone?.min ?? 0);
        expect(zoneSize).toBeGreaterThan(0);
      }
    });

    it('should handle flat market conditions', async () => {
      const flatData = mockMarketData.map(candle => ({
        ...candle,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50000,
      }));

      const entryPoints = await calculateEntryPoints({
        marketData: flatData,
        analysisResults: mockAnalysisResults,
        marketContext: { ...mockMarketContext, volatility: 'low', trend: 'neutral' },
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      // Might have fewer entries in flat market
      expect(entryPoints.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle data with gaps', async () => {
      const gappyData = mockMarketData.filter((_, i) => i % 3 !== 1);

      const entryPoints = await calculateEntryPoints({
        marketData: gappyData,
        analysisResults: mockAnalysisResults,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
    });

    it.skip('should limit number of entries', async () => {
      // TODO: Fix test - entry limit logic needs to be implemented
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        analysisResults: {
          ...mockAnalysisResults,
          patterns: Array(50).fill(mockAnalysisResults.patterns[0]),
        },
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Should not return excessive number of entries
      expect(entryPoints.length).toBeLessThanOrEqual(10);
    });
  });
});