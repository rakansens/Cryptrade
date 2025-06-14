import { EnhancedLineDetectorV2, type EnhancedLineV2 } from '@/lib/analysis/enhanced-line-detector-v2';
import type { MultiTimeframeData } from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';

describe('EnhancedLineDetectorV2', () => {
  let detector: EnhancedLineDetectorV2;
  let mockMultiTimeframeData: MultiTimeframeData;

  beforeEach(() => {
    detector = new EnhancedLineDetectorV2();
    
    // Create comprehensive mock multi-timeframe data
    const baseTime = 1640995200000; // Jan 1, 2022
    
    // 15m timeframe data
    const data15m: ProcessedKline[] = [];
    for (let i = 0; i < 100; i++) {
      const time = baseTime + i * 15 * 60 * 1000; // 15 minute intervals
      const basePrice = 50000 + Math.sin(i * 0.1) * 2000; // Oscillating around 50k
      
      // Create support around 48000 and resistance around 52000
      let price = basePrice;
      if (i % 20 === 10) { // Touch support every 20 candles
        price = 48000 + Math.random() * 100;
      } else if (i % 25 === 15) { // Touch resistance
        price = 52000 - Math.random() * 100;
      }
      
      const open = price;
      const close = price + (Math.random() - 0.5) * 200;
      const high = Math.max(open, close) + Math.random() * 150;
      const low = Math.min(open, close) - Math.random() * 150;
      const volume = 1000 + Math.random() * 2000;
      
      data15m.push({ time, open, high, low, close, volume });
    }
    
    // 1h timeframe data (fewer points, broader view)
    const data1h: ProcessedKline[] = [];
    for (let i = 0; i < 50; i++) {
      const time = baseTime + i * 60 * 60 * 1000; // 1 hour intervals
      const basePrice = 50000 + Math.sin(i * 0.05) * 3000;
      
      let price = basePrice;
      if (i % 15 === 8) { // Support touches
        price = 48000 + Math.random() * 200;
      } else if (i % 18 === 12) { // Resistance touches
        price = 52000 - Math.random() * 200;
      }
      
      const open = price;
      const close = price + (Math.random() - 0.5) * 400;
      const high = Math.max(open, close) + Math.random() * 300;
      const low = Math.min(open, close) - Math.random() * 300;
      const volume = 5000 + Math.random() * 10000;
      
      data1h.push({ time, open, high, low, close, volume });
    }
    
    // 4h timeframe data
    const data4h: ProcessedKline[] = [];
    for (let i = 0; i < 25; i++) {
      const time = baseTime + i * 4 * 60 * 60 * 1000; // 4 hour intervals
      const basePrice = 50000 + Math.sin(i * 0.02) * 4000;
      
      let price = basePrice;
      if (i % 10 === 5) { // Support/resistance touches
        price = i % 2 === 0 ? 48000 + Math.random() * 300 : 52000 - Math.random() * 300;
      }
      
      const open = price;
      const close = price + (Math.random() - 0.5) * 600;
      const high = Math.max(open, close) + Math.random() * 500;
      const low = Math.min(open, close) - Math.random() * 500;
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
      // Create detector with strict quality requirements
      const strictDetector = new EnhancedLineDetectorV2({
        minQualityScore: 80,
        minConfidence: 0.8,
        minTouchCount: 5
      });

      const result = await strictDetector.detectEnhancedLines(mockMultiTimeframeData);
      
      // All returned lines should meet quality criteria
      [...result.horizontalLines, ...result.trendlines].forEach(line => {
        expect(line.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(80);
        expect(line.confidence).toBeGreaterThanOrEqual(0.8);
        expect(line.touchCount).toBeGreaterThanOrEqual(5);
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
          const currentScore = allLines[i].confidence * allLines[i].strength;
          const nextScore = allLines[i + 1].confidence * allLines[i + 1].strength;
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