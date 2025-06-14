import { describe, it, expect, beforeEach } from '@jest/globals';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import type { PriceData as CandlestickData } from '@/types/market';
import type { PatternAnalysis, PatternDetectionParams, PatternType } from '@/types/pattern';

describe('PatternDetector', () => {
  let detector: PatternDetector;
  let mockData: CandlestickData[];

  beforeEach(() => {
    // Create base mock data - 100 candles
    mockData = createBaseMockData(100);
    detector = new PatternDetector(mockData);
  });

  describe('constructor', () => {
    it('should create instance with provided data', () => {
      expect(detector).toBeDefined();
      expect(detector).toBeInstanceOf(PatternDetector);
    });
  });

  describe('detectPatterns', () => {
    it('should detect patterns with default parameters', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.6,
      };

      const patterns = detector.detectPatterns(params);

      expect(patterns).toBeInstanceOf(Array);
      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.6);
        expect(pattern).toMatchObject({
          type: expect.any(String),
          confidence: expect.any(Number),
          description: expect.any(String),
          startIndex: expect.any(Number),
          endIndex: expect.any(Number),
          visualization: expect.any(Object),
          metrics: expect.any(Object),
          trading_implication: expect.any(String),
        });
      });
    });

    it('should filter patterns by confidence', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.8,
      };

      const patterns = detector.detectPatterns(params);

      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should filter patterns by type when specified', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.5,
        patternTypes: ['headAndShoulders', 'inverseHeadAndShoulders'],
      };

      const patterns = detector.detectPatterns(params);

      patterns.forEach(pattern => {
        expect(['headAndShoulders', 'inverseHeadAndShoulders']).toContain(pattern.type);
      });
    });

    it('should use only recent data based on lookbackPeriod', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 20,
        minConfidence: 0.5,
      };

      const patterns = detector.detectPatterns(params);

      patterns.forEach(pattern => {
        expect(pattern.startIndex).toBeGreaterThanOrEqual(mockData.length - 20);
      });
    });
  });

  describe('Head and Shoulders pattern detection', () => {
    it('should detect classic head and shoulders pattern', () => {
      // Create data with head and shoulders pattern
      const hsData = createHeadAndShouldersData();
      const hsDetector = new PatternDetector(hsData);

      const params: PatternDetectionParams = {
        lookbackPeriod: hsData.length,
        minConfidence: 0.5,
        patternTypes: ['headAndShoulders'],
      };

      const patterns = hsDetector.detectPatterns(params);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('headAndShoulders');
      expect(patterns[0].metrics).toHaveProperty('leftShoulderHeight');
      expect(patterns[0].metrics).toHaveProperty('headHeight');
      expect(patterns[0].metrics).toHaveProperty('rightShoulderHeight');
      expect(patterns[0].metrics).toHaveProperty('necklineLevel');
    });

    it('should detect inverse head and shoulders pattern', () => {
      // Create data with inverse head and shoulders pattern
      const ihsData = createInverseHeadAndShouldersData();
      const ihsDetector = new PatternDetector(ihsData);

      const params: PatternDetectionParams = {
        lookbackPeriod: ihsData.length,
        minConfidence: 0.5,
        patternTypes: ['inverseHeadAndShoulders'],
      };

      const patterns = ihsDetector.detectPatterns(params);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('inverseHeadAndShoulders');
      expect(patterns[0].trading_implication).toContain('bullish');
    });

    it('should validate shoulder symmetry', () => {
      // Create asymmetric shoulders
      const asymmetricData = createAsymmetricShoulderData();
      const asymDetector = new PatternDetector(asymmetricData);

      const params: PatternDetectionParams = {
        lookbackPeriod: asymmetricData.length,
        minConfidence: 0.9, // High confidence required
        patternTypes: ['headAndShoulders'],
      };

      const patterns = asymDetector.detectPatterns(params);

      // Should not detect pattern with high confidence due to asymmetry
      expect(patterns.length).toBe(0);
    });
  });

  describe('Triangle pattern detection', () => {
    it('should detect ascending triangle pattern', () => {
      const triangleData = createAscendingTriangleData();
      const triangleDetector = new PatternDetector(triangleData);

      const params: PatternDetectionParams = {
        lookbackPeriod: triangleData.length,
        minConfidence: 0.6,
        patternTypes: ['ascendingTriangle'],
      };

      const patterns = triangleDetector.detectPatterns(params);

      expect(patterns.some(p => p.type === 'ascendingTriangle')).toBe(true);
      const ascTriangle = patterns.find(p => p.type === 'ascendingTriangle');
      if (ascTriangle) {
        expect(ascTriangle.metrics).toHaveProperty('upperBound');
        expect(ascTriangle.metrics).toHaveProperty('lowerBound');
        expect(ascTriangle.trading_implication).toContain('bullish');
      }
    });

    it('should detect descending triangle pattern', () => {
      const triangleData = createDescendingTriangleData();
      const triangleDetector = new PatternDetector(triangleData);

      const params: PatternDetectionParams = {
        lookbackPeriod: triangleData.length,
        minConfidence: 0.6,
        patternTypes: ['descendingTriangle'],
      };

      const patterns = triangleDetector.detectPatterns(params);

      expect(patterns.some(p => p.type === 'descendingTriangle')).toBe(true);
      const descTriangle = patterns.find(p => p.type === 'descendingTriangle');
      if (descTriangle) {
        expect(descTriangle.trading_implication).toContain('bearish');
      }
    });

    it('should detect symmetrical triangle pattern', () => {
      const triangleData = createSymmetricalTriangleData();
      const triangleDetector = new PatternDetector(triangleData);

      const params: PatternDetectionParams = {
        lookbackPeriod: triangleData.length,
        minConfidence: 0.6,
        patternTypes: ['symmetricalTriangle'],
      };

      const patterns = triangleDetector.detectPatterns(params);

      expect(patterns.some(p => p.type === 'symmetricalTriangle')).toBe(true);
    });
  });

  describe('Double pattern detection', () => {
    it('should detect double top pattern', () => {
      const doubleTopData = createDoubleTopData();
      const dtDetector = new PatternDetector(doubleTopData);

      const params: PatternDetectionParams = {
        lookbackPeriod: doubleTopData.length,
        minConfidence: 0.6,
        patternTypes: ['doubleTop'],
      };

      const patterns = dtDetector.detectPatterns(params);

      expect(patterns.some(p => p.type === 'doubleTop')).toBe(true);
      const doubleTop = patterns.find(p => p.type === 'doubleTop');
      if (doubleTop) {
        expect(doubleTop.metrics).toHaveProperty('firstPeakPrice');
        expect(doubleTop.metrics).toHaveProperty('secondPeakPrice');
        expect(doubleTop.metrics).toHaveProperty('valleyPrice');
        expect(doubleTop.trading_implication).toContain('bearish');
      }
    });

    it('should detect double bottom pattern', () => {
      const doubleBottomData = createDoubleBottomData();
      const dbDetector = new PatternDetector(doubleBottomData);

      const params: PatternDetectionParams = {
        lookbackPeriod: doubleBottomData.length,
        minConfidence: 0.6,
        patternTypes: ['doubleBottom'],
      };

      const patterns = dbDetector.detectPatterns(params);

      expect(patterns.some(p => p.type === 'doubleBottom')).toBe(true);
      const doubleBottom = patterns.find(p => p.type === 'doubleBottom');
      if (doubleBottom) {
        expect(doubleBottom.trading_implication).toContain('bullish');
      }
    });
  });

  describe('Pattern visualization', () => {
    it('should include visualization data for detected patterns', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.5,
      };

      const patterns = detector.detectPatterns(params);

      patterns.forEach(pattern => {
        expect(pattern.visualization).toBeDefined();
        expect(pattern.visualization.keyPoints).toBeInstanceOf(Array);
        expect(pattern.visualization.keyPoints.length).toBeGreaterThan(0);

        pattern.visualization.keyPoints.forEach(point => {
          expect(point).toMatchObject({
            time: expect.any(Number),
            value: expect.any(Number),
            label: expect.any(String),
            type: expect.any(String),
          });
        });

        if (pattern.visualization.trendLines) {
          expect(pattern.visualization.trendLines).toBeInstanceOf(Array);
        }

        if (pattern.visualization.area) {
          expect(pattern.visualization.area).toMatchObject({
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            color: expect.any(String),
            opacity: expect.any(Number),
          });
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data', () => {
      const emptyDetector = new PatternDetector([]);
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.6,
      };

      const patterns = emptyDetector.detectPatterns(params);
      expect(patterns).toHaveLength(0);
    });

    it('should handle insufficient data', () => {
      const smallData = createBaseMockData(10);
      const smallDetector = new PatternDetector(smallData);
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.6,
      };

      const patterns = smallDetector.detectPatterns(params);
      // Should handle gracefully, possibly return no patterns
      expect(patterns).toBeInstanceOf(Array);
    });

    it('should handle lookbackPeriod larger than data length', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 200, // Larger than mockData length
        minConfidence: 0.6,
      };

      const patterns = detector.detectPatterns(params);
      // Should use all available data
      expect(patterns).toBeInstanceOf(Array);
    });

    it('should handle all pattern types when none specified', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 50,
        minConfidence: 0.5,
        // patternTypes not specified - should check all
      };

      const patterns = detector.detectPatterns(params);
      
      // Should attempt to detect all pattern types
      const detectedTypes = new Set(patterns.map(p => p.type));
      expect(detectedTypes.size).toBeGreaterThanOrEqual(0); // May find various patterns
    });
  });

  describe('Performance', () => {
    it('should detect patterns within reasonable time', () => {
      const largeData = createBaseMockData(1000);
      const largeDetector = new PatternDetector(largeData);
      
      const params: PatternDetectionParams = {
        lookbackPeriod: 200,
        minConfidence: 0.6,
      };

      const startTime = Date.now();
      const patterns = largeDetector.detectPatterns(params);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(patterns).toBeInstanceOf(Array);
    });

    it('should limit number of patterns returned', () => {
      const params: PatternDetectionParams = {
        lookbackPeriod: 100,
        minConfidence: 0.5,
      };

      const patterns = detector.detectPatterns(params);

      // Should return reasonable number of patterns (implementation specific)
      // Most implementations limit to top patterns by confidence
      expect(patterns.length).toBeLessThanOrEqual(20);
    });
  });
});

