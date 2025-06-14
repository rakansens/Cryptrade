import { logger } from '@/lib/utils/logger';
import type { ProcessedKline } from '@/types/market';

/**
 * Advanced Touch Point Detection
 * 
 * Phase 2 implementation for improved line detection accuracy.
 * Analyzes touch points with wick/body distinction, volume confirmation,
 * and price bounce patterns.
 */

export interface TouchPoint {
  price: number;
  time: number;
  index: number;
  type: 'support' | 'resistance';
  touchType: 'wick' | 'body' | 'exact';
  strength: number;
  volume: number;
  volumeRatio: number; // Volume relative to average
  bounceStrength?: number; // How strongly price bounced
  bounceDirection?: 'up' | 'down';
  priceMovement?: number; // Price movement after touch
}

export interface TouchAnalysis {
  touchPoints: TouchPoint[];
  averageVolume: number;
  wickTouchCount: number;
  bodyTouchCount: number;
  exactTouchCount: number;
  strongBounceCount: number;
  touchQualityScore: number;
  volumeWeightedStrength: number;
}

export interface AdvancedTouchConfig {
  wickWeight: number; // Weight for wick touches (0-1)
  bodyWeight: number; // Weight for body touches (0-1)
  exactWeight: number; // Weight for exact touches (0-1)
  volumeThresholdMultiplier: number; // Min volume as multiple of average
  bounceThresholdPercent: number; // Min bounce as % of price
  lookforwardBars: number; // Bars to check for bounce
  tolerancePercent: number; // Price tolerance for touch detection
}

const DEFAULT_CONFIG: AdvancedTouchConfig = {
  wickWeight: 0.7,
  bodyWeight: 1.0,
  exactWeight: 1.2,
  volumeThresholdMultiplier: 1.2,
  bounceThresholdPercent: 0.3,
  lookforwardBars: 5,
  tolerancePercent: 0.1
};

export class AdvancedTouchDetector {
  private config: AdvancedTouchConfig;
  
  constructor(config: Partial<AdvancedTouchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Analyze touch points for a given price level
   */
  analyzeTouchPoints(
    data: ProcessedKline[],
    priceLevel: number,
    levelType: 'support' | 'resistance'
  ): TouchAnalysis {
    const touchPoints: TouchPoint[] = [];
    const tolerance = priceLevel * (this.config.tolerancePercent / 100);
    
    // Calculate average volume
    const volumes = data.map(k => k.volume);
    const averageVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    // Analyze each candle for touches
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const touchPoint = this.detectTouchPoint(
        candle, 
        priceLevel, 
        tolerance, 
        levelType,
        i,
        averageVolume
      );
      
      if (touchPoint) {
        // Analyze bounce if there are enough forward bars
        if (i + this.config.lookforwardBars < data.length) {
          this.analyzeBounce(touchPoint, data, i);
        }
        
        touchPoints.push(touchPoint);
      }
    }
    
    // Calculate touch quality metrics
    const wickTouchCount = touchPoints.filter(tp => tp.touchType === 'wick').length;
    const bodyTouchCount = touchPoints.filter(tp => tp.touchType === 'body').length;
    const exactTouchCount = touchPoints.filter(tp => tp.touchType === 'exact').length;
    const strongBounceCount = touchPoints.filter(tp => 
      tp.bounceStrength && tp.bounceStrength > this.config.bounceThresholdPercent
    ).length;
    
    // Calculate quality score
    const touchQualityScore = this.calculateTouchQualityScore(touchPoints, data.length);
    
    // Calculate volume-weighted strength
    const volumeWeightedStrength = this.calculateVolumeWeightedStrength(touchPoints);
    
    return {
      touchPoints,
      averageVolume,
      wickTouchCount,
      bodyTouchCount,
      exactTouchCount,
      strongBounceCount,
      touchQualityScore,
      volumeWeightedStrength
    };
  }
  
