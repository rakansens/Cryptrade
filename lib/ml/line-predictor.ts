// ML-based line quality predictor using TensorFlow.js

import * as tf from '@tensorflow/tfjs';
import { logger } from '@/lib/utils/logger';
import type { 
  LineFeatures, 
  MLPrediction, 
  MLReasoning,
  FeatureImportance,
  ModelMetrics 
} from './line-validation-types';
import { FeatureExtractor } from './feature-extractor';

export class LineQualityPredictor {
  private model: tf.LayersModel | null = null;
  private featureImportance: Map<string, number>;
  private modelMetrics: ModelMetrics;
  private isModelReady = false;

  constructor() {
    this.featureImportance = new Map();
    this.modelMetrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      lastUpdated: Date.now(),
      trainingSamples: 0,
      version: '1.0.0'
    };
    
    this.initializeModel();
  }

  /**
   * Initialize the TensorFlow.js model
   */
  private async initializeModel() {
    try {
      // Create a simple neural network
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [23], // Number of features
            units: 32,
            activation: 'relu',
            kernelInitializer: 'glorotUniform'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({
            units: 4, // [success_prob, expected_bounces, conf_low, conf_high]
            activation: 'sigmoid'
          })
        ]
      });

      // Compile the model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });

      // Initialize with synthetic training data
      await this.initializeWithSyntheticData();
      
      this.isModelReady = true;
      logger.info('[LinePredictor] Model initialized successfully');
    } catch (error) {
      logger.error('[LinePredictor] Failed to initialize model', error);
      // Fallback to rule-based predictions
      this.isModelReady = false;
    }
  }

  /**
   * Train model with synthetic data for demo
   */
  private async initializeWithSyntheticData() {
    if (!this.model) return;

    // Generate synthetic training data
    const numSamples = 1000;
    const features: number[][] = [];
    const labels: number[][] = [];

    for (let i = 0; i < numSamples; i++) {
      // Generate random features
      const feature = Array(23).fill(0).map(() => Math.random());
      
      // Generate labels based on feature patterns
      // This simulates learned patterns
      const touchCountNorm = feature[0];
      const rSquared = feature[1];
      const volumeStrength = feature[8];
      const timeframeConfluence = feature[17];
      
      // Success probability based on key features
      const successProb = Math.min(1, Math.max(0,
        0.3 + 
        touchCountNorm * 0.2 +
        rSquared * 0.3 +
        volumeStrength * 0.1 +
        timeframeConfluence * 0.2 +
        (Math.random() - 0.5) * 0.1
      ));
      
      // Expected bounces (1-5)
      const expectedBounces = Math.min(1, Math.max(0,
        (successProb * 0.8 + Math.random() * 0.2)
      ));
      
      // Confidence interval
      const confWidth = 0.1 + (1 - rSquared) * 0.2;
      const confLow = Math.max(0, successProb - confWidth);
      const confHigh = Math.min(1, successProb + confWidth);
      
      features.push(feature);
      labels.push([successProb, expectedBounces, confLow, confHigh]);
    }

    // Convert to tensors
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    // Train the model
    await this.model.fit(xs, ys, {
      epochs: 20,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) {
            logger.info(`[LinePredictor] Training epoch ${epoch}`, logs);
          }
        }
      }
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    // Update feature importance (simulated)
    this.updateFeatureImportance();
  }

  /**
   * Predict line quality and success probability
   */
  async predictLineSuccess(
    features: LineFeatures,
    normalizedFeatures: number[]
  ): Promise<MLPrediction> {
    if (!this.isModelReady || !this.model) {
      // Fallback to rule-based prediction
      return this.ruleBasedPrediction(features);
    }

    try {
      // Create tensor from features
      const input = tf.tensor2d([normalizedFeatures]);
      
      // Get prediction
      const prediction = this.model.predict(input) as tf.Tensor;
      const values = await prediction.array() as number[][];
      
      // Clean up
      input.dispose();
      prediction.dispose();
      
      const [successProb, expectedBouncesNorm, confLow, confHigh] = values[0];
      
      // Generate reasoning
      const reasoning = this.generateReasoning(features, successProb);
      
      // Calculate risk score
      const riskScore = this.calculateRiskScore(features, successProb);
      
      // Suggest SL/TP based on prediction
      const { stopLoss, takeProfit } = this.suggestRiskManagement(features, successProb);
      
      return {
        successProbability: successProb,
        expectedBounces: Math.round(expectedBouncesNorm * 5), // Denormalize to 0-5
        confidenceInterval: [confLow, confHigh],
        riskScore,
        suggestedStopLoss: stopLoss,
        suggestedTakeProfit: takeProfit,
        reasoning
      };
    } catch (error) {
      logger.error('[LinePredictor] Prediction error', error);
      return this.ruleBasedPrediction(features);
    }
  }

  /**
   * Rule-based fallback prediction
   */
  private ruleBasedPrediction(features: LineFeatures): MLPrediction {
    // Calculate success probability using rules
    let successProb = 0.5;
    
    // Touch count impact
    if (features.touchCount >= 3) successProb += 0.1;
    if (features.touchCount >= 5) successProb += 0.1;
    
    // R-squared impact
    successProb += features.rSquared * 0.2;
    
    // Volume strength impact
    if (features.volumeStrength > 1.2) successProb += 0.1;
    
    // Touch quality impact
    if (features.bodyTouchRatio > 0.6) successProb += 0.1;
    if (features.wickTouchRatio > 0.7) successProb -= 0.05;
    
    // Market condition impact
    if (features.marketCondition === 'trending') successProb += 0.05;
    if (features.marketCondition === 'volatile') successProb -= 0.1;
    
    // Time impact
    if (features.recentTouchCount > 2) successProb += 0.1;
    if (features.timeSinceLastTouch > 50) successProb -= 0.1;
    
    // Normalize
    successProb = Math.max(0.1, Math.min(0.95, successProb));
    
    const reasoning = this.generateReasoning(features, successProb);
    const riskScore = this.calculateRiskScore(features, successProb);
    
    return {
      successProbability: successProb,
      expectedBounces: Math.round(successProb * 3 + 1),
      confidenceInterval: [
        Math.max(0, successProb - 0.15),
        Math.min(1, successProb + 0.15)
      ],
      riskScore,
      reasoning
    };
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(features: LineFeatures, successProb: number): MLReasoning[] {
    const reasoning: MLReasoning[] = [];
    
    // Touch count reasoning
    if (features.touchCount >= 5) {
      reasoning.push({
        factor: 'タッチ回数',
        impact: 'positive',
        weight: 0.2,
        description: `${features.touchCount}回のタッチで強固なサポート/レジスタンス`
      });
    } else if (features.touchCount <= 2) {
      reasoning.push({
        factor: 'タッチ回数',
        impact: 'negative',
        weight: 0.15,
        description: 'タッチ回数が少なく信頼性が低い'
      });
    }
    
    // R-squared reasoning
    if (features.rSquared > 0.9) {
      reasoning.push({
        factor: '線形性',
        impact: 'positive',
        weight: 0.25,
        description: `R²値 ${features.rSquared.toFixed(2)} - 非常に正確なライン`
      });
    }
    
    // Volume reasoning
    if (features.volumeStrength > 1.5) {
      reasoning.push({
        factor: 'ボリューム',
        impact: 'positive',
        weight: 0.15,
        description: '高ボリュームでの反発 - 機関投資家の関心'
      });
    }
    
    // Touch quality
    if (features.bodyTouchRatio > 0.7) {
      reasoning.push({
        factor: 'タッチ品質',
        impact: 'positive',
        weight: 0.1,
        description: '実体での反発が多く、強い価格帯'
      });
    } else if (features.wickTouchRatio > 0.8) {
      reasoning.push({
        factor: 'タッチ品質',
        impact: 'negative',
        weight: 0.1,
        description: 'ヒゲでのタッチが多く、不安定な可能性'
      });
    }
    
    // Market condition
    if (features.marketCondition === 'trending' && features.trendStrength > 0.5) {
      reasoning.push({
        factor: '市場環境',
        impact: 'positive',
        weight: 0.1,
        description: '強いトレンド相場でのライン'
      });
    }
    
    // Time relevance
    if (features.timeSinceLastTouch < 10) {
      reasoning.push({
        factor: '直近の反応',
        impact: 'positive',
        weight: 0.15,
        description: '最近テストされたばかりの新鮮なライン'
      });
    }
    
    // Psychological level
    if (features.nearPsychological) {
      reasoning.push({
        factor: '心理的価格',
        impact: 'positive',
        weight: 0.1,
        description: 'ラウンドナンバー付近 - 多くのトレーダーが意識'
      });
    }
    
    return reasoning.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(features: LineFeatures, successProb: number): number {
    let risk = 1 - successProb;
    
    // Adjust for market conditions
    if (features.marketCondition === 'volatile') risk *= 1.2;
    if (features.timeSinceLastTouch > 100) risk *= 1.1;
    if (features.distanceFromPrice > 0.05) risk *= 1.1;
    
    return Math.max(0, Math.min(1, risk));
  }

  /**
   * Suggest stop loss and take profit
   */
  private suggestRiskManagement(
    features: LineFeatures, 
    successProb: number
  ): { stopLoss?: number; takeProfit?: number } {
    // This would be more sophisticated in production
    const avgRange = 0.02; // 2% average range
    
    const stopLoss = avgRange * (1 + (1 - successProb));
    const takeProfit = avgRange * (1 + successProb) * 2;
    
    return {
      stopLoss: Math.round(stopLoss * 10000) / 10000,
      takeProfit: Math.round(takeProfit * 10000) / 10000
    };
  }

  /**
   * Update feature importance (simulated for demo)
   */
  private updateFeatureImportance() {
    this.featureImportance.set('touchCount', 0.25);
    this.featureImportance.set('rSquared', 0.20);
    this.featureImportance.set('volumeStrength', 0.15);
    this.featureImportance.set('bodyTouchRatio', 0.10);
    this.featureImportance.set('timeframeConfluence', 0.10);
    this.featureImportance.set('marketCondition', 0.08);
    this.featureImportance.set('recentTouchCount', 0.07);
    this.featureImportance.set('nearPsychological', 0.05);
  }

  /**
   * Get feature importance
   */
  getFeatureImportance(): FeatureImportance[] {
    const importance: FeatureImportance[] = [];
    
    this.featureImportance.forEach((value, key) => {
      let category: 'basic' | 'volume' | 'time' | 'market' | 'pattern' = 'basic';
      
      if (key.includes('volume')) category = 'volume';
      else if (key.includes('time') || key.includes('recent') || key.includes('age')) category = 'time';
      else if (key.includes('market') || key.includes('trend') || key.includes('volatility')) category = 'market';
      else if (key.includes('pattern')) category = 'pattern';
      
      importance.push({
        feature: key,
        importance: value,
        category
      });
    });
    
    return importance.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get model metrics
   */
  getModelMetrics(): ModelMetrics {
    return { ...this.modelMetrics };
  }

  /**
   * Update model with new outcome data
   */
  async updateWithOutcome(lineId: string, outcome: boolean) {
    // In production, this would retrain the model incrementally
    logger.info('[LinePredictor] Recording outcome', { lineId, outcome });
    
    this.modelMetrics.trainingSamples++;
    this.modelMetrics.lastUpdated = Date.now();
  }
}