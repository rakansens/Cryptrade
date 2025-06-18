import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { chartDataAnalysisTool } from '@/lib/mastra/tools/chart-data-analysis.tool';
import { logger } from '@/lib/utils/logger';
import type { Candle, TechnicalAnalysis, Pattern } from '@/lib/mastra/tools/chart-data-analysis.tool';

// Mock logger
vi.mock('@/lib/utils/logger');

// Mock candlestick data generator
function generateMockCandles(count: number, trend: 'bullish' | 'bearish' | 'sideways' = 'sideways'): any[] {
  const basePrice = 50000;
  const candles = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < count; i++) {
    const time = Date.now() - (count - i) * 3600000; // 1 hour intervals
    
    // Apply trend
    if (trend === 'bullish') {
      currentPrice += Math.random() * 200 + 50;
    } else if (trend === 'bearish') {
      currentPrice -= Math.random() * 200 + 50;
    } else {
      currentPrice += (Math.random() - 0.5) * 300;
    }
    
    const volatility = currentPrice * 0.02;
    const open = currentPrice + (Math.random() - 0.5) * volatility;
    const close = currentPrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = 1000000 + Math.random() * 500000;
    
    candles.push([time, open.toString(), high.toString(), low.toString(), close.toString(), volume.toString()]);
  }
  
  return candles;
}

