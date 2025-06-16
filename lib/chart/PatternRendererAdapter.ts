/**
 * Updated: Pattern Renderer Adapter - 環境変数の型安全なアクセスを実装
 * 
 * 既存のPatternRendererから新しいPatternRendererCoreへの移行用アダプター
 * 破壊的変更を最小化しながら段階的に新しいアーキテクチャに移行
 */

import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import type { PatternRenderer as IPatternRenderer, PatternRendererState, PatternRenderVisualization, PatternMetrics, RenderedPattern } from '@/types/pattern.types';
import { PatternRendererCore } from './PatternRendererCore';
import { PatternRenderer } from './pattern-renderer';
import { env } from '@/config/env';
import { logger } from '@/lib/utils/logger';

/**
 * アダプタークラス - 既存のAPIを維持しながら内部で新しいCoreを使用
 */
export class PatternRendererAdapter implements IPatternRenderer {
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
    visualization: PatternRenderVisualization,
    patternType: string,
    metrics?: PatternMetrics
  ): void {
    if (this.useNewCore) {
      // PatternRenderVisualization を PatternVisualization に変換
      const coreVisualization: PatternVisualization = this.convertVisualization(visualization);
      
      // Convert PatternMetrics to core format if needed
      const coreMetrics: PatternMetrics | undefined = metrics ? { ...metrics } : undefined;
      
      // 新しいCoreを使用（非同期だが、既存APIとの互換性のためawaitしない）
      this.core.renderPattern(id, coreVisualization, patternType, coreMetrics)
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
              const legacyVisualization = this.convertVisualization(visualization);
              const legacyMetrics = metrics ? { ...metrics } : undefined;
              this.legacy.renderPattern(id, legacyVisualization, patternType, legacyMetrics);
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
        const legacyVisualization = this.convertVisualization(visualization);
        const legacyMetrics: PatternMetrics | undefined = metrics ? {
          targetLevel: metrics.targetLevel,
          stopLoss: metrics.stopLoss,
          breakoutLevel: metrics.breakoutLevel,
        } as PatternMetrics : undefined;
        this.legacy.renderPattern(id, legacyVisualization, patternType, legacyMetrics);
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
   * すべてのパターンを削除
   */
  removeAllPatterns(): void {
    if (this.useNewCore) {
      // Core doesn't have removeAllPatterns, so remove each pattern individually
      const state = this.core.getDebugState();
      if (state && state.registryState && state.registryState.patterns) {
        state.registryState.patterns.forEach((patternId: string) => {
          this.core.removePattern(patternId).catch(error => {
            logger.error('[PatternRendererAdapter] Failed to remove pattern', { id: patternId, error });
          });
        });
      }
    } else if (this.legacy && 'removeAllPatterns' in this.legacy) {
      const legacyWithRemoveAll = this.legacy as PatternRenderer & { removeAllPatterns(): void };
      legacyWithRemoveAll.removeAllPatterns();
    }
  }

  /**
   * タイムスケールを更新
   */
  updateTimeScale(timeScale: unknown): void {
    if (this.legacy && 'updateTimeScale' in this.legacy) {
      const legacyWithTimeScale = this.legacy as PatternRenderer & { updateTimeScale(timeScale: unknown): void };
      legacyWithTimeScale.updateTimeScale(timeScale);
    }
    // Core doesn't need timeScale updates
  }

  /**
   * デバッグ用状態取得（既存APIとの互換性）
   */
  debugGetState(): PatternRendererState {
    if (this.useNewCore) {
      const coreState = this.core.getDebugState();
      // Convert core state to PatternRendererState format
      const patterns = new Map<string, RenderedPattern>();
      if (coreState.registryState && coreState.registryState.patterns) {
        coreState.registryState.patterns.forEach((patternId: string) => {
          patterns.set(patternId, {
            id: patternId,
            type: 'unknown',
            lines: [] as string[],
            markers: [] as string[],
            metricLines: [] as string[]
          });
        });
      }
      return {
        patterns: patterns as Map<string, RenderedPattern>,
        metricLinesDetails: coreState.registryState?.metrics?.map((m: { id: string; seriesCount?: number }) => ({
          id: m.id,
          lineCount: m.seriesCount || 0
        })) || []
      };
    } else if (this.legacy) {
      const legacyState = this.legacy.debugGetState() as {
        patternSeries?: string[];
        markers?: unknown[];
        metricLines?: unknown[];
        metricLinesDetails?: Array<{ id: string; lineCount: number }>;
      };
      // Convert legacy state to PatternRendererState format
      const patterns = new Map<string, RenderedPattern>();
      if (legacyState.patternSeries) {
        legacyState.patternSeries.forEach((patternId: string) => {
          patterns.set(patternId, {
            id: patternId,
            type: 'unknown',
            lines: [] as string[],
            markers: (legacyState.markers || []) as string[],
            metricLines: (legacyState.metricLines || []) as string[]
          });
        });
      }
      return {
        patterns: patterns as Map<string, RenderedPattern>,
        metricLinesDetails: legacyState.metricLinesDetails || []
      };
    }
    return {
      patterns: new Map(),
      metricLinesDetails: []
    };
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
   * PatternRenderVisualization を PatternVisualization に変換
   */
  private convertVisualization(renderViz: PatternRenderVisualization): PatternVisualization {
    // PatternRenderVisualization has: type, points, lines?, channels?, labels?
    // PatternVisualization has: keyPoints, lines?, areas?, labels?
    
    const keyPoints = renderViz.points.map((point, _index) => ({
      time: point.time,
      value: point.value,
      type: (point.type === 'high' || point.type === 'low' ? 
        (point.type === 'high' ? 'peak' : 'trough') : 
        'peak') as 'peak' | 'trough' | 'neckline' | 'breakout' | 'target',
      label: undefined
    }));
    
    const lines = renderViz.lines?.map((line, _index) => ({
      from: renderViz.points.findIndex(p => p.time === line.point1.time && p.value === line.point1.value),
      to: renderViz.points.findIndex(p => p.time === line.point2.time && p.value === line.point2.value),
      type: 'outline' as const,
      style: line.width || line.color || line.style ? {
        color: line.color,
        lineWidth: line.width as number | undefined,
        lineStyle: (typeof line.style === 'number' ? 
          (line.style === 0 ? 'solid' : line.style === 1 ? 'dotted' : 'dashed') : 
          line.style) as 'solid' | 'dashed' | 'dotted' | undefined
      } : undefined
    })).filter(line => line.from >= 0 && line.to >= 0);
    
    const areas = renderViz.channels?.map(channel => {
      // Convert channel to area by finding the points that form it
      const upperPoints = [
        renderViz.points.findIndex(p => p.time === channel.upperLine.point1.time && p.value === channel.upperLine.point1.value),
        renderViz.points.findIndex(p => p.time === channel.upperLine.point2.time && p.value === channel.upperLine.point2.value)
      ];
      const lowerPoints = [
        renderViz.points.findIndex(p => p.time === channel.lowerLine.point1.time && p.value === channel.lowerLine.point1.value),
        renderViz.points.findIndex(p => p.time === channel.lowerLine.point2.time && p.value === channel.lowerLine.point2.value)
      ];
      
      return {
        points: [...upperPoints, ...lowerPoints.reverse()].filter(i => i >= 0),
        style: channel.fillColor || channel.fillOpacity ? {
          fillColor: channel.fillColor,
          opacity: channel.fillOpacity
        } : undefined
      };
    }).filter(area => area.points.length >= 3);
    
    const labels = renderViz.labels?.map(label => {
      const pointIndex = renderViz.points.findIndex(p => p.time === label.point.time && p.value === label.point.value);
      return {
        point: pointIndex,
        text: label.text,
        position: 'above' as const
      };
    }).filter(label => label.point >= 0);
    
    return {
      keyPoints,
      lines,
      areas,
      labels
    };
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
  interface WindowWithDebugFlag extends Window {
    __debugUseNewPatternRenderer?: boolean;
  }
  
  const useNewCore = env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER ||
                     (typeof window !== 'undefined' &&
                      (window as WindowWithDebugFlag).__debugUseNewPatternRenderer === true);
  
  const adapter = new PatternRendererAdapter(chart, mainSeries, {
    useNewCore,
    fallbackToLegacy: true,
  });
  
  logger.info('[PatternRendererFactory] Created auto-selected renderer', {
    selectedRenderer: adapter.getCurrentRenderer(),
    basedOnEnv: env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER,
    basedOnDebug: (typeof window !== 'undefined' && 
                   (window as WindowWithDebugFlag).__debugUseNewPatternRenderer),
  });
  
  return adapter;
}

/**
 * デバッグ用: ランタイムでレンダラーを切り替えるヘルパー
 */
export function enableNewPatternRenderer() {
  interface WindowWithDebugFlag extends Window {
    __debugUseNewPatternRenderer?: boolean;
  }
  
  if (typeof window !== 'undefined') {
    (window as WindowWithDebugFlag).__debugUseNewPatternRenderer = true;
    logger.info('[PatternRendererAdapter] New pattern renderer enabled globally');
  }
}

export function disableNewPatternRenderer() {
  interface WindowWithDebugFlag extends Window {
    __debugUseNewPatternRenderer?: boolean;
  }
  
  if (typeof window !== 'undefined') {
    (window as WindowWithDebugFlag).__debugUseNewPatternRenderer = false;
    logger.info('[PatternRendererAdapter] New pattern renderer disabled globally');
  }
}