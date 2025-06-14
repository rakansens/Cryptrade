// Streaming ML analysis with progress visualization

import { logger } from '@/lib/utils/logger';
import { FeatureExtractor } from './feature-extractor';
import { LineQualityPredictor } from './line-predictor';
import type { 
  LineFeatures, 
  MLPrediction, 
  StreamingMLUpdate,
  CurrencyPairMLConfig 
} from './line-validation-types';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';

export class StreamingMLAnalyzer {
  private predictor: LineQualityPredictor;
  private currencyConfigs: Map<string, CurrencyPairMLConfig>;
  
  constructor() {
    this.predictor = new LineQualityPredictor();
    this.currencyConfigs = this.initializeCurrencyConfigs();
  }

  /**
   * Analyze line with streaming progress updates
   */
  async *analyzeLineWithProgress(
    line: DetectedLine,
    priceData: PriceData[],
    symbol: string,
    currentPrice: number
  ): AsyncGenerator<StreamingMLUpdate> {
    const startTime = Date.now();
    
    try {
      // Stage 1: Collecting data
      yield {
        stage: 'collecting',
        progress: 10,
        currentStep: 'データ収集中...',
        details: {
          processingTime: Date.now() - startTime
        }
      };
      
      await this.simulateProcessing(500);
      
      // Stage 2: Feature extraction
      yield {
        stage: 'extracting',
        progress: 30,
        currentStep: '特徴量を抽出中...',
        details: {
          processingTime: Date.now() - startTime
        }
      };
      
      const extractor = new FeatureExtractor(priceData, currentPrice);
      const features = extractor.extractFeatures(line, symbol);
      const normalizedFeatures = extractor.normalizeFeatures(features);
      
      yield {
        stage: 'extracting',
        progress: 50,
        currentStep: `${Object.keys(features).length}個の特徴量を抽出完了`,
        details: {
          featuresExtracted: normalizedFeatures.length,
          importantFeatures: this.getTopFeatures(features),
          processingTime: Date.now() - startTime
        }
      };
      
      await this.simulateProcessing(500);
      
      // Stage 3: ML Prediction
      yield {
        stage: 'predicting',
        progress: 70,
        currentStep: 'MLモデルで予測中...',
        details: {
          processingTime: Date.now() - startTime
        }
      };
      
      const prediction = await this.predictor.predictLineSuccess(features, normalizedFeatures);
      
      // Apply currency-specific adjustments
      const adjustedPrediction = this.applyCurrencyAdjustments(prediction, features, symbol);
      
      yield {
        stage: 'predicting',
        progress: 85,
        currentStep: '予測完了',
        details: {
          preliminaryScore: adjustedPrediction.successProbability,
          processingTime: Date.now() - startTime
        }
      };
      
      await this.simulateProcessing(300);
      
      // Stage 4: Analysis complete
      yield {
        stage: 'analyzing',
        progress: 95,
        currentStep: '分析結果をまとめています...',
        details: {
          processingTime: Date.now() - startTime
        }
      };
      
      await this.simulateProcessing(200);
      
      // Final result
      yield {
        stage: 'complete',
        progress: 100,
        currentStep: 'ML分析完了',
        details: {
          featuresExtracted: normalizedFeatures.length,
          importantFeatures: this.getTopFeatures(features),
          preliminaryScore: adjustedPrediction.successProbability,
          processingTime: Date.now() - startTime
        }
      };
      
      // Return the final prediction data
      return adjustedPrediction;
      
    } catch (error) {
      logger.error('[StreamingMLAnalyzer] Analysis error', error);
      yield {
        stage: 'complete',
        progress: 100,
        currentStep: 'エラーが発生しました',
        details: {
          processingTime: Date.now() - startTime
        }
      };
      throw error;
    }
  }

