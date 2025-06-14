import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { chartDataAnalysisTool } from '../chart-data-analysis.tool';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Helper function to create mock response
const createMockResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers(),
  statusText: 'OK',
  redirected: false,
  type: 'basic' as ResponseType,
  url: '',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
} as Response);

describe('chartDataAnalysisTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    const mockCandleData = [
      [1640995200000, "48000", "48500", "47500", "48200", "1000"],
      [1640998800000, "48200", "48700", "48100", "48600", "1200"],
      [1641002400000, "48600", "49000", "48500", "48800", "1500"],
      [1641006000000, "48800", "49200", "48700", "49100", "1100"],
      [1641009600000, "49100", "49500", "49000", "49300", "1300"],
    ];


    it('should fetch and analyze chart data successfully with default parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      const result = await chartDataAnalysisTool.execute({ 
        context: {} 
      });

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        dataRange: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          candleCount: mockCandleData.length,
        },
        currentPrice: {
          price: 49300,
          timestamp: 1641009600000,
        },
        technicalAnalysis: {
          trend: {
            direction: expect.stringMatching(/bullish|bearish|sideways/),
            strength: expect.any(Number),
            confidence: expect.any(Number),
          },
          supportResistance: {
            supports: expect.any(Array),
            resistances: expect.any(Array),
          },
          volatility: {
            atr: expect.any(Number),
            volatilityLevel: expect.stringMatching(/low|medium|high/),
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

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200')
      );
    });

    it('should handle custom parameters correctly', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'ETHUSDT',
          timeframe: '4h',
          limit: 100,
          analysisType: 'trend',
          lookbackPeriod: 50,
        }
      });

      expect(result.symbol).toBe('ETHUSDT');
      expect(result.timeframe).toBe('4h');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=ETHUSDT&interval=4h&limit=100')
      );
    });

    it('should handle API failures gracefully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
        }
      });

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
          nextAction: expect.stringContaining('手動でチャート分析を行ってください'),
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis failed',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should handle API response with invalid status', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const result = await chartDataAnalysisTool.execute({
        context: { symbol: 'BTCUSDT' }
      });

      expect(result.currentPrice.price).toBe(50000); // Fallback
      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
    });

    it('should generate appropriate recommendations based on analysis', async () => {
      // Mock data with strong uptrend and clear swing points
      const uptrendData = Array(200).fill(null).map((_, i) => {
        // Create data with clear swing points for better pattern detection
        const basePrice = 48000 + i * 50;
        const isSwingPoint = i % 10 === 0 || i % 10 === 5;
        const swingVariation = isSwingPoint ? (i % 20 === 0 ? -200 : 200) : 0;
        
        return [
          1640995200000 + i * 3600000,
          String(basePrice + swingVariation), // Open
          String(basePrice + swingVariation + 100), // High
          String(basePrice + swingVariation - 100), // Low  
          String(basePrice + swingVariation + 20), // Close
          "1000"
        ];
      });

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(uptrendData));

      const result = await chartDataAnalysisTool.execute({
        context: { 
          symbol: 'BTCUSDT',
          analysisType: 'full' 
        }
      });

      expect(result.recommendations.trendlineDrawing).toBeInstanceOf(Array);
      
      // If recommendations are generated, verify their structure
      if (result.recommendations.trendlineDrawing.length > 0) {
        // Check if recommendations are properly sorted by priority
        const priorities = result.recommendations.trendlineDrawing.map(r => r.priority);
        expect(priorities).toEqual([...priorities].sort((a, b) => b - a));

        // Verify recommendation structure
        result.recommendations.trendlineDrawing.forEach(rec => {
          expect(rec).toMatchObject({
            type: expect.stringMatching(/trendline|fibonacci|horizontal/),
            description: expect.any(String),
            points: expect.arrayContaining([
              expect.objectContaining({
                time: expect.any(Number),
                price: expect.any(Number),
              })
            ]),
            style: expect.objectContaining({
              color: expect.any(String),
              lineWidth: expect.any(Number),
              lineStyle: expect.stringMatching(/solid|dashed|dotted/),
            }),
            priority: expect.any(Number),
          });
        });
      }
      
      // Always expect valid analysis and nextAction
      expect(result.recommendations.analysis).toBeTruthy();
      expect(result.recommendations.nextAction).toBeTruthy();
    });

    it('should detect patterns when analysisType is "patterns"', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'patterns',
        }
      });

      expect(result.patterns).toBeDefined();
      if (result.patterns && result.patterns.length > 0) {
        result.patterns.forEach(pattern => {
          expect(pattern).toMatchObject({
            type: expect.any(String),
            confidence: expect.any(Number),
            timeframe: expect.any(String),
            description: expect.any(String),
          });
          expect(pattern.confidence).toBeGreaterThanOrEqual(0);
          expect(pattern.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should handle different timeframe calculations correctly', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      
      for (const timeframe of timeframes) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

        const result = await chartDataAnalysisTool.execute({
          context: { timeframe }
        });

        expect(result.timeframe).toBe(timeframe);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`interval=${timeframe}`)
        );
      }
    });

    it('should calculate technical indicators correctly', async () => {
      // Create more realistic data for indicator calculations
      const extendedData = Array(50).fill(null).map((_, i) => {
        const basePrice = 48000 + Math.sin(i / 10) * 1000;
        return [
          1640995200000 + i * 3600000,
          String(basePrice),
          String(basePrice + Math.random() * 200),
          String(basePrice - Math.random() * 200),
          String(basePrice + (Math.random() - 0.5) * 100),
          "1000"
        ];
      });

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(extendedData));

      const result = await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          limit: 50,
        }
      });

      const { momentum, movingAverages } = result.technicalAnalysis;

      // RSI should be between 0 and 100
      expect(momentum.rsi).toBeGreaterThanOrEqual(0);
      expect(momentum.rsi).toBeLessThanOrEqual(100);

      // MACD values should exist
      expect(momentum.macd).toMatchObject({
        macd: expect.any(Number),
        signal: expect.any(Number),
        histogram: expect.any(Number),
      });

      // Moving averages should be calculated
      if (extendedData.length >= 20 && movingAverages.ma20 !== undefined) {
        expect(movingAverages.ma20).toBeGreaterThan(0);
      }
    });

    it('should include raw data in response', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      const result = await chartDataAnalysisTool.execute({
        context: {}
      });

      expect(result.rawData).toBeDefined();
      expect(result.rawData?.candles).toBeInstanceOf(Array);
      
      result.rawData?.candles?.forEach(candle => {
        expect(candle).toMatchObject({
          time: expect.any(Number),
          open: expect.any(Number),
          high: expect.any(Number),
          low: expect.any(Number),
          close: expect.any(Number),
          volume: expect.any(Number),
        });
      });
    });

    it('should properly log execution steps', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce(createMockResponse(mockCandleData));

      await chartDataAnalysisTool.execute({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'full',
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Starting analysis',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          analysisType: 'full',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[ChartDataAnalysis] Analysis completed successfully',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          recommendationCount: expect.any(Number),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty candle data', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await chartDataAnalysisTool.execute({
        context: {}
      });

      // When candle data is empty, the tool will throw an error accessing empty array
      // and fall back to the error handler which returns fallback values
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframe).toBe('1h');
      expect(result.currentPrice.price).toBe(50000); // Fallback price from error handler
      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
    });

    it('should handle very large limit values', async () => {
      const largeData = Array(1000).fill(null).map((_, i) => [
        1640995200000 + i * 3600000,
        "48000", "48500", "47500", "48200", "1000"
      ]);

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce(createMockResponse(largeData));

      const result = await chartDataAnalysisTool.execute({
        context: {
          limit: 1000,
        }
      });

      // The tool successfully fetched and processed 1000 candles
      expect(result.dataRange.candleCount).toBe(1000);
      expect(result.symbol).toBe('BTCUSDT');
    });
  });

  describe('input validation', () => {
    it('should use default values for missing parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await chartDataAnalysisTool.execute({
        context: {}
      });

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframe).toBe('1h');
    });
  });
});