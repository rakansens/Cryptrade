import { logger } from '@/lib/utils/logger';
import { enhancedMarketDataService, type MultiTimeframeData, type SupportResistanceLevel, type ConfluenceZone } from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';

/**
 * Multi-Timeframe Line Detection Algorithm
 * 
 * Enhanced line detection that uses multiple timeframes to improve accuracy.
 * Identifies high-confidence support/resistance lines based on cross-timeframe validation.
 */

export interface LineDetectionConfig {
  minTimeframes: number;
  priceTolerancePercent: number;
  minTouchCount: number;
  confluenceZoneWidth: number;
  strengthThreshold: number;
  recencyWeight: number;
}

export interface DetectedLine {
  id: string;
  type: 'support' | 'resistance' | 'trendline';
  price: number;
  strength: number;
  confidence: number;
  touchCount: number;
  supportingTimeframes: string[];
  firstDetected: number;
  lastTouched: number;
  points: Array<{
    time: number;
    price: number;
    timeframe: string;
  }>;
  confluenceZone?: ConfluenceZone;
  metadata: {
    algorithm: 'multi-timeframe';
    version: string;
    calculatedAt: number;
    crossTimeframeValidation: number;
    volatilityAdjusted: boolean;
  };
}

export interface TrendlineData {
  startPoint: { time: number; price: number };
  endPoint: { time: number; price: number };
  slope: number;
  strength: number;
  touchPoints: Array<{ time: number; price: number; timeframe: string }>;
  equation: {
    slope: number;
    intercept: number;
    priceAtTime: (time: number) => number;
  };
}

export interface LineDetectionResult {
  symbol: string;
  horizontalLines: DetectedLine[];
  trendlines: DetectedLine[];
  confluenceZones: ConfluenceZone[];
  summary: {
    totalLines: number;
    highConfidenceLines: number;
    multiTimeframeLines: number;
    averageStrength: number;
    detectionTime: number;
  };
  config: LineDetectionConfig;
}

const DEFAULT_CONFIG: LineDetectionConfig = {
  minTimeframes: 2,
  priceTolerancePercent: 0.5,
  minTouchCount: 3,
  confluenceZoneWidth: 1.0,
  strengthThreshold: 0.6,
  recencyWeight: 0.3
};

export class MultiTimeframeLineDetector {
  private config: LineDetectionConfig;
  