  /**
   * Apply currency-specific ML adjustments
   */
  private applyCurrencyAdjustments(
    prediction: MLPrediction,
    features: LineFeatures,
    symbol: string
  ): MLPrediction {
    const config = this.currencyConfigs.get(symbol);
    if (!config) return prediction;
    
    let adjustedProb = prediction.successProbability;
    const newReasons = [...prediction.reasoning];
    
    // Round number adjustment
    if (features.nearPsychological && config.roundNumberBonus > 1) {
      adjustedProb *= config.roundNumberBonus;
      newReasons.push({
        factor: `${symbol}特有調整`,
        impact: 'positive',
        weight: 0.1,
        description: `${symbol}はラウンドナンバーで反発しやすい`
      });
    }
    
    // Weekend adjustment
    if (features.dayOfWeek === 0 || features.dayOfWeek === 6) {
      adjustedProb *= config.weekendReliability;
      if (config.weekendReliability < 1) {
        newReasons.push({
          factor: '週末取引',
          impact: 'negative',
          weight: 0.05,
          description: '週末は流動性が低く信頼性低下'
        });
      }
    }
    
    // Normalize probability
    adjustedProb = Math.max(0.1, Math.min(0.95, adjustedProb));
    
    return {
      ...prediction,
      successProbability: adjustedProb,
      reasoning: newReasons
    };
  }

  /**
   * Get top contributing features
   */
  private getTopFeatures(features: LineFeatures): string[] {
    const importantFeatures: string[] = [];
    
    if (features.touchCount >= 5) {
      importantFeatures.push(`タッチ回数: ${features.touchCount}回`);
    }
    
    if (features.rSquared > 0.9) {
      importantFeatures.push(`高い線形性: R²=${features.rSquared.toFixed(2)}`);
    }
    
    if (features.volumeStrength > 1.5) {
      importantFeatures.push(`強いボリューム: ${features.volumeStrength.toFixed(1)}x`);
    }
    
    if (features.bodyTouchRatio > 0.7) {
      importantFeatures.push(`実体タッチ: ${Math.round(features.bodyTouchRatio * 100)}%`);
    }
    
    if (features.timeframeConfluence > 0.8) {
      importantFeatures.push('マルチタイムフレーム確認');
    }
    
    if (features.nearPsychological) {
      importantFeatures.push('心理的価格帯');
    }
    
    return importantFeatures.slice(0, 4); // Top 4 features
  }

  /**
   * Initialize currency-specific configurations
   */
  private initializeCurrencyConfigs(): Map<string, CurrencyPairMLConfig> {
    const configs = new Map<string, CurrencyPairMLConfig>();
    
    // Bitcoin configuration
    configs.set('BTCUSDT', {
      symbol: 'BTCUSDT',
      roundNumberBonus: 1.2,      // 20% bonus for round numbers
      weekendReliability: 0.8,    // 20% less reliable on weekends
      newsImpactMultiplier: 1.5,  // High news sensitivity
      liquidityThreshold: 1000,
      customFeatures: {
        'hashRateSensitivity': 0.7,
        'institutionalHours': 1.1
      }
    });
    
    // Ethereum configuration
    configs.set('ETHUSDT', {
      symbol: 'ETHUSDT',
      roundNumberBonus: 1.15,     // 15% bonus for round numbers
      weekendReliability: 0.85,   // 15% less reliable on weekends
      newsImpactMultiplier: 1.3,  // Moderate news sensitivity
      liquidityThreshold: 800,
      customFeatures: {
        'gasFeeSensitivity': 0.8,
        'defiActivity': 1.1
      }
    });
    
    // Add more currency pairs as needed
    configs.set('BNBUSDT', {
      symbol: 'BNBUSDT',
      roundNumberBonus: 1.1,
      weekendReliability: 0.9,
      newsImpactMultiplier: 1.2,
      liquidityThreshold: 500
    });
    
    return configs;
  }

  /**
   * Simulate processing delay for demo
   */
  private simulateProcessing(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get feature importance visualization data
   */
  getFeatureImportanceData() {
    return this.predictor.getFeatureImportance();
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics() {
    return this.predictor.getModelMetrics();
  }
}