  /**
   * Detect if a candle touches a price level
   */
  private detectTouchPoint(
    candle: ProcessedKline,
    priceLevel: number,
    tolerance: number,
    levelType: 'support' | 'resistance',
    index: number,
    averageVolume: number
  ): TouchPoint | null {
    const { open, high, low, close, volume, time } = candle;
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    
    let touchType: 'wick' | 'body' | 'exact' | null = null;
    let touchPrice = 0;
    
    if (levelType === 'support') {
      // Check for support touch
      if (Math.abs(low - priceLevel) <= tolerance) {
        // Wick touched support
        touchType = 'wick';
        touchPrice = low;
        
        if (Math.abs(bodyLow - priceLevel) <= tolerance) {
          // Body also touched
          touchType = 'body';
          touchPrice = bodyLow;
        }
        
        if (Math.abs(close - priceLevel) <= tolerance * 0.5) {
          // Closed very near support (exact touch)
          touchType = 'exact';
          touchPrice = close;
        }
      }
    } else {
      // Check for resistance touch
      if (Math.abs(high - priceLevel) <= tolerance) {
        // Wick touched resistance
        touchType = 'wick';
        touchPrice = high;
        
        if (Math.abs(bodyHigh - priceLevel) <= tolerance) {
          // Body also touched
          touchType = 'body';
          touchPrice = bodyHigh;
        }
        
        if (Math.abs(close - priceLevel) <= tolerance * 0.5) {
          // Closed very near resistance (exact touch)
          touchType = 'exact';
          touchPrice = close;
        }
      }
    }
    
    if (!touchType) return null;
    
    // Calculate touch strength based on type
    let strength = 0;
    switch (touchType) {
      case 'wick':
        strength = this.config.wickWeight;
        break;
      case 'body':
        strength = this.config.bodyWeight;
        break;
      case 'exact':
        strength = this.config.exactWeight;
        break;
    }
    
    // Adjust strength based on volume
    const volumeRatio = volume / averageVolume;
    if (volumeRatio > this.config.volumeThresholdMultiplier) {
      strength *= (1 + (volumeRatio - 1) * 0.2); // Boost for high volume
    }
    
    return {
      price: touchPrice,
      time,
      index,
      type: levelType,
      touchType,
      strength,
      volume,
      volumeRatio
    };
  }
  
  /**
   * Analyze price bounce after touch
   */
  private analyzeBounce(
    touchPoint: TouchPoint,
    data: ProcessedKline[],
    touchIndex: number
  ): void {
    const touchCandle = data[touchIndex];
    const lookforward = Math.min(this.config.lookforwardBars, data.length - touchIndex - 1);
    
    let maxBounce = 0;
    let bounceDirection: 'up' | 'down' | undefined;
    
    for (let i = 1; i <= lookforward; i++) {
      const futureCandle = data[touchIndex + i];
      
      if (touchPoint.type === 'support') {
        // For support, look for upward bounce
        const bounceAmount = futureCandle.high - touchCandle.low;
        const bouncePercent = (bounceAmount / touchCandle.low) * 100;
        
        if (bouncePercent > maxBounce) {
          maxBounce = bouncePercent;
          bounceDirection = 'up';
        }
      } else {
        // For resistance, look for downward bounce
        const bounceAmount = touchCandle.high - futureCandle.low;
        const bouncePercent = (bounceAmount / touchCandle.high) * 100;
        
        if (bouncePercent > maxBounce) {
          maxBounce = bouncePercent;
          bounceDirection = 'down';
        }
      }
    }
    
    if (maxBounce > this.config.bounceThresholdPercent) {
      touchPoint.bounceStrength = maxBounce;
      touchPoint.bounceDirection = bounceDirection;
      
      // Boost strength for strong bounces
      const bounceMultiplier = 1 + (maxBounce / 100) * 0.5;
      touchPoint.strength *= bounceMultiplier;
    }
    
    // Calculate overall price movement
    const endCandle = data[touchIndex + lookforward];
    const priceMovement = ((endCandle.close - touchCandle.close) / touchCandle.close) * 100;
    touchPoint.priceMovement = priceMovement;
  }
  
