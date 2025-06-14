import { AdvancedTouchDetector, type TouchPoint, type TouchAnalysis } from '@/lib/analysis/advanced-touch-detector';
import type { ProcessedKline } from '@/types/market';

describe('AdvancedTouchDetector', () => {
  let detector: AdvancedTouchDetector;
  let mockData: ProcessedKline[];

  beforeEach(() => {
    detector = new AdvancedTouchDetector();
    
    // Create mock candle data
    mockData = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { time: 2000, open: 102, high: 107, low: 98, close: 104, volume: 1200 },
      { time: 3000, open: 104, high: 106, low: 100, close: 101, volume: 800 },
      { time: 4000, open: 101, high: 103, low: 99, close: 100, volume: 1500 }, // Strong support touch
      { time: 5000, open: 100, high: 108, low: 99, close: 106, volume: 2000 }, // Bounce from support
      { time: 6000, open: 106, high: 110, low: 104, close: 108, volume: 1100 },
      { time: 7000, open: 108, high: 109, low: 105, close: 107, volume: 900 },
      { time: 8000, open: 107, high: 108, low: 100, close: 101, volume: 1800 }, // Another support touch
      { time: 9000, open: 101, high: 105, low: 100, close: 104, volume: 1300 }, // Body touch at support
      { time: 10000, open: 104, high: 112, low: 103, close: 110, volume: 2200 }, // Strong bounce
    ];
  });

  describe('analyzeTouchPoints', () => {
    it('should detect wick touches at support level', () => {
      const supportLevel = 99;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      expect(analysis.touchPoints.length).toBeGreaterThan(0);
      expect(analysis.wickTouchCount).toBeGreaterThan(0);
      
      // Check for specific wick touch
      const wickTouches = analysis.touchPoints.filter(tp => tp.touchType === 'wick');
      expect(wickTouches.length).toBeGreaterThan(0);
    });

    it('should detect body touches with higher strength', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      const bodyTouches = analysis.touchPoints.filter(tp => tp.touchType === 'body');
      const wickTouches = analysis.touchPoints.filter(tp => tp.touchType === 'wick');

      if (bodyTouches.length > 0 && wickTouches.length > 0) {
        const avgBodyStrength = bodyTouches.reduce((sum, tp) => sum + tp.strength, 0) / bodyTouches.length;
        const avgWickStrength = wickTouches.reduce((sum, tp) => sum + tp.strength, 0) / wickTouches.length;
        
        expect(avgBodyStrength).toBeGreaterThanOrEqual(avgWickStrength);
      }
    });

    it('should boost strength for high volume touches', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      const highVolumeTouches = analysis.touchPoints.filter(tp => tp.volumeRatio > 1.5);
      expect(highVolumeTouches.length).toBeGreaterThan(0);

      // High volume touches should have boosted strength
      highVolumeTouches.forEach(tp => {
        expect(tp.strength).toBeGreaterThan(0.7); // Base strength + volume boost
      });
    });

    it('should detect price bounces after touches', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      const bounceTouches = analysis.touchPoints.filter(tp => tp.bounceStrength && tp.bounceStrength > 0);
      expect(bounceTouches.length).toBeGreaterThan(0);

      // Check bounce direction is correct for support
      bounceTouches.forEach(tp => {
        if (tp.bounceDirection) {
          expect(tp.bounceDirection).toBe('up');
        }
      });
    });

    it('should calculate touch quality score correctly', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      expect(analysis.touchQualityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.touchQualityScore).toBeLessThanOrEqual(100);

      // Quality should be higher with more body touches and volume confirmation
      expect(analysis.touchQualityScore).toBeGreaterThan(30); // Should be decent quality
    });

    it('should calculate volume-weighted strength', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');

      expect(analysis.volumeWeightedStrength).toBeGreaterThan(0);
      expect(analysis.volumeWeightedStrength).toBeLessThanOrEqual(2); // Max possible with high volume boost
    });
  });

  describe('filterHighQualityTouches', () => {
    it('should filter touches by minimum strength', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');
      
      const highQualityTouches = detector.filterHighQualityTouches(
        analysis,
        0.8, // High strength requirement
        false, // Don't require volume
        false  // Don't require bounce
      );

      highQualityTouches.forEach(tp => {
        expect(tp.strength).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should filter touches by volume requirement', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');
      
      const volumeConfirmedTouches = detector.filterHighQualityTouches(
        analysis,
        0.5, // Lower strength requirement
        true, // Require volume confirmation
        false
      );

      volumeConfirmedTouches.forEach(tp => {
        expect(tp.volumeRatio).toBeGreaterThanOrEqual(1.3); // Default volume threshold
      });
    });

    it('should filter touches by bounce requirement', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');
      
      const bounceTouches = detector.filterHighQualityTouches(
        analysis,
        0.5,
        false,
        true // Require bounce confirmation
      );

      bounceTouches.forEach(tp => {
        expect(tp.bounceStrength).toBeDefined();
        expect(tp.bounceStrength).toBeGreaterThanOrEqual(0.4); // Default bounce threshold
      });
    });
  });

  describe('calculateLineConfidence', () => {
    it('should calculate confidence based on touch analysis', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');
      
      const confidence = detector.calculateLineConfidence(analysis);
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);

      // Confidence should be reasonable for our test data
      expect(confidence).toBeGreaterThan(0.3);
    });

    it('should give higher confidence for better quality touches', () => {
      // Create high-quality touch scenario
      const highQualityData: ProcessedKline[] = [
        { time: 1000, open: 100, high: 101, low: 100, close: 100, volume: 2000 }, // Exact touch, high volume
        { time: 2000, open: 100, high: 105, low: 100, close: 104, volume: 2500 }, // Body touch, high volume, bounce
        { time: 3000, open: 104, high: 104, low: 100, close: 100, volume: 3000 }, // Another exact touch
      ];

      const highQualityAnalysis = detector.analyzeTouchPoints(highQualityData, 100, 'support');
      const highQualityConfidence = detector.calculateLineConfidence(highQualityAnalysis);

      // Compare with lower quality scenario
      const lowQualityData: ProcessedKline[] = [
        { time: 1000, open: 100, high: 101, low: 99, close: 100, volume: 500 }, // Wick touch, low volume
      ];

      const lowQualityAnalysis = detector.analyzeTouchPoints(lowQualityData, 99, 'support');
      const lowQualityConfidence = detector.calculateLineConfidence(lowQualityAnalysis);

      expect(highQualityConfidence).toBeGreaterThan(lowQualityConfidence);
    });
  });

  describe('getTouchStatistics', () => {
    it('should provide comprehensive touch statistics', () => {
      const supportLevel = 100;
      const analysis = detector.analyzeTouchPoints(mockData, supportLevel, 'support');
      
      const { summary, details } = detector.getTouchStatistics(analysis);

      expect(summary).toContain('touches');
      expect(summary).toContain('Quality:');

      expect(details).toHaveProperty('totalTouches');
      expect(details).toHaveProperty('touchTypes');
      expect(details).toHaveProperty('qualityScore');
      expect(details).toHaveProperty('volumeWeightedStrength');
      expect(details).toHaveProperty('averageStrength');

      expect(details.touchTypes).toHaveProperty('wick');
      expect(details.touchTypes).toHaveProperty('body');
      expect(details.touchTypes).toHaveProperty('exact');
    });
  });

  describe('resistance level detection', () => {
    it('should detect resistance touches correctly', () => {
      const resistanceData: ProcessedKline[] = [
        { time: 1000, open: 95, high: 100, low: 94, close: 98, volume: 1000 }, // Wick touch resistance
        { time: 2000, open: 98, high: 100, low: 96, close: 97, volume: 1200 }, // Another wick touch
        { time: 3000, open: 97, high: 100, low: 95, close: 99, volume: 1500 }, // Body approaches resistance
        { time: 4000, open: 99, high: 100, low: 97, close: 100, volume: 2000 }, // Exact close at resistance
        { time: 5000, open: 100, high: 100, low: 95, close: 96, volume: 1800 }, // Rejection from resistance
      ];

      const resistanceLevel = 100;
      const analysis = detector.analyzeTouchPoints(resistanceData, resistanceLevel, 'resistance');

      expect(analysis.touchPoints.length).toBeGreaterThan(0);
      
      // Check all touches are marked as resistance
      analysis.touchPoints.forEach(tp => {
        expect(tp.type).toBe('resistance');
      });

      // Should detect bounces downward from resistance
      const bounceTouches = analysis.touchPoints.filter(tp => 
        tp.bounceDirection === 'down' && tp.bounceStrength && tp.bounceStrength > 0
      );
      expect(bounceTouches.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data gracefully', () => {
      const analysis = detector.analyzeTouchPoints([], 100, 'support');
      
      expect(analysis.touchPoints).toHaveLength(0);
      expect(analysis.touchQualityScore).toBe(0);
      expect(analysis.volumeWeightedStrength).toBe(0);
    });

    it('should handle single candle data', () => {
      const singleCandle: ProcessedKline[] = [
        { time: 1000, open: 100, high: 101, low: 99, close: 100, volume: 1000 }
      ];

      const analysis = detector.analyzeTouchPoints(singleCandle, 99, 'support');
      
      expect(analysis.touchPoints.length).toBeLessThanOrEqual(1);
      expect(analysis.averageVolume).toBe(1000);
    });

    it('should handle price levels with no touches', () => {
      const analysis = detector.analyzeTouchPoints(mockData, 150, 'resistance'); // Way above price range
      
      expect(analysis.touchPoints).toHaveLength(0);
      expect(analysis.touchQualityScore).toBe(0);
    });
  });
});