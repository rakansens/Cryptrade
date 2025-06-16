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
    warnings.push(`Data exceeds maximum length: ${data.length} > ${options.maxLength}`);
  }

  // データポイントの検証
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    
    if (!point || typeof point !== 'object') {
      return {
        valid: false,
        error: `Invalid data point at index ${i}: expected object`
      };
    }

    // Time検証
    if (typeof point.time !== 'number' || point.time <= 0) {
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
    if (!options.allowNaN && isNaN(point.close)) {
      return {
        valid: false,
        error: `NaN value detected at index ${i}`
      };
    }

    // Infinity チェック
    if (!options.allowInfinity && !isFinite(point.close)) {
      return {
        valid: false,
        error: `Infinity value detected at index ${i}`
      };
    }

    // 負の価格チェック
    if (point.close < 0) {
      warnings.push(`Negative price at index ${i}: ${point.close}`);
    }
  }

  // 単調性チェック（時間が順序通りか）
  if (options.checkMonotonic) {
    for (let i = 1; i < data.length; i++) {
      if (data[i].time <= data[i - 1].time) {
        return {
          valid: false,
          error: `Time series is not monotonically increasing at index ${i}`
        };
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

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
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
  for (let i = 0; i < data.length; i++) {
    const value = data[i];

    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `Invalid value at index ${i}: expected number, got ${typeof value}`
      };
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
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
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
  data: any,
  indicatorName: string,
  options: DataValidationOptions
): ValidationResult {
  // If it's a price data array with time and close
  if (Array.isArray(data) && data.length > 0 && 
      data[0] && typeof data[0] === 'object' && 
      'time' in data[0] && 'close' in data[0]) {
    return validatePriceData(data as { time: number; close: number }[], options);
  }
  
  // If it's a simple number array
  if (Array.isArray(data) && data.every(item => typeof item === 'number' || item === null || item === undefined)) {
    return validateNumberArray(data.filter(item => item !== null && item !== undefined) as number[], options);
  }
  
  return {
    valid: false,
    error: `Invalid input data format for ${indicatorName} indicator`
  };
}