import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { FeatureExtractor } from '@/lib/ml/feature-extractor';
import { env } from '@/config/env';
import type { LineFeatures } from '@/lib/ml/line-validation-types';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';

// Mock dependencies
jest.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test'
  }
}));

describe('FeatureExtractor', () => {
  let extractor: FeatureExtractor;
  let mockPriceData: PriceData[];
  let currentPrice: number;

  beforeEach(() => {
    // Create realistic price data
    mockPriceData = generateMockPriceData(100);
    const lastCandle = mockPriceData[mockPriceData.length - 1];
    currentPrice = lastCandle?.close ?? 50000;
    extractor = new FeatureExtractor(mockPriceData, currentPrice);
  });

  describe('constructor', () => {
    it('should initialize with price data and current price', () => {
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(FeatureExtractor);
    });
  });

  describe('extractFeatures', () => {
    it('should extract all required features from a line', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');

      // Basic features
      expect(features.touchCount).toBe(mockLine.touchPoints.length);
      expect(features.rSquared).toBeGreaterThanOrEqual(0);
      expect(features.rSquared).toBeLessThanOrEqual(1);
      expect(features.confidence).toBe(mockLine.confidence);

      // Touch quality
      expect(features.wickTouchRatio).toBeGreaterThanOrEqual(0);
      expect(features.wickTouchRatio).toBeLessThanOrEqual(1);
      expect(features.bodyTouchRatio).toBeGreaterThanOrEqual(0);
      expect(features.bodyTouchRatio).toBeLessThanOrEqual(1);
      expect(features.exactTouchRatio).toBeGreaterThanOrEqual(0);
      expect(features.exactTouchRatio).toBeLessThanOrEqual(1);

      // Volume features
      expect(features.volumeAverage).toBeGreaterThan(0);
      expect(features.volumeMax).toBeGreaterThan(0);
      expect(features.volumeStrength).toBeGreaterThan(0);

      // Time features
      expect(features.ageInCandles).toBeGreaterThan(0);
      expect(features.recentTouchCount).toBeGreaterThanOrEqual(0);
      expect(features.timeSinceLastTouch).toBeGreaterThanOrEqual(0);

      // Market context
      expect(['trending', 'ranging', 'volatile']).toContain(features.marketCondition);
      expect(features.trendStrength).toBeGreaterThanOrEqual(-1);
      expect(features.trendStrength).toBeLessThanOrEqual(1);
      expect(features.volatility).toBeGreaterThanOrEqual(0);
      expect(features.volatility).toBeLessThanOrEqual(1);
      expect(features.timeOfDay).toBeGreaterThanOrEqual(0);
      expect(features.timeOfDay).toBeLessThan(24);
      expect(features.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(features.dayOfWeek).toBeLessThanOrEqual(6);

      // Multi-timeframe
      expect(features.timeframeConfluence).toBeGreaterThanOrEqual(0);
      expect(features.timeframeConfluence).toBeLessThanOrEqual(1);
      expect(typeof features.higherTimeframeAlignment).toBe('boolean');

      // Pattern context
      expect(typeof features.nearPattern).toBe('boolean');
      if (features.nearPattern) {
        expect(features.patternType).toBeDefined();
      }

      // Price context
      expect(features.distanceFromPrice).toBeGreaterThanOrEqual(0);
      expect(features.priceRoundness).toBeGreaterThanOrEqual(0);
      expect(features.priceRoundness).toBeLessThanOrEqual(1);
      expect(typeof features.nearPsychological).toBe('boolean');
    });

    it('should handle lines with no R-squared value', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      delete mockLine.rSquared;
      
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      expect(features.rSquared).toBe(0);
    });

    it('should calculate touch quality correctly', () => {
      // Create line with specific touch types
      const price = 50000;
      const mockLine: DetectedLine = {
        type: 'horizontal',
        price,
        confidence: 0.85,
        touchPoints: [
          { time: mockPriceData[10]?.time ?? 0, value: mockPriceData[10]?.high ?? 0 }, // Wick touch
          { time: mockPriceData[20]?.time ?? 0, value: ((mockPriceData[20]?.open ?? 0) + (mockPriceData[20]?.close ?? 0)) / 2 }, // Body touch
          { time: mockPriceData[30]?.time ?? 0, value: price }, // Exact touch
        ],
        timeframe: '1h'
      };

      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features.wickTouchRatio).toBeGreaterThan(0);
      expect(features.bodyTouchRatio).toBeGreaterThan(0);
      expect(features.exactTouchRatio).toBeGreaterThan(0);
      expect(features.wickTouchRatio + features.bodyTouchRatio + features.exactTouchRatio).toBeLessThanOrEqual(3); // Can overlap
    });

    it('should calculate volume features correctly', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');

      // Get expected volumes
      const touchVolumes = mockLine.touchPoints.map(touch => {
        const candle = mockPriceData.find(p => p.time === touch.time);
        return candle?.volume || 0;
      });
      const expectedAvg = touchVolumes.reduce((a, b) => a + b, 0) / touchVolumes.length;
      const expectedMax = Math.max(...touchVolumes);

      expect(features.volumeAverage).toBeCloseTo(expectedAvg, 2);
      expect(features.volumeMax).toBe(expectedMax);
    });

    it('should calculate time features correctly', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');

      const firstTouch = Math.min(...mockLine.touchPoints.map(t => t.time));
      const lastTouch = Math.max(...mockLine.touchPoints.map(t => t.time));

      const firstIndex = mockPriceData.findIndex(p => p.time >= firstTouch);
      const lastIndex = mockPriceData.findIndex(p => p.time >= lastTouch);
      const currentIndex = mockPriceData.length - 1;

      expect(features.ageInCandles).toBe(currentIndex - firstIndex);
      expect(features.timeSinceLastTouch).toBe(currentIndex - lastIndex);
    });

    it('should detect market conditions correctly', () => {
      // Test trending market
      const trendingData = generateTrendingPriceData(100, 'up');
      const trendingExtractor = new FeatureExtractor(trendingData, trendingData[trendingData.length - 1]?.close ?? 0);
      const mockLine = createMockLine(trendingData);
      const features = trendingExtractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.marketCondition).toBe('trending');
      expect(features.trendStrength).toBeGreaterThan(0); // Uptrend
    });

    it('should calculate distance from current price', () => {
      const linePrice = 50000;
      const currentPrice = 52000;
      const mockLine: DetectedLine = {
        type: 'horizontal',
        price: linePrice,
        confidence: 0.85,
        touchPoints: [{ time: mockPriceData[0]?.time ?? 0, value: linePrice }],
        timeframe: '1h'
      };

      const customExtractor = new FeatureExtractor(mockPriceData, currentPrice);
      const features = customExtractor.extractFeatures(mockLine, 'BTCUSDT');

      const expectedDistance = Math.abs(currentPrice - linePrice) / currentPrice;
      expect(features.distanceFromPrice).toBeCloseTo(expectedDistance, 5);
    });

    it('should detect psychological price levels', () => {
      const psychologicalPrices = [1000, 5000, 10000, 50000, 100000];

      psychologicalPrices.forEach(price => {
        const mockLine: DetectedLine = {
          type: 'horizontal',
          price,
          confidence: 0.85,
          touchPoints: [{ time: mockPriceData[0]?.time ?? 0, value: price }],
          timeframe: '1h'
        };

        const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
        expect(features.nearPsychological).toBe(true);
        expect(features.priceRoundness).toBeGreaterThan(0.8);
      });
    });
  });

  describe('normalizeFeatures', () => {
    it('should normalize all features to 0-1 range', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      const normalized = extractor.normalizeFeatures(features);

      expect(normalized).toBeInstanceOf(Array);
      expect(normalized.length).toBe(23); // Should match number of features

      // All normalized values should be between 0 and 1
      normalized.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(isFinite(value)).toBe(true);
      });
    });

    it('should handle extreme feature values', () => {
      const extremeFeatures: LineFeatures = {
        touchCount: 1000, // Very high
        rSquared: 0,
        confidence: 1,
        wickTouchRatio: 1,
        bodyTouchRatio: 0,
        exactTouchRatio: 0,
        volumeAverage: 1000000,
        volumeMax: 2000000,
        volumeStrength: 100,
        ageInCandles: 5000,
        recentTouchCount: 100,
        timeSinceLastTouch: 1000,
        marketCondition: 'volatile',
        trendStrength: -1,
        volatility: 1,
        timeOfDay: 23,
        dayOfWeek: 6,
        timeframeConfluence: 1,
        higherTimeframeAlignment: true,
        nearPattern: true,
        patternType: 'headAndShoulders',
        distanceFromPrice: 0.5,
        priceRoundness: 1,
        nearPsychological: true
      };

      const normalized = extractor.normalizeFeatures(extremeFeatures);

      // All values should still be normalized properly
      normalized.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(isFinite(value)).toBe(true);
      });
    });

    it('should maintain feature order consistency', () => {
      const mockLine: DetectedLine = createMockLine(mockPriceData);
      const features1 = extractor.extractFeatures(mockLine, 'BTCUSDT');
      const features2 = extractor.extractFeatures(mockLine, 'BTCUSDT');

      const normalized1 = extractor.normalizeFeatures(features1);
      const normalized2 = extractor.normalizeFeatures(features2);

      expect(normalized1).toEqual(normalized2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty touch points', () => {
      const mockLine: DetectedLine = {
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [],
        timeframe: '1h'
      };

      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features.touchCount).toBe(0);
      expect(features.wickTouchRatio).toBe(0);
      expect(features.bodyTouchRatio).toBe(0);
      expect(features.exactTouchRatio).toBe(0);
    });

    it('should handle single price data point', () => {
      const singleData: PriceData[] = [{
        time: Date.now() / 1000,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1000
      }];

      const firstCandle = singleData[0];
      if (!firstCandle) return;
      
      const singleExtractor = new FeatureExtractor(singleData, firstCandle.close);
      const mockLine: DetectedLine = {
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [{ time: firstCandle.time, value: 50000 }],
        timeframe: '1h'
      };

      const features = singleExtractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features).toBeDefined();
      expect(features.volatility).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing touch point data', () => {
      const mockLine: DetectedLine = {
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [
          { time: 999999999, value: 50000 } // Time not in price data
        ],
        timeframe: '1h'
      };

      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features).toBeDefined();
      expect(features.volumeAverage).toBe(0);
    });

    it('should handle NaN and Infinity values in price data', () => {
      const problematicData: PriceData[] = [
        {
          time: 1000,
          open: NaN,
          high: Infinity,
          low: -Infinity,
          close: 100,
          volume: NaN
        }
      ];

      const problematicExtractor = new FeatureExtractor(problematicData, 100);
      const mockLine = createMockLine(mockPriceData);
      
      const features = problematicExtractor.extractFeatures(mockLine, 'BTCUSDT');
      expect(features).toBeDefined();
    });

    it('should handle zero volume candles', () => {
      const zeroVolumeData: PriceData[] = mockPriceData.map(d => ({
        ...d,
        volume: 0
      }));

      const zeroVolumeExtractor = new FeatureExtractor(zeroVolumeData, currentPrice);
      const mockLine = createMockLine(mockPriceData);
      
      const features = zeroVolumeExtractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features.volumeAverage).toBe(0);
      expect(features.volumeMax).toBe(0);
      expect(features.volumeStrength).toBe(1); // Default when overall avg is 0
    });

    it('should handle development environment mock values', () => {
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'development';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.timeframeConfluence).toBe(0.65);
      expect(features.higherTimeframeAlignment).toBe(true);
      expect(features.nearPattern).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('mock'));

      consoleWarnSpy.mockRestore();
      (env as any).NODE_ENV = originalEnv;
    });

    it('should handle production environment mock values', () => {
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      const mockLine = createMockLine(mockPriceData);
      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.timeframeConfluence).toBe(0.5);
      expect(features.higherTimeframeAlignment).toBe(false);
      expect(features.nearPattern).toBe(false);

      (env as any).NODE_ENV = originalEnv;
    });

    it('should handle lines with missing properties', () => {
      const minimalLine: Partial<DetectedLine> = {
        touchPoints: [{ time: mockPriceData[0]?.time ?? 0, value: 50000 }],
        confidence: 0.5
      };

      const features = extractor.extractFeatures(minimalLine as DetectedLine, 'BTCUSDT');
      
      expect(features).toBeDefined();
      expect(features.touchCount).toBe(1);
      expect(features.confidence).toBe(0.5);
      expect(features.rSquared).toBe(0);
    });

    it('should handle extreme market volatility', () => {
      const volatileData: PriceData[] = [];
      for (let i = 0; i < 20; i++) {
        const base = 50000;
        const swing = (i % 2 === 0) ? 5000 : -5000;
        volatileData.push({
          time: i * 3600,
          open: base,
          high: base + Math.abs(swing) + 1000,
          low: base - Math.abs(swing) - 1000,
          close: base + swing,
          volume: 10000
        });
      }

      const volatileExtractor = new FeatureExtractor(volatileData, 50000);
      const mockLine = {
        type: 'horizontal' as const,
        price: 50000,
        confidence: 0.8,
        touchPoints: [{ time: 0, value: 50000 }],
        timeframe: '1h'
      };

      const features = volatileExtractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.volatility).toBeGreaterThan(0.7);
      expect(features.marketCondition).toBe('volatile');
    });

    it('should handle pattern type detection in development mode', () => {
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'development';

      jest.spyOn(console, 'warn').mockImplementation();
      
      // Create a new extractor and mock the checkNearbyPatterns method
      const mockExtractor = new FeatureExtractor(mockPriceData, currentPrice);
      jest.spyOn(mockExtractor as any, 'checkNearbyPatterns').mockReturnValue(true);

      const mockLine = createMockLine(mockPriceData);
      const features = mockExtractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.nearPattern).toBe(true);
      expect(features.patternType).toBeDefined();
      expect(['headAndShoulders', 'doubleTop', 'triangle', 'flag']).toContain(features.patternType);

      (env as any).NODE_ENV = originalEnv;
    });
  });
});

