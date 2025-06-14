/**
 * Pattern Renderer Adapter
 * 
 * 既存のPatternRendererから新しいPatternRendererCoreへの移行用アダプター
 * 破壊的変更を最小化しながら段階的に新しいアーキテクチャに移行
 */

import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { PatternRendererCore } from './PatternRendererCore';
import { PatternRenderer } from './pattern-renderer';
import { logger } from '@/lib/utils/logger';

/**
 * アダプタークラス - 既存のAPIを維持しながら内部で新しいCoreを使用
 */
export class PatternRendererAdapter {
  private core: PatternRendererCore;
  private legacy: PatternRenderer;
  private useNewCore: boolean;
  
  constructor(
    chart: IChartApi, 
    mainSeries: ISeriesApi<SeriesType>,
    options: {
      useNewCore?: boolean;
      fallbackToLegacy?: boolean;
    } = {}
  ) {
    this.useNewCore = options.useNewCore ?? false;
    
    // 新しいCoreインスタンスを作成
    this.core = new PatternRendererCore(chart, mainSeries);
    
    // フォールバック用にレガシーインスタンスも作成
    if (options.fallbackToLegacy !== false) {
      this.legacy = new PatternRenderer(chart, mainSeries);
    } else {
      this.legacy = null!;
    }
    
    logger.info('[PatternRendererAdapter] Created adapter', {
      useNewCore: this.useNewCore,
      hasFallback: !!this.legacy,
    });
  }
  
  /**
   * パターンをレンダリング（既存APIとの互換性）
   */
  renderPattern(
    id: string,
    visualization: PatternVisualization,
    patternType: string,
    metrics?: {
      target_level?: number;
      stop_loss?: number;
      breakout_level?: number;
    }
  ): void {
    if (this.useNewCore) {
      // 新しいCoreを使用（非同期だが、既存APIとの互換性のためawaitしない）
      this.core.renderPattern(id, visualization, patternType, metrics)
        .catch(error => {
          logger.error('[PatternRendererAdapter] Core render failed', {
            id,
            patternType,
            error: String(error),
          });
          
          // フォールバックが利用可能な場合は試行
          if (this.legacy) {
            logger.info('[PatternRendererAdapter] Falling back to legacy renderer');
            try {
              this.legacy.renderPattern(id, visualization, patternType, metrics);
            } catch (legacyError) {
              logger.error('[PatternRendererAdapter] Legacy fallback also failed', {
                id,
                error: String(legacyError),
              });
            }
          }
        });
    } else {
      // レガシーレンダラーを使用
      if (this.legacy) {
        this.legacy.renderPattern(id, visualization, patternType, metrics);
      } else {
        logger.error('[PatternRendererAdapter] No legacy renderer available');
      }
    }
  }
  
  /**
   * パターンを削除（既存APIとの互換性）
   */
  removePattern(id: string): void {
    if (this.useNewCore) {
      // 新しいCoreを使用
      this.core.removePattern(id).catch(error => {
        logger.error('[PatternRendererAdapter] Core remove failed', {
          id,
          error: String(error),
        });
        
        // フォールバックが利用可能な場合は試行
        if (this.legacy) {
          logger.info('[PatternRendererAdapter] Falling back to legacy renderer for removal');
          try {
            this.legacy.removePattern(id);
          } catch (legacyError) {
            logger.error('[PatternRendererAdapter] Legacy remove fallback also failed', {
              id,
              error: String(legacyError),
            });
          }
        }
      });
    } else {
      // レガシーレンダラーを使用
      if (this.legacy) {
        this.legacy.removePattern(id);
      }
    }
  }
  
  /**
   * 新しいCoreに切り替え
   */
  switchToNewCore(): void {
    if (!this.useNewCore) {
      this.useNewCore = true;
      logger.info('[PatternRendererAdapter] Switched to new core');
    }
  }
  