// MSW server setup
const server = setupServer(
  rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
    const symbol = req.url.searchParams.get('symbol');
    const interval = req.url.searchParams.get('interval');
    const limit = parseInt(req.url.searchParams.get('limit') || '200');
    
    // Generate mock data based on parameters
    const mockCandles = generateMockCandles(limit);
    
    return res(ctx.json(mockCandles));
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('ChartDataAnalysisTool', () => {
  describe('Basic Functionality', () => {
    it('should fetch and analyze chart data with default parameters', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframe).toBe('1h');
      expect(result.dataRange.candleCount).toBe(200);
      expect(result.currentPrice.price).toBeGreaterThan(0);
      expect(result.technicalAnalysis).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should fetch data with custom parameters', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'ETHUSDT',
          timeframe: '4h',
          limit: 100,
          analysisType: 'trend'
        }
      });
      
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.timeframe).toBe('4h');
      expect(result.dataRange.candleCount).toBe(100);
    });

    it('should handle different analysis types', async () => {
      const analysisTypes = ['full', 'trend', 'support_resistance', 'patterns', 'volatility'];
      
      for (const analysisType of analysisTypes) {
        const result = await chartDataAnalysisTool.execute({
          context: {
            analysisType: analysisType as any
          }
        });
        
        expect(result).toBeDefined();
        expect(result.technicalAnalysis).toBeDefined();
        
        if (analysisType === 'full' || analysisType === 'patterns') {
          expect(result.patterns).toBeDefined();
        }
      }
    });
  });

  describe('Technical Analysis', () => {
    it('should calculate trend analysis correctly', async () => {
      // Mock bullish trend data
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const mockCandles = generateMockCandles(200, 'bullish');
          return res(ctx.json(mockCandles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: { analysisType: 'trend' }
      });
      
      expect(result.technicalAnalysis.trend).toBeDefined();
      expect(result.technicalAnalysis.trend.direction).toMatch(/bullish|bearish|sideways/);
      expect(result.technicalAnalysis.trend.strength).toBeGreaterThanOrEqual(0);
      expect(result.technicalAnalysis.trend.strength).toBeLessThanOrEqual(1);
      expect(result.technicalAnalysis.trend.confidence).toBeGreaterThanOrEqual(0);
      expect(result.technicalAnalysis.trend.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate support and resistance levels', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { analysisType: 'support_resistance' }
      });
      
      const { supportResistance } = result.technicalAnalysis;
      expect(supportResistance).toBeDefined();
      expect(Array.isArray(supportResistance.supports)).toBe(true);
      expect(Array.isArray(supportResistance.resistances)).toBe(true);
      
      // Check support structure
      if (supportResistance.supports.length > 0) {
        const support = supportResistance.supports[0];
        expect(support.price).toBeGreaterThan(0);
        expect(support.strength).toBeGreaterThanOrEqual(0);
        expect(support.strength).toBeLessThanOrEqual(1);
        expect(support.touchCount).toBeGreaterThanOrEqual(2);
        expect(support.lastTouch).toBeGreaterThan(0);
      }
    });

    it('should calculate momentum indicators', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { lookbackPeriod: 50 }
      });
      
      const { momentum } = result.technicalAnalysis;
      expect(momentum).toBeDefined();
      
      // RSI
      expect(momentum.rsi).toBeGreaterThanOrEqual(0);
      expect(momentum.rsi).toBeLessThanOrEqual(100);
      
      // MACD
      expect(momentum.macd).toBeDefined();
      expect(typeof momentum.macd.macd).toBe('number');
      expect(typeof momentum.macd.signal).toBe('number');
      expect(typeof momentum.macd.histogram).toBe('number');
    });

    it('should calculate volatility metrics', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { analysisType: 'volatility' }
      });
      
      const { volatility } = result.technicalAnalysis;
      expect(volatility).toBeDefined();
      expect(volatility.atr).toBeGreaterThan(0);
      expect(volatility.atrPercent).toBeGreaterThan(0);
      expect(volatility.volatilityLevel).toMatch(/low|medium|high/);
    });

    it('should calculate moving averages', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { limit: 250 } // Ensure enough data for MA200
      });
      
      const { movingAverages } = result.technicalAnalysis;
      expect(movingAverages).toBeDefined();
      
      if (movingAverages.ma20 !== undefined) {
        expect(movingAverages.ma20).toBeGreaterThan(0);
      }
      if (movingAverages.ma50 !== undefined) {
        expect(movingAverages.ma50).toBeGreaterThan(0);
      }
      if (movingAverages.ema12 !== undefined) {
        expect(movingAverages.ema12).toBeGreaterThan(0);
      }
      if (movingAverages.ema26 !== undefined) {
        expect(movingAverages.ema26).toBeGreaterThan(0);
      }
    });
  });

  describe('Pattern Detection', () => {
    it('should detect chart patterns when requested', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { analysisType: 'patterns' }
      });
      
      if (result.patterns && result.patterns.length > 0) {
        const pattern = result.patterns[0];
        expect(pattern.type).toBeTruthy();
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
        expect(pattern.timeframe).toBeTruthy();
        expect(pattern.description).toBeTruthy();
      }
    });

    it('should detect ascending triangle pattern', async () => {
      // Mock data that forms an ascending triangle
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const candles = [];
          const basePrice = 50000;
          
          // Create ascending triangle pattern
          for (let i = 0; i < 200; i++) {
            const time = Date.now() - (200 - i) * 3600000;
            const resistanceLevel = basePrice + 1000;
            
            // Gradually increasing lows
            const low = basePrice + (i / 200) * 500 - Math.random() * 100;
            
            // Highs hitting resistance
            const high = i % 20 === 0 ? resistanceLevel : resistanceLevel - Math.random() * 200;
            
            const open = (high + low) / 2 + (Math.random() - 0.5) * 100;
            const close = (high + low) / 2 + (Math.random() - 0.5) * 100;
            const volume = 1000000 + Math.random() * 500000;
            
            candles.push([
              time,
              open.toString(),
              Math.max(open, close, high).toString(),
              Math.min(open, close, low).toString(),
              close.toString(),
              volume.toString()
            ]);
          }
          
          return res(ctx.json(candles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: { analysisType: 'patterns' }
      });
      
      // Pattern detection might find the ascending triangle
      if (result.patterns && result.patterns.length > 0) {
        const ascendingTriangle = result.patterns.find(p => p.type === 'ascending_triangle');
        if (ascendingTriangle) {
          expect(ascendingTriangle.confidence).toBeGreaterThan(0);
          expect(ascendingTriangle.description).toContain('上昇三角形');
        }
      }
    });
  });

  describe('Drawing Recommendations', () => {
    it('should generate trendline recommendations', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations.trendlineDrawing)).toBe(true);
      
      if (result.recommendations.trendlineDrawing.length > 0) {
        const recommendation = result.recommendations.trendlineDrawing[0];
        expect(recommendation.type).toMatch(/trendline|fibonacci|horizontal/);
        expect(recommendation.description).toBeTruthy();
        expect(Array.isArray(recommendation.points)).toBe(true);
        expect(recommendation.points.length).toBeGreaterThanOrEqual(2);
        
        // Check point structure
        const point = recommendation.points[0];
        expect(point.time).toBeGreaterThan(0);
        expect(point.price).toBeGreaterThan(0);
        
        // Check style
        expect(recommendation.style).toBeDefined();
        expect(recommendation.style.color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(recommendation.style.lineWidth).toBeGreaterThan(0);
        expect(recommendation.style.lineStyle).toMatch(/solid|dashed|dotted/);
        
        expect(recommendation.priority).toBeGreaterThanOrEqual(1);
        expect(recommendation.priority).toBeLessThanOrEqual(10);
      }
    });

    it('should prioritize recommendations correctly', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      const recommendations = result.recommendations.trendlineDrawing;
      
      // Check that recommendations are sorted by priority (descending)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].priority).toBeGreaterThanOrEqual(recommendations[i].priority);
      }
    });

    it('should generate appropriate analysis summary', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result.recommendations.analysis).toBeTruthy();
      expect(result.recommendations.analysis).toContain('チャート分析結果');
      expect(result.recommendations.nextAction).toBeTruthy();
    });

    it('should provide context-aware next actions', async () => {
      // Test with high RSI
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          // Generate overbought conditions
          const candles = generateMockCandles(200, 'bullish');
          return res(ctx.json(candles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      // Should recommend caution or profit-taking
      expect(result.recommendations.nextAction).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.dataRange.candleCount).toBe(0);
      expect(result.currentPrice.price).toBe(50000); // Fallback price
      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis failed',
        expect.any(Object)
      );
    });

    it('should handle empty data gracefully', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result).toBeDefined();
      expect(result.dataRange.candleCount).toBe(0);
      expect(result.technicalAnalysis).toBeDefined();
    });

    it('should handle malformed data', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          return res(ctx.json([
            ['invalid', 'data', 'format'],
            [12345, 'not', 'enough', 'fields']
          ]));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Raw Data Output', () => {
    it('should include raw candle data when requested', async () => {
      const result = await chartDataAnalysisTool.execute({
        context: { limit: 100 }
      });
      
      if (result.rawData?.candles) {
        expect(Array.isArray(result.rawData.candles)).toBe(true);
        expect(result.rawData.candles.length).toBeLessThanOrEqual(50); // Last 50 candles
        
        if (result.rawData.candles.length > 0) {
          const candle = result.rawData.candles[0];
          expect(candle.time).toBeGreaterThan(0);
          expect(candle.open).toBeGreaterThan(0);
          expect(candle.high).toBeGreaterThan(0);
          expect(candle.low).toBeGreaterThan(0);
          expect(candle.close).toBeGreaterThan(0);
          expect(candle.volume).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Time Frame Support', () => {
    it('should support all major timeframes', async () => {
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      
      for (const timeframe of timeframes) {
        const result = await chartDataAnalysisTool.execute({
          context: { timeframe, limit: 50 }
        });
        
        expect(result.timeframe).toBe(timeframe);
        expect(result.dataRange).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await chartDataAnalysisTool.execute({
        context: { limit: 500, analysisType: 'full' }
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const limit = parseInt(req.url.searchParams.get('limit') || '1000');
          const mockCandles = generateMockCandles(limit);
          return res(ctx.json(mockCandles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: { limit: 1000 }
      });
      
      expect(result.dataRange.candleCount).toBe(1000);
      expect(result.technicalAnalysis).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle data with extreme values', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const candles = [
            [Date.now(), '0.00001', '0.00002', '0.000005', '0.000015', '100'],
            [Date.now() + 3600000, '1000000', '2000000', '900000', '1500000', '100000000']
          ];
          return res(ctx.json(candles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: { limit: 2 }
      });
      
      expect(result).toBeDefined();
      expect(result.technicalAnalysis).toBeDefined();
    });

    it('should handle identical prices (no volatility)', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const candles = [];
          const price = 50000;
          
          for (let i = 0; i < 100; i++) {
            candles.push([
              Date.now() - (100 - i) * 3600000,
              price.toString(),
              price.toString(),
              price.toString(),
              price.toString(),
              '1000000'
            ]);
          }
          
          return res(ctx.json(candles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('low');
      expect(result.technicalAnalysis.trend.direction).toBe('sideways');
    });

    it('should handle data gaps', async () => {
      server.use(
        rest.get('https://api.binance.com/api/v3/klines', (req, res, ctx) => {
          const candles = [];
          
          // Add candles with gaps
          for (let i = 0; i < 50; i++) {
            if (i % 10 !== 5) { // Skip every 10th candle to create gaps
              candles.push([
                Date.now() - (50 - i) * 3600000,
                '50000',
                '51000',
                '49000',
                '50500',
                '1000000'
              ]);
            }
          }
          
          return res(ctx.json(candles));
        })
      );
      
      const result = await chartDataAnalysisTool.execute({
        context: {}
      });
      
      expect(result).toBeDefined();
      expect(result.dataRange.candleCount).toBeLessThan(50);
    });
  });
});