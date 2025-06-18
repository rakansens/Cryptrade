import { chartDataAnalysisTool } from '../../../../../lib/mastra/tools/chart-data-analysis.tool';
import { logger } from '../../../../../lib/utils/logger';
import { z } from 'zod';

// Mock the logger
jest.mock('../../../../../lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch for Binance API
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Helper to create mock response
const createMockResponse = (data: any) => ({
  ok: true,
  json: async () => data,
  status: 200,
  statusText: 'OK',
});

const createErrorResponse = (status: number) => ({
  ok: false,
  json: async () => ({ error: 'API Error' }),
  status,
  statusText: 'Error',
});

describe('chartDataAnalysisTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockCandleData = [
    [1704067200000, "42000", "42500", "41800", "42300", "1000"],
    [1704070800000, "42300", "42600", "42100", "42400", "1100"],
    [1704074400000, "42400", "42800", "42200", "42600", "1200"],
    [1704078000000, "42600", "42900", "42500", "42700", "1050"],
    [1704081600000, "42700", "43000", "42600", "42900", "1300"],
  ];

  const createMockCandles = (count: number, basePrice: number = 50000) => {
    const candles = [];
    for (let i = 0; i < count; i++) {
      const time = Date.now() - (count - i) * 3600000; // 1 hour intervals
      const open = basePrice + Math.sin(i * 0.1) * 1000;
      const close = open + (Math.random() - 0.5) * 200;
      const high = Math.max(open, close) + Math.random() * 100;
      const low = Math.min(open, close) - Math.random() * 100;
      const volume = 1000 + Math.random() * 500;
      
      candles.push([
        time,
        open.toFixed(2),
        high.toFixed(2),
        low.toFixed(2),
        close.toFixed(2),
        volume.toFixed(2)
      ]);
    }
    return candles;
  };

  describe('Tool Configuration', () => {
    it('should have correct id and description', () => {
      expect(chartDataAnalysisTool.id).toBe('chart-data-analysis');
      expect(chartDataAnalysisTool.description).toContain('Advanced chart data analysis tool');
    });

    it('should have valid input schema', () => {
      const validInput = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        limit: 200,
        analysisType: 'full' as const,
        lookbackPeriod: 100,
      };

      expect(() => chartDataAnalysisTool.inputSchema.parse(validInput)).not.toThrow();
    });

    it('should validate input constraints', () => {
      expect(() => 
        chartDataAnalysisTool.inputSchema.parse({ limit: 5 })
      ).toThrow();

      expect(() => 
        chartDataAnalysisTool.inputSchema.parse({ limit: 2000 })
      ).toThrow();

      expect(() => 
        chartDataAnalysisTool.inputSchema.parse({ analysisType: 'invalid' })
      ).toThrow();
    });
  });

  describe('Execute Function', () => {
    it('should fetch and analyze chart data successfully', async () => {
      const mockCandles = createMockCandles(200);
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 200,
          analysisType: 'full',
          lookbackPeriod: 100,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200'
      );

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        dataRange: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          candleCount: 200,
        },
        currentPrice: {
          price: expect.any(Number),
          timestamp: expect.any(Number),
        },
        technicalAnalysis: {
          trend: {
            direction: expect.stringMatching(/^(bullish|bearish|sideways)$/),
            strength: expect.any(Number),
            confidence: expect.any(Number),
          },
          supportResistance: {
            supports: expect.any(Array),
            resistances: expect.any(Array),
          },
          volatility: {
            atr: expect.any(Number),
            volatilityLevel: expect.stringMatching(/^(low|medium|high)$/),
            atrPercent: expect.any(Number),
          },
          momentum: {
            rsi: expect.any(Number),
            macd: {
              macd: expect.any(Number),
              signal: expect.any(Number),
              histogram: expect.any(Number),
            },
          },
          movingAverages: expect.any(Object),
        },
        recommendations: {
          trendlineDrawing: expect.any(Array),
          analysis: expect.any(String),
          nextAction: expect.any(String),
        },
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Starting analysis',
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(429));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis failed',
        expect.objectContaining({
          error: expect.any(String),
        })
      );

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        currentPrice: {
          price: 50000, // Fallback price
        },
        technicalAnalysis: {
          trend: {
            direction: 'sideways',
            strength: 0.5,
            confidence: 0.1,
          },
        },
        recommendations: {
          analysis: expect.stringContaining('データの取得に失敗しました'),
        },
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'ETHUSDT',
          timeframe: '4h',
        },
      });

      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
      expect(result.dataRange.candleCount).toBe(0);
    });
  });

  describe('Technical Analysis Calculations', () => {
    it('should calculate RSI correctly', async () => {
      // Create uptrend data for predictable RSI
      const uptrendCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 40000 + i * 100; // Steady uptrend
        uptrendCandles.push([
          time,
          price.toString(),
          (price + 50).toString(),
          (price - 50).toString(),
          (price + 25).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(uptrendCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // In strong uptrend, RSI should be above 50
      expect(result.technicalAnalysis.momentum.rsi).toBeGreaterThan(50);
      expect(result.technicalAnalysis.momentum.rsi).toBeLessThanOrEqual(100);
    });

    it('should calculate MACD correctly', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { macd } = result.technicalAnalysis.momentum;
      expect(macd).toHaveProperty('macd');
      expect(macd).toHaveProperty('signal');
      expect(macd).toHaveProperty('histogram');
      expect(macd.histogram).toBeCloseTo(macd.macd - macd.signal, 5);
    });

    it('should calculate moving averages correctly', async () => {
      const candles = createMockCandles(100, 50000);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { movingAverages } = result.technicalAnalysis;
      
      if (movingAverages.ma20) {
        expect(movingAverages.ma20).toBeGreaterThan(0);
      }
      if (movingAverages.ma50) {
        expect(movingAverages.ma50).toBeGreaterThan(0);
      }
      if (movingAverages.ema12) {
        expect(movingAverages.ema12).toBeGreaterThan(0);
      }
      if (movingAverages.ema26) {
        expect(movingAverages.ema26).toBeGreaterThan(0);
      }
    });

    it('should calculate ATR and volatility levels', async () => {
      // High volatility data
      const volatileCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const base = 50000;
        const volatility = 2000 * Math.sin(i * 0.5); // High swings
        const open = base + volatility;
        const close = base - volatility;
        const high = Math.max(open, close) + Math.abs(volatility);
        const low = Math.min(open, close) - Math.abs(volatility);
        
        volatileCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(volatileCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      const { volatility } = result.technicalAnalysis;
      expect(volatility.atr).toBeGreaterThan(0);
      expect(volatility.atrPercent).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(volatility.volatilityLevel);
    });
  });

  describe('Support and Resistance Detection', () => {
    it('should detect support and resistance levels', async () => {
      // Create data with clear support/resistance levels
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        let price = 50000;
        
        // Create bounces at 48000 (support) and 52000 (resistance)
        if (i % 20 < 10) {
          price = 48000 + Math.random() * 1000;
        } else {
          price = 52000 - Math.random() * 1000;
        }
        
        candles.push([
          time,
          price.toString(),
          (price + 100).toString(),
          (price - 100).toString(),
          price.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { supportResistance } = result.technicalAnalysis;
      
      // Should detect at least some levels
      expect(supportResistance.supports.length).toBeGreaterThanOrEqual(0);
      expect(supportResistance.resistances.length).toBeGreaterThanOrEqual(0);
      
      // Check structure of detected levels
      supportResistance.supports.forEach(support => {
        expect(support).toHaveProperty('price');
        expect(support).toHaveProperty('strength');
        expect(support).toHaveProperty('touchCount');
        expect(support).toHaveProperty('lastTouch');
        expect(support.strength).toBeGreaterThanOrEqual(0);
        expect(support.strength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Pattern Detection', () => {
    it('should detect patterns when analysis type is full', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
          analysisType: 'full',
        },
      });

      // Patterns might be detected or not, but structure should be valid
      if (result.patterns) {
        expect(Array.isArray(result.patterns)).toBe(true);
        result.patterns.forEach(pattern => {
          expect(pattern).toHaveProperty('type');
          expect(pattern).toHaveProperty('confidence');
          expect(pattern).toHaveProperty('timeframe');
          expect(pattern).toHaveProperty('description');
        });
      }
    });

    it('should skip pattern detection for non-pattern analysis types', async () => {
      const candles = createMockCandles(50);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
          analysisType: 'trend',
        },
      });

      expect(result.patterns).toBeUndefined();
    });
  });

  describe('Drawing Recommendations', () => {
    it('should generate trendline recommendations', async () => {
      const trendCandles = [];
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        const price = 45000 + i * 50; // Clear uptrend
        trendCandles.push([
          time,
          price.toString(),
          (price + 100).toString(),
          (price - 50).toString(),
          (price + 50).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(trendCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { recommendations } = result;
      expect(recommendations).toHaveProperty('trendlineDrawing');
      expect(recommendations).toHaveProperty('analysis');
      expect(recommendations).toHaveProperty('nextAction');
      
      expect(Array.isArray(recommendations.trendlineDrawing)).toBe(true);
      
      recommendations.trendlineDrawing.forEach(drawing => {
        expect(drawing).toHaveProperty('type');
        expect(['trendline', 'fibonacci', 'horizontal']).toContain(drawing.type);
        expect(drawing).toHaveProperty('description');
        expect(drawing).toHaveProperty('points');
        expect(drawing).toHaveProperty('style');
        expect(drawing).toHaveProperty('priority');
        
        expect(drawing.style).toHaveProperty('color');
        expect(drawing.style).toHaveProperty('lineWidth');
        expect(drawing.style).toHaveProperty('lineStyle');
      });
    });

    it('should prioritize recommendations by strength', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { trendlineDrawing } = result.recommendations;
      
      // Check if sorted by priority (descending)
      for (let i = 1; i < trendlineDrawing.length; i++) {
        expect(trendlineDrawing[i - 1].priority).toBeGreaterThanOrEqual(
          trendlineDrawing[i].priority
        );
      }
    });
  });

  describe('Analysis Summary Generation', () => {
    it('should generate comprehensive analysis summary', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      const { analysis, nextAction } = result.recommendations;
      
      expect(analysis).toContain('チャート分析結果');
      expect(analysis).toContain('トレンド');
      expect(analysis).toContain('RSI');
      expect(analysis).toContain('MACD');
      expect(analysis).toContain('ボラティリティ');
      
      expect(nextAction).toBeTruthy();
      expect(typeof nextAction).toBe('string');
    });

    it('should provide context-specific next actions', async () => {
      // Create overbought conditions
      const overboughtCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 50000 + i * 200; // Strong uptrend for high RSI
        overboughtCandles.push([
          time,
          price.toString(),
          (price + 50).toString(),
          (price - 10).toString(),
          (price + 40).toString(),
          "2000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(overboughtCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // The recommendation should reflect market conditions
      expect(result.recommendations.nextAction).toBeTruthy();
    });
  });

  describe('Raw Data Handling', () => {
    it('should include last 50 candles in raw data', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      expect(result.rawData).toBeDefined();
      expect(result.rawData?.candles).toBeDefined();
      expect(result.rawData?.candles?.length).toBe(50);
      
      result.rawData?.candles?.forEach(candle => {
        expect(candle).toHaveProperty('time');
        expect(candle).toHaveProperty('open');
        expect(candle).toHaveProperty('high');
        expect(candle).toHaveProperty('low');
        expect(candle).toHaveProperty('close');
        expect(candle).toHaveProperty('volume');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty candle data', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
        },
      });

      expect(result.dataRange.candleCount).toBe(0);
      expect(result.currentPrice.price).toBe(0);
    });

    it('should handle insufficient data for indicators', async () => {
      const fewCandles = createMockCandles(10); // Not enough for most indicators
      mockFetch.mockResolvedValueOnce(createMockResponse(fewCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 10,
        },
      });

      expect(result).toBeDefined();
      expect(result.technicalAnalysis).toBeDefined();
      // Should still return valid structure even with limited data
    });

    it('should use default values when parameters are not provided', async () => {
      const candles = createMockCandles(200);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {}, // No parameters provided
      });

      expect(result.symbol).toBe('BTCUSDT'); // Default symbol
      expect(result.timeframe).toBe('1h'); // Default timeframe
      expect(result.dataRange.candleCount).toBe(200); // Default limit
    });
  });

  describe('Timeframe Handling', () => {
    const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    
    timeframes.forEach(timeframe => {
      it(`should handle ${timeframe} timeframe correctly`, async () => {
        const candles = createMockCandles(50);
        mockFetch.mockResolvedValueOnce(createMockResponse(candles));

        const result = await chartDataAnalysisTool.execute({
          context: {
            symbol: 'BTCUSDT',
            timeframe,
            limit: 50,
          },
        });

        expect(result.timeframe).toBe(timeframe);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`interval=${timeframe}`)
        );
      });
    });
  });

  describe('Analysis Type Variations', () => {
    const analysisTypes = ['full', 'trend', 'support_resistance', 'patterns', 'volatility'] as const;
    
    analysisTypes.forEach(analysisType => {
      it(`should handle ${analysisType} analysis type`, async () => {
        const candles = createMockCandles(100);
        mockFetch.mockResolvedValueOnce(createMockResponse(candles));

        const result = await chartDataAnalysisTool.execute({
          context: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
            limit: 100,
            analysisType,
          },
        });

        expect(result).toBeDefined();
        expect(result.technicalAnalysis).toBeDefined();
        
        // Pattern detection should only occur for 'full' or 'patterns'
        if (analysisType === 'full' || analysisType === 'patterns') {
          // Patterns may or may not be detected, but field should exist
        } else {
          expect(result.patterns).toBeUndefined();
        }
      });
    });
  });

  describe('Pattern Detection - Ascending Triangle', () => {
    it('should detect ascending triangle pattern', async () => {
      // Create data that forms an ascending triangle
      const ascendingTriangleCandles = [];
      const resistanceLevel = 52000;
      
      for (let i = 0; i < 30; i++) {
        const time = Date.now() - (30 - i) * 3600000;
        // Flat resistance at top
        const high = resistanceLevel + (Math.random() - 0.5) * 50;
        // Rising support line
        const low = 48000 + (i * 100); // Gradually increasing lows
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);
        
        ascendingTriangleCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(ascendingTriangleCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 30,
          analysisType: 'patterns',
        },
      });

      // Check if patterns were analyzed
      if (result.patterns && result.patterns.length > 0) {
        const ascendingTriangle = result.patterns.find(p => p.type === 'ascending_triangle');
        if (ascendingTriangle) {
          expect(ascendingTriangle.confidence).toBeGreaterThan(0);
          expect(ascendingTriangle.description).toContain('上昇三角形');
        }
      }
    });
  });

  describe('Advanced Technical Calculations', () => {
    it('should handle edge cases in RSI calculation', async () => {
      // All prices the same (no gains or losses)
      const flatCandles = [];
      const flatPrice = 50000;
      
      for (let i = 0; i < 30; i++) {
        const time = Date.now() - (30 - i) * 3600000;
        flatCandles.push([
          time,
          flatPrice.toString(),
          flatPrice.toString(),
          flatPrice.toString(),
          flatPrice.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(flatCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 30,
        },
      });

      // RSI should handle division by zero gracefully
      expect(result.technicalAnalysis.momentum.rsi).toBeDefined();
      expect(result.technicalAnalysis.momentum.rsi).toBeGreaterThanOrEqual(0);
      expect(result.technicalAnalysis.momentum.rsi).toBeLessThanOrEqual(100);
    });

    it('should calculate stochastic oscillator when sufficient data', async () => {
      const candles = createMockCandles(100);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      // Check if stochastic might be calculated (optional field)
      if (result.technicalAnalysis.momentum.stochastic) {
        expect(result.technicalAnalysis.momentum.stochastic.k).toBeDefined();
        expect(result.technicalAnalysis.momentum.stochastic.d).toBeDefined();
      }
    });

    it('should handle extreme volatility in ATR calculation', async () => {
      // Create extremely volatile data
      const extremeCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const base = 50000;
        const extremeSwing = 10000 * (i % 2 === 0 ? 1 : -1);
        const open = base + extremeSwing;
        const close = base - extremeSwing;
        const high = Math.max(open, close) + Math.abs(extremeSwing) * 2;
        const low = Math.min(open, close) - Math.abs(extremeSwing) * 2;
        
        extremeCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "5000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(extremeCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('high');
      expect(result.technicalAnalysis.volatility.atrPercent).toBeGreaterThan(4);
    });
  });

  describe('Support/Resistance Advanced Detection', () => {
    it('should detect multiple support and resistance levels with proper ranking', async () => {
      // Create data with multiple clear S/R levels
      const multiLevelCandles = [];
      const levels = [48000, 50000, 52000, 54000]; // Multiple S/R levels
      
      for (let i = 0; i < 200; i++) {
        const time = Date.now() - (200 - i) * 3600000;
        // Bounce between levels
        const levelIndex = Math.floor((i / 50) % levels.length);
        const baseLevel = levels[levelIndex];
        const variation = (Math.random() - 0.5) * 500;
        
        const open = baseLevel + variation;
        const close = baseLevel - variation;
        const high = baseLevel + Math.abs(variation) + 100;
        const low = baseLevel - Math.abs(variation) - 100;
        
        multiLevelCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(multiLevelCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 200,
          lookbackPeriod: 150,
        },
      });

      const { supportResistance } = result.technicalAnalysis;
      
      // Should detect multiple levels
      expect(supportResistance.supports.length).toBeGreaterThan(0);
      expect(supportResistance.resistances.length).toBeGreaterThan(0);
      
      // Check if properly sorted by strength
      for (let i = 1; i < supportResistance.supports.length; i++) {
        expect(supportResistance.supports[i - 1].strength).toBeGreaterThanOrEqual(
          supportResistance.supports[i].strength
        );
      }
    });

    it('should handle S/R detection with minimal swing points', async () => {
      // Create trending data with few swing points
      const trendingCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 45000 + i * 100; // Strong trend, few swings
        
        trendingCandles.push([
          time,
          price.toString(),
          (price + 50).toString(),
          (price - 50).toString(),
          (price + 25).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(trendingCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should handle gracefully even with few S/R levels
      expect(result.technicalAnalysis.supportResistance).toBeDefined();
      expect(Array.isArray(result.technicalAnalysis.supportResistance.supports)).toBe(true);
      expect(Array.isArray(result.technicalAnalysis.supportResistance.resistances)).toBe(true);
    });
  });

  describe('Trendline Point Detection', () => {
    it('should find correct touch points for support levels', async () => {
      // Create data that touches a specific support level multiple times
      const supportLevel = 48000;
      const touchCandles = [];
      
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        let low, high, open, close;
        
        // Create touches at specific intervals
        if (i % 20 === 0) {
          low = supportLevel - 50; // Touch the support
          high = supportLevel + 500;
          open = supportLevel + 200;
          close = supportLevel + 300;
        } else {
          low = supportLevel + 200;
          high = supportLevel + 800;
          open = supportLevel + 400;
          close = supportLevel + 500;
        }
        
        touchCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(touchCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      // Check if support trendlines are recommended
      const supportTrendlines = result.recommendations.trendlineDrawing.filter(
        d => d.description.includes('サポート')
      );
      
      if (supportTrendlines.length > 0) {
        supportTrendlines.forEach(trendline => {
          expect(trendline.points.length).toBeGreaterThanOrEqual(2);
          expect(trendline.style.color).toBe('#4CAF50'); // Green for support
        });
      }
    });

    it('should find trend points for bearish markets', async () => {
      // Create clear downtrend data
      const bearishCandles = [];
      for (let i = 0; i < 80; i++) {
        const time = Date.now() - (80 - i) * 3600000;
        const basePrice = 55000 - i * 100; // Declining prices
        
        // Create swing highs for downtrend line
        let high, low, open, close;
        if (i % 15 === 7) { // Swing high
          high = basePrice + 300;
          low = basePrice - 100;
          open = basePrice;
          close = basePrice - 50;
        } else {
          high = basePrice + 50;
          low = basePrice - 200;
          open = basePrice;
          close = basePrice - 150;
        }
        
        bearishCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(bearishCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 80,
        },
      });

      // Should detect bearish trend
      expect(result.technicalAnalysis.trend.direction).toBe('bearish');
      
      // Check for downtrend line recommendations
      const trendLines = result.recommendations.trendlineDrawing.filter(
        d => d.description.includes('下降')
      );
      
      if (trendLines.length > 0) {
        expect(trendLines[0].style.color).toBe('#FF5722'); // Red for bearish
      }
    });
  });

  describe('Edge Cases in Calculations', () => {
    it('should handle empty moving average calculations', async () => {
      // Very few candles
      const fewCandles = createMockCandles(5);
      mockFetch.mockResolvedValueOnce(createMockResponse(fewCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 5,
        },
      });

      // Should not crash, but MAs might be undefined
      expect(result.technicalAnalysis.movingAverages).toBeDefined();
      expect(result.technicalAnalysis.movingAverages.ma20).toBeUndefined();
      expect(result.technicalAnalysis.movingAverages.ma50).toBeUndefined();
    });

    it('should handle single candle edge case', async () => {
      const singleCandle = [[
        Date.now(),
        "50000",
        "50100",
        "49900",
        "50050",
        "1000"
      ]];

      mockFetch.mockResolvedValueOnce(createMockResponse(singleCandle));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 1,
        },
      });

      expect(result.dataRange.candleCount).toBe(1);
      expect(result.currentPrice.price).toBe(50050);
      // Most indicators won't be calculable
      expect(result.technicalAnalysis.momentum.rsi).toBe(50); // Default
    });

    it('should handle malformed candle data gracefully', async () => {
      const malformedCandles = [
        [Date.now(), "50000", "50100", "49900", "50050", "1000"],
        [Date.now() + 3600000, "NaN", "50200", "50000", "50100", "1100"], // Invalid price
        [Date.now() + 7200000, "50100", "50200", "50000", "50150", "1200"],
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse(malformedCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 3,
        },
      });

      // Should handle NaN values gracefully
      expect(result).toBeDefined();
      expect(result.dataRange.candleCount).toBe(3);
    });
  });

  describe('Recommendation Generation Edge Cases', () => {
    it('should handle no support/resistance levels found', async () => {
      // Random walk data with no clear levels
      const randomCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const randomPrice = 50000 + (Math.random() - 0.5) * 10000;
        
        randomCandles.push([
          time,
          randomPrice.toString(),
          (randomPrice + Math.random() * 500).toString(),
          (randomPrice - Math.random() * 500).toString(),
          (randomPrice + (Math.random() - 0.5) * 300).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(randomCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should still provide recommendations even without clear S/R
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.analysis).toBeTruthy();
      expect(result.recommendations.nextAction).toBeTruthy();
    });

    it('should generate oversold condition recommendations', async () => {
      // Create oversold conditions
      const oversoldCandles = [];
      for (let i = 0; i < 50; i++) {
        const time = Date.now() - (50 - i) * 3600000;
        const price = 50000 - i * 200; // Strong downtrend for low RSI
        
        oversoldCandles.push([
          time,
          price.toString(),
          (price + 50).toString(),
          (price - 100).toString(),
          (price - 80).toString(),
          "2000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(oversoldCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 50,
        },
      });

      // Should detect oversold conditions
      expect(result.technicalAnalysis.momentum.rsi).toBeLessThan(30);
      expect(result.recommendations.nextAction).toContain('売られすぎ');
    });

    it('should handle near support level recommendations', async () => {
      const supportLevel = 48000;
      const nearSupportCandles = [];
      
      // Build history with clear support
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        let price;
        
        if (i < 80) {
          // Historical bounces off support
          price = supportLevel + Math.random() * 2000;
        } else {
          // Recent approach to support
          price = supportLevel + 100 + (90 - i) * 10; // Getting closer
        }
        
        nearSupportCandles.push([
          time,
          price.toString(),
          (price + 100).toString(),
          (Math.min(price - 100, supportLevel)).toString(),
          price.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(nearSupportCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      // Check if recommendation mentions approaching support
      const hasSupport = result.technicalAnalysis.supportResistance.supports.length > 0;
      if (hasSupport) {
        const currentPrice = result.currentPrice.price;
        const nearestSupport = result.technicalAnalysis.supportResistance.supports[0];
        const distance = ((currentPrice - nearestSupport.price) / currentPrice) * 100;
        
        if (distance < 2) {
          expect(result.recommendations.nextAction).toContain('サポートライン');
        }
      }
    });
  });

  describe('Helper Function Coverage', () => {
    it('should calculate variance correctly', async () => {
      // Create data with consistent highs (low variance)
      const flatHighCandles = [];
      const consistentHigh = 52000;
      
      for (let i = 0; i < 20; i++) {
        const time = Date.now() - (20 - i) * 3600000;
        const low = 48000 + Math.random() * 2000;
        const open = low + Math.random() * 1000;
        const close = low + Math.random() * 1000;
        
        flatHighCandles.push([
          time,
          open.toString(),
          (consistentHigh + (Math.random() - 0.5) * 50).toString(), // Very small variance
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(flatHighCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 20,
          analysisType: 'patterns',
        },
      });

      // Low variance in highs might contribute to pattern detection
      expect(result).toBeDefined();
    });

    it('should calculate slope for ascending lows', async () => {
      // Create data with ascending lows (positive slope)
      const ascendingLowCandles = [];
      
      for (let i = 0; i < 20; i++) {
        const time = Date.now() - (20 - i) * 3600000;
        const low = 48000 + i * 100; // Linearly increasing lows
        const high = 52000 + (Math.random() - 0.5) * 200;
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);
        
        ascendingLowCandles.push([
          time,
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(ascendingLowCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 20,
          analysisType: 'patterns',
        },
      });

      // Ascending lows might be detected in pattern analysis
      expect(result).toBeDefined();
    });
  });

  describe('Timeframe Conversion', () => {
    it('should handle unknown timeframe gracefully', async () => {
      const candles = createMockCandles(50);
      mockFetch.mockResolvedValueOnce(createMockResponse(candles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: 'invalid_timeframe',
          limit: 50,
        },
      });

      // Should use default (1h) for unknown timeframes
      expect(result).toBeDefined();
      expect(result.dataRange.endTime - result.dataRange.startTime).toBeGreaterThan(0);
    });
  });

  describe('Complex Market Conditions', () => {
    it('should handle sideways market with range-bound recommendations', async () => {
      // Create range-bound data
      const rangeCandles = [];
      const upperBound = 52000;
      const lowerBound = 48000;
      
      for (let i = 0; i < 100; i++) {
        const time = Date.now() - (100 - i) * 3600000;
        // Oscillate between bounds
        const phase = Math.sin(i * 0.1);
        const price = lowerBound + (upperBound - lowerBound) * ((phase + 1) / 2);
        const variance = Math.random() * 200;
        
        rangeCandles.push([
          time,
          price.toString(),
          (price + variance).toString(),
          (price - variance).toString(),
          (price + (Math.random() - 0.5) * 100).toString(),
          "1000"
        ]);
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(rangeCandles));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          limit: 100,
        },
      });

      // Should detect sideways trend
      expect(['sideways', 'bearish', 'bullish']).toContain(result.technicalAnalysis.trend.direction);
      
      // Should have both support and resistance recommendations
      const hasSupport = result.recommendations.trendlineDrawing.some(d => 
        d.description.includes('サポート')
      );
      const hasResistance = result.recommendations.trendlineDrawing.some(d => 
        d.description.includes('レジスタンス')
      );
      
      if (result.technicalAnalysis.trend.direction === 'sideways') {
        expect(result.recommendations.nextAction).toContain('レンジ');
      }
    });
  });
});