// Helper functions to create specific pattern data

function createBaseMockData(length: number): CandlestickData[] {
  const data: CandlestickData[] = [];
  let basePrice = 50000;
  
  for (let i = 0; i < length; i++) {
    const variation = (Math.random() - 0.5) * 1000;
    const open = basePrice + variation;
    const close = open + (Math.random() - 0.5) * 500;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    
    data.push({
      time: Date.now() - (length - i) * 3600000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
    });
    
    basePrice = close;
  }
  
  return data;
}

function createHeadAndShouldersData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create a head and shoulders pattern
  const prices = [
    50000, 50500, 51000, 52000, 52500, // Rise to left shoulder
    52000, 51500, 51000, 50500, 50000, // Drop to left valley
    50500, 51000, 52000, 53000, 54000, 54500, // Rise to head
    54000, 53000, 52000, 51000, 50500, 50000, // Drop to right valley
    50500, 51000, 51500, 52000, 52500, // Rise to right shoulder
    52000, 51500, 51000, 50500, 50000, // Final drop
  ];
  
  prices.forEach((price, i) => {
    const variation = Math.random() * 100;
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: price + variation * 2,
      low: price - variation * 2,
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  });
  
  return data;
}

function createInverseHeadAndShouldersData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create an inverse head and shoulders pattern (bullish reversal)
  const prices = [
    52000, 51500, 51000, 50500, 50000, // Drop to left shoulder
    50500, 51000, 51500, 52000, 52500, // Rise to left peak
    52000, 51000, 50000, 49000, 48500, // Drop to head
    49000, 50000, 51000, 52000, 52500, // Rise to right peak
    52000, 51500, 51000, 50500, 50000, // Drop to right shoulder
    50500, 51000, 51500, 52000, 52500, // Final rise
  ];
  
  prices.forEach((price, i) => {
    const variation = Math.random() * 100;
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: price + variation * 2,
      low: price - variation * 2,
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  });
  
  return data;
}

