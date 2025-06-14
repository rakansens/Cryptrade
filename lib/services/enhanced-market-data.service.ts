import { logger } from '@/lib/utils/logger';
import { BaseService } from '@/lib/api/base-service';
import { APP_CONSTANTS } from '@/config/app-constants';
import type { ProcessedKline } from '@/types/market';

/**
 * Enhanced Market Data Service
 * 
 * Multi-timeframe data integration for improved line detection accuracy.
 * Fetches data from multiple timeframes to identify confluence zones and
 * provide weighted importance based on timeframe significance.
 */

export interface TimeframeConfig {
  interval: string;
  weight: number;
  dataPoints: number;
}

export interface MultiTimeframeData {
  symbol: string;
  timeframes: Record<string, {
    data: ProcessedKline[];
    weight: number;
    dataPoints: number;
  }>;
  fetchedAt: number;
}

export interface SupportResistanceLevel {
  price: number;
  strength: number;
  touchCount: number;
  timeframeSupport: string[];
  confidenceScore: number;
  firstSeen: number;
  lastSeen: number;
  type: 'support' | 'resistance';
}

export interface ConfluenceZone {
  priceRange: {
    min: number;
    max: number;
    center: number;
  };
  strength: number;
  timeframeCount: number;
  supportingTimeframes: string[];
  levels: SupportResistanceLevel[];
  type: 'support' | 'resistance' | 'pivot';
}

/**
 * Default timeframe configuration
 * Higher timeframes get more weight for line detection
 */
const DEFAULT_TIMEFRAME_CONFIG: TimeframeConfig[] = [
  { interval: '15m', weight: 0.2, dataPoints: 200 },  // Short-term noise filtering
  { interval: '1h', weight: 0.3, dataPoints: 500 },   // Primary intraday analysis
  { interval: '4h', weight: 0.35, dataPoints: 400 },  // Strong intermediate signals
  { interval: '1d', weight: 0.15, dataPoints: 200 }   // Long-term structural levels
];

export class EnhancedMarketDataService extends BaseService {
  private cache = new Map<string, MultiTimeframeData>();
  private cacheExpiryMs = APP_CONSTANTS.api.timeoutMs; // Use app constants

  constructor() {
    super('/api/binance'); // Use binance API base path
  }
  
