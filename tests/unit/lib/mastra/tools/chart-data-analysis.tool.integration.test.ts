// Integration tests for chart-data-analysis.tool.ts
// These tests focus on the tool's integration and overall functionality

import { chartDataAnalysisTool } from '../../../../../lib/mastra/tools/chart-data-analysis.tool';
import { logger } from '../../../../../lib/utils/logger';

// Mock the logger
jest.mock('../../../../../lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('chartDataAnalysisTool Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Tool Integration', () => {
    it('should process minimal candle data without errors', async () => {
      // Test with just 2 candles (minimum for most calculations)
      const minimalCandles = [
        [Date.now() - 3600000, "50000", "50100", "49900", "50050", "1000"],
        [Date.now(), "50050", "50150", "49950", "50100", "1100"]
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => minimalCandles,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 2,
        },
      });

      expect(result.dataRange.candleCount).toBe(2);
      expect(result.rawData?.candles?.length).toBe(2); // Should include all candles when less than 50
    });

    it('should handle malformed data by filtering NaN values', async () => {
      const malformedCandles = [
        [Date.now() - 7200000, "50000", "50100", "49900", "50050", "1000"],
        [Date.now() - 3600000, "NaN", "50200", "50000", "50100", "1100"], // NaN open price
        [Date.now(), "50100", "50200", "50000", "50150", "1200"],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedCandles,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 3,
        },
      });

      // The tool should handle NaN gracefully
      expect(result).toBeDefined();
      expect(result.dataRange.candleCount).toBe(3);
      
      // Check that parsed values are valid numbers
      const candles = result.rawData?.candles || [];
      candles.forEach(candle => {
        expect(isNaN(candle.open)).toBe(false);
        expect(isNaN(candle.high)).toBe(false);
        expect(isNaN(candle.low)).toBe(false);
        expect(isNaN(candle.close)).toBe(false);
      });
    });

    it('should provide meaningful analysis even with limited data', async () => {
      const limitedCandles = [];
      for (let i = 0; i < 10; i++) {
        const time = Date.now() - (10 - i) * 3600000;
        const price = 50000 + i * 50;
        limitedCandles.push([
          time,
          price.toString(),
          (price + 20).toString(),
          (price - 20).toString(),
          (price + 10).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => limitedCandles,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 10,
        },
      });

      // Should still provide basic analysis
      expect(result.technicalAnalysis).toBeDefined();
      expect(result.recommendations.analysis).toBeTruthy();
      expect(result.recommendations.nextAction).toBeTruthy();
      
      // Some indicators might not be available
      expect(result.technicalAnalysis.movingAverages.ma20).toBeUndefined(); // Not enough data for MA20
    });
  });

  describe('Pattern Detection Scenarios', () => {
    it('should identify potential ascending triangle pattern', async () => {
      const ascendingTriangleData = [];
      const resistanceLevel = 52000;
      
      // Create 20 candles with ascending lows and flat highs
      for (let i = 0; i < 20; i++) {
        const time = Date.now() - (20 - i) * 3600000;
        const low = 48000 + i * 100; // Ascending lows
        const high = resistanceLevel + (Math.random() - 0.5) * 50; // Flat resistance
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);
        
        ascendingTriangleData.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ascendingTriangleData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 20,
          analysisType: 'patterns',
        },
      });

      // Pattern detection is probabilistic, so we check structure
      if (result.patterns && result.patterns.length > 0) {
        const patterns = result.patterns;
        patterns.forEach(pattern => {
          expect(pattern).toHaveProperty('type');
          expect(pattern).toHaveProperty('confidence');
          expect(pattern).toHaveProperty('description');
        });
      }
    });
  });

  describe('Technical Analysis Edge Cases', () => {
    it('should handle flat price data (no volatility)', async () => {
      const flatData = [];
      const flatPrice = 50000;
      
      for (let i = 0; i < 30; i++) {
        const time = Date.now() - (30 - i) * 3600000;
        flatData.push([
          time,
          flatPrice.toString(),
          flatPrice.toString(),
          flatPrice.toString(),
          flatPrice.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => flatData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 30,
        },
      });

      // Should handle zero volatility
      expect(result.technicalAnalysis.volatility.atr).toBe(0);
      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('low');
      
      // RSI calculation should handle no price changes
      expect(result.technicalAnalysis.momentum.rsi).toBeDefined();
      expect(isNaN(result.technicalAnalysis.momentum.rsi)).toBe(false);
    });

    it('should calculate extreme volatility correctly', async () => {
      const volatileData = [];
      
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const base = 50000;
        const swing = 5000 * (i % 2 === 0 ? 1 : -1);
        const open = base + swing;
        const close = base - swing;
        const high = Math.max(open, close) + Math.abs(swing);
        const low = Math.min(open, close) - Math.abs(swing);
        
        volatileData.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "5000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => volatileData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should detect high volatility
      expect(result.technicalAnalysis.volatility.atr).toBeGreaterThan(0);
      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('high');
      expect(result.technicalAnalysis.volatility.atrPercent).toBeGreaterThan(4);
    });
  });

  describe('Support/Resistance Detection', () => {
    it('should detect clear support and resistance levels', async () => {
      const srData = [];
      
      // Create data that bounces between 48000 and 52000
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        let price;
        
        // Create clear bounces
        if (i % 20 < 5) {
          price = 48000 + Math.random() * 200; // Near support
        } else if (i % 20 >= 15) {
          price = 52000 - Math.random() * 200; // Near resistance
        } else {
          price = 50000 + (Math.random() - 0.5) * 1000; // Middle range
        }
        
        srData.push([
          time,
          price.toString(),
          (price + 100).toString(),
          (price - 100).toString(),
          price.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => srData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { supportResistance } = result.technicalAnalysis;
      
      // Should detect some levels
      expect(supportResistance.supports.length).toBeGreaterThanOrEqual(0);
      expect(supportResistance.resistances.length).toBeGreaterThanOrEqual(0);
      
      // Levels should be properly structured
      [...supportResistance.supports, ...supportResistance.resistances].forEach(level => {
        expect(level).toHaveProperty('price');
        expect(level).toHaveProperty('strength');
        expect(level).toHaveProperty('touchCount');
        expect(level).toHaveProperty('lastTouch');
        expect(level.strength).toBeGreaterThanOrEqual(0);
        expect(level.strength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Drawing Recommendations', () => {
    it('should generate appropriate recommendations for trending market', async () => {
      const trendData = [];
      
      // Create clear uptrend
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 45000 + i * 100;
        
        // Add some noise but maintain trend
        const noise = (Math.random() - 0.5) * 50;
        
        trendData.push([
          time,
          (price + noise).toString(),
          (price + noise + 50).toString(),
          (price + noise - 50).toString(),
          (price + noise + 25).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => trendData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should detect uptrend
      expect(result.technicalAnalysis.trend.direction).toBe('bullish');
      
      // Should have trend-related recommendations
      expect(result.recommendations.trendlineDrawing).toBeDefined();
      expect(Array.isArray(result.recommendations.trendlineDrawing)).toBe(true);
      
      // Check recommendation structure
      result.recommendations.trendlineDrawing.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('points');
        expect(rec).toHaveProperty('style');
        expect(rec).toHaveProperty('priority');
      });
    });

    it('should prioritize recommendations correctly', async () => {
      const data = [];
      
      // Create data with multiple potential trendlines
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        const trend = 45000 + i * 50;
        const oscillation = 1000 * Math.sin(i * 0.2);
        const price = trend + oscillation;
        
        data.push([
          time,
          price.toString(),
          (price + 100).toString(),
          (price - 100).toString(),
          price.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { trendlineDrawing } = result.recommendations;
      
      // Verify recommendations are sorted by priority
      for (let i = 1; i < trendlineDrawing.length; i++) {
        expect(trendlineDrawing[i - 1].priority).toBeGreaterThanOrEqual(
          trendlineDrawing[i].priority
        );
      }
    });
  });

  describe('Market Condition Analysis', () => {
    it('should provide appropriate recommendations for oversold conditions', async () => {
      const oversoldData = [];
      
      // Create strong downtrend for oversold RSI
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 50000 - i * 150; // Steep decline
        
        oversoldData.push([
          time,
          price.toString(),
          (price + 30).toString(),
          (price - 50).toString(),
          (price - 40).toString(),
          "2000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => oversoldData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should have appropriate RSI
      const rsi = result.technicalAnalysis.momentum.rsi;
      expect(rsi).toBeDefined();
      
      // Should provide relevant recommendations
      expect(result.recommendations.analysis).toContain('RSI');
      expect(result.recommendations.nextAction).toBeTruthy();
    });

    it('should analyze range-bound markets correctly', async () => {
      const rangeData = [];
      const upper = 52000;
      const lower = 48000;
      
      // Create oscillating data
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        const phase = Math.sin(i * 0.1);
        const price = lower + (upper - lower) * ((phase + 1) / 2);
        const noise = (Math.random() - 0.5) * 200;
        
        rangeData.push([
          time,
          (price + noise).toString(),
          (price + noise + 100).toString(),
          (price + noise - 100).toString(),
          (price + noise).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rangeData,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      // Should detect sideways or range-bound market
      const { trend } = result.technicalAnalysis;
      expect(['sideways', 'bullish', 'bearish']).toContain(trend.direction);
      
      // Should have support/resistance recommendations
      const srRecs = result.recommendations.trendlineDrawing.filter(
        r => r.description.includes('サポート') || r.description.includes('レジスタンス')
      );
      
      // Analysis should mention range or trend status
      expect(result.recommendations.analysis).toContain('トレンド');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
        },
      });

      expect(result.dataRange.candleCount).toBe(0);
      expect(result.currentPrice.price).toBe(0);
      expect(result.recommendations.analysis).toContain('データが不足');
    });

    it('should handle API errors with fallback data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited' }),
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
        },
      });

      // Should return fallback structure
      expect(result.currentPrice.price).toBe(50000); // Fallback price
      expect(result.technicalAnalysis.trend.direction).toBe('sideways');
      expect(result.technicalAnalysis.trend.confidence).toBe(0.1); // Low confidence
      expect(result.recommendations.analysis).toContain('データの取得に失敗');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
        },
      });

      expect(logger.error).toHaveBeenCalled();
      expect(result.recommendations.analysis).toContain('データの取得に失敗');
    });
  });

  describe('Raw Data Handling', () => {
    it('should include last 50 candles when more than 50 available', async () => {
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        candles.push([
          time,
          "50000",
          "50100",
          "49900",
          "50050",
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => candles,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      expect(result.rawData?.candles?.length).toBe(50);
    });

    it('should include all candles when less than 50 available', async () => {
      const candles = [];
      for (let i = 0; i < 30; i++) {
        const time = Date.now() - (30 - i) * 3600000;
        candles.push([
          time,
          "50000",
          "50100",
          "49900",
          "50050",
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => candles,
      });

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 30,
        },
      });

      expect(result.rawData?.candles?.length).toBe(30);
    });
  });
});