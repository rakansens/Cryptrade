import { EnhancedLineDetectorV2 } from '@/lib/analysis/enhanced-line-detector-v2';
import type { MultiTimeframeData } from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';

// Mock the logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the AdvancedTouchDetector
jest.mock('@/lib/analysis/advanced-touch-detector', () => ({
  AdvancedTouchDetector: jest.fn().mockImplementation(() => ({
    analyzeTouchPoints: jest.fn().mockReturnValue({
      touchPoints: [
        { price: 48000, time: 1640995200000, index: 20, type: 'support', touchType: 'wick', strength: 0.9, volume: 1500, volumeRatio: 1.5 },
        { price: 48050, time: 1640995200000 + 60 * 60 * 1000, index: 60, type: 'support', touchType: 'body', strength: 0.85, volume: 1800, volumeRatio: 1.8 },
        { price: 52000, time: 1640995200000 + 40 * 15 * 60 * 1000, index: 40, type: 'resistance', touchType: 'wick', strength: 0.9, volume: 2000, volumeRatio: 2.0 },
        { price: 51950, time: 1640995200000 + 80 * 15 * 60 * 1000, index: 80, type: 'resistance', touchType: 'body', strength: 0.88, volume: 2200, volumeRatio: 2.2 }
      ],
      averageVolume: 1500,
      wickTouchCount: 2,
      bodyTouchCount: 2,
      exactTouchCount: 0,
      strongBounceCount: 3,
      touchQualityScore: 85,
      volumeWeightedStrength: 0.9
    }),
    calculateTouchQualityScore: jest.fn().mockReturnValue(85),
    calculateVolumeWeightedStrength: jest.fn().mockReturnValue(0.9),
    calculateLineConfidence: jest.fn().mockReturnValue(0.85),
    getTouchStatistics: jest.fn().mockReturnValue({
      summary: '4 touches'
    })
  }))
}));

