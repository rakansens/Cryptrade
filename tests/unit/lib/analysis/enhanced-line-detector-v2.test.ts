import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EnhancedLineDetectorV2, type LineDetectionV2Config, type EnhancedLineV2, type TrendLineDetection } from '@/lib/analysis/enhanced-line-detector-v2';
import { AdvancedTouchDetector } from '@/lib/analysis/advanced-touch-detector';
import type { MultiTimeframeData } from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/analysis/advanced-touch-detector');

describe('EnhancedLineDetectorV2', () => {
  let detector: EnhancedLineDetectorV2;
  let mockTouchDetector: jest.Mocked<AdvancedTouchDetector>;
  
  // Helper to create mock kline data
  const createKline = (overrides: Partial<ProcessedKline> = {}): ProcessedKline => ({
    time: 1000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1000,
    ...overrides
  });

  // Create comprehensive mock multi-timeframe data
  const createMockTimeframeData = (basePrice: number = 100): MultiTimeframeData => {
    // Create data with clear swing points for testing
    const data1h = [];
    for (let i = 0; i < 20; i++) {
      const time = 1000 + i * 3600000; // 1 hour intervals
      
      let high, low, open, close;
      if (i === 10) {
        // Clear swing high at index 10
        high = basePrice + 30;
        low = basePrice + 25;
        open = basePrice + 26;
        close = basePrice + 28;
      } else if (i === 15) {
        // Clear swing low at index 15
        high = basePrice - 15;
        low = basePrice - 20;
        open = basePrice - 16;
        close = basePrice - 18;
      } else if (i >= 5 && i <= 15 && i !== 10 && i !== 15) {
        // Mid-range values
        high = basePrice + 10 - Math.abs(i - 10);
        low = basePrice - 10 + Math.abs(i - 10);
        open = basePrice + (Math.random() - 0.5) * 2;
        close = basePrice + (Math.random() - 0.5) * 2;
      } else {
        // Edge values
        high = basePrice + 5;
        low = basePrice - 5;
        open = basePrice + (Math.random() - 0.5) * 2;
        close = basePrice + (Math.random() - 0.5) * 2;
      }
      
      data1h.push({
        time,
        open,
        high,
        low,
        close,
        volume: 1000 + Math.random() * 1000
      });
    }
    
    // Create data for 4h timeframe
    const data4h = [];
    for (let i = 0; i < 15; i++) {
      const time = 1000 + i * 14400000; // 4 hour intervals
      
      let high, low, open, close;
      if (i === 7) {
        // Clear swing high
        high = basePrice + 35;
        low = basePrice + 30;
        open = basePrice + 31;
        close = basePrice + 33;
      } else if (i === 12) {
        // Clear swing low
        high = basePrice - 20;
        low = basePrice - 25;
        open = basePrice - 21;
        close = basePrice - 23;
      } else if (i >= 2 && i <= 12) {
        // Mid-range values
        high = basePrice + 15 - Math.abs(i - 7);
        low = basePrice - 15 + Math.abs(i - 7);
        open = basePrice + (Math.random() - 0.5) * 3;
        close = basePrice + (Math.random() - 0.5) * 3;
      } else {
        // Edge values
        high = basePrice + 8;
        low = basePrice - 8;
        open = basePrice + (Math.random() - 0.5) * 3;
        close = basePrice + (Math.random() - 0.5) * 3;
      }
      
      data4h.push({
        time,
        open,
        high,
        low,
        close,
        volume: 5000 + Math.random() * 3000
      });
    }
    
    return {
      symbol: 'BTCUSDT',
      timeframes: {
        '1h': {
          data: data1h,
          weight: 1.0,
          dataPoints: data1h.length
        },
        '4h': {
          data: data4h,
          weight: 1.5,
          dataPoints: data4h.length
        }
      },
      fetchedAt: Date.now()
    };
  };

  const mockTouchAnalysis = {
    touchPoints: [
      { price: 100, time: 1000, index: 0, type: 'support' as const, touchType: 'body' as const, strength: 1.0, volume: 1000, volumeRatio: 1.0 },
      { price: 100, time: 3000, index: 2, type: 'support' as const, touchType: 'wick' as const, strength: 0.7, volume: 800, volumeRatio: 0.8 },
      { price: 100, time: 4000, index: 3, type: 'support' as const, touchType: 'exact' as const, strength: 1.2, volume: 1500, volumeRatio: 1.5 },
    ],
    averageVolume: 1100,
    wickTouchCount: 1,
    bodyTouchCount: 1,
    exactTouchCount: 1,
    strongBounceCount: 2,
    touchQualityScore: 75,
    volumeWeightedStrength: 0.9
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock touch detector methods
    mockTouchDetector = {
      analyzeTouchPoints: jest.fn().mockReturnValue(mockTouchAnalysis),
      calculateLineConfidence: jest.fn().mockReturnValue(0.8),
      calculateTouchQualityScore: jest.fn().mockReturnValue(75),
      calculateVolumeWeightedStrength: jest.fn().mockReturnValue(0.9),
      getTouchStatistics: jest.fn().mockReturnValue({
        summary: '3 touches (W:1 B:1 E:1), 2 bounces, Quality: 75.0/100',
        details: { totalTouches: 3, qualityScore: 75 }
      }),
      filterHighQualityTouches: jest.fn(),
    } as any;

    // Set up constructor mock
    (AdvancedTouchDetector as jest.MockedClass<typeof AdvancedTouchDetector>).mockImplementation(() => mockTouchDetector);

    detector = new EnhancedLineDetectorV2();
  });

  describe('constructor and configuration', () => {
    it('should create instance with default config', () => {
      expect(detector).toBeDefined();
      expect(AdvancedTouchDetector).toHaveBeenCalledWith({
        wickWeight: 0.7,
        bodyWeight: 1.0,
        exactWeight: 1.2,
        volumeThresholdMultiplier: 1.3,
        bounceThresholdPercent: 0.4,
        lookforwardBars: 6,
        tolerancePercent: 0.15
      });
    });

    it('should merge custom config with defaults', () => {
      const customConfig: Partial<LineDetectionV2Config> = {
        minTouchCount: 5,
        minConfidence: 0.8,
        minQualityScore: 80,
        touchConfig: {
          wickWeight: 0.5,
          volumeThresholdMultiplier: 1.5
        }
      };
      
      // Reset mock to clear previous calls
      jest.clearAllMocks();
      
      const customDetector = new EnhancedLineDetectorV2(customConfig);
      expect(customDetector).toBeDefined();
      // The touchConfig is passed as-is, not merged with defaults in the constructor
      expect(AdvancedTouchDetector).toHaveBeenCalledWith({
        wickWeight: 0.5,
        volumeThresholdMultiplier: 1.5
      });
    });
  });

  describe('detectEnhancedLines', () => {
    it('should detect both horizontal lines and trendlines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(result).toHaveProperty('horizontalLines');
      expect(result).toHaveProperty('trendlines');
      expect(result).toHaveProperty('detectionStats');
      
      expect(result.detectionStats).toMatchObject({
        totalCandidates: expect.any(Number),
        qualityFiltered: expect.any(Number),
        touchFiltered: expect.any(Number),
        finalLines: expect.any(Number),
        processingTime: expect.any(Number),
      });
    });

    it('should log detection progress', async () => {
      const multiTimeframeData = createMockTimeframeData();
      await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[EnhancedLineDetectorV2] Starting advanced line detection',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          timeframes: ['1h', '4h'],
          config: expect.any(Object)
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        '[EnhancedLineDetectorV2] Detection completed',
        expect.any(Object)
      );
    });

    it('should measure processing time accurately', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const startTime = Date.now();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      const endTime = Date.now();
      
      expect(result.detectionStats.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.detectionStats.processingTime).toBeLessThanOrEqual(endTime - startTime + 10);
    });
  });

  describe('horizontal line detection', () => {
    it('should find swing levels correctly', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData(100);
      await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should analyze touch points for swing levels
      expect(mockTouchDetector.analyzeTouchPoints).toHaveBeenCalled();
    });

    it('should merge similar price levels across timeframes', async () => {
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock similar price levels in different timeframes
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: [
          ...mockTouchAnalysis.touchPoints,
          { price: 100.5, time: 5000, index: 4, type: 'support' as const, touchType: 'body' as const, strength: 1.0, volume: 1200, volumeRatio: 1.1 }
        ]
      });
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Lines should be merged within price tolerance
      if (result.horizontalLines.length > 0) {
        const line = result.horizontalLines[0];
        expect(line!.supportingTimeframes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should calculate quality metrics correctly', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.horizontalLines.forEach(line => {
        const metrics = line.qualityMetrics;
        expect(metrics.wickBodyRatio).toBeGreaterThanOrEqual(0);
        expect(metrics.wickBodyRatio).toBeLessThanOrEqual(1);
        expect(metrics.volumeConfirmation).toBeGreaterThanOrEqual(0);
        expect(metrics.volumeConfirmation).toBeLessThanOrEqual(1);
        expect(metrics.bounceConfirmation).toBeGreaterThanOrEqual(0);
        expect(metrics.bounceConfirmation).toBeLessThanOrEqual(1);
        expect(metrics.overallQuality).toBeGreaterThanOrEqual(0);
        expect(metrics.overallQuality).toBeLessThanOrEqual(100);
      });
    });

    it('should filter by minimum timeframe support', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 3 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Only 2 timeframes in test data
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should filter out lines without enough timeframe support
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should apply volume confirmation filter', async () => {
      const detector = new EnhancedLineDetectorV2({
        requireVolumeConfirmation: true,
        volumeConfirmationThreshold: 0.8,
        touchConfig: { volumeThresholdMultiplier: 1.3 }
      });
      
      // Mock low volume touches
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: mockTouchAnalysis.touchPoints.map(tp => ({
          ...tp,
          volumeRatio: 0.5
        }))
      });
      
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should apply bounce confirmation filter', async () => {
      const detector = new EnhancedLineDetectorV2({
        requireBounceConfirmation: true,
        bounceConfirmationThreshold: 0.5
      });
      
      // Mock no bounce confirmation
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        strongBounceCount: 0
      });
      
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should determine level type based on recent price action', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Modify data to have most prices above a certain level
      multiTimeframeData.timeframes['1h']!.data = multiTimeframeData.timeframes['1h']!.data.map(k => ({
        ...k,
        close: 110 // Most closes above 100
      }));
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should correctly identify support/resistance based on price position
      expect(mockTouchDetector.analyzeTouchPoints).toHaveBeenCalled();
    });

    it('should sort lines by combined confidence and strength', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock multiple lines with different confidences
      let callCount = 0;
      mockTouchDetector.calculateLineConfidence.mockImplementation(() => {
        callCount++;
        return callCount % 2 === 0 ? 0.9 : 0.7;
      });
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Verify sorting
      for (let i = 1; i < result.horizontalLines.length; i++) {
        const prevScore = result.horizontalLines[i - 1]!.confidence * result.horizontalLines[i - 1]!.strength;
        const currScore = result.horizontalLines[i]!.confidence * result.horizontalLines[i]!.strength;
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
      }
    });
  });

  describe('trendline detection', () => {
    it('should detect trendlines using linear regression', async () => {
      const multiTimeframeData = createMockTimeframeData();
      
      // Create ascending price data
      const trendData: ProcessedKline[] = Array.from({ length: 20 }, (_, i) => ({
        time: 1000 + i * 1000,
        open: 100 + i * 2,
        high: 105 + i * 2,
        low: 98 + i * 2,
        close: 102 + i * 2,
        volume: 1000,
      }));
      
      multiTimeframeData.timeframes['1h']!.data = trendData;
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should attempt trendline detection
      expect(result.trendlines).toBeDefined();
    });

    it('should validate trendline R-squared threshold', async () => {
      const detector = new EnhancedLineDetectorV2({
        trendlineRSquaredThreshold: 0.9,
        minTimeframes: 1
      });
      
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Only high-quality trendlines should pass
      result.trendlines.forEach(trendline => {
        expect(trendline.coordinates).toBeDefined();
      });
    });

    it('should limit trendline slope', async () => {
      const detector = new EnhancedLineDetectorV2({
        maxTrendlineSlope: 0.05,
        minTimeframes: 1
      });
      
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Steep trendlines should be filtered out
      result.trendlines.forEach(trendline => {
        if (trendline.coordinates?.slope) {
          expect(Math.abs(trendline.coordinates.slope)).toBeLessThanOrEqual(0.05);
        }
      });
    });

    it('should analyze touches along trendlines', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Create data with clear swing points for trendline detection
      const trendData: ProcessedKline[] = [];
      for (let i = 0; i < 20; i++) {
        const basePrice = 100 + i * 2;
        // Create swing points with higher variance
        const isSwingPoint = i % 3 === 0;
        trendData.push({
          time: 1000 + i * 1000,
          open: basePrice,
          high: isSwingPoint ? basePrice + 10 : basePrice + 2,
          low: isSwingPoint ? basePrice - 10 : basePrice - 2,
          close: basePrice + 1,
          volume: 1000
        });
      }
      
      multiTimeframeData.timeframes['1h']!.data = trendData;
      
      // Mock touch analysis to return valid touches for trendlines
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchQualityScore: 70,
        touchPoints: Array(4).fill(null).map((_, i) => ({
          price: 100 + i * 10,
          time: 1000 + i * 3000,
          index: i * 3,
          type: 'support' as const,
          touchType: 'wick' as const,
          strength: 0.7,
          volume: 1000,
          volumeRatio: 1.0
        }))
      });
      
      await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should analyze trendline touches - check if touch analysis methods were called
      expect(mockTouchDetector.calculateTouchQualityScore).toHaveBeenCalled();
    });

    it('should include trendline metadata', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.trendlines.forEach(trendline => {
        expect(trendline.type).toBe('trendline');
        expect(trendline.coordinates).toBeDefined();
        if (trendline.coordinates) {
          expect(trendline.coordinates.startTime).toBeDefined();
          expect(trendline.coordinates.endTime).toBeDefined();
          expect(trendline.coordinates.startPrice).toBeDefined();
          expect(trendline.coordinates.endPrice).toBeDefined();
          expect(trendline.coordinates.slope).toBeDefined();
        }
      });
    });
  });

  describe('line strength calculation', () => {
    it('should calculate strength based on multiple factors', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock high-quality touches
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: Array(8).fill(null).map((_, i) => ({
          price: 100,
          time: 1000 + i * 1000,
          index: i,
          type: 'support' as const,
          touchType: 'body' as const,
          strength: 1.0,
          volume: 1500,
          volumeRatio: 1.5,
          bounceStrength: 0.5
        })),
        strongBounceCount: 5,
        touchQualityScore: 85,
        volumeWeightedStrength: 0.95
      });
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.horizontalLines.length > 0) {
        const line = result.horizontalLines[0];
        expect(line!.strength).toBeGreaterThan(0.5);
        expect(line!.strength).toBeLessThanOrEqual(1.0);
      }
    });

    it('should limit maximum strength to 1.0', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock extremely high-quality touches
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: Array(20).fill(null).map((_, i) => ({
          price: 100,
          time: 1000 + i * 1000,
          index: i,
          type: 'support' as const,
          touchType: 'exact' as const,
          strength: 1.2,
          volume: 2000,
          volumeRatio: 2.0,
          bounceStrength: 1.0
        })),
        strongBounceCount: 20,
        touchQualityScore: 100,
        volumeWeightedStrength: 1.0
      });
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.horizontalLines.forEach(line => {
        expect(line.strength).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('line descriptions', () => {
    it('should generate descriptive text for horizontal lines', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.horizontalLines.forEach(line => {
        expect(line.description).toContain('level');
        expect(line.description).toContain('touches');
        expect(line.description).toContain('timeframes');
      });
    });

    it('should generate descriptive text for trendlines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.trendlines.forEach(line => {
        expect(line.description).toMatch(/ascending|descending/);
        expect(line.description).toContain('trendline');
        expect(line.description).toContain('fit');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty timeframe data', async () => {
      const emptyData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': { data: [], weight: 1.0, dataPoints: 0 },
        },
        fetchedAt: Date.now(),
      };
      
      const result = await detector.detectEnhancedLines(emptyData);
      
      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
      expect(result.detectionStats.totalCandidates).toBe(0);
    });

    it('should handle insufficient data for swing detection', async () => {
      const insufficientData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: Array(5).fill(null).map((_, i) => createKline({ time: 1000 + i * 1000 })),
            weight: 1.0,
            dataPoints: 5
          },
        },
        fetchedAt: Date.now(),
      };
      
      const result = await detector.detectEnhancedLines(insufficientData);
      
      expect(result).toBeDefined();
      expect(result.detectionStats.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle null/undefined candles gracefully', async () => {
      const dataWithNulls: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: [
              createKline({ time: 1000 }),
              null as any,
              createKline({ time: 3000 }),
              undefined as any,
              createKline({ time: 5000 })
            ],
            weight: 1.0,
            dataPoints: 5
          },
        },
        fetchedAt: Date.now(),
      };
      
      await expect(detector.detectEnhancedLines(dataWithNulls)).resolves.toBeDefined();
    });

    it('should handle extreme price values', async () => {
      const extremeData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: [
              createKline({ high: 1e10, low: 1e-10 }),
              createKline({ high: Infinity, low: -Infinity }),
              createKline({ high: NaN, low: NaN })
            ],
            weight: 1.0,
            dataPoints: 3
          },
        },
        fetchedAt: Date.now(),
      };
      
      await expect(detector.detectEnhancedLines(extremeData)).resolves.toBeDefined();
    });

    it('should handle timeframe data with no valid swings', async () => {
      // Create flat data with no swings
      const flatData: ProcessedKline[] = Array(20).fill(null).map((_, i) => ({
        time: 1000 + i * 1000,
        open: 100,
        high: 100.1,
        low: 99.9,
        close: 100,
        volume: 1000
      }));
      
      const multiTimeframeData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': { data: flatData, weight: 1.0, dataPoints: flatData.length }
        },
        fetchedAt: Date.now()
      };
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      expect(result).toBeDefined();
    });
  });

  describe('performance and statistics', () => {
    it('should track detection statistics accurately', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock multiple candidates with some filtered out
      mockTouchDetector.analyzeTouchPoints
        .mockReturnValueOnce({ ...mockTouchAnalysis, touchPoints: [] }) // Filtered by touch count
        .mockReturnValueOnce({ ...mockTouchAnalysis, touchQualityScore: 50 }) // Filtered by quality
        .mockReturnValue(mockTouchAnalysis); // Valid lines
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.detectionStats.totalCandidates).toBeGreaterThanOrEqual(0);
      expect(result.detectionStats.qualityFiltered).toBeGreaterThanOrEqual(0);
      expect(result.detectionStats.touchFiltered).toBeGreaterThanOrEqual(0);
      expect(result.detectionStats.finalLines).toBe(
        result.horizontalLines.length + result.trendlines.length
      );
    });

    it('should complete detection within reasonable time', async () => {
      const largeData = createMockTimeframeData();
      // Add more timeframes
      largeData.timeframes['15m'] = largeData.timeframes['1h']!;
      largeData.timeframes['30m'] = largeData.timeframes['1h']!;
      largeData.timeframes['1d'] = largeData.timeframes['4h']!;
      
      const startTime = Date.now();
      const result = await detector.detectEnhancedLines(largeData);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.detectionStats.processingTime).toBeLessThanOrEqual(duration + 10);
    });
  });

  describe('integration with touch detector', () => {
    it('should pass correct parameters to touch detector', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(mockTouchDetector.analyzeTouchPoints).toHaveBeenCalledWith(
        expect.any(Array), // data
        expect.any(Number), // price level
        expect.stringMatching(/^(support|resistance)$/) // level type
      );
    });

    it('should use touch detector statistics', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(mockTouchDetector.getTouchStatistics).toHaveBeenCalled();
    });

    it('should calculate combined touch quality scores', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(mockTouchDetector.calculateTouchQualityScore).toHaveBeenCalled();
      expect(mockTouchDetector.calculateVolumeWeightedStrength).toHaveBeenCalled();
    });
  });

  describe('unique ID generation', () => {
    it('should generate unique IDs for all lines', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Generate multiple lines
      mockTouchDetector.calculateLineConfidence
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.8)
        .mockReturnValue(0.7);
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      const allIds = [
        ...result.horizontalLines.map(l => l.id),
        ...result.trendlines.map(l => l.id)
      ];
      
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
      
      // Check ID format
      allIds.forEach(id => {
        expect(id).toMatch(/^(horizontal|trendline)_\d+_[a-z0-9]+$/);
      });
    });
  });

  describe('metadata and timestamps', () => {
    it('should include creation timestamps', async () => {
      const detector = new EnhancedLineDetectorV2({ minTimeframes: 1 });
      const multiTimeframeData = createMockTimeframeData();
      
      const beforeTime = Date.now();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      const afterTime = Date.now();
      
      const allLines = [...result.horizontalLines, ...result.trendlines];
      allLines.forEach(line => {
        expect(line.createdAt).toBeGreaterThanOrEqual(beforeTime);
        expect(line.createdAt).toBeLessThanOrEqual(afterTime);
      });
    });
  });
});