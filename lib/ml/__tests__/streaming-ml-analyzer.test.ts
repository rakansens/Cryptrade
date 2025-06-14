import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StreamingMLAnalyzer } from '../streaming-ml-analyzer';
import { FeatureExtractor } from '../feature-extractor';
import { LineQualityPredictor } from '../line-predictor';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';
import type { StreamingMLUpdate, LineFeatures, MLPrediction } from '../line-validation-types';

// Mock dependencies
jest.mock('../feature-extractor');
jest.mock('../line-predictor');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('StreamingMLAnalyzer', () => {
  let analyzer: StreamingMLAnalyzer;
  let mockFeatureExtractor: jest.Mocked<FeatureExtractor>;
  let mockPredictor: jest.Mocked<LineQualityPredictor>;
  let mockPriceData: PriceData[];
  let mockLine: DetectedLine;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockFeatureExtractor = {
      extractFeatures: jest.fn(),
      normalizeFeatures: jest.fn()
    } as any;

    mockPredictor = {
      predictLineSuccess: jest.fn(),
      getFeatureImportance: jest.fn(),
      getModelMetrics: jest.fn()
    } as any;

    // Mock constructor implementations
    (FeatureExtractor as jest.MockedClass<typeof FeatureExtractor>).mockImplementation(() => mockFeatureExtractor);
    (LineQualityPredictor as jest.MockedClass<typeof LineQualityPredictor>).mockImplementation(() => mockPredictor);

    // Create test data
    mockPriceData = generateMockPriceData(100);
    mockLine = createMockLine();

    analyzer = new StreamingMLAnalyzer();
  });

  describe('constructor', () => {
    it('should initialize with predictor and currency configs', () => {
      expect(LineQualityPredictor).toHaveBeenCalled();
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyzeLineWithProgress', () => {
    it('should yield progress updates through all stages', async () => {
      const mockFeatures = createMockFeatures();
      const mockNormalized = Array(23).fill(0.5);
      const mockPrediction = createMockPrediction();

      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(mockNormalized);
      mockPredictor.predictLineSuccess.mockResolvedValue(mockPrediction);

      const updates: StreamingMLUpdate[] = [];
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        updates.push(update);
      }

      // Should have updates for all stages
      expect(updates.length).toBeGreaterThanOrEqual(6);

      // Check stages in order
      const stages = updates.map(u => u.stage);
      expect(stages).toContain('collecting');
      expect(stages).toContain('extracting');
      expect(stages).toContain('predicting');
      expect(stages).toContain('analyzing');
      expect(stages).toContain('complete');

      // Check progress increases
      for (let i = 1; i < updates.length; i++) {
        expect(updates[i].progress).toBeGreaterThanOrEqual(updates[i - 1].progress);
      }

      // Final update should be 100%
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.progress).toBe(100);
      expect(finalUpdate.stage).toBe('complete');
    });

    it('should include detailed information in updates', async () => {
      const mockFeatures = createMockFeatures();
      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(createMockPrediction());

      const updates: StreamingMLUpdate[] = [];
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        updates.push(update);
      }

      // Check collecting stage
      const collectingUpdate = updates.find(u => u.stage === 'collecting');
      expect(collectingUpdate?.currentStep).toContain('データ収集中');
      expect(collectingUpdate?.details?.processingTime).toBeGreaterThanOrEqual(0);

      // Check extracting stage details
      const extractingComplete = updates.find(u => 
        u.stage === 'extracting' && u.progress >= 50
      );
      expect(extractingComplete?.details?.featuresExtracted).toBe(23);
      expect(extractingComplete?.details?.importantFeatures).toBeInstanceOf(Array);

      // Check predicting stage details
      const predictingComplete = updates.find(u => 
        u.stage === 'predicting' && u.progress >= 85
      );
      expect(predictingComplete?.details?.preliminaryScore).toBeGreaterThan(0);

      // Check final update
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.details?.featuresExtracted).toBe(23);
      expect(finalUpdate.details?.preliminaryScore).toBeDefined();
      expect(finalUpdate.details?.processingTime).toBeGreaterThan(0);
    });

    it('should extract top features correctly', async () => {
      const mockFeatures: LineFeatures = {
        ...createMockFeatures(),
        touchCount: 8,
        rSquared: 0.95,
        volumeStrength: 2.0,
        bodyTouchRatio: 0.8,
        timeframeConfluence: 0.9,
        nearPsychological: true
      };

      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(createMockPrediction());

      const updates: StreamingMLUpdate[] = [];
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        updates.push(update);
      }

      const finalUpdate = updates[updates.length - 1];
      const importantFeatures = finalUpdate.details?.importantFeatures || [];

      expect(importantFeatures.length).toBeGreaterThan(0);
      expect(importantFeatures.length).toBeLessThanOrEqual(4);
      expect(importantFeatures.some(f => f.includes('タッチ回数'))).toBe(true);
      expect(importantFeatures.some(f => f.includes('線形性'))).toBe(true);
    });

    it('should apply currency-specific adjustments for BTCUSDT', async () => {
      const mockFeatures: LineFeatures = {
        ...createMockFeatures(),
        nearPsychological: true,
        dayOfWeek: 0 // Sunday
      };

      const basePrediction = createMockPrediction();
      basePrediction.successProbability = 0.7;

      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(basePrediction);

      let finalPrediction: MLPrediction | undefined;
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        // The generator returns the final prediction after yielding all updates
      }

      // The last value from the generator is the prediction
      const result = await generator.next();
      finalPrediction = result.value as MLPrediction;

      expect(finalPrediction).toBeDefined();
      
      // Check adjustments were applied
      // Round number bonus: 0.7 * 1.2 = 0.84
      // Weekend reliability: 0.84 * 0.8 = 0.672
      expect(finalPrediction.successProbability).toBeCloseTo(0.672, 2);
      
      // Check additional reasoning was added
      const btcReason = finalPrediction.reasoning.find(r => 
        r.description.includes('BTCUSDT')
      );
      expect(btcReason).toBeDefined();
      
      const weekendReason = finalPrediction.reasoning.find(r => 
        r.factor === '週末取引'
      );
      expect(weekendReason).toBeDefined();
    });

    it('should handle different currency pairs', async () => {
      const mockFeatures = createMockFeatures();
      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(createMockPrediction());

      // Test with ETHUSDT
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'ETHUSDT',
        3000
      );

      const updates: StreamingMLUpdate[] = [];
      for await (const update of generator) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1].stage).toBe('complete');
    });

    it('should handle unknown currency pairs', async () => {
      const mockFeatures = createMockFeatures();
      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      
      const basePrediction = createMockPrediction();
      mockPredictor.predictLineSuccess.mockResolvedValue(basePrediction);

      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'UNKNOWN',
        100
      );

      const updates: StreamingMLUpdate[] = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const result = await generator.next();
      const finalPrediction = result.value as MLPrediction;

      // Should return unmodified prediction for unknown pairs
      expect(finalPrediction.successProbability).toBe(basePrediction.successProbability);
    });

    it('should handle errors gracefully', async () => {
      mockFeatureExtractor.extractFeatures.mockImplementation(() => {
        throw new Error('Feature extraction failed');
      });

      const updates: StreamingMLUpdate[] = [];
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      try {
        for await (const update of generator) {
          updates.push(update);
        }
      } catch (error) {
        // Expected error
      }

      // Should have at least one update before error
      expect(updates.length).toBeGreaterThan(0);
      
      // Last update should indicate error
      const lastUpdate = updates[updates.length - 1];
      expect(lastUpdate.currentStep).toContain('エラー');
    });

    it('should measure processing time accurately', async () => {
      const mockFeatures = createMockFeatures();
      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(createMockPrediction());

      const startTime = Date.now();
      const updates: StreamingMLUpdate[] = [];
      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        updates.push(update);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Check that processing time in final update is reasonable
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.details?.processingTime).toBeGreaterThan(0);
      expect(finalUpdate.details?.processingTime).toBeLessThanOrEqual(totalTime + 100); // Allow some margin
    });
  });

  describe('getFeatureImportanceData', () => {
    it('should delegate to predictor', () => {
      const mockImportance = [
        { feature: 'touchCount', importance: 0.25, category: 'basic' as const },
        { feature: 'rSquared', importance: 0.20, category: 'basic' as const }
      ];
      mockPredictor.getFeatureImportance.mockReturnValue(mockImportance);

      const result = analyzer.getFeatureImportanceData();

      expect(result).toBe(mockImportance);
      expect(mockPredictor.getFeatureImportance).toHaveBeenCalled();
    });
  });

  describe('getModelMetrics', () => {
    it('should delegate to predictor', () => {
      const mockMetrics = {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
        lastUpdated: Date.now(),
        trainingSamples: 1000,
        version: '1.0.0'
      };
      mockPredictor.getModelMetrics.mockReturnValue(mockMetrics);

      const result = analyzer.getModelMetrics();

      expect(result).toBe(mockMetrics);
      expect(mockPredictor.getModelMetrics).toHaveBeenCalled();
    });
  });

  describe('currency configurations', () => {
    it('should have correct BTCUSDT configuration', async () => {
      const mockFeatures: LineFeatures = {
        ...createMockFeatures(),
        nearPsychological: true,
        dayOfWeek: 3 // Wednesday (weekday)
      };

      const basePrediction = createMockPrediction();
      basePrediction.successProbability = 0.5;

      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(basePrediction);

      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'BTCUSDT',
        50000
      );

      for await (const update of generator) {
        // Consume updates
      }

      const result = await generator.next();
      const finalPrediction = result.value as MLPrediction;

      // Only round number bonus should apply (not weekend)
      // 0.5 * 1.2 = 0.6
      expect(finalPrediction.successProbability).toBeCloseTo(0.6, 2);
    });

    it('should have correct ETHUSDT configuration', async () => {
      const mockFeatures: LineFeatures = {
        ...createMockFeatures(),
        nearPsychological: true,
        dayOfWeek: 6 // Saturday
      };

      const basePrediction = createMockPrediction();
      basePrediction.successProbability = 0.5;

      mockFeatureExtractor.extractFeatures.mockReturnValue(mockFeatures);
      mockFeatureExtractor.normalizeFeatures.mockReturnValue(Array(23).fill(0.5));
      mockPredictor.predictLineSuccess.mockResolvedValue(basePrediction);

      const generator = analyzer.analyzeLineWithProgress(
        mockLine,
        mockPriceData,
        'ETHUSDT',
        3000
      );

      for await (const update of generator) {
        // Consume updates
      }

      const result = await generator.next();
      const finalPrediction = result.value as MLPrediction;

      // Round number bonus: 0.5 * 1.15 = 0.575
      // Weekend reliability: 0.575 * 0.85 = 0.48875
      expect(finalPrediction.successProbability).toBeCloseTo(0.48875, 2);
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
  return {
    id: 'test-line-1',
    type: 'support',
    price: 50000,
    confidence: 0.85,
    touchPoints: [
      { time: 1000, value: 50000 },
      { time: 2000, value: 49950 },
      { time: 3000, value: 50020 },
      { time: 4000, value: 49980 }
    ],
    supportingTimeframes: ['1h', '4h']
  };
}

function createMockFeatures(): LineFeatures {
  return {
    touchCount: 4,
    rSquared: 0.85,
    confidence: 0.8,
    wickTouchRatio: 0.3,
    bodyTouchRatio: 0.6,
    exactTouchRatio: 0.1,
    volumeAverage: 1500,
    volumeMax: 2500,
    volumeStrength: 1.2,
    ageInCandles: 50,
    recentTouchCount: 2,
    timeSinceLastTouch: 10,
    marketCondition: 'ranging',
    trendStrength: 0.1,
    volatility: 0.3,
    timeOfDay: 14,
    dayOfWeek: 3,
    timeframeConfluence: 0.7,
    higherTimeframeAlignment: true,
    nearPattern: false,
    patternType: undefined,
    distanceFromPrice: 0.02,
    priceRoundness: 0.6,
    nearPsychological: false
  };
}

function createMockPrediction(): MLPrediction {
  return {
    successProbability: 0.75,
    expectedBounces: 3,
    confidenceInterval: [0.65, 0.85],
    riskScore: 0.25,
    suggestedStopLoss: 0.02,
    suggestedTakeProfit: 0.06,
    reasoning: [
      {
        factor: 'タッチ回数',
        impact: 'positive',
        weight: 0.2,
        description: '4回のタッチで信頼性あり'
      }
    ]
  };
}