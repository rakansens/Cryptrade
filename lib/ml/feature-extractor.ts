// Feature extraction for ML line validation

import { env } from '@/config/env';
import type { LineFeatures } from './line-validation-types';
import { FEATURE_RANGES } from './line-validation-types';
import type { DetectedLine } from '@/lib/analysis/types';
import type { PriceData } from '@/types/market';

export class FeatureExtractor {
  private priceData: PriceData[];
  private currentPrice: number;
  
  constructor(priceData: PriceData[], currentPrice: number) {
    this.priceData = priceData;
    this.currentPrice = currentPrice;
  }

  /**
   * Extract all features from a detected line
   */
  extractFeatures(line: DetectedLine, _symbol: string): LineFeatures {
    const marketContext = this.analyzeMarketContext();
    const touchQuality = this.analyzeTouchQuality(line);
    const volumeFeatures = this.extractVolumeFeatures(line);
    const timeFeatures = this.extractTimeFeatures(line);
    const priceContext = this.analyzePriceContext(line);
    
    const patternType = this.getNearbyPatternType(line);
    
    return {
      // Basic features
      touchCount: line.touchPoints.length,
      rSquared: line.rSquared || 0,
      confidence: line.confidence,
      
      // Touch quality
      ...touchQuality,
      
      // Volume features
      ...volumeFeatures,
      
      // Time features
      ...timeFeatures,
      
      // Market context
      ...marketContext,
      
      // Multi-timeframe
      timeframeConfluence: this.calculateTimeframeConfluence(line),
      higherTimeframeAlignment: this.checkHigherTimeframeAlignment(line),
      
      // Pattern context
      nearPattern: this.checkNearbyPatterns(line),
      ...(patternType !== undefined && { patternType }),
      
      // Price context
      ...priceContext
    };
  }

  /**
   * Normalize features for ML model
   */
  normalizeFeatures(features: LineFeatures): number[] {
    const normalized: number[] = [];
    
    // Helper to normalize a value
    const normalize = (value: number, min: number, max: number): number => {
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };
    
    // Basic features
    normalized.push(normalize(features.touchCount, FEATURE_RANGES.touchCount.min, FEATURE_RANGES.touchCount.max));
    normalized.push(features.rSquared);
    normalized.push(features.confidence);
    
    // Touch quality
    normalized.push(features.wickTouchRatio);
    normalized.push(features.bodyTouchRatio);
    normalized.push(features.exactTouchRatio);
    
    // Volume features
    normalized.push(normalize(features.volumeAverage, FEATURE_RANGES.volumeAverage.min, FEATURE_RANGES.volumeAverage.max));
    normalized.push(normalize(features.volumeMax, FEATURE_RANGES.volumeMax.min, FEATURE_RANGES.volumeMax.max));
    normalized.push(normalize(features.volumeStrength, FEATURE_RANGES.volumeStrength.min, FEATURE_RANGES.volumeStrength.max));
    
    // Time features
    normalized.push(normalize(features.ageInCandles, FEATURE_RANGES.ageInCandles.min, FEATURE_RANGES.ageInCandles.max));
    normalized.push(normalize(features.recentTouchCount, FEATURE_RANGES.recentTouchCount.min, FEATURE_RANGES.recentTouchCount.max));
    normalized.push(normalize(features.timeSinceLastTouch, FEATURE_RANGES.timeSinceLastTouch.min, FEATURE_RANGES.timeSinceLastTouch.max));
    
    // Market context
    normalized.push(features.marketCondition === 'trending' ? 1 : features.marketCondition === 'ranging' ? 0.5 : 0);
    normalized.push(normalize(features.trendStrength, FEATURE_RANGES.trendStrength.min, FEATURE_RANGES.trendStrength.max));
    normalized.push(features.volatility);
    normalized.push(normalize(features.timeOfDay, FEATURE_RANGES.timeOfDay.min, FEATURE_RANGES.timeOfDay.max));
    normalized.push(normalize(features.dayOfWeek, FEATURE_RANGES.dayOfWeek.min, FEATURE_RANGES.dayOfWeek.max));
    
    // Multi-timeframe
    normalized.push(features.timeframeConfluence);
    normalized.push(features.higherTimeframeAlignment ? 1 : 0);
    
    // Pattern context
    normalized.push(features.nearPattern ? 1 : 0);
    
    // Price context
    normalized.push(normalize(features.distanceFromPrice, FEATURE_RANGES.distanceFromPrice.min, FEATURE_RANGES.distanceFromPrice.max));
    normalized.push(features.priceRoundness);
    normalized.push(features.nearPsychological ? 1 : 0);
    
    return normalized;
  }