  constructor(config: Partial<LineDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Detect support/resistance lines using multi-timeframe analysis
   */
  async detectLines(
    symbol: string,
    customConfig?: Partial<LineDetectionConfig>
  ): Promise<LineDetectionResult> {
    const startTime = Date.now();
    const effectiveConfig = customConfig ? { ...this.config, ...customConfig } : this.config;
    
    logger.info('[MultiTimeframeLineDetector] Starting line detection', {
      symbol,
      config: effectiveConfig
    });
    
    try {
      // Fetch multi-timeframe data
      const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
      
      // Find support/resistance levels
      const supportResistanceLevels = enhancedMarketDataService.findMultiTimeframeSupportResistance(
        multiTimeframeData,
        {
          minTouchCount: effectiveConfig.minTouchCount,
          priceTolerancePercent: effectiveConfig.priceTolerancePercent,
          minTimeframes: effectiveConfig.minTimeframes
        }
      );
      
      // Find confluence zones
      const confluenceZones = enhancedMarketDataService.findConfluenceZones(
        multiTimeframeData,
        {
          minTimeframes: effectiveConfig.minTimeframes,
          zoneWidthPercent: effectiveConfig.confluenceZoneWidth
        }
      );
      
      // Convert levels to detected lines
      const horizontalLines = this.convertLevelsToLines(
        supportResistanceLevels,
        multiTimeframeData,
        effectiveConfig
      );
      
      // Detect trendlines
      const trendlines = await this.detectTrendlines(
        multiTimeframeData,
        effectiveConfig
      );
      
      // Calculate summary statistics
      const allLines = [...horizontalLines, ...trendlines];
      const summary = {
        totalLines: allLines.length,
        highConfidenceLines: allLines.filter(l => l.confidence >= 0.8).length,
        multiTimeframeLines: allLines.filter(l => l.supportingTimeframes.length >= 2).length,
        averageStrength: allLines.length > 0 ? 
          allLines.reduce((sum, l) => sum + l.strength, 0) / allLines.length : 0,
        detectionTime: Date.now() - startTime
      };
      
      const result: LineDetectionResult = {
        symbol,
        horizontalLines,
        trendlines,
        confluenceZones,
        summary,
        config: effectiveConfig
      };
      
      logger.info('[MultiTimeframeLineDetector] Line detection completed', {
        symbol,
        summary,
        config: effectiveConfig
      });
      
      return result;
      
    } catch (error) {
      logger.error('[MultiTimeframeLineDetector] Line detection failed', {
        symbol,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Convert support/resistance levels to detected lines
   */
  private convertLevelsToLines(
    levels: SupportResistanceLevel[],
    multiTimeframeData: MultiTimeframeData,
    config: LineDetectionConfig
  ): DetectedLine[] {
    const lines: DetectedLine[] = [];
    
    for (const level of levels) {
      if (level.strength < config.strengthThreshold) continue;
      
      // Calculate cross-timeframe validation
      const validation = enhancedMarketDataService.calculateCrossTimeframeValidation(
        level.price,
        multiTimeframeData,
        config.priceTolerancePercent
      );
      
      // Find touch points across timeframes
      const touchPoints = this.findTouchPointsForLevel(
        level.price,
        multiTimeframeData,
        config.priceTolerancePercent
      );
      
      // Calculate enhanced confidence score
      const confidence = this.calculateEnhancedConfidence(
        level,
        validation,
        touchPoints,
        config
      );
      
      if (confidence >= 0.5) {
        const line: DetectedLine = {
          id: `${level.type}-${level.price.toFixed(2)}-${Date.now()}`,
          type: level.type,
          price: level.price,
          strength: level.strength,
          confidence,
          touchCount: level.touchCount,
          supportingTimeframes: level.timeframeSupport,
          firstDetected: level.firstSeen,
          lastTouched: level.lastSeen,
          points: touchPoints,
          metadata: {
            algorithm: 'multi-timeframe',
            version: '1.0.0',
            calculatedAt: Date.now(),
            crossTimeframeValidation: validation.validationScore,
            volatilityAdjusted: true
          }
        };
        
        lines.push(line);
      }
    }
    
    return lines.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Detect trendlines across multiple timeframes
   */
  private async detectTrendlines(
    multiTimeframeData: MultiTimeframeData,
    config: LineDetectionConfig
  ): Promise<DetectedLine[]> {
    const trendlines: DetectedLine[] = [];
    
    // Analyze each timeframe for trendlines
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      const timeframeTrendlines = this.findTrendlinesInTimeframe(
        timeframeData.data,
        interval,
        timeframeData.weight,
        config
      );
      
      for (const trendline of timeframeTrendlines) {
        // Validate trendline against other timeframes
        const crossValidation = await this.validateTrendlineAcrossTimeframes(
          trendline,
          multiTimeframeData,
          config
        );
        
        if (crossValidation.isValid) {
          const detectedLine: DetectedLine = {
            id: `trendline-${interval}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'trendline',
            price: trendline.endPoint.price, // Use end point price for sorting
            strength: trendline.strength,
            confidence: crossValidation.confidence,
            touchCount: trendline.touchPoints.length,
            supportingTimeframes: crossValidation.supportingTimeframes,
            firstDetected: trendline.startPoint.time,
            lastTouched: trendline.endPoint.time,
            points: trendline.touchPoints,
            metadata: {
              algorithm: 'multi-timeframe',
              version: '1.0.0',
              calculatedAt: Date.now(),
              crossTimeframeValidation: crossValidation.validationScore,
              volatilityAdjusted: true
            }
          };
          
          trendlines.push(detectedLine);
        }
      }
    }
    
    // Remove duplicate trendlines
    return this.deduplicateTrendlines(trendlines, config);
  }
  
  /**
   * Find trendlines in a single timeframe
   */
  private findTrendlinesInTimeframe(
    data: ProcessedKline[],
    interval: string,
    weight: number,
    config: LineDetectionConfig
  ): TrendlineData[] {
    const trendlines: TrendlineData[] = [];
    
    // Find swing points for trendline analysis
    const swingHighs = this.findSwingPoints(data, 'high');
    const swingLows = this.findSwingPoints(data, 'low');
    
    // Detect uptrend lines (connecting swing lows)
    const uptrendlines = this.fitTrendlines(swingLows, 'ascending', interval, weight);
    trendlines.push(...uptrendlines);
    
    // Detect downtrend lines (connecting swing highs)
    const downtrendlines = this.fitTrendlines(swingHighs, 'descending', interval, weight);
    trendlines.push(...downtrendlines);
    
    return trendlines.filter(tl => tl.touchPoints.length >= config.minTouchCount);
  }
  
  /**
   * Find swing points (highs or lows) in price data
   */
  private findSwingPoints(
    data: ProcessedKline[],
    type: 'high' | 'low'
  ): Array<{ time: number; price: number; index: number }> {
    const swingPoints = [];
    const lookback = 5;
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      const currentPrice = current[type];
      let isSwing = true;
      
      // Check surrounding candles
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        const comparePrice = data[j][type];
        if (type === 'high' && comparePrice >= currentPrice) {
          isSwing = false;
          break;
        }
        if (type === 'low' && comparePrice <= currentPrice) {
          isSwing = false;
          break;
        }
      }
      
      if (isSwing) {
        swingPoints.push({
          time: current.time,
          price: currentPrice,
          index: i
        });
      }
    }
    
    return swingPoints;
  }
  
  /**
   * Fit trendlines to swing points
   */
  private fitTrendlines(
    swingPoints: Array<{ time: number; price: number; index: number }>,
    direction: 'ascending' | 'descending',
    interval: string,
    weight: number
  ): TrendlineData[] {
    const trendlines: TrendlineData[] = [];
    
    if (swingPoints.length < 2) return trendlines;
    
    // Try different combinations of swing points
    for (let i = 0; i < swingPoints.length - 1; i++) {
      for (let j = i + 1; j < swingPoints.length; j++) {
        const point1 = swingPoints[i];
        const point2 = swingPoints[j];
        
        // Calculate trendline parameters
        const slope = (point2.price - point1.price) / (point2.time - point1.time);
        const intercept = point1.price - slope * point1.time;
        
        // Validate direction
        if (direction === 'ascending' && slope <= 0) continue;
        if (direction === 'descending' && slope >= 0) continue;
        
        // Find all points that touch this trendline
        const touchPoints = this.findTrendlineTouchPoints(
          swingPoints,
          slope,
          intercept,
          point1.time,
          point2.time,
          interval
        );
        
        if (touchPoints.length >= 2) {
          const strength = this.calculateTrendlineStrength(touchPoints, weight, slope);
          
          trendlines.push({
            startPoint: point1,
            endPoint: point2,
            slope,
            strength,
            touchPoints,
            equation: {
              slope,
              intercept,
              priceAtTime: (time: number) => slope * time + intercept
            }
          });
        }
      }
    }
    
    // Sort by strength and return best trendlines
    return trendlines.sort((a, b) => b.strength - a.strength).slice(0, 3);
  }
  
  /**
   * Find points that touch a trendline
   */
  private findTrendlineTouchPoints(
    swingPoints: Array<{ time: number; price: number; index: number }>,
    slope: number,
    intercept: number,
    startTime: number,
    endTime: number,
    interval: string
  ): Array<{ time: number; price: number; timeframe: string }> {
    const touchPoints = [];
    const tolerance = 0.005; // 0.5% tolerance
    
    for (const point of swingPoints) {
      if (point.time < startTime || point.time > endTime) continue;
      
      const expectedPrice = slope * point.time + intercept;
      const priceDifference = Math.abs(point.price - expectedPrice) / expectedPrice;
      
      if (priceDifference <= tolerance) {
        touchPoints.push({
          time: point.time,
          price: point.price,
          timeframe: interval
        });
      }
    }
    
    return touchPoints;
  }
  
  /**
   * Calculate trendline strength
   */
  private calculateTrendlineStrength(
    touchPoints: Array<{ time: number; price: number; timeframe: string }>,
    timeframeWeight: number,
    slope: number
  ): number {
    let strength = 0.5; // Base strength
    
    // Touch count factor
    strength += Math.min(touchPoints.length / 10, 0.3);
    
    // Timeframe weight factor
    strength += timeframeWeight * 0.2;
    
    // Slope significance factor
    const slopeSignificance = Math.min(Math.abs(slope) * 1000, 0.2);
    strength += slopeSignificance;
    
    return Math.min(strength, 1.0);
  }
  
  /**
   * Validate trendline against other timeframes
   */
  private async validateTrendlineAcrossTimeframes(
    trendline: TrendlineData,
    multiTimeframeData: MultiTimeframeData,
    config: LineDetectionConfig
  ): Promise<{
    isValid: boolean;
    confidence: number;
    validationScore: number;
    supportingTimeframes: string[];
  }> {
    const supportingTimeframes: string[] = [];
    let totalValidation = 0;
    let validationCount = 0;
    
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      // Test multiple points along the trendline
      const testPoints = this.generateTrendlineTestPoints(
        trendline,
        trendline.startPoint.time,
        trendline.endPoint.time
      );
      
      let timeframeValidation = 0;
      for (const testPoint of testPoints) {
        const validation = enhancedMarketDataService.calculateCrossTimeframeValidation(
          testPoint.price,
          { symbol: multiTimeframeData.symbol, timeframes: { [interval]: timeframeData }, fetchedAt: multiTimeframeData.fetchedAt },
          config.priceTolerancePercent
        );
        
        timeframeValidation += validation.validationScore;
      }
      
      timeframeValidation /= testPoints.length;
      
      if (timeframeValidation > 0.3) {
        supportingTimeframes.push(interval);
      }
      
      totalValidation += timeframeValidation;
      validationCount++;
    }
    
    const validationScore = validationCount > 0 ? totalValidation / validationCount : 0;
    const confidence = (trendline.strength + validationScore) / 2;
    const isValid = supportingTimeframes.length >= Math.max(1, config.minTimeframes - 1);
    
    return {
      isValid,
      confidence,
      validationScore,
      supportingTimeframes
    };
  }
  
  /**
   * Generate test points along a trendline
   */
  private generateTrendlineTestPoints(
    trendline: TrendlineData,
    startTime: number,
    endTime: number
  ): Array<{ time: number; price: number }> {
    const points = [];
    const intervals = 5;
    const timeStep = (endTime - startTime) / intervals;
    
    for (let i = 0; i <= intervals; i++) {
      const time = startTime + i * timeStep;
      const price = trendline.equation.priceAtTime(time);
      points.push({ time, price });
    }
    
    return points;
  }
  
  /**
   * Remove duplicate trendlines
   */
  private deduplicateTrendlines(
    trendlines: DetectedLine[],
    config: LineDetectionConfig
  ): DetectedLine[] {
    const unique: DetectedLine[] = [];
    const processed = new Set<string>();
    
    for (const trendline of trendlines) {
      const key = this.generateTrendlineKey(trendline, config);
      
      if (!processed.has(key)) {
        unique.push(trendline);
        processed.add(key);
      }
    }
    
    return unique.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Generate a unique key for trendline deduplication
   */
  private generateTrendlineKey(trendline: DetectedLine, config: LineDetectionConfig): string {
    const startPoint = trendline.points[0];
    const endPoint = trendline.points[trendline.points.length - 1];
    const slope = (endPoint.price - startPoint.price) / (endPoint.time - startPoint.time);
    
    return `${Math.round(slope * 10000)}-${Math.round(startPoint.price)}-${Math.round(endPoint.price)}`;
  }
  
  /**
   * Find touch points for a specific price level across timeframes
   */
  private findTouchPointsForLevel(
    targetPrice: number,
    multiTimeframeData: MultiTimeframeData,
    tolerancePercent: number
  ): Array<{ time: number; price: number; timeframe: string }> {
    const touchPoints = [];
    const tolerance = targetPrice * (tolerancePercent / 100);
    
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      for (const candle of timeframeData.data) {
        // Check if low or high touches the target price
        if (Math.abs(candle.low - targetPrice) <= tolerance) {
          touchPoints.push({
            time: candle.time,
            price: candle.low,
            timeframe: interval
          });
        }
        if (Math.abs(candle.high - targetPrice) <= tolerance) {
          touchPoints.push({
            time: candle.time,
            price: candle.high,
            timeframe: interval
          });
        }
      }
    }
    
    // Sort by time and remove duplicates
    touchPoints.sort((a, b) => a.time - b.time);
    return touchPoints.filter((point, index, array) => 
      index === 0 || point.time !== array[index - 1].time
    );
  }
  
  /**
   * Calculate enhanced confidence score
   */
  private calculateEnhancedConfidence(
    level: SupportResistanceLevel,
    validation: { validationScore: number },
    touchPoints: Array<{ time: number; price: number; timeframe: string }>,
    config: LineDetectionConfig
  ): number {
    let confidence = level.confidenceScore;
    
    // Cross-timeframe validation boost
    confidence += validation.validationScore * 0.2;
    
    // Touch count factor
    confidence += Math.min(touchPoints.length / 10, 0.15);
    
    // Recency factor
    const now = Date.now();
    const recentTouches = touchPoints.filter(p => now - p.time < 7 * 24 * 60 * 60 * 1000); // Last 7 days
    if (touchPoints.length > 0) {
      confidence += (recentTouches.length / touchPoints.length) * config.recencyWeight;
    }
    
    // Multi-timeframe support bonus
    if (level.timeframeSupport.length >= 3) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LineDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[MultiTimeframeLineDetector] Configuration updated', { config: this.config });
  }
  
  /**
   * Get current configuration
   */
  getConfig(): LineDetectionConfig {
    return { ...this.config };
  }
}

// Default instance
export const multiTimeframeLineDetector = new MultiTimeframeLineDetector();