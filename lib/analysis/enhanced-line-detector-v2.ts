import { logger } from '@/lib/utils/logger';
import { advancedTouchDetector, type TouchAnalysis, type AdvancedTouchConfig } from './advanced-touch-detector';
import type { MultiTimeframeData } from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';

/**
 * Enhanced Line Detector V2
 * 
 * Phase 2 implementation with advanced touch point detection.
 * Integrates wick/body analysis, volume confirmation, and bounce patterns
 * for significantly improved line detection accuracy.
 */

export interface EnhancedLineV2 {
  id: string;
  price: number;
  type: 'support' | 'resistance' | 'trendline';
  confidence: number;
  strength: number;
  touchCount: number;
  supportingTimeframes: string[];
  touchAnalysis: TouchAnalysis;
  qualityMetrics: {
    wickBodyRatio: number;
    volumeConfirmation: number;
    bounceConfirmation: number;
    overallQuality: number;
  };
  coordinates?: {
    startTime: number;
    endTime: number;
    startPrice: number;
    endPrice: number;
    slope?: number;
  };
  description: string;
  createdAt: number;
}

export interface TrendLineDetection {
  line: EnhancedLineV2;
  points: Array<{ time: number; price: number; index: number }>;
  rSquared: number; // Linear regression fit quality
  slope: number;
  intercept: number;
}

export interface LineDetectionV2Config {
  // Touch detection settings
  touchConfig: Partial<AdvancedTouchConfig>;
  
  // Line quality thresholds
  minTouchCount: number;
  minConfidence: number;
  minQualityScore: number;
  
  // Timeframe requirements
  minTimeframes: number;
  
  // Price tolerance
  priceTolerancePercent: number;
  
  // Trendline specific
  minTrendlinePoints: number;
  maxTrendlineSlope: number;
  trendlineRSquaredThreshold: number;
  
  // Volume analysis
  requireVolumeConfirmation: boolean;
  volumeConfirmationThreshold: number;
  
  // Bounce analysis
  requireBounceConfirmation: boolean;
  bounceConfirmationThreshold: number;
}

const DEFAULT_V2_CONFIG: LineDetectionV2Config = {
  touchConfig: {
    wickWeight: 0.7,
    bodyWeight: 1.0,
    exactWeight: 1.2,
    volumeThresholdMultiplier: 1.3,
    bounceThresholdPercent: 0.4,
    lookforwardBars: 6,
    tolerancePercent: 0.15
  },
  minTouchCount: 3,
  minConfidence: 0.6,
  minQualityScore: 60,
  minTimeframes: 2,
  priceTolerancePercent: 0.5,
  minTrendlinePoints: 3,
  maxTrendlineSlope: 0.1,
  trendlineRSquaredThreshold: 0.7,
  requireVolumeConfirmation: false,
  volumeConfirmationThreshold: 0.5,
  requireBounceConfirmation: false,
  bounceConfirmationThreshold: 0.3
};

export class EnhancedLineDetectorV2 {
  private config: LineDetectionV2Config;
  private touchDetector;
  
  constructor(config: Partial<LineDetectionV2Config> = {}) {
    this.config = { ...DEFAULT_V2_CONFIG, ...config };
    this.touchDetector = new advancedTouchDetector.constructor(this.config.touchConfig);
  }
  
