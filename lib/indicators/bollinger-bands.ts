import type { UTCTimestamp } from 'lightweight-charts';
import type { BollingerBandsConfig } from '@/types/market';
import { validatePriceData, handleIndicatorError } from './validation';
import { logger } from '@/lib/utils/logger';
import { BollingerBandsIndicator, getBollingerBandsConfig as _getBollingerBandsConfig } from './bollinger-bands-indicator';

// Lightweight Charts compatibility types
export interface PriceDataLightweight {
  time: UTCTimestamp;
  close: number;
}

export interface BollingerBandsDataLightweight {
  time: UTCTimestamp;
  upper: number;
  middle: number;  // SMA
  lower: number;
}

/**
 * Calculate Bollinger Bands - Optimized O(N) version
 * ボリンジャーバンド = 移動平均 ± (標準偏差 × 係数)
 * 
 * @deprecated Use BollingerBandsIndicator class instead for better performance and consistency
 * @param {PriceDataLightweight[]} data - Array of price data with time and close values
 * @param {number} period - SMA period (typically 20)
 * @param {number} stdDev - Standard deviation multiplier (typically 2)
 * @returns {BollingerBandsDataLightweight[]} Array of Bollinger Bands data points
 */
export function calculateBollingerBands(
  data: PriceDataLightweight[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsDataLightweight[] {
  // Use the new BollingerBandsIndicator class
  const indicator = new BollingerBandsIndicator(period, stdDev);
  return indicator.calculate(data);
}

/**
 * Get Bollinger Bands configuration with colors
 * @param {BollingerBandsConfig} config - Bollinger Bands configuration
 * @returns {Object} Configuration object for chart display
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
 * @param {number} currentPrice - Current price
 * @param {BollingerBandsDataLightweight} bollingerData - Current Bollinger Bands data point
 * @param {BollingerBandsDataLightweight} [prevBollingerData] - Previous Bollinger Bands data point
 * @returns {Object} Trading signal analysis
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
  const { upper, lower } = bollingerData;
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
 * @param {BollingerBandsDataLightweight[]} bollingerData - Array of recent Bollinger Bands data
 * @param {number} lookbackPeriod - Period to compare current width against
 * @returns {Object} Squeeze information
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
  const lastData = recent[recent.length - 1];
  if (!lastData) {
    return {
      isSqueeze: false,
      currentWidth: 0,
      averageWidth: 0,
      ratio: 0,
    };
  }
  const currentWidth = lastData.upper - lastData.lower;
  
  // Calculate average width over lookback period
  let totalWidth = 0;
  for (let i = 0; i < lookbackPeriod; i++) {
    const bbData = recent[i];
    if (bbData) {
      totalWidth += bbData.upper - bbData.lower;
    }
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