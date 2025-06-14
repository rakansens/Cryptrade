import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { enhancedMarketDataService, EnhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';
import { multiTimeframeLineDetector, MultiTimeframeLineDetector } from '@/lib/analysis/multi-timeframe-line-detector';
import { enhancedLineAnalysisTool } from '@/lib/mastra/tools/enhanced-line-analysis.tool';
import type { ProcessedKline } from '@/types/market';

// Mock the binance API service
jest.mock('@/lib/binance/api-service', () => ({
  binanceAPI: {
    fetchKlines: jest.fn()
  }
}));

// Mock the logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Multi-Timeframe Analysis', () => {
  let testKlines: ProcessedKline[];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate realistic test data
    testKlines = generateTestKlines();
    
    // Mock the binance API to return our test data
    const { binanceAPI } = require('@/lib/binance/api-service');
    binanceAPI.fetchKlines.mockResolvedValue(testKlines);
  });

  afterEach(() => {
    enhancedMarketDataService.clearCache();
  });

  describe('EnhancedMarketDataService', () => {
    describe('fetchMultiTimeframeData', () => {
      it('should fetch data from multiple timeframes successfully', async () => {
        const result = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        
        expect(result).toBeDefined();
        expect(result.symbol).toBe('BTCUSDT');
        expect(result.timeframes).toBeDefined();
        expect(Object.keys(result.timeframes)).toHaveLength(4); // 15m, 1h, 4h, 1d
        expect(result.fetchedAt).toBeGreaterThan(0);
      });

      it('should handle partial failures gracefully', async () => {
        const { binanceAPI } = require('@/lib/binance/api-service');
        
        // Make some timeframe calls fail
        binanceAPI.fetchKlines.mockImplementation((symbol: string, interval: string) => {
          if (interval === '15m') {
            return Promise.reject(new Error('15m data unavailable'));
          }
          return Promise.resolve(testKlines);
        });

        const result = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        
        expect(result).toBeDefined();
        expect(Object.keys(result.timeframes)).toHaveLength(3); // Only 1h, 4h, 1d
        expect(result.timeframes['15m']).toBeUndefined();
      });

      it('should use cached data when available', async () => {
        const { binanceAPI } = require('@/lib/binance/api-service');
        
        // First call
        await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(4);
        
        // Second call should use cache
        await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(4); // No additional calls
      });
    });

    describe('findMultiTimeframeSupportResistance', () => {
      it('should identify support and resistance levels across timeframes', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        const levels = enhancedMarketDataService.findMultiTimeframeSupportResistance(multiTimeframeData);
        
        expect(levels).toBeInstanceOf(Array);
        expect(levels.length).toBeGreaterThan(0);
        
        levels.forEach(level => {
          expect(level.price).toBeGreaterThan(0);
          expect(level.strength).toBeGreaterThanOrEqual(0);
          expect(level.strength).toBeLessThanOrEqual(1);
          expect(level.touchCount).toBeGreaterThanOrEqual(2);
          expect(level.timeframeSupport).toBeInstanceOf(Array);
          expect(level.timeframeSupport.length).toBeGreaterThan(0);
          expect(['support', 'resistance']).toContain(level.type);
        });
      });

      it('should filter levels by minimum timeframe support', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        
        const levelsMin1 = enhancedMarketDataService.findMultiTimeframeSupportResistance(
          multiTimeframeData,
          { minTimeframes: 1 }
        );
        
        const levelsMin3 = enhancedMarketDataService.findMultiTimeframeSupportResistance(
          multiTimeframeData,
          { minTimeframes: 3 }
        );
        
        expect(levelsMin3.length).toBeLessThanOrEqual(levelsMin1.length);
        levelsMin3.forEach(level => {
          expect(level.timeframeSupport.length).toBeGreaterThanOrEqual(3);
        });
      });

      it('should sort levels by confidence score', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        const levels = enhancedMarketDataService.findMultiTimeframeSupportResistance(multiTimeframeData);
        
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i - 1].confidenceScore).toBeGreaterThanOrEqual(levels[i].confidenceScore);
        }
      });
    });

    describe('findConfluenceZones', () => {
      it('should identify confluence zones where multiple timeframes agree', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        const zones = enhancedMarketDataService.findConfluenceZones(multiTimeframeData);
        
        expect(zones).toBeInstanceOf(Array);
        zones.forEach(zone => {
          expect(zone.priceRange).toBeDefined();
          expect(zone.priceRange.min).toBeLessThan(zone.priceRange.max);
          expect(zone.priceRange.center).toBeGreaterThanOrEqual(zone.priceRange.min);
          expect(zone.priceRange.center).toBeLessThanOrEqual(zone.priceRange.max);
          expect(zone.timeframeCount).toBeGreaterThanOrEqual(2);
          expect(zone.supportingTimeframes).toBeInstanceOf(Array);
          expect(['support', 'resistance', 'pivot']).toContain(zone.type);
        });
      });

      it('should respect minimum timeframes parameter', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        
        const zonesMin2 = enhancedMarketDataService.findConfluenceZones(
          multiTimeframeData,
          { minTimeframes: 2 }
        );
        
        const zonesMin4 = enhancedMarketDataService.findConfluenceZones(
          multiTimeframeData,
          { minTimeframes: 4 }
        );
        
        expect(zonesMin4.length).toBeLessThanOrEqual(zonesMin2.length);
        zonesMin4.forEach(zone => {
          expect(zone.timeframeCount).toBeGreaterThanOrEqual(4);
        });
      });
    });

    describe('calculateCrossTimeframeValidation', () => {
      it('should validate price levels across timeframes', async () => {
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        const testPrice = 50000;
        
        const validation = enhancedMarketDataService.calculateCrossTimeframeValidation(
          testPrice,
          multiTimeframeData
        );
        
        expect(validation.validationScore).toBeGreaterThanOrEqual(0);
        expect(validation.validationScore).toBeLessThanOrEqual(1);
        expect(validation.supportingTimeframes).toBeInstanceOf(Array);
        expect(validation.touchCounts).toBeDefined();
        expect(validation.avgStrength).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('MultiTimeframeLineDetector', () => {
    let detector: MultiTimeframeLineDetector;

    beforeEach(() => {
      detector = new MultiTimeframeLineDetector();
    });

    describe('detectLines', () => {
      it('should detect horizontal lines and trendlines', async () => {
        const result = await detector.detectLines('BTCUSDT');
        
        expect(result).toBeDefined();
        expect(result.symbol).toBe('BTCUSDT');
        expect(result.horizontalLines).toBeInstanceOf(Array);
        expect(result.trendlines).toBeInstanceOf(Array);
        expect(result.confluenceZones).toBeInstanceOf(Array);
        expect(result.summary).toBeDefined();
        expect(result.config).toBeDefined();
      });

      it('should validate detected lines structure', async () => {
        const result = await detector.detectLines('BTCUSDT');
        
        [...result.horizontalLines, ...result.trendlines].forEach(line => {
          expect(line.id).toBeDefined();
          expect(['support', 'resistance', 'trendline']).toContain(line.type);
          expect(line.price).toBeGreaterThan(0);
          expect(line.strength).toBeGreaterThanOrEqual(0);
          expect(line.strength).toBeLessThanOrEqual(1);
          expect(line.confidence).toBeGreaterThanOrEqual(0);
          expect(line.confidence).toBeLessThanOrEqual(1);
          expect(line.touchCount).toBeGreaterThanOrEqual(2);
          expect(line.supportingTimeframes).toBeInstanceOf(Array);
          expect(line.points).toBeInstanceOf(Array);
          expect(line.metadata).toBeDefined();
          expect(line.metadata.algorithm).toBe('multi-timeframe');
        });
      });

      it('should apply custom configuration', async () => {
        const customConfig = {
          minTimeframes: 3,
          strengthThreshold: 0.8,
          minTouchCount: 4
        };
        
        const result = await detector.detectLines('BTCUSDT', customConfig);
        
        expect(result.config.minTimeframes).toBe(3);
        expect(result.config.strengthThreshold).toBe(0.8);
        expect(result.config.minTouchCount).toBe(4);
        
        // All lines should meet the stricter criteria
        [...result.horizontalLines, ...result.trendlines].forEach(line => {
          expect(line.strength).toBeGreaterThanOrEqual(0.8);
          expect(line.touchCount).toBeGreaterThanOrEqual(4);
        });
      });

      it('should calculate summary statistics correctly', async () => {
        const result = await detector.detectLines('BTCUSDT');
        const allLines = [...result.horizontalLines, ...result.trendlines];
        
        expect(result.summary.totalLines).toBe(allLines.length);
        expect(result.summary.highConfidenceLines).toBe(
          allLines.filter(line => line.confidence >= 0.8).length
        );
        expect(result.summary.multiTimeframeLines).toBe(
          allLines.filter(line => line.supportingTimeframes.length >= 2).length
        );
        expect(result.summary.detectionTime).toBeGreaterThan(0);
        
        if (allLines.length > 0) {
          const expectedAvgStrength = allLines.reduce((sum, line) => sum + line.strength, 0) / allLines.length;
          expect(result.summary.averageStrength).toBeCloseTo(expectedAvgStrength, 2);
        }
      });
    });

    describe('configuration management', () => {
      it('should update and retrieve configuration', () => {
        const newConfig = {
          minTimeframes: 3,
          priceTolerancePercent: 1.0,
          strengthThreshold: 0.7
        };
        
        detector.updateConfig(newConfig);
        const retrievedConfig = detector.getConfig();
        
        expect(retrievedConfig.minTimeframes).toBe(3);
        expect(retrievedConfig.priceTolerancePercent).toBe(1.0);
        expect(retrievedConfig.strengthThreshold).toBe(0.7);
        // Other values should remain as defaults
        expect(retrievedConfig.minTouchCount).toBe(3);
      });
    });
  });

  describe('Enhanced Line Analysis Tool', () => {
    describe('execute', () => {
      it('should execute full analysis successfully', async () => {
        const context = {
          symbol: 'BTCUSDT',
          analysisType: 'full' as const,
          returnRawData: false
        };
        
        const result = await enhancedLineAnalysisTool.execute(context);
        
        expect(result).toBeDefined();
        expect(result.symbol).toBe('BTCUSDT');
        expect(result.analysisTimestamp).toBeGreaterThan(0);
        expect(result.horizontalLines).toBeInstanceOf(Array);
        expect(result.trendlines).toBeInstanceOf(Array);
        expect(result.confluenceZones).toBeInstanceOf(Array);
        expect(result.summary).toBeDefined();
        expect(result.marketStructure).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.config).toBeDefined();
      });

      it('should filter analysis by type', async () => {
        const horizontalOnlyContext = {
          symbol: 'BTCUSDT',
          analysisType: 'horizontal_only' as const,
          returnRawData: false
        };
        
        const trendlinesOnlyContext = {
          symbol: 'BTCUSDT',
          analysisType: 'trendlines_only' as const,
          returnRawData: false
        };
        
        const horizontalResult = await enhancedLineAnalysisTool.execute(horizontalOnlyContext);
        const trendlinesResult = await enhancedLineAnalysisTool.execute(trendlinesOnlyContext);
        
        expect(horizontalResult.trendlines).toHaveLength(0);
        expect(horizontalResult.horizontalLines.length).toBeGreaterThanOrEqual(0);
        
        expect(trendlinesResult.horizontalLines).toHaveLength(0);
        expect(trendlinesResult.confluenceZones).toHaveLength(0);
        expect(trendlinesResult.trendlines.length).toBeGreaterThanOrEqual(0);
      });

      it('should apply custom configuration', async () => {
        const customConfig = {
          minTimeframes: 3,
          strengthThreshold: 0.8
        };
        
        const context = {
          symbol: 'BTCUSDT',
          config: customConfig
        };
        
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        expect(result.config.minTimeframes).toBe(3);
        expect(result.config.strengthThreshold).toBe(0.8);
      });

      it('should generate drawing recommendations', async () => {
        const context = { symbol: 'BTCUSDT' };
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        expect(result.recommendations.drawingActions).toBeInstanceOf(Array);
        expect(result.recommendations.analysis).toBeDefined();
        expect(result.recommendations.tradingSetup).toBeDefined();
        
        result.recommendations.drawingActions.forEach(action => {
          expect(['draw_line', 'draw_zone', 'highlight_confluence']).toContain(action.action);
          expect(['support', 'resistance', 'trendline', 'zone']).toContain(action.type);
          expect(action.coordinates).toBeDefined();
          expect(action.style).toBeDefined();
          expect(action.priority).toBeGreaterThanOrEqual(1);
          expect(action.priority).toBeLessThanOrEqual(10);
          expect(action.description).toBeDefined();
        });
      });

      it('should analyze market structure', async () => {
        const context = { symbol: 'BTCUSDT' };
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        expect(['bullish', 'bearish', 'sideways']).toContain(result.marketStructure.currentTrend);
        expect(result.marketStructure.trendStrength).toBeGreaterThanOrEqual(0);
        expect(result.marketStructure.trendStrength).toBeLessThanOrEqual(1);
        expect(result.marketStructure.keyLevels).toBeInstanceOf(Array);
        expect(result.marketStructure.priceAction).toBeDefined();
        expect(result.marketStructure.priceAction.currentPrice).toBeGreaterThan(0);
      });

      it('should handle errors gracefully', async () => {
        const { binanceAPI } = require('@/lib/binance/api-service');
        binanceAPI.fetchKlines.mockRejectedValue(new Error('API Error'));
        
        const context = { symbol: 'INVALIDUSDT' };
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        // Should return fallback data instead of throwing
        expect(result).toBeDefined();
        expect(result.symbol).toBe('INVALIDUSDT');
        expect(result.horizontalLines).toHaveLength(0);
        expect(result.trendlines).toHaveLength(0);
        expect(result.recommendations.analysis).toContain('データの取得に失敗');
      });

      it('should include raw data when requested', async () => {
        const context = {
          symbol: 'BTCUSDT',
          returnRawData: true
        };
        
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        expect(result.rawData).toBeDefined();
        expect(result.rawData!.multiTimeframeData).toBeDefined();
        expect(result.rawData!.detectionDetails).toBeDefined();
      });

      it('should filter by price range when specified', async () => {
        const context = {
          symbol: 'BTCUSDT',
          priceRange: {
            min: 45000,
            max: 55000
          }
        };
        
        const result = await enhancedLineAnalysisTool.execute({ context });
        
        [...result.horizontalLines, ...result.trendlines].forEach(line => {
          expect(line.price).toBeGreaterThanOrEqual(45000);
          expect(line.price).toBeLessThanOrEqual(55000);
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistency between service and detector', async () => {
      const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
      const detectionResult = await multiTimeframeLineDetector.detectLines('BTCUSDT');
      
      // The detector should use data from the same timeframes
      const serviceTimeframes = Object.keys(multiTimeframeData.timeframes);
      
      [...detectionResult.horizontalLines, ...detectionResult.trendlines].forEach(line => {
        line.supportingTimeframes.forEach(timeframe => {
          expect(serviceTimeframes).toContain(timeframe);
        });
      });
    });

    it('should handle cache consistency', async () => {
      // First call - should populate cache
      const result1 = await multiTimeframeLineDetector.detectLines('BTCUSDT');
      
      // Second call - should use cached data and produce consistent results
      const result2 = await multiTimeframeLineDetector.detectLines('BTCUSDT');
      
      expect(result1.summary.totalLines).toBe(result2.summary.totalLines);
      expect(result1.symbol).toBe(result2.symbol);
    });

    it('should validate end-to-end workflow', async () => {
      // Test the complete workflow from data fetching to analysis
      const context = {
        symbol: 'BTCUSDT',
        analysisType: 'full' as const,
        config: {
          minTimeframes: 2,
          strengthThreshold: 0.6
        }
      };
      
      const result = await enhancedLineAnalysisTool.execute({ context });
      
      // Verify the complete pipeline worked
      expect(result.summary.totalLines).toBeGreaterThanOrEqual(0);
      expect(result.recommendations.drawingActions.length).toBeGreaterThanOrEqual(0);
      expect(result.marketStructure.priceAction.currentPrice).toBeGreaterThan(0);
      
      // Verify all detected lines meet the criteria
      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.supportingTimeframes.length).toBeGreaterThanOrEqual(2);
        expect(line.strength).toBeGreaterThanOrEqual(0.6);
        expect(line.confidence).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Generate realistic test candlestick data
 */
function generateTestKlines(): ProcessedKline[] {
  const klines: ProcessedKline[] = [];
  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  const interval = 60 * 60 * 1000; // 1 hour
  
  let currentPrice = 50000;
  let time = startTime;
  
  // Generate data with realistic price action including supports and resistances
  for (let i = 0; i < 500; i++) {
    // Add some trend and mean reversion
    const trend = Math.sin(i * 0.02) * 0.001;
    const noise = (Math.random() - 0.5) * 0.01;
    const priceChange = trend + noise;
    
    currentPrice *= (1 + priceChange);
    
    // Create OHLC with realistic spread
    const volatility = currentPrice * 0.005;
    const open = currentPrice;
    const close = currentPrice * (1 + priceChange);
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = 100 + Math.random() * 1000;
    
    klines.push({
      time,
      open,
      high,
      low,
      close,
      volume
    });
    
    time += interval;
    currentPrice = close;
  }
  
  // Add some clear support/resistance levels
  addSupportResistanceLevels(klines);
  
  return klines;
}

/**
 * Add clear support and resistance levels to test data
 */
function addSupportResistanceLevels(klines: ProcessedKline[]): void {
  const supportLevel = 49000;
  const resistanceLevel = 51000;
  
  // Make price respect these levels
  klines.forEach((kline, index) => {
    if (kline.low < supportLevel && Math.random() > 0.3) {
      // Bounce off support
      kline.low = supportLevel;
      kline.close = Math.max(kline.close, supportLevel + 100);
    }
    
    if (kline.high > resistanceLevel && Math.random() > 0.3) {
      // Reject at resistance
      kline.high = resistanceLevel;
      kline.close = Math.min(kline.close, resistanceLevel - 100);
    }
    
    // Ensure OHLC consistency
    kline.open = Math.min(Math.max(kline.open, kline.low), kline.high);
    kline.close = Math.min(Math.max(kline.close, kline.low), kline.high);
  });
}