  /**
   * Detect enhanced lines with advanced touch point analysis
   */
  async detectEnhancedLines(multiTimeframeData: MultiTimeframeData): Promise<{
    horizontalLines: EnhancedLineV2[];
    trendlines: EnhancedLineV2[];
    detectionStats: {
      totalCandidates: number;
      qualityFiltered: number;
      touchFiltered: number;
      finalLines: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    
    logger.info('[EnhancedLineDetectorV2] Starting advanced line detection', {
      symbol: multiTimeframeData.symbol,
      timeframes: Object.keys(multiTimeframeData.timeframes),
      config: this.config
    });
    
    // Detect horizontal support/resistance lines
    const horizontalLines = await this.detectHorizontalLines(multiTimeframeData);
    
    // Detect trendlines
    const trendlines = await this.detectTrendlines(multiTimeframeData);
    
    const processingTime = Date.now() - startTime;
    
    const detectionStats = {
      totalCandidates: horizontalLines.length + trendlines.length,
      qualityFiltered: horizontalLines.filter(l => l.qualityMetrics.overallQuality >= this.config.minQualityScore).length +
                      trendlines.filter(l => l.qualityMetrics.overallQuality >= this.config.minQualityScore).length,
      touchFiltered: horizontalLines.filter(l => l.touchCount >= this.config.minTouchCount).length +
                     trendlines.filter(l => l.touchCount >= this.config.minTouchCount).length,
      finalLines: horizontalLines.length + trendlines.length,
      processingTime
    };
    
    logger.info('[EnhancedLineDetectorV2] Detection completed', {
      symbol: multiTimeframeData.symbol,
      horizontalLines: horizontalLines.length,
      trendlines: trendlines.length,
      stats: detectionStats
    });
    
    return {
      horizontalLines,
      trendlines,
      detectionStats
    };
  }
  
  /**
   * Detect horizontal support/resistance lines with advanced touch analysis
   */
  private async detectHorizontalLines(multiTimeframeData: MultiTimeframeData): Promise<EnhancedLineV2[]> {
    const lines: EnhancedLineV2[] = [];
    const candidateLevels = new Map<number, {
      timeframes: string[];
      touchAnalyses: TouchAnalysis[];
      prices: number[];
    }>();
    
    // Find candidate levels across all timeframes
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      const swingLevels = this.findSwingLevels(timeframeData.data);
      
      for (const level of swingLevels) {
        // Find existing candidate near this price
        const tolerance = level.price * (this.config.priceTolerancePercent / 100);
        let foundCandidate = false;
        
        for (const [candidatePrice, candidate] of candidateLevels.entries()) {
          if (Math.abs(candidatePrice - level.price) <= tolerance) {
            candidate.timeframes.push(interval);
            candidate.prices.push(level.price);
            foundCandidate = true;
            break;
          }
        }
        
        if (!foundCandidate) {
          candidateLevels.set(level.price, {
            timeframes: [interval],
            touchAnalyses: [],
            prices: [level.price]
          });
        }
      }
    }
    
    // Analyze each candidate level with advanced touch detection
    for (const [basePrice, candidate] of candidateLevels.entries()) {
      if (candidate.timeframes.length < this.config.minTimeframes) continue;
      
      const avgPrice = candidate.prices.reduce((sum, p) => sum + p, 0) / candidate.prices.length;
      let combinedTouchAnalysis: TouchAnalysis = {
        touchPoints: [],
        averageVolume: 0,
        wickTouchCount: 0,
        bodyTouchCount: 0,
        exactTouchCount: 0,
        strongBounceCount: 0,
        touchQualityScore: 0,
        volumeWeightedStrength: 0
      };
      
      let totalVolume = 0;
      let totalCandles = 0;
      
      // Analyze touches in each supporting timeframe
      for (const interval of candidate.timeframes) {
        const timeframeData = multiTimeframeData.timeframes[interval];
        const levelType = this.determineLevelType(timeframeData.data, avgPrice);
        
        const touchAnalysis = this.touchDetector.analyzeTouchPoints(
          timeframeData.data,
          avgPrice,
          levelType
        );
        
        // Merge touch analyses
        combinedTouchAnalysis.touchPoints.push(...touchAnalysis.touchPoints);
        combinedTouchAnalysis.wickTouchCount += touchAnalysis.wickTouchCount;
        combinedTouchAnalysis.bodyTouchCount += touchAnalysis.bodyTouchCount;
        combinedTouchAnalysis.exactTouchCount += touchAnalysis.exactTouchCount;
        combinedTouchAnalysis.strongBounceCount += touchAnalysis.strongBounceCount;
        
        totalVolume += touchAnalysis.averageVolume * timeframeData.data.length;
        totalCandles += timeframeData.data.length;
      }
      
      // Calculate combined metrics
      combinedTouchAnalysis.averageVolume = totalVolume / totalCandles;
      combinedTouchAnalysis.touchQualityScore = this.touchDetector.calculateTouchQualityScore(
        combinedTouchAnalysis.touchPoints, 
        totalCandles
      );
      combinedTouchAnalysis.volumeWeightedStrength = this.touchDetector.calculateVolumeWeightedStrength(
        combinedTouchAnalysis.touchPoints
      );
      
      // Apply quality filters
      if (combinedTouchAnalysis.touchPoints.length < this.config.minTouchCount) continue;
      if (combinedTouchAnalysis.touchQualityScore < this.config.minQualityScore) continue;
      
      // Apply volume confirmation if required
      if (this.config.requireVolumeConfirmation) {
        const volumeConfirmationRatio = combinedTouchAnalysis.touchPoints.filter(tp => 
          tp.volumeRatio > this.config.touchConfig.volumeThresholdMultiplier!
        ).length / combinedTouchAnalysis.touchPoints.length;
        
        if (volumeConfirmationRatio < this.config.volumeConfirmationThreshold) continue;
      }
      
      // Apply bounce confirmation if required
      if (this.config.requireBounceConfirmation) {
        const bounceConfirmationRatio = combinedTouchAnalysis.strongBounceCount / combinedTouchAnalysis.touchPoints.length;
        if (bounceConfirmationRatio < this.config.bounceConfirmationThreshold) continue;
      }
      
      // Calculate line confidence and strength
      const confidence = this.touchDetector.calculateLineConfidence(combinedTouchAnalysis);
      if (confidence < this.config.minConfidence) continue;
      
      const strength = this.calculateLineStrength(combinedTouchAnalysis, candidate.timeframes.length);
      const levelType = this.determineLevelType(
        Object.values(multiTimeframeData.timeframes)[0].data, 
        avgPrice
      );
      
      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(combinedTouchAnalysis);
      
      // Create enhanced line
      const enhancedLine: EnhancedLineV2 = {
        id: `horizontal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        price: avgPrice,
        type: levelType,
        confidence,
        strength,
        touchCount: combinedTouchAnalysis.touchPoints.length,
        supportingTimeframes: candidate.timeframes,
        touchAnalysis: combinedTouchAnalysis,
        qualityMetrics,
        description: this.generateLineDescription(levelType, combinedTouchAnalysis, candidate.timeframes),
        createdAt: Date.now()
      };
      
      lines.push(enhancedLine);
    }
    
    // Sort by confidence and strength
    lines.sort((a, b) => (b.confidence * b.strength) - (a.confidence * a.strength));
    
    return lines;
  }
  
  /**
   * Detect trendlines with advanced touch analysis
   */
  private async detectTrendlines(multiTimeframeData: MultiTimeframeData): Promise<EnhancedLineV2[]> {
    const trendlines: EnhancedLineV2[] = [];
    
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      const detectedTrendlines = await this.detectTrendlinesInTimeframe(
        timeframeData.data, 
        interval
      );
      
      for (const trendlineDetection of detectedTrendlines) {
        // Validate across other timeframes
        const crossTimeframeValidation = await this.validateTrendlineAcrossTimeframes(
          trendlineDetection,
          multiTimeframeData
        );
        
        if (crossTimeframeValidation.supportingTimeframes.length >= this.config.minTimeframes) {
          trendlines.push(trendlineDetection.line);
        }
      }
    }
    
    return trendlines;
  }
  
  /**
   * Detect trendlines in a single timeframe
   */
  private async detectTrendlinesInTimeframe(
    data: ProcessedKline[], 
    interval: string
  ): Promise<TrendLineDetection[]> {
    const trendlines: TrendLineDetection[] = [];
    const swingPoints = this.findSwingPoints(data);
    
    // Try to fit trendlines through swing points
    for (let i = 0; i < swingPoints.length - this.config.minTrendlinePoints + 1; i++) {
      for (let j = i + this.config.minTrendlinePoints - 1; j < swingPoints.length; j++) {
        const points = swingPoints.slice(i, j + 1);
        const regression = this.calculateLinearRegression(points);
        
        if (regression.rSquared >= this.config.trendlineRSquaredThreshold &&
            Math.abs(regression.slope) <= this.config.maxTrendlineSlope) {
          
          const trendlineType = regression.slope > 0 ? 'support' : 'resistance';
          
          // Analyze touches along this trendline
          const touchAnalysis = this.analyzeTrendlineTouches(data, regression, trendlineType);
          
          if (touchAnalysis.touchPoints.length >= this.config.minTouchCount &&
              touchAnalysis.touchQualityScore >= this.config.minQualityScore) {
            
            const confidence = this.touchDetector.calculateLineConfidence(touchAnalysis);
            const strength = this.calculateLineStrength(touchAnalysis, 1);
            const qualityMetrics = this.calculateQualityMetrics(touchAnalysis);
            
            const trendline: EnhancedLineV2 = {
              id: `trendline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              price: regression.intercept,
              type: 'trendline',
              confidence,
              strength,
              touchCount: touchAnalysis.touchPoints.length,
              supportingTimeframes: [interval],
              touchAnalysis,
              qualityMetrics,
              coordinates: {
                startTime: points[0].time,
                endTime: points[points.length - 1].time,
                startPrice: regression.intercept + regression.slope * points[0].time,
                endPrice: regression.intercept + regression.slope * points[points.length - 1].time,
                slope: regression.slope
              },
              description: this.generateTrendlineDescription(regression, touchAnalysis),
              createdAt: Date.now()
            };
            
            trendlines.push({
              line: trendline,
              points,
              rSquared: regression.rSquared,
              slope: regression.slope,
              intercept: regression.intercept
            });
          }
        }
      }
    }
    
    return trendlines;
  }
  
  /**
   * Find swing levels (peaks and valleys) for horizontal line detection
   */
  private findSwingLevels(data: ProcessedKline[]): Array<{ price: number; type: 'support' | 'resistance' }> {
    const levels = [];
    const lookback = 5;
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      
      // Check for swing high (resistance)
      let isSwingHigh = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].high >= current.high) {
          isSwingHigh = false;
          break;
        }
      }
      
      if (isSwingHigh) {
        levels.push({ price: current.high, type: 'resistance' });
      }
      
      // Check for swing low (support)
      let isSwingLow = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].low <= current.low) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        levels.push({ price: current.low, type: 'support' });
      }
    }
    
    return levels;
  }
  
  /**
   * Find swing points for trendline detection
   */
  private findSwingPoints(data: ProcessedKline[]): Array<{ time: number; price: number; index: number }> {
    const points = [];
    const lookback = 3;
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      
      // Check for swing high
      let isSwingHigh = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].high >= current.high) {
          isSwingHigh = false;
          break;
        }
      }
      
      if (isSwingHigh) {
        points.push({ time: current.time, price: current.high, index: i });
      }
      
      // Check for swing low
      let isSwingLow = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].low <= current.low) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        points.push({ time: current.time, price: current.low, index: i });
      }
    }
    
    return points;
  }
  
  /**
   * Calculate linear regression for trendline fitting
   */
  private calculateLinearRegression(points: Array<{ time: number; price: number; index: number }>): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.time, 0);
    const sumY = points.reduce((sum, p) => sum + p.price, 0);
    const sumXY = points.reduce((sum, p) => sum + p.time * p.price, 0);
    const sumXX = points.reduce((sum, p) => sum + p.time * p.time, 0);
    const sumYY = points.reduce((sum, p) => sum + p.price * p.price, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    const ssRes = points.reduce((sum, p) => {
      const predicted = slope * p.time + intercept;
      return sum + Math.pow(p.price - predicted, 2);
    }, 0);
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p.price - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    
    return { slope, intercept, rSquared };
  }
  
  /**
   * Analyze touches along a trendline
   */
  private analyzeTrendlineTouches(
    data: ProcessedKline[],
    regression: { slope: number; intercept: number },
    levelType: 'support' | 'resistance'
  ): TouchAnalysis {
    // This is a simplified implementation - would need more sophisticated trendline touch detection
    // For now, find points close to the trendline
    const tolerance = 0.01; // 1% tolerance
    const touchPoints = [];
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const expectedPrice = regression.slope * candle.time + regression.intercept;
      const actualPrice = levelType === 'support' ? candle.low : candle.high;
      
      if (Math.abs(actualPrice - expectedPrice) / expectedPrice <= tolerance) {
        touchPoints.push({
          price: actualPrice,
          time: candle.time,
          index: i,
          type: levelType,
          touchType: 'wick' as const,
          strength: 1.0,
          volume: candle.volume,
          volumeRatio: 1.0
        });
      }
    }
    
    return {
      touchPoints,
      averageVolume: data.reduce((sum, k) => sum + k.volume, 0) / data.length,
      wickTouchCount: touchPoints.length,
      bodyTouchCount: 0,
      exactTouchCount: 0,
      strongBounceCount: 0,
      touchQualityScore: touchPoints.length > 0 ? 70 : 0, // Simplified
      volumeWeightedStrength: 1.0
    };
  }
  
  /**
   * Validate trendline across multiple timeframes
   */
  private async validateTrendlineAcrossTimeframes(
    trendlineDetection: TrendLineDetection,
    multiTimeframeData: MultiTimeframeData
  ): Promise<{ supportingTimeframes: string[]; confidence: number }> {
    // Simplified validation - in practice would check if the trendline
    // also appears in other timeframes
    return {
      supportingTimeframes: [Object.keys(multiTimeframeData.timeframes)[0]],
      confidence: trendlineDetection.line.confidence
    };
  }
  
  /**
   * Determine if a price level is support or resistance
   */
  private determineLevelType(data: ProcessedKline[], price: number): 'support' | 'resistance' {
    const recentCandles = data.slice(-20); // Last 20 candles
    const pricesAbove = recentCandles.filter(k => k.close > price).length;
    const pricesBelow = recentCandles.filter(k => k.close < price).length;
    
    return pricesAbove > pricesBelow ? 'support' : 'resistance';
  }
  
  /**
   * Calculate line strength based on touch analysis and timeframe support
   */
  private calculateLineStrength(touchAnalysis: TouchAnalysis, timeframeCount: number): number {
    let strength = 0.5; // Base strength
    
    // Touch count factor
    strength += Math.min(touchAnalysis.touchPoints.length / 10, 0.3);
    
    // Touch quality factor
    strength += (touchAnalysis.touchQualityScore / 100) * 0.2;
    
    // Volume-weighted strength
    strength += touchAnalysis.volumeWeightedStrength * 0.15;
    
    // Timeframe support factor
    strength += Math.min(timeframeCount / 4, 0.25);
    
    // Bounce confirmation factor
    const bounceRatio = touchAnalysis.strongBounceCount / Math.max(touchAnalysis.touchPoints.length, 1);
    strength += bounceRatio * 0.1;
    
    return Math.min(strength, 1.0);
  }
  
  /**
   * Calculate quality metrics for a line
   */
  private calculateQualityMetrics(touchAnalysis: TouchAnalysis): {
    wickBodyRatio: number;
    volumeConfirmation: number;
    bounceConfirmation: number;
    overallQuality: number;
  } {
    const totalTouches = touchAnalysis.touchPoints.length;
    
    const wickBodyRatio = totalTouches > 0 
      ? (touchAnalysis.bodyTouchCount + touchAnalysis.exactTouchCount) / totalTouches 
      : 0;
    
    const volumeConfirmation = totalTouches > 0
      ? touchAnalysis.touchPoints.filter(tp => tp.volumeRatio > 1.2).length / totalTouches
      : 0;
    
    const bounceConfirmation = totalTouches > 0
      ? touchAnalysis.strongBounceCount / totalTouches
      : 0;
    
    const overallQuality = (
      touchAnalysis.touchQualityScore * 0.4 +
      wickBodyRatio * 100 * 0.2 +
      volumeConfirmation * 100 * 0.2 +
      bounceConfirmation * 100 * 0.2
    );
    
    return {
      wickBodyRatio,
      volumeConfirmation,
      bounceConfirmation,
      overallQuality
    };
  }
  
  /**
   * Generate description for horizontal line
   */
  private generateLineDescription(
    levelType: 'support' | 'resistance',
    touchAnalysis: TouchAnalysis,
    timeframes: string[]
  ): string {
    const stats = this.touchDetector.getTouchStatistics(touchAnalysis);
    return `Strong ${levelType} level with ${stats.summary} across ${timeframes.join(', ')} timeframes`;
  }
  
  /**
   * Generate description for trendline
   */
  private generateTrendlineDescription(
    regression: { slope: number; rSquared: number },
    touchAnalysis: TouchAnalysis
  ): string {
    const direction = regression.slope > 0 ? 'ascending' : 'descending';
    const fit = regression.rSquared >= 0.9 ? 'excellent' : regression.rSquared >= 0.8 ? 'good' : 'moderate';
    const stats = this.touchDetector.getTouchStatistics(touchAnalysis);
    
    return `${direction} trendline with ${fit} fit (R²=${regression.rSquared.toFixed(3)}) and ${stats.summary}`;
  }
}

// Export singleton instance
export const enhancedLineDetectorV2 = new EnhancedLineDetectorV2();