  private analyzeTouchQuality(line: DetectedLine): Pick<LineFeatures, 'wickTouchRatio' | 'bodyTouchRatio' | 'exactTouchRatio'> {
    let wickTouches = 0;
    let bodyTouches = 0;
    let exactTouches = 0;
    
    line.touchPoints.forEach(touch => {
      const candle = this.priceData.find(p => p.time === touch.time);
      if (!candle) return;
      
      const tolerance = (candle.high - candle.low) * 0.01; // 1% tolerance
      
      // Check if touch is at wick
      if (Math.abs(touch.value - candle.high) < tolerance || 
          Math.abs(touch.value - candle.low) < tolerance) {
        wickTouches++;
      }
      
      // Check if touch is at body
      const bodyHigh = Math.max(candle.open, candle.close);
      const bodyLow = Math.min(candle.open, candle.close);
      if (touch.value >= bodyLow && touch.value <= bodyHigh) {
        bodyTouches++;
      }
      
      // Check if exact touch
      if (Math.abs(touch.value - line.price!) < tolerance) {
        exactTouches++;
      }
    });
    
    const total = line.touchPoints.length;
    return {
      wickTouchRatio: total > 0 ? wickTouches / total : 0,
      bodyTouchRatio: total > 0 ? bodyTouches / total : 0,
      exactTouchRatio: total > 0 ? exactTouches / total : 0
    };
  }

  private extractVolumeFeatures(line: DetectedLine): Pick<LineFeatures, 'volumeAverage' | 'volumeMax' | 'volumeStrength'> {
    const touchVolumes = line.touchPoints.map(touch => {
      const candle = this.priceData.find(p => p.time === touch.time);
      return candle?.volume || 0;
    });
    
    const avgVolume = touchVolumes.reduce((a, b) => a + b, 0) / touchVolumes.length;
    const maxVolume = Math.max(...touchVolumes);
    
    // Calculate overall average volume
    const overallAvgVolume = this.priceData.reduce((a, b) => a + b.volume, 0) / this.priceData.length;
    
    return {
      volumeAverage: avgVolume,
      volumeMax: maxVolume,
      volumeStrength: overallAvgVolume > 0 ? avgVolume / overallAvgVolume : 1
    };
  }

  private extractTimeFeatures(line: DetectedLine): Pick<LineFeatures, 'ageInCandles' | 'recentTouchCount' | 'timeSinceLastTouch'> {
    const firstTouch = Math.min(...line.touchPoints.map(t => t.time));
    const lastTouch = Math.max(...line.touchPoints.map(t => t.time));
    const lastCandle = this.priceData[this.priceData.length - 1];
    if (!lastCandle) {
      return {
        ageInCandles: 0,
        recentTouchCount: 0,
        timeSinceLastTouch: 0
      };
    }
    const currentTime = lastCandle.time;
    
    // Count candles
    const firstIndex = this.priceData.findIndex(p => p.time >= firstTouch);
    const lastIndex = this.priceData.findIndex(p => p.time >= lastTouch);
    const currentIndex = this.priceData.length - 1;
    
    // Recent touches (last 20% of line age)
    const recentThreshold = currentTime - (currentTime - firstTouch) * 0.2;
    const recentTouches = line.touchPoints.filter(t => t.time >= recentThreshold).length;
    
    return {
      ageInCandles: currentIndex - firstIndex,
      recentTouchCount: recentTouches,
      timeSinceLastTouch: currentIndex - lastIndex
    };
  }

  private analyzeMarketContext(): Pick<LineFeatures, 'marketCondition' | 'trendStrength' | 'volatility' | 'timeOfDay' | 'dayOfWeek'> {
    // Calculate trend using SMA
    const sma20 = this.calculateSMA(20);
    const sma50 = this.calculateSMA(50);
    
    // Trend strength
    let trendStrength = 0;
    if (sma20 && sma50) {
      trendStrength = (sma20 - sma50) / sma50;
      trendStrength = Math.max(-1, Math.min(1, trendStrength * 10)); // Normalize
    }
    
    // Volatility (using ATR concept)
    const volatility = this.calculateVolatility();
    
    // Market condition
    let marketCondition: 'trending' | 'ranging' | 'volatile';
    if (volatility > 0.7) {
      marketCondition = 'volatile';
    } else if (Math.abs(trendStrength) > 0.3) {
      marketCondition = 'trending';
    } else {
      marketCondition = 'ranging';
    }
    
    // Time features
    const lastCandle = this.priceData[this.priceData.length - 1];
    const currentDate = lastCandle ? new Date(lastCandle.time * 1000) : new Date();
    
    return {
      marketCondition,
      trendStrength,
      volatility,
      timeOfDay: currentDate.getUTCHours(),
      dayOfWeek: currentDate.getUTCDay()
    };
  }

