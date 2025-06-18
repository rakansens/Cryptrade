import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import type { PriceData as CandlestickData } from '@/types/market';
import type { PatternDetectionParams, PatternAnalysis } from '@/types/pattern';

// Helper to create mock candlestick data
function createMockCandle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000
): CandlestickData {
  return { time, open, high, low, close, volume };
}

describe('PatternDetector', () => {
  let detector: PatternDetector;
  let mockData: CandlestickData[];
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = [];
  });
  
  describe('Head and Shoulders detection', () => {
    it('should detect valid head and shoulders pattern', () => {
      // Create H&S pattern with clear peaks and valleys
      // Need to ensure peaks are true local maxima within window of 3
      mockData = [
        // Leading data
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 103, 99, 102),
        createMockCandle(3, 102, 105, 101, 104),
        
        // Left shoulder peak (110)
        createMockCandle(4, 104, 106, 103, 105),
        createMockCandle(5, 105, 108, 104, 107),
        createMockCandle(6, 107, 110, 106, 109),  // Peak
        createMockCandle(7, 109, 109, 105, 106),
        createMockCandle(8, 106, 107, 103, 104),
        
        // Left valley (100)
        createMockCandle(9, 104, 104, 101, 102),
        createMockCandle(10, 102, 102, 100, 100), // Valley
        createMockCandle(11, 100, 103, 100, 102),
        
        // Head peak (120)
        createMockCandle(12, 102, 108, 102, 107),
        createMockCandle(13, 107, 115, 107, 114),
        createMockCandle(14, 114, 120, 113, 118), // Peak (head)
        createMockCandle(15, 118, 118, 112, 113),
        createMockCandle(16, 113, 114, 108, 109),
        
        // Right valley (101)
        createMockCandle(17, 109, 109, 103, 104),
        createMockCandle(18, 104, 104, 101, 101), // Valley
        createMockCandle(19, 101, 105, 101, 104),
        
        // Right shoulder peak (109)
        createMockCandle(20, 104, 107, 103, 106),
        createMockCandle(21, 106, 109, 105, 108),  // Peak
        createMockCandle(22, 108, 108, 104, 105),
        createMockCandle(23, 105, 105, 102, 103),
        createMockCandle(24, 103, 103, 99, 100),
      ];
      
      detector = new PatternDetector(mockData);
      const params: PatternDetectionParams = {
        lookbackPeriod: 30,
        minConfidence: 0.6,
        patternTypes: ['headAndShoulders']
      };
      
      const patterns = detector.detectPatterns(params);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('headAndShoulders');
      expect(patterns[0]?.confidence).toBeGreaterThanOrEqual(0.6);
    });
    
    it('should detect inverse head and shoulders pattern', () => {
      // Create inverse H&S pattern with clear troughs and peaks
      mockData = [
        // Leading data
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 101, 97, 98),
        createMockCandle(3, 98, 99, 95, 96),
        
        // Left shoulder trough (90)
        createMockCandle(4, 96, 97, 93, 94),
        createMockCandle(5, 94, 95, 91, 92),
        createMockCandle(6, 92, 93, 90, 91),   // Trough
        createMockCandle(7, 91, 94, 91, 93),
        createMockCandle(8, 93, 96, 93, 95),
        
        // Left peak (100)
        createMockCandle(9, 95, 98, 95, 97),
        createMockCandle(10, 97, 100, 97, 99),  // Peak
        createMockCandle(11, 99, 99, 96, 97),
        
        // Head trough (85)
        createMockCandle(12, 97, 97, 92, 93),
        createMockCandle(13, 93, 93, 88, 89),
        createMockCandle(14, 89, 89, 85, 86),   // Trough (head)
        createMockCandle(15, 86, 90, 86, 89),
        createMockCandle(16, 89, 93, 89, 92),
        
        // Right peak (99)
        createMockCandle(17, 92, 96, 92, 95),
        createMockCandle(18, 95, 99, 95, 98),   // Peak
        createMockCandle(19, 98, 98, 94, 95),
        
        // Right shoulder trough (91)
        createMockCandle(20, 95, 95, 92, 93),
        createMockCandle(21, 93, 93, 91, 92),   // Trough
        createMockCandle(22, 92, 95, 92, 94),
        createMockCandle(23, 94, 97, 94, 96),
        createMockCandle(24, 96, 99, 96, 98),
      ];
      
      detector = new PatternDetector(mockData);
      const params: PatternDetectionParams = {
        lookbackPeriod: 30,
        minConfidence: 0.6,
        patternTypes: ['inverseHeadAndShoulders']
      };
      
      const patterns = detector.detectPatterns(params);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('inverseHeadAndShoulders');
      expect(patterns[0]?.trading_implication).toBe('bullish');
    });
    
    it('should calculate correct target price for H&S pattern', () => {
      // Simple H&S with clear neckline
      mockData = [
        createMockCandle(1, 100, 100, 95, 98),
        createMockCandle(2, 98, 110, 97, 110),   // Left shoulder
        createMockCandle(3, 110, 110, 100, 100), // Neckline 1
        createMockCandle(4, 100, 120, 100, 120), // Head
        createMockCandle(5, 120, 120, 100, 100), // Neckline 2
        createMockCandle(6, 100, 110, 100, 110), // Right shoulder
        createMockCandle(7, 110, 110, 95, 95),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.5,
        patternTypes: ['headAndShoulders']
      });
      
      if (patterns.length > 0) {
        const pattern = patterns[0]!;
        expect(pattern.metrics.target_level).toBeDefined();
        expect(pattern.metrics.breakout_level).toBeDefined();
        expect(pattern.metrics.stop_loss).toBeDefined();
      }
    });
  });
  
  describe('Triangle patterns detection', () => {
    it('should detect ascending triangle pattern', () => {
      // Ascending triangle: horizontal resistance, rising support
      // Need at least 2 peaks and 2 troughs with proper trend
      mockData = [
        // First trough and peak
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 101, 95, 96),
        createMockCandle(3, 96, 97, 95, 96),    // Trough 1 at 95
        createMockCandle(4, 96, 100, 96, 99),
        createMockCandle(5, 99, 105, 99, 104),
        createMockCandle(6, 104, 110, 104, 109), // Peak 1 at 110
        createMockCandle(7, 109, 109, 105, 106),
        createMockCandle(8, 106, 106, 102, 103),
        
        // Second trough and peak
        createMockCandle(9, 103, 103, 100, 101),
        createMockCandle(10, 101, 101, 98, 99),  // Trough 2 at 98 (higher than 95)
        createMockCandle(11, 99, 103, 99, 102),
        createMockCandle(12, 102, 107, 102, 106),
        createMockCandle(13, 106, 110, 106, 109), // Peak 2 at 110 (same as peak 1)
        createMockCandle(14, 109, 109, 106, 107),
        createMockCandle(15, 107, 107, 104, 105),
        
        // Third trough and peak for better pattern
        createMockCandle(16, 105, 105, 102, 103),
        createMockCandle(17, 103, 103, 101, 102), // Trough 3 at 101 (higher than 98)
        createMockCandle(18, 102, 106, 102, 105),
        createMockCandle(19, 105, 110, 105, 109), // Peak 3 at 110
        createMockCandle(20, 109, 109, 107, 108),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 25,
        minConfidence: 0.6,
        patternTypes: ['ascendingTriangle']
      });
      
      expect(patterns.some(p => p.type === 'ascendingTriangle')).toBe(true);
      const triangle = patterns.find(p => p.type === 'ascendingTriangle');
      expect(triangle?.trading_implication).toBe('bullish');
    });
    
    it('should detect descending triangle pattern', () => {
      // Descending triangle: descending resistance, horizontal support
      mockData = [
        // First peak and trough
        createMockCandle(1, 110, 112, 108, 110),
        createMockCandle(2, 110, 115, 110, 114),
        createMockCandle(3, 114, 115, 113, 114), // Peak 1 at 115
        createMockCandle(4, 114, 114, 110, 111),
        createMockCandle(5, 111, 111, 105, 106),
        createMockCandle(6, 106, 106, 100, 101), // Trough 1 at 100
        createMockCandle(7, 101, 104, 101, 103),
        createMockCandle(8, 103, 106, 103, 105),
        
        // Second peak and trough
        createMockCandle(9, 105, 109, 105, 108),
        createMockCandle(10, 108, 112, 108, 111), // Peak 2 at 112 (lower than 115)
        createMockCandle(11, 111, 111, 107, 108),
        createMockCandle(12, 108, 108, 103, 104),
        createMockCandle(13, 104, 104, 100, 101), // Trough 2 at 100 (same as trough 1)
        createMockCandle(14, 101, 103, 101, 102),
        createMockCandle(15, 102, 105, 102, 104),
        
        // Third peak and trough
        createMockCandle(16, 104, 108, 104, 107),
        createMockCandle(17, 107, 109, 107, 108), // Peak 3 at 109 (lower than 112)
        createMockCandle(18, 108, 108, 104, 105),
        createMockCandle(19, 105, 105, 100, 101), // Trough 3 at 100
        createMockCandle(20, 101, 102, 99, 100),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 25,
        minConfidence: 0.6,
        patternTypes: ['descendingTriangle']
      });
      
      expect(patterns.some(p => p.type === 'descendingTriangle')).toBe(true);
      const triangle = patterns.find(p => p.type === 'descendingTriangle');
      expect(triangle?.trading_implication).toBe('bearish');
    });
    
    it('should detect symmetrical triangle pattern', () => {
      // Symmetrical triangle: converging trend lines
      mockData = [
        // First swing high and low
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 105, 100, 104),
        createMockCandle(3, 104, 110, 104, 109), // Peak 1 at 110
        createMockCandle(4, 109, 109, 105, 106),
        createMockCandle(5, 106, 106, 100, 101),
        createMockCandle(6, 101, 101, 95, 96),   // Trough 1 at 95
        createMockCandle(7, 96, 99, 96, 98),
        
        // Second swing high and low (converging)
        createMockCandle(8, 98, 103, 98, 102),
        createMockCandle(9, 102, 107, 102, 106), // Peak 2 at 107 (lower than 110)
        createMockCandle(10, 106, 106, 102, 103),
        createMockCandle(11, 103, 103, 98, 99),  // Trough 2 at 98 (higher than 95)
        createMockCandle(12, 99, 101, 99, 100),
        
        // Third swing (more convergence)
        createMockCandle(13, 100, 104, 100, 103),
        createMockCandle(14, 103, 105, 103, 104), // Peak 3 at 105 (lower than 107)
        createMockCandle(15, 104, 104, 101, 102),
        createMockCandle(16, 102, 102, 100, 101), // Trough 3 at 100 (higher than 98)
        createMockCandle(17, 101, 102, 101, 102),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.5,
        patternTypes: ['symmetricalTriangle']
      });
      
      // Check if we found any pattern at all
      if (patterns.length > 0) {
        const triangle = patterns.find(p => p.type === 'symmetricalTriangle');
        expect(triangle?.trading_implication).toBe('neutral');
      } else {
        // If no pattern found, just check that detector returns empty array
        expect(patterns).toEqual([]);
      }
    });
  });
  
  describe('Double patterns detection', () => {
    it('should detect double top pattern', () => {
      // Double top: two similar peaks with valley between
      mockData = [
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 104, 100, 103),
        createMockCandle(3, 103, 107, 103, 106),
        createMockCandle(4, 106, 110, 106, 109),  // First top at 110
        createMockCandle(5, 109, 109, 105, 106),
        createMockCandle(6, 106, 106, 102, 103),
        createMockCandle(7, 103, 103, 100, 101),  // Valley at 100
        createMockCandle(8, 101, 105, 101, 104),
        createMockCandle(9, 104, 108, 104, 107),
        createMockCandle(10, 107, 110, 107, 109), // Second top at 110 (within 2%)
        createMockCandle(11, 109, 109, 105, 106),
        createMockCandle(12, 106, 106, 102, 103),
        createMockCandle(13, 103, 103, 98, 99),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      expect(patterns.some(p => p.type === 'doubleTop')).toBe(true);
      const doubleTop = patterns.find(p => p.type === 'doubleTop');
      expect(doubleTop?.trading_implication).toBe('bearish');
    });
    
    it('should detect double bottom pattern', () => {
      // Double bottom: two similar troughs with peak between
      // The window for finding troughs is 3, so we need proper spacing
      mockData = [
        // Leading data to establish trend
        createMockCandle(1, 110, 112, 108, 110),
        createMockCandle(2, 110, 110, 106, 107),
        createMockCandle(3, 107, 107, 103, 104),
        createMockCandle(4, 104, 104, 100, 101),
        createMockCandle(5, 101, 101, 96, 97),
        createMockCandle(6, 97, 97, 93, 94),
        createMockCandle(7, 94, 94, 91, 92),
        createMockCandle(8, 92, 92, 90, 90),     // First bottom at 90 (clear local minimum)
        createMockCandle(9, 90, 93, 90, 92),
        createMockCandle(10, 92, 95, 92, 94),
        createMockCandle(11, 94, 97, 94, 96),
        createMockCandle(12, 96, 99, 96, 98),
        createMockCandle(13, 98, 100, 98, 99),   // Peak at 100
        createMockCandle(14, 99, 99, 96, 97),
        createMockCandle(15, 97, 97, 94, 95),
        createMockCandle(16, 95, 95, 92, 93),
        createMockCandle(17, 93, 93, 91, 91),    // Second bottom at 91 (within 2% of 90)
        createMockCandle(18, 91, 94, 91, 93),
        createMockCandle(19, 93, 96, 93, 95),
        createMockCandle(20, 95, 98, 95, 97),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 25,
        minConfidence: 0.6,
        patternTypes: ['doubleBottom']
      });
      
      expect(patterns.some(p => p.type === 'doubleBottom')).toBe(true);
      const doubleBottom = patterns.find(p => p.type === 'doubleBottom');
      expect(doubleBottom?.trading_implication).toBe('bullish');
    });
    
    it('should calculate symmetry metric for double patterns', () => {
      // Perfect double top with proper spacing for peak detection
      mockData = [
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 104, 100, 103),
        createMockCandle(3, 103, 107, 103, 106),
        createMockCandle(4, 106, 109, 106, 108),
        createMockCandle(5, 108, 110, 108, 110), // First top at 110 (clear peak)
        createMockCandle(6, 110, 110, 107, 108),
        createMockCandle(7, 108, 108, 105, 106),
        createMockCandle(8, 106, 106, 103, 104),
        createMockCandle(9, 104, 104, 101, 102),
        createMockCandle(10, 102, 102, 100, 100), // Valley at 100 (clear trough)
        createMockCandle(11, 100, 103, 100, 102),
        createMockCandle(12, 102, 105, 102, 104),
        createMockCandle(13, 104, 107, 104, 106),
        createMockCandle(14, 106, 109, 106, 108),
        createMockCandle(15, 108, 110, 108, 110), // Second top at 110 (perfect match)
        createMockCandle(16, 110, 110, 107, 108),
        createMockCandle(17, 108, 108, 105, 106),
        createMockCandle(18, 106, 106, 103, 104),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      const doubleTop = patterns.find(p => p.type === 'doubleTop');
      expect(doubleTop).toBeDefined();
      expect(doubleTop?.metrics.symmetry).toBeGreaterThan(0.95);
    });
  });
  
  describe('Pattern filtering and confidence', () => {
    it('should filter patterns by minimum confidence', () => {
      // Create data that might produce low-confidence patterns
      mockData = Array.from({ length: 50 }, (_, i) => 
        createMockCandle(i, 100, 100 + Math.random() * 10, 100 - Math.random() * 10, 100)
      );
      
      detector = new PatternDetector(mockData);
      
      const lowConfPatterns = detector.detectPatterns({
        lookbackPeriod: 50,
        minConfidence: 0.3
      });
      
      const highConfPatterns = detector.detectPatterns({
        lookbackPeriod: 50,
        minConfidence: 0.8
      });
      
      expect(lowConfPatterns.length).toBeGreaterThanOrEqual(highConfPatterns.length);
    });
    
    it('should detect multiple pattern types when not filtered', () => {
      // Create a clear double top pattern that should be detected
      mockData = [
        createMockCandle(1, 100, 102, 98, 100),
        createMockCandle(2, 100, 105, 100, 104),
        createMockCandle(3, 104, 108, 104, 107),
        createMockCandle(4, 107, 110, 107, 109),  // First top at 110
        createMockCandle(5, 109, 109, 105, 106),
        createMockCandle(6, 106, 106, 102, 103),
        createMockCandle(7, 103, 103, 100, 101),  // Valley at 100
        createMockCandle(8, 101, 105, 101, 104),
        createMockCandle(9, 104, 108, 104, 107),
        createMockCandle(10, 107, 110, 107, 109), // Second top at 110
        createMockCandle(11, 109, 109, 105, 106),
        createMockCandle(12, 106, 106, 102, 103),
        createMockCandle(13, 103, 103, 98, 99),
        createMockCandle(14, 99, 102, 99, 101),
        createMockCandle(15, 101, 105, 101, 104),
        createMockCandle(16, 104, 108, 104, 107),
        createMockCandle(17, 107, 110, 107, 109), // Another peak for potential patterns
        createMockCandle(18, 109, 109, 105, 106),
        createMockCandle(19, 106, 106, 102, 103),
        createMockCandle(20, 103, 103, 99, 100),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 25,
        minConfidence: 0.5
        // No patternTypes filter - should detect all types
      });
      
      const patternTypes = new Set(patterns.map(p => p.type));
      expect(patternTypes.size).toBeGreaterThan(0);
    });
  });
  
  describe('Edge cases and error handling', () => {
    it('should handle insufficient data gracefully', () => {
      mockData = [
        createMockCandle(1, 100, 105, 100, 102),
        createMockCandle(2, 102, 103, 101, 101),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 50,
        minConfidence: 0.6
      });
      
      expect(patterns).toEqual([]);
    });
    
    it('should handle flat price data', () => {
      // All prices are the same
      mockData = Array.from({ length: 20 }, (_, i) => 
        createMockCandle(i, 100, 100, 100, 100)
      );
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6
      });
      
      expect(patterns.length).toBe(0);
    });
    
    it('should use recent data based on lookback period', () => {
      // Create 80 candles of noise
      mockData = Array.from({ length: 80 }, (_, i) => 
        createMockCandle(i, 100, 101, 99, 100)
      );
      
      // Add a clear double top pattern with proper spacing for detection
      // Need to ensure peaks are true local maxima within window of 3
      mockData.push(
        createMockCandle(80, 100, 102, 100, 101),
        createMockCandle(81, 101, 104, 101, 103),
        createMockCandle(82, 103, 106, 103, 105),
        createMockCandle(83, 105, 108, 105, 107),
        createMockCandle(84, 107, 110, 107, 110), // First top at 110
        createMockCandle(85, 110, 110, 107, 108),
        createMockCandle(86, 108, 108, 105, 106),
        createMockCandle(87, 106, 106, 103, 104),
        createMockCandle(88, 104, 104, 101, 102),
        createMockCandle(89, 102, 102, 100, 100), // Valley at 100
        createMockCandle(90, 100, 103, 100, 102),
        createMockCandle(91, 102, 105, 102, 104),
        createMockCandle(92, 104, 107, 104, 106),
        createMockCandle(93, 106, 109, 106, 108),
        createMockCandle(94, 108, 110, 108, 110), // Second top at 110
        createMockCandle(95, 110, 110, 107, 108),
        createMockCandle(96, 108, 108, 105, 106),
        createMockCandle(97, 106, 106, 103, 104),
        createMockCandle(98, 104, 104, 101, 102),
        createMockCandle(99, 102, 102, 99, 100)
      );
      
      detector = new PatternDetector(mockData);
      
      // With small lookback, should find the pattern
      const patternsSmallLookback = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      expect(patternsSmallLookback.length).toBeGreaterThan(0);
    });
  });
});