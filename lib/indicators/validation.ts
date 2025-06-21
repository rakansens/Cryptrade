/**
 * Indicator Validation Utility
 * 
 * インジケーター計算のための入力データバリデーション
 * - データの完全性チェック
 * - 最小データ要件の検証
 * - NaN/Infinity値の検出
 */

import { logger } from '@/lib/utils/logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface DataValidationOptions {
  minLength: number;
  maxLength?: number;
  allowNaN?: boolean;
  allowInfinity?: boolean;
  checkMonotonic?: boolean;
  customValidator?: (data: any[]) => ValidationResult;
}

/**
 * 価格データの検証
 */
export function validatePriceData(
  data: { time: number; close: number }[],
  options: DataValidationOptions
): ValidationResult {
  const warnings: string[] = [];

  // 空配列チェック
  if (!data || data.length === 0) {
    return {
      valid: false,
      error: 'Data array is empty'
    };
  }

  // 最小長チェック
  if (data.length < options.minLength) {
    return {
      valid: false,
      error: `Insufficient data: ${data.length} points provided, need at least ${options.minLength}`
    };
  }

  // 最大長チェック
  if (options.maxLength && data.length > options.maxLength) {
    return {
      valid: false,
      error: `Too much data: ${data.length} points provided, maximum is ${options.maxLength}`
    };
  }

  // データポイントの検証
  const nanIndices: number[] = [];
  const infinityIndices: number[] = [];
  const negativeIndices: number[] = [];
  const timeSet = new Set<number>();
  let duplicateCount = 0;
  let allowedNaNCount = 0;
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    
    if (!point || typeof point !== 'object') {
      return {
        valid: false,
        error: `Invalid data point at index ${i}: expected object`
      };
    }

    // Time検証
    if (typeof point.time !== 'number' || point.time < 0) {
      return {
        valid: false,
        error: `Invalid time at index ${i}: ${point.time}`
      };
    }

    // Price検証
    if (typeof point.close !== 'number') {
      return {
        valid: false,
        error: `Invalid close price at index ${i}: ${point.close}`
      };
    }

    // NaN チェック
    if (isNaN(point.close)) {
      if (!options.allowNaN) {
        nanIndices.push(i);
      } else {
        allowedNaNCount++;
      }
      continue; // NaN の場合は他のチェックをスキップ
    }

    // Infinity チェック
    if (!isFinite(point.close)) {
      if (!options.allowInfinity) {
        infinityIndices.push(i);
      }
    }

    // 負の価格チェック
    if (point.close < 0) {
      negativeIndices.push(i);
    }
    
    // 重複タイムスタンプチェック
    if (timeSet.has(point.time)) {
      duplicateCount++;
    } else {
      timeSet.add(point.time);
    }
  }
  
  // エラーチェック
  if (nanIndices.length > 0) {
    return {
      valid: false,
      error: `Data contains NaN values at indices: ${nanIndices.join(', ')}`
    };
  }
  
  if (infinityIndices.length > 0) {
    return {
      valid: false,
      error: `Data contains Infinity values at indices: ${infinityIndices.join(', ')}`
    };
  }
  
  // 警告チェック
  if (options.allowNaN && allowedNaNCount > 0) {
    warnings.push(`Data contains ${allowedNaNCount} NaN values`);
  }
  
  if (negativeIndices.length > 0) {
    warnings.push(`Data contains negative values at indices: ${negativeIndices.join(', ')}`);
  }
  
  if (duplicateCount > 0) {
    warnings.push(`Found ${duplicateCount} duplicate timestamps`);
  }

  // 単調性チェック（時間が順序通りか）
  if (options.checkMonotonic) {
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      if (current && previous && current.time <= previous.time) {
        return {
          valid: false,
          error: `Time values are not monotonically increasing`
        };
      }
    }
  }

  // 異常値検出（統計的アプローチ）
  const prices = data.map(d => d.close).filter(p => !isNaN(p) && isFinite(p));
  if (prices.length > 3) {
    // Use median and MAD for more robust outlier detection
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)]!;
    const deviations = sortedPrices.map(p => Math.abs(p - median));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)]!;
    
    // Modified Z-score using median and MAD
    const threshold = 2.5; // Lower threshold for small datasets
    if (mad > 0) {
      for (let i = 0; i < data.length; i++) {
        const price = data[i]!.close;
        if (!isNaN(price) && isFinite(price)) {
          const modifiedZScore = 0.6745 * Math.abs(price - median) / mad;
          if (modifiedZScore > threshold) {
            warnings.push(`Potential outlier detected at index ${i}: ${price.toFixed(2)} (median: ${median.toFixed(2)}, MAD: ${mad.toFixed(2)})`);
          }
        }
      }
    }
  }
  
  // カスタムバリデーター
  if (options.customValidator) {
    const customResult = options.customValidator(data);
    if (!customResult.valid) {
      return customResult;
    }
    if (customResult.warnings) {
      warnings.push(...customResult.warnings);
    }
  }

  if (warnings.length > 0) {
    return { valid: true as const, warnings };
  }
  return { valid: true as const };
}

