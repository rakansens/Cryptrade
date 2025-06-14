import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as tf from '@tensorflow/tfjs';
import { LineQualityPredictor } from '../line-predictor';
import type { LineFeatures, MLPrediction } from '../line-validation-types';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  sequential: jest.fn(),
  layers: {
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn()
  },
  tensor2d: jest.fn(),
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

describe('LineQualityPredictor', () => {
  let predictor: LineQualityPredictor;
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock model
    mockModel = {
      compile: jest.fn(),
      fit: jest.fn().mockResolvedValue({}),
      predict: jest.fn(),
      dispose: jest.fn()
    };

    // Setup TensorFlow mocks
    (tf.sequential as jest.Mock).mockReturnValue(mockModel);
    (tf.tensor2d as jest.Mock).mockImplementation(() => ({
      dispose: jest.fn()
    }));

    predictor = new LineQualityPredictor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize model architecture correctly', () => {
      expect(tf.sequential).toHaveBeenCalled();
      expect(tf.layers.dense).toHaveBeenCalledWith({
        inputShape: [23],
        units: 32,
        activation: 'relu',
        kernelInitializer: 'glorotUniform'
      });
      expect(tf.layers.dropout).toHaveBeenCalledWith({ rate: 0.2 });
      expect(mockModel.compile).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      (tf.sequential as jest.Mock).mockImplementation(() => {
        throw new Error('TensorFlow initialization failed');
      });

      const errorPredictor = new LineQualityPredictor();
      
      // Should still be able to make predictions using fallback
      const features = createMockFeatures();
      const normalized = Array(23).fill(0.5);
      const prediction = await errorPredictor.predictLineSuccess(features, normalized);
      
      expect(prediction).toBeDefined();
      expect(prediction.successProbability).toBeGreaterThanOrEqual(0.1);
      expect(prediction.successProbability).toBeLessThanOrEqual(0.95);
    });
  });

  describe('predictLineSuccess', () => {
    it('should predict line success with ML model when ready', async () => {
      // Mock successful prediction
      const mockPredictionTensor = {
        array: jest.fn().mockResolvedValue([[0.85, 0.6, 0.75, 0.95]]),
        dispose: jest.fn()
      };
      mockModel.predict.mockReturnValue(mockPredictionTensor);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const features = createMockFeatures();
      const normalized = Array(23).fill(0.5);
      
      // Force model ready state
      (predictor as any).isModelReady = true;
      
      const prediction = await predictor.predictLineSuccess(features, normalized);

      expect(prediction.successProbability).toBe(0.85);
      expect(prediction.expectedBounces).toBe(3); // 0.6 * 5 = 3
      expect(prediction.confidenceInterval).toEqual([0.75, 0.95]);
      expect(prediction.reasoning).toBeInstanceOf(Array);
      expect(prediction.reasoning.length).toBeGreaterThan(0);
    });

    it('should fall back to rule-based prediction when model not ready', async () => {
      const features = createMockFeatures();
      const normalized = Array(23).fill(0.5);
      
      const prediction = await predictor.predictLineSuccess(features, normalized);

      expect(prediction).toBeDefined();
      expect(prediction.successProbability).toBeGreaterThanOrEqual(0.1);
      expect(prediction.successProbability).toBeLessThanOrEqual(0.95);
      expect(prediction.reasoning).toBeInstanceOf(Array);
    });

    it('should handle prediction errors gracefully', async () => {
      // Force model ready but make prediction fail
      (predictor as any).isModelReady = true;
      mockModel.predict.mockImplementation(() => {
        throw new Error('Prediction failed');
      });

      const features = createMockFeatures();
      const normalized = Array(23).fill(0.5);
      
      const prediction = await predictor.predictLineSuccess(features, normalized);

      // Should fall back to rule-based
      expect(prediction).toBeDefined();
      expect(prediction.successProbability).toBeGreaterThanOrEqual(0.1);
    });

    it('should generate appropriate reasoning for high-quality lines', async () => {
      const highQualityFeatures: LineFeatures = {
        ...createMockFeatures(),
        touchCount: 8,
        rSquared: 0.95,
        volumeStrength: 1.8,
        bodyTouchRatio: 0.8,
        wickTouchRatio: 0.2,
        marketCondition: 'trending',
        trendStrength: 0.7,
        timeSinceLastTouch: 5,
        nearPsychological: true
      };

      const normalized = Array(23).fill(0.5);
      const prediction = await predictor.predictLineSuccess(highQualityFeatures, normalized);

      expect(prediction.reasoning.length).toBeGreaterThan(3);
      
      const positiveReasons = prediction.reasoning.filter(r => r.impact === 'positive');
      expect(positiveReasons.length).toBeGreaterThan(0);
      
      // Check for specific reasoning
      const touchReason = prediction.reasoning.find(r => r.factor === 'タッチ回数');
      expect(touchReason).toBeDefined();
      expect(touchReason?.impact).toBe('positive');
    });

    it('should generate appropriate reasoning for low-quality lines', async () => {
      const lowQualityFeatures: LineFeatures = {
        ...createMockFeatures(),
        touchCount: 2,
        rSquared: 0.4,
        volumeStrength: 0.5,
        wickTouchRatio: 0.9,
        marketCondition: 'volatile',
        timeSinceLastTouch: 100
      };

      const normalized = Array(23).fill(0.5);
      const prediction = await predictor.predictLineSuccess(lowQualityFeatures, normalized);

      const negativeReasons = prediction.reasoning.filter(r => r.impact === 'negative');
      expect(negativeReasons.length).toBeGreaterThan(0);
    });

    it('should calculate risk score based on features', async () => {
      const riskyFeatures: LineFeatures = {
        ...createMockFeatures(),
        marketCondition: 'volatile',
        timeSinceLastTouch: 150,
        distanceFromPrice: 0.1
      };

      const normalized = Array(23).fill(0.5);
      const prediction = await predictor.predictLineSuccess(riskyFeatures, normalized);

      expect(prediction.riskScore).toBeDefined();
      expect(prediction.riskScore).toBeGreaterThan(0.5);
    });

    it('should suggest stop loss and take profit levels', async () => {
      const features = createMockFeatures();
      const normalized = Array(23).fill(0.5);
      
      // Force ML prediction
      (predictor as any).isModelReady = true;
      const mockPredictionTensor = {
        array: jest.fn().mockResolvedValue([[0.8, 0.6, 0.7, 0.9]]),
        dispose: jest.fn()
      };
      mockModel.predict.mockReturnValue(mockPredictionTensor);
      
      const prediction = await predictor.predictLineSuccess(features, normalized);

      expect(prediction.suggestedStopLoss).toBeDefined();
      expect(prediction.suggestedTakeProfit).toBeDefined();
      expect(prediction.suggestedStopLoss).toBeGreaterThan(0);
      expect(prediction.suggestedTakeProfit).toBeGreaterThan(prediction.suggestedStopLoss!);
    });
  });

  describe('rule-based prediction logic', () => {
    it('should increase probability for high touch count', async () => {
      const features1 = { ...createMockFeatures(), touchCount: 2 };
      const features2 = { ...createMockFeatures(), touchCount: 6 };
      
      const normalized = Array(23).fill(0.5);
      
      const prediction1 = await predictor.predictLineSuccess(features1, normalized);
      const prediction2 = await predictor.predictLineSuccess(features2, normalized);
      
      expect(prediction2.successProbability).toBeGreaterThan(prediction1.successProbability);
    });

    it('should factor in R-squared value', async () => {
      const features1 = { ...createMockFeatures(), rSquared: 0.3 };
      const features2 = { ...createMockFeatures(), rSquared: 0.95 };
      
      const normalized = Array(23).fill(0.5);
      
      const prediction1 = await predictor.predictLineSuccess(features1, normalized);
      const prediction2 = await predictor.predictLineSuccess(features2, normalized);
      
      expect(prediction2.successProbability).toBeGreaterThan(prediction1.successProbability);
    });

    it('should consider market conditions', async () => {
      const trendingFeatures = { ...createMockFeatures(), marketCondition: 'trending' as const };
      const volatileFeatures = { ...createMockFeatures(), marketCondition: 'volatile' as const };
      
      const normalized = Array(23).fill(0.5);
      
      const trendingPrediction = await predictor.predictLineSuccess(trendingFeatures, normalized);
      const volatilePrediction = await predictor.predictLineSuccess(volatileFeatures, normalized);
      
      expect(trendingPrediction.successProbability).toBeGreaterThan(volatilePrediction.successProbability);
    });

    it('should apply touch quality considerations', async () => {
      const bodyTouchFeatures = { ...createMockFeatures(), bodyTouchRatio: 0.8, wickTouchRatio: 0.2 };
      const wickTouchFeatures = { ...createMockFeatures(), bodyTouchRatio: 0.2, wickTouchRatio: 0.8 };
      
      const normalized = Array(23).fill(0.5);
      
      const bodyPrediction = await predictor.predictLineSuccess(bodyTouchFeatures, normalized);
      const wickPrediction = await predictor.predictLineSuccess(wickTouchFeatures, normalized);
      
      expect(bodyPrediction.successProbability).toBeGreaterThan(wickPrediction.successProbability);
    });
  });

  describe('getFeatureImportance', () => {
    it('should return sorted feature importance', () => {
      const importance = predictor.getFeatureImportance();
      
      expect(importance).toBeInstanceOf(Array);
      expect(importance.length).toBeGreaterThan(0);
      
      // Check structure
      importance.forEach(item => {
        expect(item).toHaveProperty('feature');
        expect(item).toHaveProperty('importance');
        expect(item).toHaveProperty('category');
        expect(item.importance).toBeGreaterThanOrEqual(0);
        expect(item.importance).toBeLessThanOrEqual(1);
      });
      
      // Check sorting
      for (let i = 1; i < importance.length; i++) {
        expect(importance[i - 1].importance).toBeGreaterThanOrEqual(importance[i].importance);
      }
    });

    it('should categorize features correctly', () => {
      const importance = predictor.getFeatureImportance();
      
      const volumeFeatures = importance.filter(f => f.category === 'volume');
      const timeFeatures = importance.filter(f => f.category === 'time');
      const marketFeatures = importance.filter(f => f.category === 'market');
      
      expect(volumeFeatures.length).toBeGreaterThan(0);
      expect(timeFeatures.length).toBeGreaterThan(0);
      expect(marketFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('getModelMetrics', () => {
    it('should return model metrics', () => {
      const metrics = predictor.getModelMetrics();
      
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1Score');
      expect(metrics).toHaveProperty('lastUpdated');
      expect(metrics).toHaveProperty('trainingSamples');
      expect(metrics).toHaveProperty('version');
      
      expect(metrics.version).toBe('1.0.0');
      expect(metrics.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe('updateWithOutcome', () => {
    it('should update model metrics when outcome is recorded', async () => {
      const initialMetrics = predictor.getModelMetrics();
      const initialSamples = initialMetrics.trainingSamples;
      const initialUpdate = initialMetrics.lastUpdated;
      
      await predictor.updateWithOutcome('line-123', true);
      
      const updatedMetrics = predictor.getModelMetrics();
      expect(updatedMetrics.trainingSamples).toBe(initialSamples + 1);
      expect(updatedMetrics.lastUpdated).toBeGreaterThan(initialUpdate);
    });
  });

  describe('synthetic data training', () => {
    it('should train with synthetic data on initialization', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockModel.fit).toHaveBeenCalled();
      expect(tf.tensor2d).toHaveBeenCalled();
    });

    it('should generate reasonable synthetic patterns', async () => {
      // This is tested indirectly through the fit call
      const fitCall = mockModel.fit.mock.calls[0];
      expect(fitCall).toBeDefined();
      expect(fitCall[2]).toMatchObject({
        epochs: 20,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });
    });
  });
});

// Helper function to create mock features
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