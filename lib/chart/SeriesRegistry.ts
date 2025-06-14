/**
 * Series Registry for Pattern Renderer
 * 
 * WeakMapベースのシリーズ管理でメモリリークを防止
 * グローバルMapの代替として安全なライフサイクル管理を提供
 */

import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { logger } from '@/lib/utils/logger';

export interface SeriesInfo {
  patternId: string;
  type: 'marker' | 'line' | 'metric' | 'area';
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface MetricInfo {
  series: ISeriesApi<SeriesType>[];
  instanceId: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * シリーズライフサイクル管理クラス
 * WeakMapを使用してメモリリークを防止
 */
export class SeriesRegistry {
  private patternSeries = new Map<string, ISeriesApi<SeriesType>[]>();
  private seriesInfo = new WeakMap<ISeriesApi<SeriesType>, SeriesInfo>();
  private metricLines = new Map<string, MetricInfo>();
  private chart: IChartApi;
  private instanceId: number;
  
  constructor(chart: IChartApi, instanceId: number) {
    this.chart = chart;
    this.instanceId = instanceId;
    
    logger.info('[SeriesRegistry] Created new registry', {
      instanceId: this.instanceId
    });
  }
  
  /**
   * シリーズを登録
   */
  registerSeries(
    patternId: string, 
    series: ISeriesApi<SeriesType>[], 
    type: SeriesInfo['type'],
    metadata?: Record<string, unknown>
  ): void {
    // パターンに関連付けて保存
    this.patternSeries.set(patternId, series);
    
    // 各シリーズにメタデータを関連付け
    series.forEach(s => {
      this.seriesInfo.set(s, {
        patternId,
        type,
        createdAt: Date.now(),
        metadata
      });
    });
    
    logger.info('[SeriesRegistry] Registered series', {
      patternId,
      type,
      count: series.length,
      instanceId: this.instanceId,
      totalPatterns: this.patternSeries.size
    });
  }
  
  /**
   * メトリックラインを登録
   */
  registerMetricLines(
    patternId: string,
    series: ISeriesApi<SeriesType>[],
    metadata?: Record<string, unknown>
  ): void {
    this.metricLines.set(patternId, {
      series,
      instanceId: this.instanceId,
      createdAt: Date.now(),
      metadata
    });
    
    // メトリックラインも通常のシリーズとして登録
    this.registerSeries(patternId, series, 'metric', metadata);
    
    logger.info('[SeriesRegistry] Registered metric lines', {
      patternId,
      count: series.length,
      instanceId: this.instanceId,
      totalMetrics: this.metricLines.size
    });
  }
  
  /**
   * パターンに関連するすべてのシリーズを取得
   */
  getPatternSeries(patternId: string): ISeriesApi<SeriesType>[] {
    return this.patternSeries.get(patternId) || [];
  }
  
  /**
   * メトリックラインを取得
   */
  getMetricLines(patternId: string): ISeriesApi<SeriesType>[] {
    const metricInfo = this.metricLines.get(patternId);
    return metricInfo?.series || [];
  }
  
  /**
   * シリーズの情報を取得
   */
  getSeriesInfo(series: ISeriesApi<SeriesType>): SeriesInfo | undefined {
    return this.seriesInfo.get(series);
  }
  
  /**
   * パターンを完全に削除
   */
  removePattern(patternId: string): { removed: number; errors: string[] } {
    let removedCount = 0;
    const errors: string[] = [];
    
    logger.info('[SeriesRegistry] Removing pattern', {
      patternId,
      instanceId: this.instanceId
    });
    
    // 通常のシリーズを削除
    const series = this.patternSeries.get(patternId) || [];
    series.forEach((s, index) => {
      try {
        this.chart.removeSeries(s);
        removedCount++;
        logger.debug('[SeriesRegistry] Removed series', { 
          patternId, 
          index, 
          type: this.seriesInfo.get(s)?.type 
        });
      } catch (error) {
        const errorMsg = `Failed to remove series ${index}: ${String(error)}`;
        errors.push(errorMsg);
        logger.warn('[SeriesRegistry] Failed to remove series', {
          patternId,
          index,
          error: String(error)
        });
      }
    });
    
    // メトリックラインを削除
    const metricInfo = this.metricLines.get(patternId);
    if (metricInfo) {
      metricInfo.series.forEach((s, index) => {
        try {
          this.chart.removeSeries(s);
          removedCount++;
          logger.debug('[SeriesRegistry] Removed metric line', { 
            patternId, 
            index 
          });
        } catch (error) {
          const errorMsg = `Failed to remove metric line ${index}: ${String(error)}`;
          errors.push(errorMsg);
          logger.warn('[SeriesRegistry] Failed to remove metric line', {
            patternId,
            index,
            error: String(error)
          });
        }
      });
    }
    
    // レジストリから削除
    this.patternSeries.delete(patternId);
    this.metricLines.delete(patternId);
    
    logger.info('[SeriesRegistry] Pattern removal complete', {
      patternId,
      removedCount,
      errorCount: errors.length,
      instanceId: this.instanceId,
      remainingPatterns: this.patternSeries.size,
      remainingMetrics: this.metricLines.size
    });
    
    return { removed: removedCount, errors };
  }
  
  /**
   * 指定した時間より古いパターンを自動クリーンアップ
   */
  cleanupOldPatterns(maxAgeMs: number = 300000): number { // 5分
    const now = Date.now();
    let cleanedCount = 0;
    
    // メトリックラインの古いエントリをクリーンアップ
    for (const [patternId, metricInfo] of this.metricLines.entries()) {
      if (now - metricInfo.createdAt > maxAgeMs) {
        logger.info('[SeriesRegistry] Cleaning up old metric lines', {
          patternId,
          age: now - metricInfo.createdAt,
          instanceId: this.instanceId
        });
        
        const result = this.removePattern(patternId);
        cleanedCount += result.removed;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('[SeriesRegistry] Cleanup completed', {
        cleanedCount,
        instanceId: this.instanceId,
        remainingPatterns: this.patternSeries.size
      });
    }
    
    return cleanedCount;
  }
  
  /**
   * すべてのシリーズを削除（インスタンス破棄時）
   */
  dispose(): void {
    logger.info('[SeriesRegistry] Disposing registry', {
      instanceId: this.instanceId,
      patternsToRemove: this.patternSeries.size,
      metricsToRemove: this.metricLines.size
    });
    
    const patternIds = Array.from(this.patternSeries.keys());
    let totalRemoved = 0;
    const allErrors: string[] = [];
    
    patternIds.forEach(patternId => {
      const result = this.removePattern(patternId);
      totalRemoved += result.removed;
      allErrors.push(...result.errors);
    });
    
    // マップをクリア
    this.patternSeries.clear();
    this.metricLines.clear();
    
    logger.info('[SeriesRegistry] Registry disposed', {
      instanceId: this.instanceId,
      totalRemoved,
      errorCount: allErrors.length
    });
    
    if (allErrors.length > 0) {
      logger.warn('[SeriesRegistry] Disposal had errors', {
        instanceId: this.instanceId,
        errors: allErrors
      });
    }
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState(): {
    instanceId: number;
    patterns: string[];
    patternCount: number;
    metricCount: number;
    metrics: Array<{
      id: string;
      seriesCount: number;
      age: number;
      instanceId: number;
    }>;
  } {
    return {
      instanceId: this.instanceId,
      patterns: Array.from(this.patternSeries.keys()),
      patternCount: this.patternSeries.size,
      metricCount: this.metricLines.size,
      metrics: Array.from(this.metricLines.entries()).map(([id, info]) => ({
        id,
        seriesCount: info.series.length,
        age: Date.now() - info.createdAt,
        instanceId: info.instanceId
      }))
    };
  }
  
  /**
   * ファジーマッチングでパターンIDを検索
   */
  findPatternByFuzzyMatch(searchId: string): string | null {
    // 完全一致を最初に試す
    if (this.patternSeries.has(searchId) || this.metricLines.has(searchId)) {
      return searchId;
    }
    
    // IDの一部分で検索
    const searchParts = searchId.split('_');
    const uniquePart = searchParts.slice(-2).join('_');
    
    // パターンシリーズから検索
    for (const patternId of this.patternSeries.keys()) {
      if (patternId.includes(uniquePart) || 
          (patternId.includes('pattern') && patternId.endsWith(searchParts[searchParts.length - 1]))) {
        logger.info('[SeriesRegistry] Found pattern with fuzzy match', {
          searchId,
          foundId: patternId,
          uniquePart
        });
        return patternId;
      }
    }
    
    // メトリックラインから検索
    for (const patternId of this.metricLines.keys()) {
      if (patternId.includes(uniquePart) || 
          (patternId.includes('pattern') && patternId.endsWith(searchParts[searchParts.length - 1]))) {
        logger.info('[SeriesRegistry] Found metric pattern with fuzzy match', {
          searchId,
          foundId: patternId,
          uniquePart
        });
        return patternId;
      }
    }
    
    return null;
  }
}

/**
 * レガシーグローバルマップクリーンアップユーティリティ
 */
export class GlobalStateManager {
  private static registries = new Map<number, SeriesRegistry>();
  
  static registerInstance(instanceId: number, registry: SeriesRegistry): void {
    this.registries.set(instanceId, registry);
    logger.info('[GlobalStateManager] Registered registry instance', {
      instanceId,
      totalInstances: this.registries.size
    });
  }
  
  static unregisterInstance(instanceId: number): void {
    const registry = this.registries.get(instanceId);
    if (registry) {
      registry.dispose();
      this.registries.delete(instanceId);
      logger.info('[GlobalStateManager] Unregistered registry instance', {
        instanceId,
        remainingInstances: this.registries.size
      });
    }
  }
  
  static cleanupAllInstances(): void {
    logger.info('[GlobalStateManager] Cleaning up all instances', {
      totalInstances: this.registries.size
    });
    
    for (const [instanceId, registry] of this.registries.entries()) {
      registry.dispose();
    }
    
    this.registries.clear();
    logger.info('[GlobalStateManager] All instances cleaned up');
  }
  
  static getDebugState(): {
    totalInstances: number;
    instances: Array<{
      instanceId: number;
      state: ReturnType<SeriesRegistry['getDebugState']>;
    }>;
  } {
    return {
      totalInstances: this.registries.size,
      instances: Array.from(this.registries.entries()).map(([id, registry]) => ({
        instanceId: id,
        state: registry.getDebugState()
      }))
    };
  }
}