  /**
   * レガシーレンダラーに切り替え
   */
  switchToLegacy(): void {
    if (this.useNewCore && this.legacy) {
      this.useNewCore = false;
      logger.info('[PatternRendererAdapter] Switched to legacy renderer');
    }
  }
  
  /**
   * デバッグ用状態取得（既存APIとの互換性）
   */
  debugGetState() {
    if (this.useNewCore) {
      return this.core.getDebugState();
    } else if (this.legacy) {
      return this.legacy.debugGetState();
    }
    return null;
  }
  
  /**
   * デバッグ用メトリックライン全削除（既存APIとの互換性）
   */
  debugRemoveAllMetricLines(): void {
    if (this.useNewCore) {
      this.core.debugRemoveAllMetricLines();
    } else if (this.legacy) {
      this.legacy.debugRemoveAllMetricLines();
    }
  }
  
  /**
   * 古いパターンのクリーンアップ（新機能）
   */
  cleanupOldPatterns(maxAgeMs: number = 300000): number {
    if (this.useNewCore) {
      return this.core.cleanupOldPatterns(maxAgeMs);
    }
    return 0;
  }
  
  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    logger.info('[PatternRendererAdapter] Disposing adapter');
    
    // 新しいCoreのクリーンアップ
    this.core.dispose().catch(error => {
      logger.error('[PatternRendererAdapter] Failed to dispose core', {
        error: String(error),
      });
    });
    
    // レガシーレンダラーには明示的なdisposeメソッドがないため、
    // デバッグ用の全削除を実行
    if (this.legacy) {
      try {
        this.legacy.debugRemoveAllMetricLines();
      } catch (error) {
        logger.warn('[PatternRendererAdapter] Failed to clean legacy renderer', {
          error: String(error),
        });
      }
    }
  }
  
  /**
   * 新しいCoreインスタンスへの直接アクセス（高度な使用例）
   */
  getCore(): PatternRendererCore {
    return this.core;
  }
  
  /**
   * レガシーインスタンスへの直接アクセス（互換性のため）
   */
  getLegacy(): PatternRenderer | null {
    return this.legacy;
  }
  
  /**
   * 現在使用中のレンダラーの種類を取得
   */
  getCurrentRenderer(): 'core' | 'legacy' {
    return this.useNewCore ? 'core' : 'legacy';
  }
}

/**
 * 環境変数やフィーチャーフラグに基づいて自動的にレンダラーを選択するファクトリー
 */
export function createPatternRendererWithAutoSelection(
  chart: IChartApi, 
  mainSeries: ISeriesApi<SeriesType>
): PatternRendererAdapter {
  // 環境変数またはフィーチャーフラグでの制御
  const useNewCore = process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER === 'true' ||
                     (typeof window !== 'undefined' && 
                      (window as unknown as { __debugUseNewPatternRenderer?: boolean }).__debugUseNewPatternRenderer === true);
  
  const adapter = new PatternRendererAdapter(chart, mainSeries, {
    useNewCore,
    fallbackToLegacy: true,
  });
  
  logger.info('[PatternRendererFactory] Created auto-selected renderer', {
    selectedRenderer: adapter.getCurrentRenderer(),
    basedOnEnv: process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER,
    basedOnDebug: (typeof window !== 'undefined' && 
                   (window as unknown as { __debugUseNewPatternRenderer?: boolean }).__debugUseNewPatternRenderer),
  });
  
  return adapter;
}

/**
 * デバッグ用: ランタイムでレンダラーを切り替えるヘルパー
 */
export function enableNewPatternRenderer() {
  if (typeof window !== 'undefined') {
    (window as unknown as { __debugUseNewPatternRenderer?: boolean }).__debugUseNewPatternRenderer = true;
    logger.info('[PatternRendererAdapter] New pattern renderer enabled globally');
  }
}

export function disableNewPatternRenderer() {
  if (typeof window !== 'undefined') {
    (window as unknown as { __debugUseNewPatternRenderer?: boolean }).__debugUseNewPatternRenderer = false;
    logger.info('[PatternRendererAdapter] New pattern renderer disabled globally');
  }
}