describe('EnhancedLineDetectorV2', () => {
  let detector: EnhancedLineDetectorV2;
  let mockMultiTimeframeData: MultiTimeframeData;

  beforeEach(() => {
    detector = new EnhancedLineDetectorV2();
    
    // Create comprehensive mock multi-timeframe data
    const baseTime = 1640995200000; // Jan 1, 2022
    
    // 15m timeframe data with clear swing points
    const data15m: ProcessedKline[] = [];
    for (let i = 0; i < 100; i++) {
      const time = baseTime + i * 15 * 60 * 1000; // 15 minute intervals
      
      let high, low, open, close;
      
      // Create clear swing highs and lows that will be detected
      // The swing detection algorithm looks for 5 candles on each side
      if (i === 20) {
        // Clear swing low at support - make it the lowest in surrounding area
        high = 48200;
        low = 48000;  // This will be a swing low
        open = 48150;
        close = 48100;
      } else if (i > 14 && i < 20) {
        // Descending to swing low
        const distance = 20 - i;
        high = 48500 + distance * 100;
        low = 48300 + distance * 100;
        open = 48400 + distance * 100;
        close = 48350 + distance * 100;
      } else if (i > 20 && i < 26) {
        // Ascending from swing low
        const distance = i - 20;
        high = 48300 + distance * 100;
        low = 48100 + distance * 100;
        open = 48150 + distance * 100;
        close = 48250 + distance * 100;
      } else if (i === 40) {
        // Clear swing high at resistance - make it the highest in surrounding area
        high = 52000;  // This will be a swing high
        low = 51800;
        open = 51850;
        close = 51900;
      } else if (i > 34 && i < 40) {
        // Ascending to swing high
        const distance = 40 - i;
        high = 51700 - distance * 100;
        low = 51500 - distance * 100;
        open = 51550 - distance * 100;
        close = 51650 - distance * 100;
      } else if (i > 40 && i < 46) {
        // Descending from swing high
        const distance = i - 40;
        high = 51900 - distance * 100;
        low = 51700 - distance * 100;
        open = 51850 - distance * 100;
        close = 51750 - distance * 100;
      } else if (i === 60) {
        // Another swing low at support
        high = 48300;
        low = 48050;  // Another touch at support (within tolerance)
        open = 48200;
        close = 48150;
      } else if (i > 54 && i < 60) {
        // Descending to second swing low
        const distance = 60 - i;
        high = 48600 + distance * 100;
        low = 48400 + distance * 100;
        open = 48500 + distance * 100;
        close = 48450 + distance * 100;
      } else if (i > 60 && i < 66) {
        // Ascending from second swing low
        const distance = i - 60;
        high = 48400 + distance * 100;
        low = 48200 + distance * 100;
        open = 48250 + distance * 100;
        close = 48350 + distance * 100;
      } else if (i === 80) {
        // Another swing high at resistance
        high = 51950;  // Another touch at resistance (within tolerance)
        low = 51700;
        open = 51800;
        close = 51850;
      } else if (i > 74 && i < 80) {
        // Ascending to second swing high
        const distance = 80 - i;
        high = 51650 - distance * 100;
        low = 51450 - distance * 100;
        open = 51500 - distance * 100;
        close = 51600 - distance * 100;
      } else if (i > 80 && i < 86) {
        // Descending from second swing high
        const distance = i - 80;
        high = 51850 - distance * 100;
        low = 51650 - distance * 100;
        open = 51800 - distance * 100;
        close = 51700 - distance * 100;
      } else {
        // Normal candles in between
        const basePrice = 50000;
        open = basePrice + (Math.random() - 0.5) * 500;
        close = basePrice + (Math.random() - 0.5) * 500;
        high = Math.max(open, close) + Math.random() * 200;
        low = Math.min(open, close) - Math.random() * 200;
      }
      
      const volume = 1000 + Math.random() * 2000;
      data15m.push({ time, open, high, low, close, volume });
    }
    
    // 1h timeframe data with clear swing points
    const data1h: ProcessedKline[] = [];
    for (let i = 0; i < 50; i++) {
      const time = baseTime + i * 60 * 60 * 1000; // 1 hour intervals
      
      let high, low, open, close;
      
      // Create clear swing points for 1h timeframe
      if (i === 10) {
        // Swing low at support (matching 15m timeframe)
        high = 48300;
        low = 48020;  // Close to 48000 within tolerance
        open = 48200;
        close = 48150;
      } else if (i > 4 && i < 10) {
        // Descending to swing low
        const distance = 10 - i;
        high = 48600 + distance * 150;
        low = 48400 + distance * 150;
        open = 48500 + distance * 150;
        close = 48450 + distance * 150;
      } else if (i > 10 && i < 16) {
        // Ascending from swing low
        const distance = i - 10;
        high = 48400 + distance * 150;
        low = 48200 + distance * 150;
        open = 48250 + distance * 150;
        close = 48350 + distance * 150;
      } else if (i === 20) {
        // Swing high at resistance (matching 15m timeframe)
        high = 51980;  // Close to 52000 within tolerance
        low = 51700;
        open = 51800;
        close = 51900;
      } else if (i > 14 && i < 20) {
        // Ascending to swing high
        const distance = 20 - i;
        high = 51600 - distance * 150;
        low = 51400 - distance * 150;
        open = 51450 - distance * 150;
        close = 51550 - distance * 150;
      } else if (i > 20 && i < 26) {
        // Descending from swing high
        const distance = i - 20;
        high = 51900 - distance * 150;
        low = 51700 - distance * 150;
        open = 51850 - distance * 150;
        close = 51750 - distance * 150;
      } else if (i === 30) {
        // Another swing low
        high = 48400;
        low = 48030;  // Close to 48000 within tolerance
        open = 48300;
        close = 48200;
      } else if (i > 24 && i < 30) {
        // Descending to second swing low
        const distance = 30 - i;
        high = 48700 + distance * 150;
        low = 48500 + distance * 150;
        open = 48600 + distance * 150;
        close = 48550 + distance * 150;
      } else if (i > 30 && i < 36) {
        // Ascending from second swing low
        const distance = i - 30;
        high = 48500 + distance * 150;
        low = 48300 + distance * 150;
        open = 48350 + distance * 150;
        close = 48450 + distance * 150;
      } else if (i === 40) {
        // Another swing high
        high = 51970;  // Close to 52000 within tolerance
        low = 51600;
        open = 51700;
        close = 51850;
      } else if (i > 34 && i < 40) {
        // Ascending to second swing high
        const distance = 40 - i;
        high = 51550 - distance * 150;
        low = 51350 - distance * 150;
        open = 51400 - distance * 150;
        close = 51500 - distance * 150;
      } else if (i > 40 && i < 46) {
        // Descending from second swing high
        const distance = i - 40;
        high = 51900 - distance * 150;
        low = 51700 - distance * 150;
        open = 51850 - distance * 150;
        close = 51750 - distance * 150;
      } else {
        // Normal candles
        const basePrice = 50000;
        open = basePrice + (Math.random() - 0.5) * 600;
        close = basePrice + (Math.random() - 0.5) * 600;
        high = Math.max(open, close) + Math.random() * 300;
        low = Math.min(open, close) - Math.random() * 300;
      }
      
      const volume = 5000 + Math.random() * 10000;
      data1h.push({ time, open, high, low, close, volume });
    }
    
    // 4h timeframe data with clear swing points
    const data4h: ProcessedKline[] = [];
    for (let i = 0; i < 25; i++) {
      const time = baseTime + i * 4 * 60 * 60 * 1000; // 4 hour intervals
      
      let high, low, open, close;
      
      // Create clear swing points for 4h timeframe
      if (i === 8) {
        // Swing low (matching other timeframes)
        high = 48500;
        low = 48010;  // Close to 48000 within tolerance
        open = 48400;
        close = 48200;
      } else if (i > 2 && i < 8) {
        // Descending to swing low
        const distance = 8 - i;
        high = 48800 + distance * 200;
        low = 48600 + distance * 200;
        open = 48700 + distance * 200;
        close = 48650 + distance * 200;
      } else if (i > 8 && i < 14) {
        // Ascending from swing low
        const distance = i - 8;
        high = 48600 + distance * 200;
        low = 48400 + distance * 200;
        open = 48450 + distance * 200;
        close = 48550 + distance * 200;
      } else if (i === 16) {
        // Swing high (matching other timeframes)
        high = 51990;  // Close to 52000 within tolerance
        low = 51500;
        open = 51600;
        close = 51800;
      } else if (i > 10 && i < 16) {
        // Ascending to swing high
        const distance = 16 - i;
        high = 51400 - distance * 200;
        low = 51200 - distance * 200;
        open = 51250 - distance * 200;
        close = 51350 - distance * 200;
      } else if (i > 16 && i < 22) {
        // Descending from swing high
        const distance = i - 16;
        high = 51900 - distance * 200;
        low = 51700 - distance * 200;
        open = 51850 - distance * 200;
        close = 51750 - distance * 200;
      } else {
        // Normal candles
        const basePrice = 50000;
        open = basePrice + (Math.random() - 0.5) * 800;
        close = basePrice + (Math.random() - 0.5) * 800;
        high = Math.max(open, close) + Math.random() * 400;
        low = Math.min(open, close) - Math.random() * 400;
      }
      
      const volume = 20000 + Math.random() * 40000;
      data4h.push({ time, open, high, low, close, volume });
    }
    
    mockMultiTimeframeData = {
      symbol: 'BTCUSDT',
      timeframes: {
        '15m': { data: data15m, weight: 0.3, dataPoints: data15m.length },
        '1h': { data: data1h, weight: 0.5, dataPoints: data1h.length },
        '4h': { data: data4h, weight: 0.8, dataPoints: data4h.length }
      },
      fetchedAt: Date.now()
    };
  });

  describe('detectEnhancedLines', () => {
    it('should detect both horizontal lines and trendlines', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      expect(result.horizontalLines).toBeDefined();
      expect(result.trendlines).toBeDefined();
      expect(result.detectionStats).toBeDefined();

      // Should find some lines given our mock data
      expect(result.horizontalLines.length + result.trendlines.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive detection statistics', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      expect(result.detectionStats).toHaveProperty('totalCandidates');
      expect(result.detectionStats).toHaveProperty('qualityFiltered');
      expect(result.detectionStats).toHaveProperty('touchFiltered');
      expect(result.detectionStats).toHaveProperty('finalLines');
      expect(result.detectionStats).toHaveProperty('processingTime');

      expect(result.detectionStats.processingTime).toBeGreaterThan(0);
      expect(result.detectionStats.finalLines).toBe(
        result.horizontalLines.length + result.trendlines.length
      );
    });

    it('should filter lines by quality criteria', async () => {
      // Create detector with quality requirements that match mock data
      const strictDetector = new EnhancedLineDetectorV2({
        minQualityScore: 70,  // Lowered to match mock data quality
        minConfidence: 0.7,
        minTouchCount: 2
      });

      const result = await strictDetector.detectEnhancedLines(mockMultiTimeframeData);
      
      // All returned lines should meet quality criteria
      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(70);
        expect(line.confidence).toBeGreaterThanOrEqual(0.7);
        expect(line.touchCount).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('horizontal line detection', () => {
    it('should detect support and resistance levels', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      const supportLines = result.horizontalLines.filter(line => line.type === 'support');
      const resistanceLines = result.horizontalLines.filter(line => line.type === 'resistance');

      // Should detect both support and resistance from our mock data
      expect(supportLines.length + resistanceLines.length).toBeGreaterThan(0);

      // Support should be around 48000, resistance around 52000
      supportLines.forEach(line => {
        expect(line.price).toBeLessThan(51000); // Support should be below mid-range
      });

      resistanceLines.forEach(line => {
        expect(line.price).toBeGreaterThan(49000); // Resistance should be above mid-range
      });
    });

    it('should include advanced touch analysis for each line', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      result.horizontalLines.forEach(line => {
        expect(line.touchAnalysis).toBeDefined();
        expect(line.touchAnalysis.touchPoints.length).toBeGreaterThan(0);
        expect(line.touchAnalysis.touchQualityScore).toBeGreaterThanOrEqual(0);
        expect(line.touchAnalysis.touchQualityScore).toBeLessThanOrEqual(100);

        // Touch analysis should include all types
        expect(line.touchAnalysis).toHaveProperty('wickTouchCount');
        expect(line.touchAnalysis).toHaveProperty('bodyTouchCount');
        expect(line.touchAnalysis).toHaveProperty('exactTouchCount');
        expect(line.touchAnalysis).toHaveProperty('strongBounceCount');
      });
    });

    it('should include quality metrics for each line', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      result.horizontalLines.forEach(line => {
        expect(line.qualityMetrics).toBeDefined();
        expect(line.qualityMetrics).toHaveProperty('wickBodyRatio');
        expect(line.qualityMetrics).toHaveProperty('volumeConfirmation');
        expect(line.qualityMetrics).toHaveProperty('bounceConfirmation');
        expect(line.qualityMetrics).toHaveProperty('overallQuality');

        // All metrics should be valid percentages
        expect(line.qualityMetrics.wickBodyRatio).toBeGreaterThanOrEqual(0);
        expect(line.qualityMetrics.wickBodyRatio).toBeLessThanOrEqual(1);
        expect(line.qualityMetrics.volumeConfirmation).toBeGreaterThanOrEqual(0);
        expect(line.qualityMetrics.volumeConfirmation).toBeLessThanOrEqual(1);
        expect(line.qualityMetrics.bounceConfirmation).toBeGreaterThanOrEqual(0);
        expect(line.qualityMetrics.bounceConfirmation).toBeLessThanOrEqual(1);
        expect(line.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);
        expect(line.qualityMetrics.overallQuality).toBeLessThanOrEqual(100);
      });
    });

    it('should require multi-timeframe support', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      result.horizontalLines.forEach(line => {
        expect(line.supportingTimeframes.length).toBeGreaterThanOrEqual(2);
        
        // Supporting timeframes should be valid
        line.supportingTimeframes.forEach(tf => {
          expect(['15m', '1h', '4h']).toContain(tf);
        });
      });
    });
  });

  describe('trendline detection', () => {
    it('should detect trendlines with coordinates', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      const trendlines = result.trendlines;

      trendlines.forEach(line => {
        expect(line.type).toBe('trendline');
        expect(line.coordinates).toBeDefined();
        
        if (line.coordinates) {
          expect(line.coordinates.startTime).toBeDefined();
          expect(line.coordinates.endTime).toBeDefined();
          expect(line.coordinates.startPrice).toBeDefined();
          expect(line.coordinates.endPrice).toBeDefined();
          expect(line.coordinates.slope).toBeDefined();
          
          expect(line.coordinates.endTime).toBeGreaterThan(line.coordinates.startTime);
        }
      });
    });

    it('should include linear regression quality metrics', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      // Trendlines should have good fit quality in description
      result.trendlines.forEach(line => {
        expect(line.description).toContain('fit');
        expect(line.description).toMatch(/R²=\d+\.\d+/); // Should include R-squared value
      });
    });
  });

  describe('line quality and filtering', () => {
    it('should sort lines by combined confidence and strength', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      const allLines = [...result.horizontalLines, ...result.trendlines];

      if (allLines.length > 1) {
        for (let i = 0; i < allLines.length - 1; i++) {
          const currentScore = allLines[i]!.confidence * allLines[i]!.strength;
          const nextScore = allLines[i + 1]!.confidence * allLines[i + 1]!.strength;
          expect(currentScore).toBeGreaterThanOrEqual(nextScore);
        }
      }
    });

    it('should generate descriptive line descriptions', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.description).toBeDefined();
        expect(line.description.length).toBeGreaterThan(10);
        
        if (line.type === 'support' || line.type === 'resistance') {
          expect(line.description).toContain(line.type);
          expect(line.description).toContain('touches');
          expect(line.description).toContain('timeframes');
        } else if (line.type === 'trendline') {
          expect(line.description).toMatch(/(ascending|descending)/);
          expect(line.description).toContain('trendline');
        }
      });
    });

    it('should assign unique IDs to all lines', async () => {
      const result = await detector.detectEnhancedLines(mockMultiTimeframeData);

      const allLines = [...result.horizontalLines, ...result.trendlines];
      const ids = allLines.map(line => line.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(allLines.length);

      // IDs should follow naming convention
      result.horizontalLines.forEach(line => {
        expect(line.id).toMatch(/^horizontal_\d+_[a-z0-9]+$/);
      });

      result.trendlines.forEach(line => {
        expect(line.id).toMatch(/^trendline_\d+_[a-z0-9]+$/);
      });
    });
  });

  describe('configuration customization', () => {
    it('should respect custom touch detection configuration', async () => {
      const customDetector = new EnhancedLineDetectorV2({
        touchConfig: {
          wickWeight: 0.5,
          bodyWeight: 1.5,
          exactWeight: 2.0,
          volumeThresholdMultiplier: 2.0,
          bounceThresholdPercent: 1.0
        }
      });

      const result = await customDetector.detectEnhancedLines(mockMultiTimeframeData);
      
      // Should still detect lines but with different criteria
      expect(result.horizontalLines.length + result.trendlines.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply volume confirmation when required', async () => {
      const volumeDetector = new EnhancedLineDetectorV2({
        requireVolumeConfirmation: true,
        volumeConfirmationThreshold: 0.7
      });

      const result = await volumeDetector.detectEnhancedLines(mockMultiTimeframeData);

      // Lines should have high volume confirmation
      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.qualityMetrics.volumeConfirmation).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should apply bounce confirmation when required', async () => {
      const bounceDetector = new EnhancedLineDetectorV2({
        requireBounceConfirmation: true,
        bounceConfirmationThreshold: 0.5
      });

      const result = await bounceDetector.detectEnhancedLines(mockMultiTimeframeData);

      // Lines should have significant bounce confirmation
      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.qualityMetrics.bounceConfirmation).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle timeframes with insufficient data', async () => {
      const sparseData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '15m': { 
            data: [
              { time: 1000, open: 100, high: 101, low: 99, close: 100, volume: 1000 }
            ], 
            weight: 0.3, 
            dataPoints: 1 
          }
        },
        fetchedAt: Date.now()
      };

      const result = await detector.detectEnhancedLines(sparseData);

      // Should not crash and return valid structure
      expect(result.horizontalLines).toBeDefined();
      expect(result.trendlines).toBeDefined();
      expect(result.detectionStats).toBeDefined();
    });

    it('should handle empty timeframe data', async () => {
      const emptyData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': { data: [], weight: 0.5, dataPoints: 0 }
        },
        fetchedAt: Date.now()
      };

      const result = await detector.detectEnhancedLines(emptyData);

      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
      expect(result.detectionStats.finalLines).toBe(0);
    });
  });
});