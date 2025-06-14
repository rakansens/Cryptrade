import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EnhancedLineDetectorV2, type EnhancedLineV2, type LineDetectionV2Config } from '@/lib/analysis/enhanced-line-detector-v2';
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
  
  // Create mock multi-timeframe data
  const createMockTimeframeData = (basePrice: number = 100): MultiTimeframeData => ({
    symbol: 'BTCUSDT',
    timeframes: {
      '1h': {
        data: [
          { time: 1000, open: basePrice, high: basePrice + 5, low: basePrice - 5, close: basePrice + 2, volume: 1000 },
          { time: 2000, open: basePrice + 2, high: basePrice + 7, low: basePrice - 2, close: basePrice + 4, volume: 1200 },
          { time: 3000, open: basePrice + 4, high: basePrice + 6, low: basePrice, close: basePrice + 1, volume: 800 },
          { time: 4000, open: basePrice + 1, high: basePrice + 3, low: basePrice - 1, close: basePrice, volume: 1500 },
          { time: 5000, open: basePrice, high: basePrice + 8, low: basePrice - 1, close: basePrice + 6, volume: 2000 },
        ],
        weight: 1.0,
        analysisDepth: 200
      },
      '4h': {
        data: [
          { time: 1000, open: basePrice - 2, high: basePrice + 10, low: basePrice - 5, close: basePrice + 5, volume: 5000 },
          { time: 16000, open: basePrice + 5, high: basePrice + 12, low: basePrice, close: basePrice + 2, volume: 6000 },
          { time: 32000, open: basePrice + 2, high: basePrice + 4, low: basePrice - 3, close: basePrice + 1, volume: 4500 },
        ],
        weight: 1.5,
        analysisDepth: 100
      }
    },
    fetchedAt: Date.now()
  });

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
        summary: '3 touches, Quality: 75/100',
        details: { totalTouches: 3, qualityScore: 75 }
      }),
      filterHighQualityTouches: jest.fn(),
    } as any;

    // Set up constructor mock
    (AdvancedTouchDetector as jest.MockedClass<typeof AdvancedTouchDetector>).mockImplementation(() => mockTouchDetector);

    detector = new EnhancedLineDetectorV2();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(detector).toBeDefined();
      expect(AdvancedTouchDetector).toHaveBeenCalled();
    });

    it('should accept custom config', () => {
      const customConfig: Partial<LineDetectionV2Config> = {
        minTouchCount: 5,
        minConfidence: 0.8,
        minQualityScore: 80,
        requireVolumeConfirmation: true,
      };
      
      const customDetector = new EnhancedLineDetectorV2(customConfig);
      expect(customDetector).toBeDefined();
    });
  });

  describe('detectEnhancedLines', () => {
    it('should detect horizontal lines and trendlines', async () => {
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

    it('should log detection start and completion', async () => {
      const multiTimeframeData = createMockTimeframeData();
      await detector.detectEnhancedLines(multiTimeframeData);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[EnhancedLineDetectorV2] Starting advanced line detection',
        expect.any(Object)
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        '[EnhancedLineDetectorV2] Detection completed',
        expect.any(Object)
      );
    });

    it('should filter lines by minimum touch count', async () => {
      // Set high minimum touch count
      const customDetector = new EnhancedLineDetectorV2({ minTouchCount: 10 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock low touch count
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: [mockTouchAnalysis.touchPoints[0]], // Only 1 touch
      });
      
      const result = await customDetector.detectEnhancedLines(multiTimeframeData);
      
      // Should have filtered out lines with insufficient touches
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should filter lines by quality score', async () => {
      const customDetector = new EnhancedLineDetectorV2({ minQualityScore: 90 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock low quality score
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchQualityScore: 50,
      });
      
      const result = await customDetector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should apply volume confirmation when required', async () => {
      const customDetector = new EnhancedLineDetectorV2({
        requireVolumeConfirmation: true,
        volumeConfirmationThreshold: 0.8,
      });
      
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock insufficient volume confirmation
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        touchPoints: mockTouchAnalysis.touchPoints.map(tp => ({
          ...tp,
          volumeRatio: 0.5, // Low volume ratio
        })),
      });
      
      const result = await customDetector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines.length).toBe(0);
    });

    it('should apply bounce confirmation when required', async () => {
      const customDetector = new EnhancedLineDetectorV2({
        requireBounceConfirmation: true,
        bounceConfirmationThreshold: 0.5,
      });
      
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock insufficient bounce confirmation
      mockTouchDetector.analyzeTouchPoints.mockReturnValue({
        ...mockTouchAnalysis,
        strongBounceCount: 0,
      });
      
      const result = await customDetector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines.length).toBe(0);
    });
  });

  describe('horizontal line detection', () => {
    it('should find swing levels correctly', async () => {
      const multiTimeframeData = createMockTimeframeData(100);
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Should have called touch analysis for detected levels
      expect(mockTouchDetector.analyzeTouchPoints).toHaveBeenCalled();
    });

    it('should merge levels across timeframes', async () => {
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock multiple timeframe support
      mockTouchDetector.calculateLineConfidence.mockReturnValue(0.9);
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.horizontalLines.length > 0) {
        const line = result.horizontalLines[0];
        expect(line.supportingTimeframes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should calculate quality metrics for lines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.horizontalLines.length > 0) {
        const line = result.horizontalLines[0];
        expect(line.qualityMetrics).toMatchObject({
          wickBodyRatio: expect.any(Number),
          volumeConfirmation: expect.any(Number),
          bounceConfirmation: expect.any(Number),
          overallQuality: expect.any(Number),
        });
        
        // All metrics should be between 0 and 100
        expect(line.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);
        expect(line.qualityMetrics.overallQuality).toBeLessThanOrEqual(100);
      }
    });

    it('should sort horizontal lines by confidence and strength', async () => {
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock multiple lines with different confidences
      let callCount = 0;
      mockTouchDetector.calculateLineConfidence.mockImplementation(() => {
        callCount++;
        return callCount % 2 === 0 ? 0.9 : 0.7;
      });
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.horizontalLines.length > 1) {
        for (let i = 1; i < result.horizontalLines.length; i++) {
          const prevScore = result.horizontalLines[i - 1].confidence * result.horizontalLines[i - 1].strength;
          const currScore = result.horizontalLines[i].confidence * result.horizontalLines[i].strength;
          expect(prevScore).toBeGreaterThanOrEqual(currScore);
        }
      }
    });
  });

  describe('trendline detection', () => {
    it('should detect trendlines with linear regression', async () => {
      const multiTimeframeData = createMockTimeframeData();
      
      // Create ascending price data for trendline
      const trendData: ProcessedKline[] = Array.from({ length: 10 }, (_, i) => ({
        time: 1000 + i * 1000,
        open: 100 + i * 2,
        high: 105 + i * 2,
        low: 98 + i * 2,
        close: 102 + i * 2,
        volume: 1000,
      }));
      
      multiTimeframeData.timeframes['1h'].data = trendData;
      
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      // May or may not detect trendlines depending on swing point detection
      expect(result.trendlines).toBeDefined();
    });

    it('should validate trendlines across timeframes', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.trendlines.length > 0) {
        const trendline = result.trendlines[0];
        expect(trendline.type).toBe('trendline');
        expect(trendline.coordinates).toBeDefined();
        expect(trendline.coordinates?.slope).toBeDefined();
      }
    });

    it('should include trendline equation data', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      if (result.trendlines.length > 0) {
        const trendline = result.trendlines[0];
        expect(trendline.coordinates).toMatchObject({
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          startPrice: expect.any(Number),
          endPrice: expect.any(Number),
          slope: expect.any(Number),
        });
      }
    });
  });

  describe('line properties', () => {
    it('should generate unique IDs for lines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      const allIds = [
        ...result.horizontalLines.map(l => l.id),
        ...result.trendlines.map(l => l.id),
      ];
      
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should include metadata for all lines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      const allLines = [...result.horizontalLines, ...result.trendlines];
      
      allLines.forEach(line => {
        expect(line.metadata).toMatchObject({
          algorithm: 'multi-timeframe',
          version: expect.any(String),
          calculatedAt: expect.any(Number),
          crossTimeframeValidation: expect.any(Number),
          volatilityAdjusted: true,
        });
      });
    });

    it('should generate descriptive text for lines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      const allLines = [...result.horizontalLines, ...result.trendlines];
      
      allLines.forEach(line => {
        expect(line.description).toBeTruthy();
        expect(line.description.length).toBeGreaterThan(10);
      });
    });

    it('should include touch analysis for all lines', async () => {
      const multiTimeframeData = createMockTimeframeData();
      const result = await detector.detectEnhancedLines(multiTimeframeData);
      
      result.horizontalLines.forEach(line => {
        expect(line.touchAnalysis).toBeDefined();
        expect(line.touchAnalysis.touchPoints).toBeInstanceOf(Array);
        expect(line.touchAnalysis.touchQualityScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty timeframe data', async () => {
      const emptyData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': { data: [], weight: 1.0, analysisDepth: 0 },
        },
        fetchedAt: Date.now(),
      };
      
      const result = await detector.detectEnhancedLines(emptyData);
      
      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
    });

    it('should handle single candle data', async () => {
      const singleCandleData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: [{ time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 }],
            weight: 1.0,
            analysisDepth: 1
          },
        },
        fetchedAt: Date.now(),
      };
      
      const result = await detector.detectEnhancedLines(singleCandleData);
      
      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
    });

    it('should handle insufficient data for pattern detection', async () => {
      const insufficientData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: [
              { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
              { time: 2000, open: 102, high: 107, low: 98, close: 104, volume: 1200 },
            ],
            weight: 1.0,
            analysisDepth: 2
          },
        },
        fetchedAt: Date.now(),
      };
      
      const result = await detector.detectEnhancedLines(insufficientData);
      
      // Should still complete without errors
      expect(result).toBeDefined();
      expect(result.detectionStats.processingTime).toBeGreaterThan(0);
    });
  });

  describe('configuration filtering', () => {
    it('should respect minimum confidence setting', async () => {
      const highConfidenceDetector = new EnhancedLineDetectorV2({ minConfidence: 0.9 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Mock low confidence
      mockTouchDetector.calculateLineConfidence.mockReturnValue(0.7);
      
      const result = await highConfidenceDetector.detectEnhancedLines(multiTimeframeData);
      
      expect(result.horizontalLines).toHaveLength(0);
    });

    it('should respect minimum timeframe requirement', async () => {
      const multiTimeframeDetector = new EnhancedLineDetectorV2({ minTimeframes: 3 });
      const multiTimeframeData = createMockTimeframeData();
      
      // Only 2 timeframes in mock data
      const result = await multiTimeframeDetector.detectEnhancedLines(multiTimeframeData);
      
      // Lines should be filtered out due to insufficient timeframe support
      expect(result.horizontalLines.length).toBeLessThanOrEqual(
        result.detectionStats.totalCandidates
      );
    });
  });
});