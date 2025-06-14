import type { UTCTimestamp } from 'lightweight-charts';
import type { BollingerBandsData, BollingerBandsConfig } from '@/types/market';

// Lightweight Charts compatibility types
interface PriceDataLightweight {
  time: UTCTimestamp;
  close: number;
}

interface BollingerBandsDataLightweight {
  time: UTCTimestamp;
  upper: number;
  middle: number;  // SMA
  lower: number;
}

/**
 * Calculate Bollinger Bands - Optimized O(N) version
 * ボリンジャーバンド = 移動平均 ± (標準偏差 × 係数)
 * 
 * @param data Array of price data with time and close values
 * @param period SMA period (typically 20)
 * @param stdDev Standard deviation multiplier (typically 2)
 * @returns Array of Bollinger Bands data points
 */
export function calculateBollingerBands(
  data: PriceDataLightweight[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsDataLightweight[] {
  if (data.length < period) {
    return [];
  }

  const result: BollingerBandsDataLightweight[] = [];

  // Initialize first window sums
  let sum = 0;
  let sumSquares = 0;
  
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
    sumSquares += data[i].close * data[i].close;
  }

  // Calculate first point
  const firstSma = sum / period;
  const firstVariance = (sumSquares / period) - (firstSma * firstSma);
  const firstStdDev = Math.sqrt(firstVariance);
  
  result.push({
    time: data[period - 1].time,
    upper: firstSma + (firstStdDev * stdDev),
    middle: firstSma,
    lower: firstSma - (firstStdDev * stdDev),
  });

  // Use sliding window for remaining values (O(N) complexity)
  for (let i = period; i < data.length; i++) {
    // Update sliding window sums
    const oldValue = data[i - period].close;
    const newValue = data[i].close;
    
    sum = sum - oldValue + newValue;
    sumSquares = sumSquares - (oldValue * oldValue) + (newValue * newValue);
    
    // Calculate SMA and standard deviation
    const sma = sum / period;
    const variance = (sumSquares / period) - (sma * sma);
    const standardDeviation = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
    });
  }

  return result;
}

/**
 * Get Bollinger Bands configuration with colors
 * @param config Bollinger Bands configuration
 * @returns Configuration object for chart display
 */
export function getBollingerBandsConfig(config: BollingerBandsConfig) {
  return {
    period: config.period,
    stdDev: config.stdDev,
    colors: {
      upper: '#2962ff',    // Blue for upper band
      middle: '#ff9800',   // Orange for middle line (SMA)
      lower: '#2962ff',    // Blue for lower band
    },
    lineWidth: 1,
    titles: {
      upper: `BB Upper(${config.period}, ${config.stdDev})`,
      middle: `BB Middle(${config.period})`,
      lower: `BB Lower(${config.period}, ${config.stdDev})`,
    },
  };
}

/**
 * Get trading signals from Bollinger Bands
 * @param currentPrice Current price
 * @param bollingerData Current Bollinger Bands data point
 * @param prevBollingerData Previous Bollinger Bands data point
 * @returns Trading signal analysis
 */
export function getBollingerSignal(
  currentPrice: number,
  bollingerData: BollingerBandsDataLightweight,
  prevBollingerData?: BollingerBandsDataLightweight
): {
  position: 'overbought' | 'oversold' | 'normal';
  signal: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-1, proximity to bands
} {
  const { upper, middle, lower } = bollingerData;
  const bandWidth = upper - lower;
  const pricePosition = (currentPrice - lower) / bandWidth;

  let position: 'overbought' | 'oversold' | 'normal' = 'normal';
  let signal: 'buy' | 'sell' | 'neutral' = 'neutral';

  // Determine position relative to bands
  if (currentPrice >= upper) {
    position = 'overbought';
  } else if (currentPrice <= lower) {
    position = 'oversold';
  }

  // Generate signals based on band touches and previous data
  if (prevBollingerData) {
    const prevPrice = currentPrice; // This would be passed separately in real usage
    
    // Bollinger Bounce strategy
    if (currentPrice <= lower && prevPrice > prevBollingerData.lower) {
      signal = 'buy'; // Price touched lower band
    } else if (currentPrice >= upper && prevPrice < prevBollingerData.upper) {
      signal = 'sell'; // Price touched upper band
    }
  }

  return {
    position,
    signal,
    strength: Math.abs(pricePosition - 0.5) * 2, // 0 = middle, 1 = at bands
  };
}

/**
 * Calculate Bollinger Band squeeze detection
 * Squeeze occurs when bands are unusually narrow, indicating low volatility
 * @param bollingerData Array of recent Bollinger Bands data
 * @param lookbackPeriod Period to compare current width against
 * @returns Squeeze information
 */
export function detectBollingerSqueeze(
  bollingerData: BollingerBandsDataLightweight[],
  lookbackPeriod: number = 20
): {
  isSqueeze: boolean;
  currentWidth: number;
  averageWidth: number;
  ratio: number;
} {
  if (bollingerData.length < lookbackPeriod + 1) {
    return {
      isSqueeze: false,
      currentWidth: 0,
      averageWidth: 0,
      ratio: 0,
    };
  }

  const recent = bollingerData.slice(-lookbackPeriod - 1);
  const currentWidth = recent[recent.length - 1].upper - recent[recent.length - 1].lower;
  
  // Calculate average width over lookback period
  let totalWidth = 0;
  for (let i = 0; i < lookbackPeriod; i++) {
    totalWidth += recent[i].upper - recent[i].lower;
  }
  const averageWidth = totalWidth / lookbackPeriod;
  
  const ratio = currentWidth / averageWidth;
  
  return {
    isSqueeze: ratio < 0.8, // Squeeze when current width is 80% of average
    currentWidth,
    averageWidth,
    ratio,
  };
}