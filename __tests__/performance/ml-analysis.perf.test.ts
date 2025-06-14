import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { StreamingMLAnalyzer } from '@/lib/ml/streaming-ml-analyzer';
import { LineQualityPredictor } from '@/lib/ml/line-predictor';
import { FeatureExtractor } from '@/lib/ml/feature-extractor';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';
import type { StreamingMLUpdate } from '@/lib/ml/line-validation-types';

// Mock TensorFlow.js for performance testing
jest.mock('@tensorflow/tfjs', () => ({
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({
      array: jest.fn().mockResolvedValue([[0.85, 0.6, 0.75, 0.95]]),
      dispose: jest.fn()
    })),
    dispose: jest.fn()
  })),
  layers: {
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn()
  },
  tensor2d: jest.fn(() => ({ dispose: jest.fn() })),
  dispose: jest.fn()
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  featureExtraction: 5,
  modelPrediction: 10,
  streamingAnalysis: 50,
  batchPrediction: 100,
  modelInitialization: 100,
  featureNormalization: 1,
  currencyAdjustment: 1
};

describe('ML Analysis Performance Tests', () => {
  let performanceResults: Record<string, number[]> = {};
  let mockPriceData: PriceData[];
  let analyzer: StreamingMLAnalyzer;
  let predictor: LineQualityPredictor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate test data
    mockPriceData = generateMockPriceData(1000);
    analyzer = new StreamingMLAnalyzer();
    predictor = new LineQualityPredictor();
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

  describe('Feature Extraction Performance', () => {
    it('should extract features within threshold', () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const line = createMockLine();
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const features = extractor.extractFeatures(line, 'BTCUSDT');
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['featureExtraction'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.featureExtraction);
    });

    it('should normalize features efficiently', () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const line = createMockLine();
      const features = extractor.extractFeatures(line, 'BTCUSDT');
      const times: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        const normalized = extractor.normalizeFeatures(features);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['featureNormalization'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.featureNormalization);
    });
  });

  describe('Model Prediction Performance', () => {
    it('should predict line success within threshold', async () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const line = createMockLine();
      const features = extractor.extractFeatures(line, 'BTCUSDT');
      const normalized = extractor.normalizeFeatures(features);
      const times: number[] = [];

      // Force model ready state
      (predictor as any).isModelReady = true;

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const prediction = await predictor.predictLineSuccess(features, normalized);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['modelPrediction'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.modelPrediction);
    });

    it('should handle batch predictions efficiently', async () => {
      const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
      const lines = Array.from({ length: 20 }, () => createMockLine());
      
      // Force model ready state
      (predictor as any).isModelReady = true;

      const start = performance.now();
      
      const predictions = await Promise.all(
        lines.map(async (line) => {
          const features = extractor.extractFeatures(line, 'BTCUSDT');
          const normalized = extractor.normalizeFeatures(features);
          return predictor.predictLineSuccess(features, normalized);
        })
      );
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['batchPrediction'] = [totalTime];
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchPrediction);
      expect(predictions.length).toBe(20);
    });
  });

  describe('Streaming Analysis Performance', () => {
    it('should complete streaming analysis within threshold', async () => {
      const line = createMockLine();
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const updates: StreamingMLUpdate[] = [];
        
        for await (const update of analyzer.analyzeLineWithProgress(
          line,
          mockPriceData,
          'BTCUSDT',
          50000
        )) {
          updates.push(update);
        }
        
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['streamingAnalysis'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.streamingAnalysis);
    });

    it('should maintain performance with large datasets', async () => {
      const largePriceData = generateMockPriceData(5000);
      const line = createMockLine();
      
      const start = performance.now();
      const updates: StreamingMLUpdate[] = [];
      
      for await (const update of analyzer.analyzeLineWithProgress(
        line,
        largePriceData,
        'BTCUSDT',
        50000
      )) {
        updates.push(update);
      }
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['streamingAnalysisLarge'] = [totalTime];
      expect(totalTime).toBeLessThan(200); // 5000 candles under 200ms
    });

    it('should handle concurrent streaming analyses', async () => {
      const lines = Array.from({ length: 5 }, () => createMockLine());
      
      const start = performance.now();
      
      const analysisPromises = lines.map(async (line) => {
        const updates: StreamingMLUpdate[] = [];
        for await (const update of analyzer.analyzeLineWithProgress(
          line,
          mockPriceData,
          'BTCUSDT',
          50000
        )) {
          updates.push(update);
        }
        return updates;
      });
      
      const results = await Promise.all(analysisPromises);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['concurrentStreamingAnalysis'] = [totalTime];
      expect(totalTime).toBeLessThan(250); // 5 concurrent analyses under 250ms
      expect(results.length).toBe(5);
    });
  });

  describe('Currency-Specific Adjustments Performance', () => {
    it('should apply currency adjustments efficiently', async () => {
      const currencies = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'];
      const line = createMockLine();
      const times: number[] = [];

      for (const currency of currencies) {
        const start = performance.now();
        
        const updates: StreamingMLUpdate[] = [];
        for await (const update of analyzer.analyzeLineWithProgress(
          line,
          mockPriceData,
          currency,
          50000
        )) {
          updates.push(update);
        }
        
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['currencyAdjustment'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.streamingAnalysis);
    });
  });

  describe('Model Initialization Performance', () => {
    it('should initialize model within threshold', async () => {
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const tempPredictor = new LineQualityPredictor();
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['modelInitialization'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.modelInitialization);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during continuous ML analysis', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many ML analyses
      for (let cycle = 0; cycle < 50; cycle++) {
        const line = createMockLine();
        const extractor = new FeatureExtractor(mockPriceData, mockPriceData[mockPriceData.length - 1].close);
        
        const features = extractor.extractFeatures(line, 'BTCUSDT');
        const normalized = extractor.normalizeFeatures(features);
        await predictor.predictLineSuccess(features, normalized);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
    });

    it('should handle streaming analysis memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many streaming analyses
      for (let cycle = 0; cycle < 20; cycle++) {
        const line = createMockLine();
        const updates: StreamingMLUpdate[] = [];
        
        for await (const update of analyzer.analyzeLineWithProgress(
          line,
          mockPriceData,
          'BTCUSDT',
          50000
        )) {
          updates.push(update);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024); // Less than 30MB increase
    });
  });

  describe('Feature Importance Performance', () => {
    it('should calculate feature importance efficiently', () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const importance = predictor.getFeatureImportance();
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['featureImportance'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(1); // Under 1ms
    });

    it('should retrieve model metrics efficiently', () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const metrics = predictor.getModelMetrics();
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['modelMetrics'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(1); // Under 1ms
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should handle live trading scenario efficiently', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const timeframes = ['1h', '4h', '1d'];
      let totalAnalyses = 0;
      
      const start = performance.now();
      
      // Simulate multiple symbols and timeframes
      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          // Generate lines for each timeframe
          const lines = Array.from({ length: 3 }, () => createMockLine());
          
          for (const line of lines) {
            const updates: StreamingMLUpdate[] = [];
            for await (const update of analyzer.analyzeLineWithProgress(
              line,
              mockPriceData,
              symbol,
              mockPriceData[mockPriceData.length - 1].close
            )) {
              updates.push(update);
            }
            totalAnalyses++;
          }
        }
      }
      
      const end = performance.now();
      const totalTime = end - start;
      const analysesPerSecond = (totalAnalyses / totalTime) * 1000;

      performanceResults['liveTrading'] = [totalTime];
      console.log(`[PERF] Live trading scenario: ${analysesPerSecond.toFixed(1)} analyses/second`);
      
      expect(totalTime).toBeLessThan(3000); // Complete all analyses under 3 seconds
      expect(totalAnalyses).toBe(27); // 3 symbols * 3 timeframes * 3 lines
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

function createMockLine(): DetectedLine {
  const touchTimes = [100, 200, 300, 400, 500];
  return {
    id: `line-${Date.now()}-${Math.random()}`,
    type: 'support',
    price: 50000,
    confidence: 0.85,
    touchPoints: touchTimes.map(t => ({
      time: t,
      value: 50000 + (Math.random() - 0.5) * 100
    })),
    supportingTimeframes: ['1h', '4h']
  };
}