  /**
   * Calculate overall touch quality score
   */
  private calculateTouchQualityScore(touchPoints: TouchPoint[], totalCandles: number): number {
    if (touchPoints.length === 0) return 0;
    
    let score = 0;
    
    // Factor 1: Number of touches relative to data size
    const touchDensity = touchPoints.length / totalCandles;
    score += Math.min(touchDensity * 100, 30); // Max 30 points
    
    // Factor 2: Touch type distribution
    const bodyRatio = touchPoints.filter(tp => tp.touchType === 'body' || tp.touchType === 'exact').length / touchPoints.length;
    score += bodyRatio * 20; // Max 20 points
    
    // Factor 3: Average touch strength
    const avgStrength = touchPoints.reduce((sum, tp) => sum + tp.strength, 0) / touchPoints.length;
    score += avgStrength * 20; // Max 20-24 points (with exact touches)
    
    // Factor 4: Volume confirmation
    const highVolumeTouches = touchPoints.filter(tp => tp.volumeRatio > this.config.volumeThresholdMultiplier).length;
    const volumeConfirmationRatio = highVolumeTouches / touchPoints.length;
    score += volumeConfirmationRatio * 15; // Max 15 points
    
    // Factor 5: Bounce confirmation
    const strongBounces = touchPoints.filter(tp => 
      tp.bounceStrength && tp.bounceStrength > this.config.bounceThresholdPercent
    ).length;
    const bounceRatio = strongBounces / touchPoints.length;
    score += bounceRatio * 15; // Max 15 points
    
    return Math.min(score, 100);
  }
  
  /**
   * Calculate volume-weighted strength
   */
  private calculateVolumeWeightedStrength(touchPoints: TouchPoint[]): number {
    if (touchPoints.length === 0) return 0;
    
    const totalVolumeWeight = touchPoints.reduce((sum, tp) => sum + tp.volume, 0);
    const weightedStrength = touchPoints.reduce((sum, tp) => 
      sum + (tp.strength * tp.volume), 0
    );
    
    return totalVolumeWeight > 0 ? weightedStrength / totalVolumeWeight : 0;
  }
  
  /**
   * Filter touch points by quality criteria
   */
  filterHighQualityTouches(
    touchAnalysis: TouchAnalysis,
    minStrength: number = 0.8,
    requireVolume: boolean = true,
    requireBounce: boolean = false
  ): TouchPoint[] {
    return touchAnalysis.touchPoints.filter(tp => {
      if (tp.strength < minStrength) return false;
      if (requireVolume && tp.volumeRatio < this.config.volumeThresholdMultiplier) return false;
      if (requireBounce && (!tp.bounceStrength || tp.bounceStrength < this.config.bounceThresholdPercent)) return false;
      return true;
    });
  }
  
  /**
   * Calculate confidence score for a line based on touch analysis
   */
  calculateLineConfidence(touchAnalysis: TouchAnalysis): number {
    const {
      touchPoints,
      touchQualityScore,
      volumeWeightedStrength,
      strongBounceCount
    } = touchAnalysis;
    
    if (touchPoints.length === 0) return 0;
    
    // Base confidence from quality score
    let confidence = touchQualityScore / 100 * 0.4;
    
    // Volume-weighted strength contribution
    confidence += volumeWeightedStrength * 0.3;
    
    // Touch count contribution
    const touchCountScore = Math.min(touchPoints.length / 10, 1) * 0.2;
    confidence += touchCountScore;
    
    // Bounce confirmation contribution
    const bounceRatio = strongBounceCount / touchPoints.length;
    confidence += bounceRatio * 0.1;
    
    return Math.min(confidence, 1);
  }
  
  /**
   * Get touch point statistics for logging
   */
  getTouchStatistics(touchAnalysis: TouchAnalysis): {
    summary: string;
    details: Record<string, any>;
  } {
    const { 
      touchPoints, 
      wickTouchCount, 
      bodyTouchCount, 
      exactTouchCount,
      strongBounceCount,
      touchQualityScore,
      volumeWeightedStrength
    } = touchAnalysis;
    
    const summary = `${touchPoints.length} touches (W:${wickTouchCount} B:${bodyTouchCount} E:${exactTouchCount}), ` +
                   `${strongBounceCount} bounces, Quality: ${touchQualityScore.toFixed(1)}/100`;
    
    const details = {
      totalTouches: touchPoints.length,
      touchTypes: {
        wick: wickTouchCount,
        body: bodyTouchCount,
        exact: exactTouchCount
      },
      strongBounces: strongBounceCount,
      qualityScore: touchQualityScore,
      volumeWeightedStrength,
      averageStrength: touchPoints.length > 0 
        ? touchPoints.reduce((sum, tp) => sum + tp.strength, 0) / touchPoints.length 
        : 0,
      highVolumeTouches: touchPoints.filter(tp => tp.volumeRatio > this.config.volumeThresholdMultiplier).length
    };
    
    return { summary, details };
  }
}

// Singleton instance with default configuration
export const advancedTouchDetector = new AdvancedTouchDetector();