// Helper functions

function generateMockPriceData(count: number): PriceData[] {
  const data: PriceData[] = [];
  let basePrice = 50000;
  const baseTime = Math.floor(Date.now() / 1000) - count * 3600;

  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 1000;
    const open = basePrice + variation;
    const close = open + (Math.random() - 0.5) * 500;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const volume = 1000 + Math.random() * 5000;

    data.push({
      time: baseTime + i * 3600,
      open,
      high,
      low,
      close,
      volume
    });

    basePrice = close;
  }

  return data;
}

function generateTrendingPriceData(count: number, direction: 'up' | 'down'): PriceData[] {
  const data: PriceData[] = [];
  let basePrice = 50000;
  const baseTime = Math.floor(Date.now() / 1000) - count * 3600;
  const trendFactor = direction === 'up' ? 1.001 : 0.999;

  for (let i = 0; i < count; i++) {
    basePrice *= trendFactor;
    const variation = (Math.random() - 0.5) * 100;
    const open = basePrice + variation;
    const close = basePrice + variation + (direction === 'up' ? 50 : -50);
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;
    const volume = 1000 + Math.random() * 5000;

    data.push({
      time: baseTime + i * 3600,
      open,
      high,
      low,
      close,
      volume
    });
  }

  return data;
}

function createMockLine(priceData: PriceData[]): DetectedLine {
  // Create a line with touches at different points
  const indices = [10, 25, 40, 60, 75].filter(i => i < priceData.length);
  const firstIndex = indices[0];
  if (firstIndex === undefined) {
    throw new Error('Invalid price data - no indices');
  }
  const firstCandle = priceData[firstIndex];
  if (!firstCandle) {
    throw new Error('Invalid price data - candle not found');
  }
  const price = firstCandle.low;

  return {
    type: 'support',
    price,
    confidence: 0.85,
    rSquared: 0.92,
    touchPoints: indices.map(i => {
      const candle = priceData[i];
      if (!candle) {
        throw new Error(`No candle at index ${i}`);
      }
      return {
        time: candle.time,
        value: candle.low + (Math.random() - 0.5) * 50
      };
    }),
    timeframe: '1h'
  };
}