/**
 * 数値配列の検証
 */
export function validateNumberArray(
  data: number[],
  options: Omit<DataValidationOptions, 'checkMonotonic'>
): ValidationResult {
  const warnings: string[] = [];

  // 空配列チェック
  if (!data || data.length === 0) {
    return {
      valid: false,
      error: 'Data array is empty'
    };
  }

  // 最小長チェック
  if (data.length < options.minLength) {
    return {
      valid: false,
      error: `Insufficient data: ${data.length} values provided, need at least ${options.minLength}`
    };
  }

  // 各値の検証
  const nonNumericIndices: number[] = [];
  const uniqueValues = new Set<number>();
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i];

    if (typeof value !== 'number') {
      nonNumericIndices.push(i);
      continue;
    }

    if (!options.allowNaN && isNaN(value)) {
      return {
        valid: false,
        error: `NaN value detected at index ${i}`
      };
    }

    if (!options.allowInfinity && !isFinite(value)) {
      return {
        valid: false,
        error: `Infinity value detected at index ${i}`
      };
    }
    
    uniqueValues.add(value);
  }
  
  // 非数値エラーチェック
  if (nonNumericIndices.length > 0) {
    return {
      valid: false,
      error: `Array contains non-numeric values at indices: ${nonNumericIndices.join(', ')}`
    };
  }
  
  // 定数値チェック
  if (uniqueValues.size === 1 && data.length > 1) {
    const constantValue = Array.from(uniqueValues)[0];
    warnings.push(`All values are constant (${constantValue})`);
  }

  if (warnings.length > 0) {
    return { valid: true as const, warnings };
  }
  return { valid: true as const };
}

/**
 * インジケーター計算エラーのハンドリング
 */
export function handleIndicatorError(
  indicatorName: string,
  error: unknown,
  fallbackValue?: any
): never | any {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  logger.error(`[${indicatorName}] Calculation failed`, {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined
  });

  // フォールバック値が設定されている場合は返す
  if (fallbackValue !== undefined) {
    logger.warn(`[${indicatorName}] Returning fallback value`, {
      fallback: fallbackValue
    });
    return fallbackValue;
  }

  // 本番環境では詳細なエラーを投げる
  throw new Error(`${indicatorName} calculation failed: ${errorMessage}`);
}

/**
 * 安全なインジケーター計算ラッパー
 */
export async function safeCalculateIndicator<T>(
  indicatorName: string,
  calculateFn: () => T | Promise<T>,
  fallbackValue?: T
): Promise<T> {
  try {
    return await calculateFn();
  } catch (error) {
    return handleIndicatorError(indicatorName, error, fallbackValue);
  }
}

/**
 * Alias for validateNumberArray for backward compatibility
 */
export const validateNumericArray = validateNumberArray;

/**
 * General indicator input validation
 */
export function validateIndicatorInput(
  input: any,
  indicatorName: string,
  options: DataValidationOptions
): ValidationResult {
  const warnings: string[] = [];
  
  // Check if input has data property
  if (!input || typeof input !== 'object' || !input.data) {
    return {
      valid: false,
      error: `Invalid input format for ${indicatorName} indicator`
    };
  }
  
  const { data } = input;
  
  // Basic validation for price data
  const dataValidation = validatePriceData(data, options);
  if (!dataValidation.valid) {
    return dataValidation;
  }
  
  // Merge warnings from data validation
  if (dataValidation.warnings) {
    warnings.push(...dataValidation.warnings);
  }
  
  // Indicator-specific validation
  switch (indicatorName) {
    case 'RSI':
      if (!input.period || input.period <= 0) {
        return {
          valid: false,
          error: 'RSI period must be positive'
        };
      }
      break;
      
    case 'MACD':
      if (!input.fastPeriod || !input.slowPeriod || !input.signalPeriod) {
        return {
          valid: false,
          error: 'MACD requires fastPeriod, slowPeriod, and signalPeriod'
        };
      }
      if (input.fastPeriod >= input.slowPeriod) {
        return {
          valid: false,
          error: 'MACD fast period must be less than slow period'
        };
      }
      if (data.length < input.slowPeriod + input.signalPeriod) {
        return {
          valid: false,
          error: `Insufficient data for MACD: need at least ${input.slowPeriod + input.signalPeriod} points`
        };
      }
      break;
      
    case 'BollingerBands':
      if (!input.period || input.period <= 0) {
        return {
          valid: false,
          error: 'Bollinger Bands period must be positive'
        };
      }
      if (input.stdDev !== undefined && input.stdDev <= 0) {
        return {
          valid: false,
          error: 'Standard deviation must be positive'
        };
      }
      break;
      
    case 'SMA':
    case 'EMA':
      if (!input.period || input.period <= 0) {
        return {
          valid: false,
          error: `${indicatorName} period must be positive`
        };
      }
      break;
      
    default:
      return {
        valid: false,
        error: `Unknown indicator: ${indicatorName}`
      };
  }
  
  if (warnings.length > 0) {
    return { valid: true, warnings };
  }
  return { valid: true };
}