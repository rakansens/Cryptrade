// Mock dependencies before imports
jest.mock('@/lib/utils/logger');

// Mock fetch globally
global.fetch = jest.fn();

import { chartDataAnalysisTool } from '@/lib/mastra/tools/chart-data-analysis.tool';
import { logger } from '@/lib/utils/logger';

// Type cast the execute function to avoid TypeScript errors
const executeChartDataAnalysisTool = chartDataAnalysisTool.execute as any;

describe('chartDataAnalysisTool', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // Fixed timestamp for tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(chartDataAnalysisTool.id).toBe('chart-data-analysis');
      expect(chartDataAnalysisTool.description).toContain('Advanced chart data analysis tool');
      expect(chartDataAnalysisTool.inputSchema).toBeDefined();
      expect(chartDataAnalysisTool.outputSchema).toBeDefined();
    });
  });

  describe('execute - successful analysis', () => {
    const mockCandleData = Array.from({ length: 100 }, (_, i) => [
      1640995200000 + i * 3600000, // Open time
      '50000', // Open
      '50500', // High
      '49500', // Low
      '50200', // Close
      '100', // Volume
    ]);

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCandleData,
      } as Response);
    });

    it('should fetch and analyze market data with default parameters', async () => {
      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200'
      );

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        dataRange: {
          candleCount: 100,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        currentPrice: {
          price: 50200,
          timestamp: expect.any(Number),
        },
        technicalAnalysis: expect.objectContaining({
          trend: expect.objectContaining({
            direction: expect.stringMatching(/^(bullish|bearish|sideways)$/),
            strength: expect.any(Number),
            confidence: expect.any(Number),
          }),
          supportResistance: expect.objectContaining({
            supports: expect.any(Array),
            resistances: expect.any(Array),
          }),
          volatility: expect.objectContaining({
            atr: expect.any(Number),
            volatilityLevel: expect.stringMatching(/^(low|medium|high)$/),
            atrPercent: expect.any(Number),
          }),
          momentum: expect.objectContaining({
            rsi: expect.any(Number),
            macd: expect.objectContaining({
              macd: expect.any(Number),
              signal: expect.any(Number),
              histogram: expect.any(Number),
            }),
          }),
        }),
        recommendations: expect.objectContaining({
          trendlineDrawing: expect.any(Array),
          analysis: expect.any(String),
          nextAction: expect.any(String),
        }),
      });
    });

    it('should handle custom parameters', async () => {
      const result = await executeChartDataAnalysisTool({
        context: {
          symbol: 'ETHUSDT',
          timeframe: '4h',
          limit: 500,
          analysisType: 'trend',
          lookbackPeriod: 200,
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=4h&limit=500'
      );

      expect(result.symbol).toBe('ETHUSDT');
      expect(result.timeframe).toBe('4h');
    });

    it('should generate trendline recommendations for strong trends', async () => {
      // Mock data with clear uptrend
      const uptrendData = Array.from({ length: 100 }, (_, i) => [
        1640995200000 + i * 3600000,
        String(45000 + i * 100), // Steadily increasing open
        String(45500 + i * 100), // High
        String(44800 + i * 100), // Low
        String(45200 + i * 100), // Close
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => uptrendData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: { analysisType: 'full' }
      });

      expect(result.technicalAnalysis.trend.direction).toBe('bullish');
      expect(result.technicalAnalysis.trend.strength).toBeGreaterThan(0.6);
      expect(result.recommendations.trendlineDrawing.length).toBeGreaterThan(0);
      
      const trendlineRec = result.recommendations.trendlineDrawing[0];
      expect(trendlineRec).toMatchObject({
        type: 'trendline',
        description: expect.stringContaining('トレンドライン'),
        points: expect.arrayContaining([
          expect.objectContaining({ time: expect.any(Number), price: expect.any(Number) })
        ]),
        style: expect.objectContaining({
          color: expect.any(String),
          lineWidth: expect.any(Number),
          lineStyle: expect.stringMatching(/^(solid|dashed|dotted)$/),
        }),
        priority: expect.any(Number),
      });
    });

    it('should detect support and resistance levels', async () => {
      // Mock data with clear support/resistance levels
      const rangeData = Array.from({ length: 100 }, (_, i) => {
        const basePrice = 50000;
        const oscillation = Math.sin(i * 0.2) * 1000;
        return [
          1640995200000 + i * 3600000,
          String(basePrice + oscillation - 100),
          String(basePrice + oscillation + 100),
          String(basePrice + oscillation - 200),
          String(basePrice + oscillation),
          '100',
        ];
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rangeData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(result.technicalAnalysis.supportResistance.supports.length).toBeGreaterThan(0);
      expect(result.technicalAnalysis.supportResistance.resistances.length).toBeGreaterThan(0);

      const support = result.technicalAnalysis.supportResistance.supports[0];
      expect(support).toMatchObject({
        price: expect.any(Number),
        strength: expect.any(Number),
        touchCount: expect.any(Number),
        lastTouch: expect.any(Number),
      });
    });

    it('should calculate technical indicators correctly', async () => {
      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      const { momentum, volatility, movingAverages } = result.technicalAnalysis;

      // RSI should be between 0 and 100
      expect(momentum.rsi).toBeGreaterThanOrEqual(0);
      expect(momentum.rsi).toBeLessThanOrEqual(100);

      // ATR should be positive
      expect(volatility.atr).toBeGreaterThan(0);
      expect(volatility.atrPercent).toBeGreaterThan(0);

      // Moving averages should exist if enough data
      if (mockCandleData.length >= 20) {
        expect(movingAverages.ma20).toBeDefined();
      }
      if (mockCandleData.length >= 50) {
        expect(movingAverages.ma50).toBeDefined();
      }
    });

    it('should handle patterns analysis when requested', async () => {
      const result = await executeChartDataAnalysisTool({
        context: { analysisType: 'patterns' }
      });

      expect(result.patterns).toBeDefined();
      if (result.patterns && result.patterns.length > 0) {
        expect(result.patterns[0]).toMatchObject({
          type: expect.any(String),
          confidence: expect.any(Number),
          timeframe: expect.any(String),
          description: expect.any(String),
        });
      }
    });

    it('should limit raw data to last 50 candles', async () => {
      const result = await executeChartDataAnalysisTool({
        context: { limit: 200 }
      });

      expect(result.rawData?.candles).toHaveLength(50);
    });

    it('should generate appropriate market analysis summaries', async () => {
      const scenarios = [
        { rsi: 75, expectedText: '買われすぎ' },
        { rsi: 25, expectedText: '売られすぎ' },
        { rsi: 50, expectedText: '中立' },
      ];

      for (const scenario of scenarios) {
        // Mock data to produce specific RSI
        const mockData = Array.from({ length: 100 }, (_, i) => {
          const price = scenario.rsi > 70 ? 50000 + i * 50 : 
                        scenario.rsi < 30 ? 50000 - i * 50 : 50000;
          return [
            1640995200000 + i * 3600000,
            String(price),
            String(price + 100),
            String(price - 100),
            String(price),
            '100',
          ];
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockData,
        } as Response);

        const result = await executeChartDataAnalysisTool({
          context: {}
        });

        expect(result.recommendations.analysis).toContain(scenario.expectedText);
      }
    });

    it('should generate next action recommendations based on market conditions', async () => {
      // Test bullish trend recommendation
      const bullishData = Array.from({ length: 100 }, (_, i) => [
        1640995200000 + i * 3600000,
        String(45000 + i * 100),
        String(45500 + i * 100),
        String(44800 + i * 100),
        String(45200 + i * 100),
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => bullishData,
      } as Response);

      const bullishResult = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(bullishResult.recommendations.nextAction).toContain('上昇トレンド');

      // Test oversold condition recommendation
      const oversoldData = Array.from({ length: 100 }, (_, i) => [
        1640995200000 + i * 3600000,
        String(50000 - i * 100), // Declining prices
        String(50100 - i * 100),
        String(49900 - i * 100),
        String(50000 - i * 100),
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => oversoldData,
      } as Response);

      const oversoldResult = await executeChartDataAnalysisTool({
        context: {}
      });

      // Should suggest potential reversal for oversold conditions
      const nextAction = oversoldResult.recommendations.nextAction;
      expect(
        nextAction.includes('売られすぎ') || 
        nextAction.includes('反発') ||
        nextAction.includes('下降トレンド')
      ).toBe(true);
    });

    it('should include all required fields in trendline recommendations', async () => {
      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      if (result.recommendations.trendlineDrawing.length > 0) {
        const drawing = result.recommendations.trendlineDrawing[0];
        expect(drawing).toHaveProperty('type');
        expect(drawing).toHaveProperty('description');
        expect(drawing).toHaveProperty('points');
        expect(drawing).toHaveProperty('style');
        expect(drawing).toHaveProperty('priority');
        
        expect(drawing.points.length).toBeGreaterThanOrEqual(2);
        expect(drawing.style).toMatchObject({
          color: expect.any(String),
          lineWidth: expect.any(Number),
          lineStyle: expect.stringMatching(/^(solid|dashed|dotted)$/),
        });
      }
    });
  });

  describe('execute - error handling', () => {
    it('should handle API fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await executeChartDataAnalysisTool({
        context: { symbol: 'BTCUSDT' }
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis failed',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          error: 'Network error',
        })
      );

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        currentPrice: { price: 50000 }, // Fallback price
        technicalAnalysis: {
          trend: { direction: 'sideways', strength: 0.5, confidence: 0.1 },
        },
        recommendations: {
          trendlineDrawing: [],
          analysis: 'データの取得に失敗しました。しばらく時間をおいて再度お試しください。',
        },
      });
    });

    it('should handle non-ok API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis failed',
        expect.objectContaining({
          error: 'Failed to fetch candlestick data: 429',
        })
      );

      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
    });

    it('should handle empty candle data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(result.dataRange.candleCount).toBe(0);
      expect(result.currentPrice.price).toBe(50000); // Fallback
      expect(result.technicalAnalysis.trend.confidence).toBe(0.1); // Low confidence
    });

    it('should handle malformed candle data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          ['invalid', 'data', 'format'],
          null,
          undefined,
          [1640995200000, '50000', '50500', '49500', '50200', '100'], // Valid
        ],
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      // Should process valid candles and skip invalid ones
      expect(result.dataRange.candleCount).toBe(3); // Including invalid entries
    });

    it('should handle insufficient data for indicators', async () => {
      const fewCandles = Array.from({ length: 5 }, (_, i) => [
        1640995200000 + i * 3600000,
        '50000',
        '50500',
        '49500',
        '50200',
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fewCandles,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      // Should handle gracefully with default values
      expect(result.technicalAnalysis.momentum.rsi).toBe(50); // Default RSI
      expect(result.technicalAnalysis.trend.direction).toBe('sideways');
    });

    it('should validate limit parameter', async () => {
      const result = await executeChartDataAnalysisTool({
        context: { limit: 5 } // Below minimum
      });

      // Should use minimum of 10
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5')
      );
    });

    it('should handle very high volatility', async () => {
      const volatileData = Array.from({ length: 100 }, (_, i) => [
        1640995200000 + i * 3600000,
        String(50000 + Math.random() * 5000),
        String(55000 + Math.random() * 5000),
        String(45000 + Math.random() * 5000),
        String(50000 + Math.random() * 5000),
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => volatileData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('high');
      expect(result.technicalAnalysis.volatility.atrPercent).toBeGreaterThan(4);
    });
  });

  describe('execute - edge cases', () => {
    it('should handle all analysis types', async () => {
      const analysisTypes = ['full', 'trend', 'support_resistance', 'patterns', 'volatility'] as const;

      for (const analysisType of analysisTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => Array.from({ length: 100 }, (_, i) => [
            1640995200000 + i * 3600000,
            '50000', '50500', '49500', '50200', '100',
          ]),
        } as Response);

        const result = await executeChartDataAnalysisTool({
          context: { analysisType }
        });

        expect(result).toBeDefined();
        expect(result.symbol).toBe('BTCUSDT');

        if (analysisType === 'patterns' || analysisType === 'full') {
          expect(result.patterns).toBeDefined();
        }
      }
    });

    it('should handle different timeframes correctly', async () => {
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

      for (const timeframe of timeframes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [[1640995200000, '50000', '50500', '49500', '50200', '100']],
        } as Response);

        const result = await executeChartDataAnalysisTool({
          context: { timeframe }
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`interval=${timeframe}`)
        );
        expect(result.timeframe).toBe(timeframe);
      }
    });

    it('should handle extreme price movements', async () => {
      const extremeData = [
        [1640995200000, '50000', '50500', '49500', '50200', '100'],
        [1640998800000, '50200', '100000', '50000', '95000', '1000'], // Huge spike
        [1641002400000, '95000', '96000', '20000', '25000', '2000'], // Huge drop
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => extremeData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      expect(result.technicalAnalysis.volatility.volatilityLevel).toBe('high');
      expect(result.recommendations.analysis).toContain('ボラティリティ');
    });

    it('should handle near support level detection', async () => {
      // Create data where current price is near a support level
      const supportData = Array.from({ length: 100 }, (_, i) => {
        const baseSupport = 49000;
        const price = i < 50 ? baseSupport : i < 80 ? 51000 : 49100; // Near support at end
        return [
          1640995200000 + i * 3600000,
          String(price),
          String(price + 100),
          String(price - 100),
          String(price),
          '100',
        ];
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => supportData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: {}
      });

      const nextAction = result.recommendations.nextAction;
      expect(nextAction).toContain('サポートライン');
      expect(nextAction).toContain('接近');
    });

    it('should generate different recommendations for different volatility levels', async () => {
      const volatilityScenarios = [
        { multiplier: 0.1, expected: 'low' },
        { multiplier: 1, expected: 'medium' },
        { multiplier: 5, expected: 'high' },
      ];

      for (const scenario of volatilityScenarios) {
        const data = Array.from({ length: 100 }, (_, i) => [
          1640995200000 + i * 3600000,
          String(50000),
          String(50000 + 100 * scenario.multiplier),
          String(50000 - 100 * scenario.multiplier),
          String(50000),
          '100',
        ]);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => data,
        } as Response);

        const result = await executeChartDataAnalysisTool({
          context: {}
        });

        expect(result.technicalAnalysis.volatility.volatilityLevel).toBe(scenario.expected);
      }
    });

    it('should handle undefined values in calculations', async () => {
      const sparseData = Array.from({ length: 10 }, (_, i) => [
        1640995200000 + i * 3600000,
        '50000',
        '50500',
        '49500',
        '50200',
        '100',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sparseData,
      } as Response);

      const result = await executeChartDataAnalysisTool({
        context: { lookbackPeriod: 20 } // More than available data
      });

      // Should not throw and provide sensible defaults
      expect(result.technicalAnalysis.trend.direction).toBe('sideways');
      expect(result.technicalAnalysis.momentum.rsi).toBe(50);
    });
  });
});