  private analyzePriceContext(line: DetectedLine): Pick<LineFeatures, 'distanceFromPrice' | 'priceRoundness' | 'nearPsychological'> {
    const firstTouch = line.touchPoints[0];
    const linePrice = line.price || firstTouch?.value || 0;
    const distance = Math.abs(this.currentPrice - linePrice) / this.currentPrice;
    
    // Check price roundness
    const priceStr = linePrice.toString();
    const decimals = priceStr.split('.')[1]?.length || 0;
    let roundness = 0;
    
    if (linePrice % 1000 === 0) roundness = 1;
    else if (linePrice % 100 === 0) roundness = 0.8;
    else if (linePrice % 10 === 0) roundness = 0.6;
    else if (decimals <= 1) roundness = 0.4;
    else roundness = 0.2;
    
    // Check if near psychological level
    const psychLevels = [1000, 5000, 10000, 50000, 100000];
    const nearPsychological = psychLevels.some(level => 
      Math.abs(linePrice - Math.round(linePrice / level) * level) / linePrice < 0.01
    );
    
    return {
      distanceFromPrice: distance,
      priceRoundness: roundness,
      nearPsychological
    };
  }

  /**
   * タイムフレーム間の一致度を計算
   * @notImplemented
   * @alpha
   * @returns {number} Timeframe confluence score (0.5-0.65 in dev, 0.5 in prod)
   */
  private calculateTimeframeConfluence(_line: DetectedLine): number {
    // 開発環境では固定値を返す
    if (env.NODE_ENV === 'development') {
      console.warn('[FeatureExtractor] Using mock timeframe confluence value');
      return 0.65; // 中程度の一致度
    }
    
    // 本番環境では最小値を返す（安全側に倒す）
    return 0.5;
  }

  /**
   * 上位タイムフレームとの整合性をチェック
   * @notImplemented
   * @alpha
   * @returns {boolean} Always true in dev, false in prod
   */
  private checkHigherTimeframeAlignment(_line: DetectedLine): boolean {
    // 開発環境では固定値を返す
    if (env.NODE_ENV === 'development') {
      console.warn('[FeatureExtractor] Using mock higher timeframe alignment');
      return true; // 開発時は常に整合性ありとする
    }
    
    // 本番環境では常にfalseを返す（安全側に倒す）
    return false;
  }

  /**
   * 近傍のパターンをチェック
   * @notImplemented
   * @alpha
   * @returns {boolean} Always false as placeholder implementation
   */
  private checkNearbyPatterns(_line: DetectedLine): boolean {
    // 開発環境では固定値を返す
    if (env.NODE_ENV === 'development') {
      console.warn('[FeatureExtractor] Using mock nearby patterns check');
      return false; // 開発時はパターンなしとする
    }
    
    // 本番環境では常にfalseを返す（安全側に倒す）
    return false;
  }

  private getNearbyPatternType(line: DetectedLine): string | undefined {
    if (!this.checkNearbyPatterns(line)) return undefined;
    
    const patterns = ['headAndShoulders', 'doubleTop', 'triangle', 'flag'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  private calculateSMA(period: number): number | null {
    if (this.priceData.length < period) return null;
    
    const sum = this.priceData
      .slice(-period)
      .reduce((acc, candle) => acc + candle.close, 0);
    
    return sum / period;
  }

  private calculateVolatility(): number {
    const period = Math.min(20, this.priceData.length);
    const returns: number[] = [];
    
    for (let i = 1; i < period; i++) {
      const curr = this.priceData[this.priceData.length - i];
      const prev = this.priceData[this.priceData.length - i - 1];
      if (curr && prev && prev.close !== 0) {
        returns.push((curr.close - prev.close) / prev.close);
      }
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize to 0-1 range
    return Math.min(1, stdDev * 100);
  }
}