  /**
   * Fetch multi-timeframe data for a symbol
   */
  async fetchMultiTimeframeData(
    symbol: string,
    timeframeConfigs: TimeframeConfig[] = DEFAULT_TIMEFRAME_CONFIG
  ): Promise<MultiTimeframeData> {
    const cacheKey = `${symbol}-${JSON.stringify(timeframeConfigs)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.fetchedAt < this.cacheExpiryMs) {
      logger.debug('[EnhancedMarketData] Using cached data', { symbol, age: Date.now() - cached.fetchedAt });
      return cached;
    }
    
    logger.info('[EnhancedMarketData] Fetching multi-timeframe data', { 
      symbol, 
      timeframes: timeframeConfigs.map(t => t.interval) 
    });
    
    const timeframeData: Record<string, any> = {};
    
    try {
      // Fetch data for all timeframes in parallel
      const fetchPromises = timeframeConfigs.map(async (config) => {
        try {
          const response = await this.get<ProcessedKline[]>('/klines', {
            symbol,
            interval: config.interval,
            limit: config.dataPoints.toString()
          });
          return {
            interval: config.interval,
            data: response.data,
            weight: config.weight,
            dataPoints: config.dataPoints
          };
        } catch (error) {
          logger.warn('[EnhancedMarketData] Failed to fetch timeframe data', {
            symbol,
            interval: config.interval,
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }
      });
      
      const results = await Promise.allSettled(fetchPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const { interval, data, weight, dataPoints } = result.value;
          timeframeData[interval] = { data, weight, dataPoints };
        } else {
          logger.warn('[EnhancedMarketData] Timeframe fetch failed', {
            symbol,
            interval: timeframeConfigs[index].interval,
            reason: result.status === 'rejected' ? result.reason : 'No data returned'
          });
        }
      });
      
      if (Object.keys(timeframeData).length === 0) {
        throw new Error('Failed to fetch data from any timeframe');
      }
      
      const multiTimeframeData: MultiTimeframeData = {
        symbol,
        timeframes: timeframeData,
        fetchedAt: Date.now()
      };
      
      this.cache.set(cacheKey, multiTimeframeData);
      
      logger.info('[EnhancedMarketData] Multi-timeframe data fetched successfully', {
        symbol,
        timeframesCount: Object.keys(timeframeData).length,
        totalDataPoints: Object.values(timeframeData).reduce((sum, tf: any) => sum + tf.data.length, 0)
      });
      
      return multiTimeframeData;
      
    } catch (error) {
      logger.error('[EnhancedMarketData] Failed to fetch multi-timeframe data', {
        symbol,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find support and resistance levels across multiple timeframes
   */
  findMultiTimeframeSupportResistance(
    multiTimeframeData: MultiTimeframeData,
    options: {
      minTouchCount?: number;
      priceTolerancePercent?: number;
      minTimeframes?: number;
    } = {}
  ): SupportResistanceLevel[] {
    const { 
      minTouchCount = 2, 
      priceTolerancePercent = 0.5,
      minTimeframes = 1
    } = options;
    
    logger.debug('[EnhancedMarketData] Finding multi-timeframe support/resistance', {
      symbol: multiTimeframeData.symbol,
      timeframes: Object.keys(multiTimeframeData.timeframes),
      options
    });
    
    const allLevels: SupportResistanceLevel[] = [];
    
    // Find levels in each timeframe
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      const levels = this.findSupportResistanceLevels(
        timeframeData.data,
        interval,
        timeframeData.weight,
        { minTouchCount, priceTolerancePercent }
      );
      allLevels.push(...levels);
    }
    
    // Group similar levels across timeframes
    const groupedLevels = this.groupSimilarLevels(allLevels, priceTolerancePercent);
    
    // Filter by minimum timeframe support
    const validLevels = groupedLevels.filter(level => 
      level.timeframeSupport.length >= minTimeframes
    );
    
    // Sort by confidence score (descending)
    validLevels.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    logger.info('[EnhancedMarketData] Multi-timeframe levels identified', {
      symbol: multiTimeframeData.symbol,
      totalLevels: allLevels.length,
      groupedLevels: groupedLevels.length,
      validLevels: validLevels.length
    });
    
    return validLevels;
  }
  
  /**
   * Identify confluence zones where multiple timeframes agree
   */
  findConfluenceZones(
    multiTimeframeData: MultiTimeframeData,
    options: {
      minTimeframes?: number;
      zoneWidthPercent?: number;
    } = {}
  ): ConfluenceZone[] {
    const { minTimeframes = 2, zoneWidthPercent = 1.0 } = options;
    
    const supportResistanceLevels = this.findMultiTimeframeSupportResistance(
      multiTimeframeData,
      { minTimeframes: 1 } // Get all levels first
    );
    
    const confluenceZones: ConfluenceZone[] = [];
    const processedLevels = new Set<number>();
    
    for (const level of supportResistanceLevels) {
      if (processedLevels.has(level.price)) continue;
      
      const zoneWidth = level.price * (zoneWidthPercent / 100);
      const zoneMin = level.price - zoneWidth;
      const zoneMax = level.price + zoneWidth;
      
      // Find all levels within this zone
      const levelsInZone = supportResistanceLevels.filter(l => 
        l.price >= zoneMin && l.price <= zoneMax
      );
      
      if (levelsInZone.length >= minTimeframes) {
        const allTimeframes = new Set<string>();
        levelsInZone.forEach(l => l.timeframeSupport.forEach(tf => allTimeframes.add(tf)));
        
        if (allTimeframes.size >= minTimeframes) {
          const zonePrices = levelsInZone.map(l => l.price);
          const zoneStrength = levelsInZone.reduce((sum, l) => sum + l.strength, 0) / levelsInZone.length;
          
          // Determine zone type
          const supportCount = levelsInZone.filter(l => l.type === 'support').length;
          const resistanceCount = levelsInZone.filter(l => l.type === 'resistance').length;
          const zoneType = supportCount > resistanceCount ? 'support' : 
                          resistanceCount > supportCount ? 'resistance' : 'pivot';
          
          confluenceZones.push({
            priceRange: {
              min: Math.min(...zonePrices),
              max: Math.max(...zonePrices),
              center: zonePrices.reduce((sum, p) => sum + p, 0) / zonePrices.length
            },
            strength: zoneStrength,
            timeframeCount: allTimeframes.size,
            supportingTimeframes: Array.from(allTimeframes),
            levels: levelsInZone,
            type: zoneType
          });
          
          // Mark all levels in this zone as processed
          levelsInZone.forEach(l => processedLevels.add(l.price));
        }
      }
    }
    
    confluenceZones.sort((a, b) => b.strength - a.strength);
    
    logger.info('[EnhancedMarketData] Confluence zones identified', {
      symbol: multiTimeframeData.symbol,
      zonesCount: confluenceZones.length,
      strongZones: confluenceZones.filter(z => z.timeframeCount >= 3).length
    });
    
    return confluenceZones;
  }
  
  /**
   * Calculate cross-timeframe validation score for a price level
   */
  calculateCrossTimeframeValidation(
    price: number,
    multiTimeframeData: MultiTimeframeData,
    tolerancePercent: number = 0.5
  ): {
    validationScore: number;
    supportingTimeframes: string[];
    touchCounts: Record<string, number>;
    avgStrength: number;
  } {
    const tolerance = price * (tolerancePercent / 100);
    const supportingTimeframes: string[] = [];
    const touchCounts: Record<string, number> = {};
    let totalStrength = 0;
    let timeframeCount = 0;
    
    for (const [interval, timeframeData] of Object.entries(multiTimeframeData.timeframes)) {
      const levels = this.findSupportResistanceLevels(
        timeframeData.data,
        interval,
        timeframeData.weight,
        { minTouchCount: 1, priceTolerancePercent: tolerancePercent }
      );
      
      const matchingLevels = levels.filter(level => 
        Math.abs(level.price - price) <= tolerance
      );
      
      if (matchingLevels.length > 0) {
        supportingTimeframes.push(interval);
        const totalTouches = matchingLevels.reduce((sum, l) => sum + l.touchCount, 0);
        touchCounts[interval] = totalTouches;
        totalStrength += matchingLevels.reduce((sum, l) => sum + l.strength, 0);
        timeframeCount++;
      }
    }
    
    const validationScore = timeframeCount / Object.keys(multiTimeframeData.timeframes).length;
    const avgStrength = timeframeCount > 0 ? totalStrength / timeframeCount : 0;
    
    return {
      validationScore,
      supportingTimeframes,
      touchCounts,
      avgStrength
    };
  }
  
  /**
   * Find support and resistance levels in a single timeframe
   */
  private findSupportResistanceLevels(
    data: ProcessedKline[],
    interval: string,
    weight: number,
    options: { minTouchCount: number; priceTolerancePercent: number }
  ): SupportResistanceLevel[] {
    const { minTouchCount, priceTolerancePercent } = options;
    const levels: SupportResistanceLevel[] = [];
    
    // Find swing highs and lows
    const swingPoints = this.findSwingPoints(data);
    
    // Group similar price levels
    const tolerance = this.calculatePriceTolerance(data, priceTolerancePercent);
    const groupedPoints = this.groupSwingPoints(swingPoints, tolerance);
    
    for (const group of groupedPoints) {
      if (group.points.length >= minTouchCount) {
        const avgPrice = group.points.reduce((sum, p) => sum + p.price, 0) / group.points.length;
        const touchCount = group.points.length;
        const strength = Math.min(touchCount / 5, 1) * weight; // Normalize and apply timeframe weight
        
        const times = group.points.map(p => p.time);
        const confidenceScore = this.calculateLevelConfidence(group.points, weight, interval);
        
        levels.push({
          price: avgPrice,
          strength,
          touchCount,
          timeframeSupport: [interval],
          confidenceScore,
          firstSeen: Math.min(...times),
          lastSeen: Math.max(...times),
          type: group.type
        });
      }
    }
    
    return levels.sort((a, b) => b.strength - a.strength);
  }
  
  /**
   * Find swing highs and lows in price data
   */
  private findSwingPoints(data: ProcessedKline[]): Array<{
    price: number;
    time: number;
    type: 'support' | 'resistance';
    index: number;
  }> {
    const swingPoints = [];
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
        swingPoints.push({
          price: current.high,
          time: current.time,
          type: 'resistance',
          index: i
        });
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
        swingPoints.push({
          price: current.low,
          time: current.time,
          type: 'support',
          index: i
        });
      }
    }
    
    return swingPoints;
  }
  
  /**
   * Group swing points by similar price levels
   */
  private groupSwingPoints(
    swingPoints: Array<{ price: number; time: number; type: 'support' | 'resistance'; index: number }>,
    tolerance: number
  ): Array<{
    points: Array<{ price: number; time: number; type: 'support' | 'resistance'; index: number }>;
    type: 'support' | 'resistance';
  }> {
    const groups = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < swingPoints.length; i++) {
      if (processed.has(i)) continue;
      
      const point = swingPoints[i];
      const group = [point];
      processed.add(i);
      
      // Find similar points
      for (let j = i + 1; j < swingPoints.length; j++) {
        if (processed.has(j)) continue;
        
        const otherPoint = swingPoints[j];
        if (otherPoint.type === point.type && 
            Math.abs(otherPoint.price - point.price) <= tolerance) {
          group.push(otherPoint);
          processed.add(j);
        }
      }
      
      groups.push({
        points: group,
        type: point.type
      });
    }
    
    return groups;
  }
  
  /**
   * Calculate price tolerance based on market volatility
   */
  private calculatePriceTolerance(data: ProcessedKline[], tolerancePercent: number): number {
    const prices = data.map(candle => candle.close);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    return avgPrice * (tolerancePercent / 100);
  }
  
  /**
   * Calculate confidence score for a support/resistance level
   */
  private calculateLevelConfidence(
    points: Array<{ price: number; time: number; type: 'support' | 'resistance'; index: number }>,
    timeframeWeight: number,
    interval: string
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Touch count factor (more touches = higher confidence)
    confidence += Math.min(points.length / 10, 0.3);
    
    // Timeframe weight factor
    confidence += timeframeWeight * 0.2;
    
    // Recency factor (more recent touches = higher confidence)
    const now = Date.now();
    const recentTouches = points.filter(p => now - p.time < 30 * 24 * 60 * 60 * 1000); // Last 30 days
    confidence += (recentTouches.length / points.length) * 0.1;
    
    // Price consistency factor
    const prices = points.map(p => p.price);
    const priceStdDev = this.calculateStandardDeviation(prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceConsistency = 1 - (priceStdDev / avgPrice);
    confidence += priceConsistency * 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Group similar levels across timeframes
   */
  private groupSimilarLevels(
    levels: SupportResistanceLevel[],
    tolerancePercent: number
  ): SupportResistanceLevel[] {
    const grouped: SupportResistanceLevel[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < levels.length; i++) {
      if (processed.has(i)) continue;
      
      const level = levels[i];
      const tolerance = level.price * (tolerancePercent / 100);
      const similarLevels = [level];
      processed.add(i);
      
      // Find similar levels
      for (let j = i + 1; j < levels.length; j++) {
        if (processed.has(j)) continue;
        
        const otherLevel = levels[j];
        if (otherLevel.type === level.type &&
            Math.abs(otherLevel.price - level.price) <= tolerance) {
          similarLevels.push(otherLevel);
          processed.add(j);
        }
      }
      
      if (similarLevels.length > 1) {
        // Merge similar levels
        const avgPrice = similarLevels.reduce((sum, l) => sum + l.price, 0) / similarLevels.length;
        const totalStrength = similarLevels.reduce((sum, l) => sum + l.strength, 0);
        const totalTouchCount = similarLevels.reduce((sum, l) => sum + l.touchCount, 0);
        const allTimeframes = Array.from(new Set(similarLevels.flatMap(l => l.timeframeSupport)));
        const avgConfidence = similarLevels.reduce((sum, l) => sum + l.confidenceScore, 0) / similarLevels.length;
        
        grouped.push({
          price: avgPrice,
          strength: totalStrength,
          touchCount: totalTouchCount,
          timeframeSupport: allTimeframes,
          confidenceScore: avgConfidence * (allTimeframes.length / 4), // Boost for multi-timeframe support
          firstSeen: Math.min(...similarLevels.map(l => l.firstSeen)),
          lastSeen: Math.max(...similarLevels.map(l => l.lastSeen)),
          type: level.type
        });
      } else {
        grouped.push(level);
      }
    }
    
    return grouped;
  }
  
  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('[EnhancedMarketData] Cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, data]) => ({
      key,
      age: now - data.fetchedAt
    }));
    
    return {
      size: this.cache.size,
      entries
    };
  }
}

// Singleton instance
export const enhancedMarketDataService = new EnhancedMarketDataService();