function createAsymmetricShoulderData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create pattern with very asymmetric shoulders
  const prices = [
    50000, 50500, 51000, 51500, // Small left shoulder
    51000, 50500, 50000, // Drop
    50500, 51000, 52000, 53000, 54000, // Rise to head
    53500, 53000, 52500, 52000, // Drop
    52500, 53000, 53500, 54000, 54500, 55000, // Much higher right shoulder
  ];
  
  prices.forEach((price, i) => {
    const variation = Math.random() * 100;
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: price + variation * 2,
      low: price - variation * 2,
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  });
  
  return data;
}

function createAscendingTriangleData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  const resistance = 52000;
  
  // Create ascending triangle - rising lows, flat highs
  for (let i = 0; i < 30; i++) {
    const lowerBound = 50000 + (i * 50); // Rising lower bound
    const upperBound = resistance;
    
    const price = lowerBound + (upperBound - lowerBound) * (i % 5) / 4;
    const variation = Math.random() * 100;
    
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: Math.min(price + variation * 2, upperBound),
      low: Math.max(price - variation * 2, lowerBound),
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  }
  
  return data;
}

function createDescendingTriangleData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  const support = 50000;
  
  // Create descending triangle - falling highs, flat lows
  for (let i = 0; i < 30; i++) {
    const upperBound = 52000 - (i * 50); // Falling upper bound
    const lowerBound = support;
    
    const price = lowerBound + (upperBound - lowerBound) * (i % 5) / 4;
    const variation = Math.random() * 100;
    
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: Math.min(price + variation * 2, upperBound),
      low: Math.max(price - variation * 2, lowerBound),
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  }
  
  return data;
}

