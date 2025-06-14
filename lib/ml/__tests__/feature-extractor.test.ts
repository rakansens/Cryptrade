import { describe, it, expect, beforeEach } from '@jest/globals';
import { FeatureExtractor } from '../feature-extractor';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';
import type { LineFeatures } from '../line-validation-types';

describe('FeatureExtractor', () => {
  let extractor: FeatureExtractor;
  let mockPriceData: PriceData[];
  let currentPrice: number;

  beforeEach(() => {
    // Create realistic price data
    mockPriceData = generateMockPriceData(100);
    currentPrice = mockPriceData[mockPriceData.length - 1].close;
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
        id: 'test-line',
        type: 'horizontal',
        price,
        confidence: 0.85,
        touchPoints: [
          { time: mockPriceData[10].time, value: mockPriceData[10].high }, // Wick touch
          { time: mockPriceData[20].time, value: (mockPriceData[20].open + mockPriceData[20].close) / 2 }, // Body touch
          { time: mockPriceData[30].time, value: price }, // Exact touch
        ],
        supportingTimeframes: ['1h']
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
      const currentTime = mockPriceData[mockPriceData.length - 1].time;

      const firstIndex = mockPriceData.findIndex(p => p.time >= firstTouch);
      const lastIndex = mockPriceData.findIndex(p => p.time >= lastTouch);
      const currentIndex = mockPriceData.length - 1;

      expect(features.ageInCandles).toBe(currentIndex - firstIndex);
      expect(features.timeSinceLastTouch).toBe(currentIndex - lastIndex);
    });

    it('should detect market conditions correctly', () => {
      // Test trending market
      const trendingData = generateTrendingPriceData(100, 'up');
      const trendingExtractor = new FeatureExtractor(trendingData, trendingData[trendingData.length - 1].close);
      const mockLine = createMockLine(trendingData);
      const features = trendingExtractor.extractFeatures(mockLine, 'BTCUSDT');

      expect(features.marketCondition).toBe('trending');
      expect(features.trendStrength).toBeGreaterThan(0); // Uptrend
    });

    it('should calculate distance from current price', () => {
      const linePrice = 50000;
      const currentPrice = 52000;
      const mockLine: DetectedLine = {
        id: 'test-line',
        type: 'horizontal',
        price: linePrice,
        confidence: 0.85,
        touchPoints: [{ time: mockPriceData[0].time, value: linePrice }],
        supportingTimeframes: ['1h']
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
          id: 'test-line',
          type: 'horizontal',
          price,
          confidence: 0.85,
          touchPoints: [{ time: mockPriceData[0].time, value: price }],
          supportingTimeframes: ['1h']
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
      normalized.forEach((value, index) => {
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
        id: 'test-line',
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [],
        supportingTimeframes: ['1h']
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

      const singleExtractor = new FeatureExtractor(singleData, singleData[0].close);
      const mockLine: DetectedLine = {
        id: 'test-line',
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [{ time: singleData[0].time, value: 50000 }],
        supportingTimeframes: ['1h']
      };

      const features = singleExtractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features).toBeDefined();
      expect(features.volatility).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing touch point data', () => {
      const mockLine: DetectedLine = {
        id: 'test-line',
        type: 'horizontal',
        price: 50000,
        confidence: 0.85,
        touchPoints: [
          { time: 999999999, value: 50000 } // Time not in price data
        ],
        supportingTimeframes: ['1h']
      };

      const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
      
      expect(features).toBeDefined();
      expect(features.volumeAverage).toBe(0);
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
  const price = priceData[indices[0]].low;

  return {
    id: 'test-line-1',
    type: 'support',
    price,
    confidence: 0.85,
    rSquared: 0.92,
    touchPoints: indices.map(i => ({
      time: priceData[i].time,
      value: priceData[i].low + (Math.random() - 0.5) * 50
    })),
    supportingTimeframes: ['1h', '4h']
  };
}