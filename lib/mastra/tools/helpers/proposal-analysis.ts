import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import { binanceAPI } from '@/lib/binance/api-service';

// Candlestick pattern types
export type CandlePattern = 
  | 'pin_bar'
  | 'engulfing'
  | 'doji'
  | 'hammer'
  | 'shooting_star'
  | 'morning_star'
  | 'evening_star';

// Multi-timeframe analysis
export async function analyzeMultipleTimeframes(
  symbol: string,
  currentInterval: string,
  data: CandlestickData[]
): Promise<{
  higherTimeframes: string[];
  confluence: number;
  confirmations: Map<string, boolean>;
}> {
  const timeframeHierarchy: Record<string, string[]> = {
    '1m': ['5m', '15m', '1h'],
    '5m': ['15m', '1h', '4h'],
    '15m': ['1h', '4h', '1d'],
    '30m': ['1h', '4h', '1d'],
    '1h': ['4h', '1d', '1w'],
    '4h': ['1d', '1w'],
    '1d': ['1w', '1M'],
  };

  const higherTimeframes = timeframeHierarchy[currentInterval] || [];
  const confirmations = new Map<string, boolean>();
  let confirmedCount = 0;

  // Analyze each higher timeframe
  for (const tf of higherTimeframes) {
    try {
      const higherData = await binanceAPI.fetchKlines(symbol, tf, 100);
      if (higherData && higherData.length > 0) {
        // Check if the current trend is confirmed on higher timeframe
        const isConfirmed = confirmTrendOnTimeframe(data, higherData);
        confirmations.set(tf, isConfirmed);
        if (isConfirmed) confirmedCount++;
      }
    } catch (error) {
      logger.warn(`Failed to fetch ${tf} data for multi-timeframe analysis`, error);
    }
  }

  const confluence = higherTimeframes.length > 0 
    ? confirmedCount / higherTimeframes.length 
    : 0;

  return {
    higherTimeframes,
    confluence,
    confirmations,
  };
}

// Check if trend is confirmed on a different timeframe
function confirmTrendOnTimeframe(
  currentData: CandlestickData[],
  higherData: Array<{
    time?: number;
    openTime?: number;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>
): boolean {
  if (currentData.length < 2 || higherData.length < 2) return false;

  // Calculate trend direction on both timeframes
  const currentTrend = calculateTrendDirection(currentData);
  const higherTrend = calculateTrendDirection(
    higherData.map(k => ({
      time: 'time' in k ? k.time : Math.floor(k.openTime / 1000),
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
      volume: parseFloat(k.volume),
    }))
  );

  // Trends should align
  return currentTrend === higherTrend && currentTrend !== 'sideways';
}

// Calculate trend direction
function calculateTrendDirection(data: CandlestickData[]): 'up' | 'down' | 'sideways' {
  if (data.length < 20) return 'sideways';

  const firstQuarter = data.slice(0, Math.floor(data.length / 4));
  const lastQuarter = data.slice(-Math.floor(data.length / 4));

  const firstAvg = firstQuarter.reduce((sum, d) => sum + d.close, 0) / firstQuarter.length;
  const lastAvg = lastQuarter.reduce((sum, d) => sum + d.close, 0) / lastQuarter.length;

  const change = (lastAvg - firstAvg) / firstAvg;

  if (change > 0.02) return 'up';
  if (change < -0.02) return 'down';
  return 'sideways';
}

// Volume-weighted peak detection
export function findVolumeWeightedPeaks(
  data: CandlestickData[],
  type: 'high' | 'low',
  windowSize: number = 10
): Array<{
  index: number;
  price: number;
  volume: number;
  volumeWeight: number;
}> {
  const peaks: Array<{
    index: number;
    price: number;
    volume: number;
    volumeWeight: number;
  }> = [];

  // Calculate average volume
  const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;

  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i][type];
    let isPeak = true;

    // Check if it's a peak
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i) {
        if (type === 'high' && data[j].high >= current) {
          isPeak = false;
          break;
        }
        if (type === 'low' && data[j].low <= current) {
          isPeak = false;
          break;
        }
      }
    }

    if (isPeak) {
      const volumeWeight = data[i].volume / avgVolume;
      peaks.push({
        index: i,
        price: current,
        volume: data[i].volume,
        volumeWeight,
      });
    }
  }

  // Sort by volume weight
  return peaks.sort((a, b) => b.volumeWeight - a.volumeWeight);
}

