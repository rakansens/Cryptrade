import { logger } from '@/lib/utils/logger';
import { validatePriceData, handleIndicatorError, type DataValidationOptions } from './validation';
import type { PriceDataLightweight, ValidationOptions } from './types';

/**
 * 指標計算の基底クラス（抽象クラス）
 * 
 * 共通の機能を提供：
 * - 入力データのバリデーション
 * - エラーハンドリング
 * - ロギング
 * - テンプレートメソッドパターン
 */
export abstract class BaseIndicator<T> {
  protected readonly indicatorName: string;
  protected readonly defaultOptions: ValidationOptions;

  constructor(indicatorName: string, defaultOptions: ValidationOptions) {
    this.indicatorName = indicatorName;
    this.defaultOptions = {
      minLength: 1,
      checkMonotonic: false,
      allowNaN: false,
      allowInfinity: false,
      ...defaultOptions
    };
  }

  /**
   * 指標を計算する（テンプレートメソッド）
   */
  public calculate(data: PriceDataLightweight[]): T[] {
    try {
      // 1. 入力データの検証
      const validation = this.validateInput(data, this.defaultOptions);
      if (!validation.valid) {
        return this.handleError(new Error(validation.error!));
      }

      // 2. 警告の処理
      if (validation.warnings) {
        this.logWarnings(validation.warnings);
      }

      // 3. 実際の計算（サブクラスで実装）
      return this.calculateCore(validation.data || data);

    } catch (error) {
      return this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 抽象メソッド：実際の指標計算
   * サブクラスで必ず実装する必要がある
   */
  protected abstract calculateCore(data: PriceDataLightweight[]): T[];

  /**
   * 入力データの検証
   */
  protected validateInput(data: PriceDataLightweight[], options: ValidationOptions) {
    // 既存のvalidatePriceDataとの互換性のため、型を変換
    const compatibleData = data.map(d => ({
      time: Number(d.time),
      close: d.close
    }));

    const compatibleOptions: DataValidationOptions = {
      minLength: options.minLength,
      maxLength: options.maxLength,
      checkMonotonic: options.checkMonotonic,
      allowNaN: options.allowNaN,
      allowInfinity: options.allowInfinity,
      customValidator: options.customValidator
    };

    return validatePriceData(compatibleData, compatibleOptions);
  }

  /**
   * エラーハンドリング
   */
  protected handleError(error: Error): T[] {
    return handleIndicatorError(this.indicatorName, error, [] as T[]);
  }

  /**
   * 警告のログ出力
   */
  protected logWarnings(warnings: string[]): void {
    warnings.forEach(warning => {
      logger.warn(`[${this.indicatorName}] ${warning}`);
    });
  }

  /**
   * 指標名の取得
   */
  public getIndicatorName(): string {
    return this.indicatorName;
  }
}