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
    trend: 'bullish',
    volatility: 'normal',
    momentum: 'positive',
    volume: 'increasing',
    keyLevels: {
      support: [49000, 48500, 48000],
      resistance: [51000, 51500, 52000],
    },
    marketStructure: 'uptrend',
  };

  const mockAnalysisResults = {
    patterns: [
      {
        id: 'pattern-1',
        type: 'triangle',
        direction: 'bullish',
        targetPrice: 52000,
        confidence: 0.85,
      },
      {
        id: 'pattern-2',
        type: 'flag',
        direction: 'bearish',
        targetPrice: 48000,
        confidence: 0.75,
      },
    ],
    supportResistance: [
      { level: 50000, type: 'support', strength: 0.9 },
      { level: 51000, type: 'resistance', strength: 0.85 },
    ],
    trendlines: [
      {
        id: 'trendline-1',
        type: 'support',
        currentPrice: 49800,
        slope: 0.02,
      },
    ],
    indicators: {
      rsi: { value: 45, signal: 'oversold' },
      macd: { histogram: 50, signal: 'bullish' },
      bollingerBands: {
        upper: 51500,
        middle: 50000,
        lower: 48500,
      },
    },
  };

  describe('Basic Functionality', () => {
    it('should calculate entry points from market data', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
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
    it('should calculate scalping entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'scalping',
      });

      const scalpingEntries = entryPoints.filter(e => e.strategy === 'scalping');
      expect(scalpingEntries.length).toBeGreaterThan(0);
      
      // Scalping entries should have tight zones
      const entry = scalpingEntries[0];
      const zoneSize = Math.abs(entry.zone.end - entry.zone.start);
      const pricePercentage = zoneSize / entry.price;
      expect(pricePercentage).toBeLessThan(0.005); // Less than 0.5%
    });

    it('should calculate day trading entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'dayTrading',
      });

      const dayTradingEntries = entryPoints.filter(e => e.strategy === 'dayTrading');
      expect(dayTradingEntries.length).toBeGreaterThan(0);
    });

    it('should calculate swing trading entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'swingTrading',
      });

      const swingEntries = entryPoints.filter(e => e.strategy === 'swingTrading');
      expect(swingEntries.length).toBeGreaterThan(0);
      
      // Swing entries should have wider zones
      const entry = swingEntries[0];
      const zoneSize = Math.abs(entry.zone.end - entry.zone.start);
      const pricePercentage = zoneSize / entry.price;
      expect(pricePercentage).toBeGreaterThan(0.005); // More than 0.5%
    });

    it('should calculate position trading entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'position',
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

    it('should use support/resistance levels', async () => {
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
        analysisResults: undefined,
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
        marketContext: { ...mockMarketContext, trend: 'bullish' },
        strategyPreference: 'auto',
      });

      const longEntries = entryPoints.filter(e => e.direction === 'long');
      const shortEntries = entryPoints.filter(e => e.direction === 'short');
      
      // In bullish market, should have more long entries
      expect(longEntries.length).toBeGreaterThan(shortEntries.length);
    });

    it('should adapt to bearish market', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
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

    it('should consider key levels', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Should have entries near key levels
      const nearKeyLevel = entryPoints.some(entry => {
        const allLevels = [
          ...mockMarketContext.keyLevels.support,
          ...mockMarketContext.keyLevels.resistance,
        ];
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
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      entryPoints.forEach(entry => {
        expect(entry.reasoning).toBeTruthy();
        expect(entry.reasoning.length).toBeGreaterThan(0);
      });
    });

    it('should sort entries by confidence', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      // Verify entries are sorted by confidence (descending)
      for (let i = 1; i < entryPoints.length; i++) {
        expect(entryPoints[i - 1].confidence).toBeGreaterThanOrEqual(
          entryPoints[i].confidence
        );
      }
    });

    it('should filter out low confidence entries', async () => {
      const entryPoints = await calculateEntryPoints({
        marketData: mockMarketData,
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
        marketContext: { ...mockMarketContext, volatility: 'high' },
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      // Entries should have wider zones in volatile markets
      if (entryPoints.length > 0) {
        const zoneSize = entryPoints[0].zone.end - entryPoints[0].zone.start;
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
        marketContext: mockMarketContext,
        strategyPreference: 'auto',
      });

      expect(entryPoints).toBeDefined();
      expect(Array.isArray(entryPoints)).toBe(true);
    });

    it('should limit number of entries', async () => {
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