// Detect candlestick patterns
export function detectCandlePatterns(
  data: CandlestickData[],
  index: number
): CandlePattern[] {
  const patterns: CandlePattern[] = [];
  
  if (index < 2 || index >= data.length) return patterns;

  const curr = data[index];
  const prev = data[index - 1];
  const prev2 = index >= 2 ? data[index - 2] : null;

  // Calculate body and wick sizes
  const body = Math.abs(curr.close - curr.open);
  const upperWick = curr.high - Math.max(curr.close, curr.open);
  const lowerWick = Math.min(curr.close, curr.open) - curr.low;
  const totalRange = curr.high - curr.low;

  // Pin bar detection
  if (lowerWick > body * 2 && upperWick < body * 0.5) {
    patterns.push('pin_bar');
  }

  // Shooting star
  if (upperWick > body * 2 && lowerWick < body * 0.5) {
    patterns.push('shooting_star');
  }

  // Doji
  if (body < totalRange * 0.1) {
    patterns.push('doji');
  }

  // Bullish engulfing
  if (prev.close < prev.open && // Previous is bearish
      curr.close > curr.open && // Current is bullish
      curr.open <= prev.close && // Opens at or below previous close
      curr.close > prev.open) { // Closes above previous open
    patterns.push('engulfing');
  }

  // Hammer
  if (lowerWick >= body * 2 && 
      upperWick < body * 0.3 &&
      curr.close > curr.open) {
    patterns.push('hammer');
  }

  return patterns;
}

// Calculate volume profile for support/resistance
export function calculateVolumeProfile(
  data: CandlestickData[],
  bins: number = 20
): Array<{
  priceLevel: number;
  volume: number;
  percentage: number;
}> {
  if (data.length === 0) return [];

  // Find price range
  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const binSize = (maxPrice - minPrice) / bins;

  // Initialize volume bins
  const volumeProfile = new Array(bins).fill(0);

  // Accumulate volume in each price bin
  data.forEach(candle => {
    // Distribute volume across the candle's range
    const lowBin = Math.floor((candle.low - minPrice) / binSize);
    const highBin = Math.floor((candle.high - minPrice) / binSize);

    for (let bin = lowBin; bin <= highBin && bin < bins; bin++) {
      if (bin >= 0) {
        // Distribute volume proportionally
        volumeProfile[bin] += candle.volume / (highBin - lowBin + 1);
      }
    }
  });

  const totalVolume = volumeProfile.reduce((sum, v) => sum + v, 0);

  return volumeProfile.map((volume, i) => ({
    priceLevel: minPrice + (i + 0.5) * binSize,
    volume,
    percentage: (volume / totalVolume) * 100,
  }));
}

// Statistical analysis helpers
export function calculateLinearRegression(
  points: Array<{ x: number; y: number }>
): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  // Calculate sums
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

  // Calculate slope and intercept
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
  const ssResidual = points.reduce((sum, p) => {
    const yPred = slope * p.x + intercept;
    return sum + Math.pow(p.y - yPred, 2);
  }, 0);

  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

// Calculate standard deviation
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDifferences = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDifferences.reduce((sum, v) => sum + v, 0) / values.length;
  
  return Math.sqrt(variance);
}

// Filter outliers using standard deviation
export function filterOutliers(
  values: number[],
  threshold: number = 2
): {
  filtered: number[];
  outliers: number[];
} {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = calculateStandardDeviation(values);

  const filtered: number[] = [];
  const outliers: number[] = [];

  values.forEach(value => {
    if (Math.abs(value - mean) <= threshold * stdDev) {
      filtered.push(value);
    } else {
      outliers.push(value);
    }
  });

  return { filtered, outliers };
}

// Calculate ATR for dynamic tolerance
export function calculateATR(data: CandlestickData[], period: number = 14): number {
  if (data.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Calculate ATR as SMA of true ranges
  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
}

// Detect market condition (trending vs ranging)
export function detectMarketCondition(
  data: CandlestickData[]
): 'trending' | 'ranging' {
  if (data.length < 20) return 'ranging';

  // Calculate ADX or use simple trend strength
  const prices = data.map(d => d.close);
  const priceChanges = prices.slice(1).map((p, i) => p - prices[i]);
  
  // Calculate directional movement
  let positiveMoves = 0;
  let negativeMoves = 0;

  priceChanges.forEach(change => {
    if (change > 0) positiveMoves++;
    else if (change < 0) negativeMoves++;
  });

  const trendStrength = Math.abs(positiveMoves - negativeMoves) / priceChanges.length;

  // If moves are balanced, market is ranging
  return trendStrength > 0.3 ? 'trending' : 'ranging';
}

// Enhanced confidence calculation
export function calculateEnhancedConfidence(
  factors: {
    touchPoints: number;
    volumeWeight: number;
    timeframeConfluence: number;
    patternConfirmation: number;
    statisticalFit: number;
  }
): number {
  // Weight each factor
  const weights = {
    touchPoints: 0.25,
    volumeWeight: 0.20,
    timeframeConfluence: 0.20,
    patternConfirmation: 0.15,
    statisticalFit: 0.20,
  };

  // Calculate weighted sum
  const weightedSum = 
    factors.touchPoints * weights.touchPoints +
    factors.volumeWeight * weights.volumeWeight +
    factors.timeframeConfluence * weights.timeframeConfluence +
    factors.patternConfirmation * weights.patternConfirmation +
    factors.statisticalFit * weights.statisticalFit;

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, weightedSum));
}