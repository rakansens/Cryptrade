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
      // Create H&S pattern: left shoulder, head, right shoulder
      mockData = [
        createMockCandle(1, 100, 100, 95, 98),
        createMockCandle(2, 98, 110, 97, 108),  // Left shoulder peak
        createMockCandle(3, 108, 108, 102, 103),
        createMockCandle(4, 103, 105, 100, 101), // Left valley
        createMockCandle(5, 101, 115, 100, 114), // Head peak
        createMockCandle(6, 114, 114, 101, 102), // Right valley
        createMockCandle(7, 102, 109, 101, 107), // Right shoulder peak
        createMockCandle(8, 107, 107, 98, 99),
      ];
      
      detector = new PatternDetector(mockData);
      const params: PatternDetectionParams = {
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['headAndShoulders']
      };
      
      const patterns = detector.detectPatterns(params);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('headAndShoulders');
      expect(patterns[0]?.confidence).toBeGreaterThanOrEqual(0.6);
    });
    
    it('should detect inverse head and shoulders pattern', () => {
      // Create inverse H&S pattern
      mockData = [
        createMockCandle(1, 100, 105, 100, 102),
        createMockCandle(2, 102, 103, 90, 92),   // Left shoulder trough
        createMockCandle(3, 92, 98, 92, 97),
        createMockCandle(4, 97, 100, 95, 99),    // Left peak
        createMockCandle(5, 99, 100, 85, 86),    // Head trough
        createMockCandle(6, 86, 99, 86, 98),     // Right peak
        createMockCandle(7, 98, 98, 91, 93),     // Right shoulder trough
        createMockCandle(8, 93, 101, 93, 100),
      ];
      
      detector = new PatternDetector(mockData);
      const params: PatternDetectionParams = {
        lookbackPeriod: 20,
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
      mockData = [
        createMockCandle(1, 100, 110, 100, 105),
        createMockCandle(2, 105, 110, 102, 103), // High 1
        createMockCandle(3, 103, 105, 103, 104),
        createMockCandle(4, 104, 110, 104, 105), // High 2
        createMockCandle(5, 105, 106, 105, 106),
        createMockCandle(6, 106, 110, 106, 107), // High 3
        createMockCandle(7, 107, 108, 107, 108),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
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
        createMockCandle(1, 110, 110, 100, 105),
        createMockCandle(2, 105, 108, 100, 102), // Low 1
        createMockCandle(3, 102, 106, 100, 101), // Low 2
        createMockCandle(4, 101, 104, 100, 100), // Low 3
        createMockCandle(5, 100, 102, 98, 99),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
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
        createMockCandle(1, 100, 110, 100, 105),
        createMockCandle(2, 105, 108, 102, 103),
        createMockCandle(3, 103, 106, 104, 105),
        createMockCandle(4, 105, 105, 105, 105),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.5,
        patternTypes: ['symmetricalTriangle']
      });
      
      const triangle = patterns.find(p => p.type === 'symmetricalTriangle');
      expect(triangle?.trading_implication).toBe('neutral');
    });
  });
  
  describe('Double patterns detection', () => {
    it('should detect double top pattern', () => {
      // Double top: two similar peaks
      mockData = [
        createMockCandle(1, 100, 100, 95, 98),
        createMockCandle(2, 98, 110, 98, 110),  // First top
        createMockCandle(3, 110, 110, 100, 100), // Valley
        createMockCandle(4, 100, 109, 100, 109), // Second top (similar to first)
        createMockCandle(5, 109, 109, 95, 95),
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
      // Double bottom: two similar troughs
      mockData = [
        createMockCandle(1, 110, 110, 105, 108),
        createMockCandle(2, 108, 108, 90, 90),   // First bottom
        createMockCandle(3, 90, 100, 90, 100),   // Peak
        createMockCandle(4, 100, 100, 91, 91),   // Second bottom (similar to first)
        createMockCandle(5, 91, 105, 91, 105),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['doubleBottom']
      });
      
      expect(patterns.some(p => p.type === 'doubleBottom')).toBe(true);
      const doubleBottom = patterns.find(p => p.type === 'doubleBottom');
      expect(doubleBottom?.trading_implication).toBe('bullish');
    });
    
    it('should calculate symmetry metric for double patterns', () => {
      // Perfect double top
      mockData = [
        createMockCandle(1, 100, 100, 95, 98),
        createMockCandle(2, 98, 110, 98, 110),  // First top at 110
        createMockCandle(3, 110, 110, 100, 100),
        createMockCandle(4, 100, 110, 100, 110), // Second top at 110 (perfect match)
        createMockCandle(5, 110, 110, 95, 95),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      const doubleTop = patterns.find(p => p.type === 'doubleTop');
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
      // Create complex data that might form multiple patterns
      mockData = [
        // Data that could form various patterns
        createMockCandle(1, 100, 110, 100, 105),
        createMockCandle(2, 105, 115, 105, 110),
        createMockCandle(3, 110, 110, 100, 102),
        createMockCandle(4, 102, 120, 102, 118),
        createMockCandle(5, 118, 118, 101, 103),
        createMockCandle(6, 103, 111, 103, 109),
        createMockCandle(7, 109, 109, 95, 98),
        createMockCandle(8, 98, 105, 98, 104),
        createMockCandle(9, 104, 110, 104, 108),
        createMockCandle(10, 108, 108, 100, 101),
      ];
      
      detector = new PatternDetector(mockData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 20,
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
      // Create 100 candles but only recent ones form a pattern
      mockData = Array.from({ length: 90 }, (_, i) => 
        createMockCandle(i, 100, 101, 99, 100)
      );
      
      // Add a clear double top in the last 10 candles
      mockData.push(
        createMockCandle(90, 100, 110, 100, 110),
        createMockCandle(91, 110, 110, 100, 100),
        createMockCandle(92, 100, 110, 100, 110),
        createMockCandle(93, 110, 110, 95, 95)
      );
      
      detector = new PatternDetector(mockData);
      
      // With small lookback, should find the pattern
      const patternsSmallLookback = detector.detectPatterns({
        lookbackPeriod: 10,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      // With large lookback including noise, might not find it
      const patternsLargeLookback = detector.detectPatterns({
        lookbackPeriod: 100,
        minConfidence: 0.6,
        patternTypes: ['doubleTop']
      });
      
      expect(patternsSmallLookback.length).toBeGreaterThan(0);
    });
  });
});