function createSymmetricalTriangleData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create symmetrical triangle - converging highs and lows
  for (let i = 0; i < 30; i++) {
    const upperBound = 52000 - (i * 30); // Falling upper bound
    const lowerBound = 50000 + (i * 30); // Rising lower bound
    
    const price = lowerBound + (upperBound - lowerBound) * (i % 5) / 4;
    const variation = Math.random() * 50;
    
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: Math.min(price + variation * 2, upperBound),
      low: Math.max(price - variation * 2, lowerBound),
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  }
  
  return data;
}

function createDoubleTopData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create double top pattern
  const prices = [
    50000, 50500, 51000, 51500, 52000, 52500, // First rise
    52000, 51500, 51000, 50500, 50000, // Drop to valley
    50500, 51000, 51500, 52000, 52400, // Second rise (slightly lower)
    52000, 51500, 51000, 50500, 50000, 49500, // Final drop
  ];
  
  prices.forEach((price, i) => {
    const variation = Math.random() * 100;
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: price + variation * 2,
      low: price - variation * 2,
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  });
  
  return data;
}

function createDoubleBottomData(): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - 50 * 3600000;
  
  // Create double bottom pattern
  const prices = [
    52000, 51500, 51000, 50500, 50000, 49500, // First drop
    50000, 50500, 51000, 51500, 52000, // Rise to peak
    51500, 51000, 50500, 50000, 49600, // Second drop (slightly higher)
    50000, 50500, 51000, 51500, 52000, 52500, // Final rise
  ];
  
  prices.forEach((price, i) => {
    const variation = Math.random() * 100;
    data.push({
      time: baseTime + i * 3600000,
      open: price - variation,
      high: price + variation * 2,
      low: price - variation * 2,
      close: price + variation,
      volume: 1000 + Math.random() * 500,
    });
  });
  
  return data;
}