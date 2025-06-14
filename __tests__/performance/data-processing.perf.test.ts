import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { FeatureExtractor } from '@/lib/ml/feature-extractor';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import { AdvancedTouchDetector } from '@/lib/analysis/advanced-touch-detector';
import { EnhancedLineDetectorV2 } from '@/lib/analysis/enhanced-line-detector-v2';
import { calculateMACD, calculateRSI, calculateBollingerBands, calculateSMA } from '@/lib/utils/indicators';
import type { CandlestickData, PriceData } from '@/types/market';
import type { DetectedLine } from '@/lib/analysis/types';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  featureExtraction: 2,
  patternDetection: 50,
  touchDetection: 10,
  lineDetection: 30,
  macdCalculation: 5,
  rsiCalculation: 5,
  bollingerCalculation: 5,
  smaCalculation: 2,
  bulkIndicators: 20,
  largeDatasetProcessing: 100
};

describe('Data Processing Performance Tests', () => {
  let performanceResults: Record<string, number[]> = {};
  let mockCandlestickData: CandlestickData[];
  let mockPriceData: PriceData[];

  beforeEach(() => {
    // Generate test data
    mockCandlestickData = generateMockCandlestickData(1000);
    mockPriceData = mockCandlestickData.map(candle => ({
      time: Math.floor(candle.time / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
  });

  afterEach(() => {
    // Log performance results
    Object.entries(performanceResults).forEach(([test, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      console.log(`[PERF] ${test}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    });
    performanceResults = {};
  });

  describe('ML Feature Extraction Performance', () => {
    it('should extract features from line within threshold', () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const mockLine = createMockLine();
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const features = extractor.extractFeatures(mockLine, 'BTCUSDT');
        const normalized = extractor.normalizeFeatures(features);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['featureExtraction'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.featureExtraction);
    });

    it('should handle batch feature extraction efficiently', () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const lines = Array.from({ length: 50 }, () => createMockLine());
      
      const start = performance.now();
      lines.forEach(line => {
        const features = extractor.extractFeatures(line, 'BTCUSDT');
        extractor.normalizeFeatures(features);
      });
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['batchFeatureExtraction'] = [totalTime];
      expect(totalTime).toBeLessThan(50); // 50 lines under 50ms
    });
  });

  describe('Pattern Detection Performance', () => {
    it('should detect patterns in dataset within threshold', () => {
      const detector = new PatternDetector();
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const patterns = detector.detectPatterns(mockCandlestickData);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['patternDetection'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.patternDetection);
    });

    it('should handle large datasets efficiently', () => {
      const detector = new PatternDetector();
      const largeDataset = generateMockCandlestickData(5000);
      
      const start = performance.now();
      const patterns = detector.detectPatterns(largeDataset);
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['patternDetectionLarge'] = [totalTime];
      expect(totalTime).toBeLessThan(250); // 5000 candles under 250ms
    });

    it('should scale linearly with data size', () => {
      const detector = new PatternDetector();
      const sizes = [100, 500, 1000, 2000];
      const times: number[] = [];

      sizes.forEach(size => {
        const data = generateMockCandlestickData(size);
        const start = performance.now();
        detector.detectPatterns(data);
        const end = performance.now();
        times.push(end - start);
      });

      // Check that time roughly doubles when data doubles
      const ratio = times[3] / times[1]; // 2000 vs 500
      expect(ratio).toBeLessThan(5); // Should be around 4x, allow some overhead
    });
  });

  describe('Touch Detection Performance', () => {
    it('should detect touches efficiently', () => {
      const detector = new AdvancedTouchDetector();
      const times: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const touches = detector.detectTouches(mockCandlestickData, 50000);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['touchDetection'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.touchDetection);
    });

    it('should analyze touch quality efficiently', () => {
      const detector = new AdvancedTouchDetector();
      const touches = detector.detectTouches(mockCandlestickData.slice(0, 100), 50000);
      const times: number[] = [];

      if (touches.length > 0) {
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          detector.analyzeTouchQuality(touches[0], mockCandlestickData.slice(0, 100));
          const end = performance.now();
          times.push(end - start);
        }

        performanceResults['touchQualityAnalysis'] = times;
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        expect(avgTime).toBeLessThan(2); // Each analysis under 2ms
      }
    });
  });

  describe('Line Detection Performance', () => {
    it('should detect lines within threshold', () => {
      const detector = new EnhancedLineDetectorV2();
      const times: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const lines = detector.detectLines(mockCandlestickData, { minTouches: 3 });
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['lineDetection'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.lineDetection);
    });

    it('should detect multi-timeframe lines efficiently', () => {
      const detector = new EnhancedLineDetectorV2();
      const start = performance.now();
      
      const lines = detector.detectMultiTimeframeLines(
        mockCandlestickData,
        ['1h', '4h', '1d'],
        { minTouches: 3 }
      );
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['multiTimeframeLineDetection'] = [totalTime];
      expect(totalTime).toBeLessThan(100); // 3 timeframes under 100ms
    });
  });

  describe('Technical Indicator Performance', () => {
    it('should calculate MACD within threshold', () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        calculateMACD(mockCandlestickData);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['macdCalculation'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.macdCalculation);
    });

    it('should calculate RSI within threshold', () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        calculateRSI(mockCandlestickData);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['rsiCalculation'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.rsiCalculation);
    });

    it('should calculate Bollinger Bands within threshold', () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        calculateBollingerBands(mockCandlestickData);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['bollingerCalculation'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.bollingerCalculation);
    });

    it('should calculate multiple indicators concurrently', () => {
      const start = performance.now();
      
      // Calculate all indicators
      const macd = calculateMACD(mockCandlestickData);
      const rsi = calculateRSI(mockCandlestickData);
      const bb = calculateBollingerBands(mockCandlestickData);
      const sma20 = calculateSMA(mockCandlestickData, 20);
      const sma50 = calculateSMA(mockCandlestickData, 50);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['bulkIndicators'] = [totalTime];
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.bulkIndicators);
    });
  });

  describe('Large Dataset Processing', () => {
    it('should process 10k candles efficiently', () => {
      const largeDataset = generateMockCandlestickData(10000);
      const detector = new PatternDetector();
      
      const start = performance.now();
      
      // Process multiple operations
      const patterns = detector.detectPatterns(largeDataset);
      const macd = calculateMACD(largeDataset);
      const rsi = calculateRSI(largeDataset);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['largeDatasetProcessing'] = [totalTime];
      expect(totalTime).toBeLessThan(500); // 10k candles under 500ms
    });

    it('should maintain performance with streaming data', () => {
      const initialData = generateMockCandlestickData(1000);
      const detector = new PatternDetector();
      const times: number[] = [];

      // Simulate streaming updates
      for (let i = 0; i < 100; i++) {
        const newCandle = generateMockCandlestickData(1)[0];
        initialData.push(newCandle);
        initialData.shift(); // Maintain window size

        const start = performance.now();
        detector.detectPatterns(initialData);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['streamingDataProcessing'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(50); // Each update under 50ms
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during continuous processing', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const detector = new PatternDetector();
      const touchDetector = new AdvancedTouchDetector();
      
      // Perform many processing cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        const data = generateMockCandlestickData(100);
        detector.detectPatterns(data);
        touchDetector.detectTouches(data, 50000);
        calculateMACD(data);
        calculateRSI(data);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent analysis operations', async () => {
      const operations: Promise<void>[] = [];
      const detector = new PatternDetector();
      const touchDetector = new AdvancedTouchDetector();
      const lineDetector = new EnhancedLineDetectorV2();

      const start = performance.now();
      
      // Launch concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(new Promise<void>((resolve) => {
          const data = generateMockCandlestickData(200);
          
          setTimeout(() => {
            detector.detectPatterns(data);
            touchDetector.detectTouches(data, 50000 + i * 100);
            lineDetector.detectLines(data);
            calculateMACD(data);
            calculateRSI(data);
            resolve();
          }, Math.random() * 10);
        }));
      }

      await Promise.all(operations);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['concurrentProcessing'] = [totalTime];
      expect(totalTime).toBeLessThan(200); // All concurrent ops under 200ms
    });
  });
});

// Helper functions

function generateMockCandlestickData(count: number): CandlestickData[] {
  const data: CandlestickData[] = [];
  let basePrice = 50000;
  const baseTime = Date.now() - count * 3600000;

  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 1000;
    const open = basePrice + variation;
    const close = open + (Math.random() - 0.5) * 500;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const volume = 1000 + Math.random() * 5000;

    data.push({
      time: baseTime + i * 3600000,
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

function createMockLine(): DetectedLine {
  const times = [1000, 2000, 3000, 4000, 5000];
  return {
    id: `line-${Date.now()}`,
    type: 'support',
    price: 50000,
    confidence: 0.85,
    touchPoints: times.map(t => ({
      time: t,
      value: 50000 + (Math.random() - 0.5) * 100
    })),
    supportingTimeframes: ['1h', '4h']
  };
}