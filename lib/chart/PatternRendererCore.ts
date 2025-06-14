/**
 * Pattern Renderer Core
 * 
 * プラグインベースの新しいパターンレンダラー
 * 717行のモノリシックなクラスを300行以下のクリーンなアーキテクチャに再設計
 */

import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { SeriesRegistry, GlobalStateManager } from './SeriesRegistry';
import { PluginRegistry } from './plugins/PluginRegistry';
import { PluginUtilitiesImpl } from './plugins/utils';
import { KeyPointRenderer } from './plugins/KeyPointRenderer';
import { LineRenderer } from './plugins/LineRenderer';
import { MetricRenderer } from './plugins/MetricRenderer';
import type { PluginContext, RenderResult, IRendererPlugin, PluginMetadata, PluginOptions } from './plugins/interfaces';
import { PluginError } from './plugins/interfaces';
import { logger } from '@/lib/utils/logger';

// インスタンスカウンター（デバッグ用）
let instanceCounter = 0;

/**
 * パターンレンダラーコア
 * 
 * プラグインアーキテクチャによる軽量で拡張可能な実装
 */
export class PatternRendererCore {
  private chart: IChartApi;
  private mainSeries: ISeriesApi<SeriesType>;
  private registry: SeriesRegistry;
  private pluginRegistry: PluginRegistry;
  private utilities: PluginUtilitiesImpl;
  private instanceId: number;
  private context: PluginContext;
  
  constructor(chart: IChartApi, mainSeries: ISeriesApi<SeriesType>) {
    this.chart = chart;
    this.mainSeries = mainSeries;
    this.instanceId = ++instanceCounter;
    
    // SeriesRegistryの初期化
    this.registry = new SeriesRegistry(chart, this.instanceId);
    
    // ユーティリティの初期化
    this.utilities = new PluginUtilitiesImpl();
    
    // プラグインコンテキストの作成
    this.context = {
      chart: this.chart,
      mainSeries: this.mainSeries,
      registry: this.registry,
      instanceId: this.instanceId,
      utilities: this.utilities,
    };
    
    // プラグインレジストリの初期化
    this.pluginRegistry = new PluginRegistry(this.context);
    
    // デフォルトプラグインの登録
    this.registerDefaultPlugins();
    
    // グローバル状態管理に登録
    GlobalStateManager.registerInstance(this.instanceId, this.registry);
    
    logger.info('[PatternRendererCore] Created new instance', {
      instanceId: this.instanceId,
      totalInstances: instanceCounter,
    });
    
    // デバッグ用のグローバル露出
    this.exposeForDebugging();
  }
  
  /**
   * パターンをレンダリング
   */
  async renderPattern(
    id: string,
    visualization: PatternVisualization,
    patternType: string,
    metrics?: {
      target_level?: number;
      stop_loss?: number;
      breakout_level?: number;
    }
  ): Promise<RenderResult> {
    try {
      // 入力データの検証
      this.validateInput(id, visualization);
      
      logger.info('[PatternRendererCore] Starting pattern render', {
        instanceId: this.instanceId,
        id,
        patternType,
        keyPointsCount: visualization.keyPoints?.length || 0,
        hasLines: !!visualization.lines?.length,
        hasAreas: !!visualization.areas?.length,
        hasMetrics: !!metrics,
      });
      
      // 既存のパターンを削除
      await this.removePattern(id);
      
      // サポートしているプラグインでレンダリング
      const renderResult = await this.pluginRegistry.renderWithAllSupporting(
        id, 
        visualization, 
        metrics
      );
      
      const result: RenderResult = {
        success: renderResult.successes.length > 0,
        plugin: renderResult.successes.join(', '),
        patternId: id,
        seriesCreated: renderResult.successes.length,
        errors: renderResult.failures.map(f => f.error),
        warnings: renderResult.failures.length > 0 ? 
          [`${renderResult.failures.length} plugins failed`] : undefined,
        metadata: {
          patternType,
          renderTime: Date.now(),
          instanceId: this.instanceId,
          supportingPlugins: renderResult.successes,
          failedPlugins: renderResult.failures.map(f => f.plugin),
        },
      };
      
      if (result.success) {
        logger.info('[PatternRendererCore] Pattern rendered successfully', {
          id,
          patternType,
          successfulPlugins: renderResult.successes,
          failedPlugins: renderResult.failures.length,
        });
      } else {
        logger.error('[PatternRendererCore] Pattern render failed', {
          id,
          patternType,
          failures: renderResult.failures,
        });
      }
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[PatternRendererCore] Failed to render pattern', {
        id,
        patternType,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        success: false,
        plugin: 'PatternRendererCore',
        patternId: id,
        seriesCreated: 0,
        errors: [errorMsg],
        metadata: {
          patternType,
          errorTime: Date.now(),
          instanceId: this.instanceId,
        },
      };
    }
  }
  
  /**
   * パターンを削除
   */
  async removePattern(id: string): Promise<void> {
    logger.info('[PatternRendererCore] Removing pattern', {
      instanceId: this.instanceId,
      id,
    });
    
    try {
      // すべてのプラグインで削除を試行
      const removeResult = await this.pluginRegistry.removeWithAllSupporting(id);
      
      // SeriesRegistryからも削除
      const registryResult = this.registry.removePattern(id);
      
      logger.info('[PatternRendererCore] Pattern removed', {
        id,
        pluginSuccesses: removeResult.successes.length,
        pluginFailures: removeResult.failures.length,
        registryRemoved: registryResult.removed,
        registryErrors: registryResult.errors.length,
      });
      
    } catch (error) {
      logger.error('[PatternRendererCore] Failed to remove pattern', {
        id,
        error: String(error),
      });
      throw error;
    }
  }
  
  /**
   * インスタンスの破棄
   */
  async dispose(): Promise<void> {
    logger.info('[PatternRendererCore] Disposing instance', {
      instanceId: this.instanceId,
    });
    
    try {
      // プラグインのクリーンアップ
      await this.pluginRegistry.dispose();
      
      // SeriesRegistryのクリーンアップ
      this.registry.dispose();
      
      // グローバル状態管理から登録解除
      GlobalStateManager.unregisterInstance(this.instanceId);
      
      // デバッグ用グローバル変数をクリア
      this.cleanupDebugGlobals();
      
      logger.info('[PatternRendererCore] Instance disposed', {
        instanceId: this.instanceId,
      });
      
    } catch (error) {
      logger.error('[PatternRendererCore] Failed to dispose instance', {
        instanceId: this.instanceId,
        error: String(error),
      });
      throw error;
    }
  }
  
  /**
   * デフォルトプラグインの登録
   */
  private registerDefaultPlugins(): void {
    logger.info('[PatternRendererCore] Registering default plugins');
    
    // KeyPointRenderer
    this.pluginRegistry.register(
      new KeyPointRenderer(),
      {
        name: 'KeyPointRenderer',
        version: '1.0.0',
        description: 'Renders pattern key points as markers',
        supports: ['keyPoints'],
      },
      { enabled: true }
    );
    
    // LineRenderer
    this.pluginRegistry.register(
      new LineRenderer(),
      {
        name: 'LineRenderer',
        version: '1.0.0',
        description: 'Renders pattern lines and trendlines',
        supports: ['lines'],
      },
      { enabled: true }
    );
    
    // MetricRenderer
    this.pluginRegistry.register(
      new MetricRenderer(),
      {
        name: 'MetricRenderer',
        version: '1.0.0',
        description: 'Renders pattern metrics as horizontal lines',
        supports: ['metrics'],
      },
      { enabled: true }
    );
    
    logger.info('[PatternRendererCore] Default plugins registered', {
      pluginCount: this.pluginRegistry.getAll().length,
    });
  }
  
  /**
   * 入力データの検証
   */
  private validateInput(id: string, visualization: PatternVisualization): void {
    if (!id || typeof id !== 'string') {
      throw new PluginError('PatternRendererCore', 'validate', 'Invalid pattern ID');
    }
    
    if (!visualization) {
      throw new PluginError('PatternRendererCore', 'validate', 'Visualization object is required');
    }
    
    if (!visualization.keyPoints || !Array.isArray(visualization.keyPoints)) {
      throw new PluginError('PatternRendererCore', 'validate', 'keyPoints array is required');
    }
    
    if (visualization.keyPoints.length === 0) {
      throw new PluginError('PatternRendererCore', 'validate', 'At least one key point is required');
    }
  }
  
  /**
   * デバッグ用のグローバル露出
   */
  private exposeForDebugging(): void {
    if (typeof window !== 'undefined') {
      // 現在のインスタンスを露出
      interface WindowWithDebug extends Window {
        __debugPatternRendererCore?: PatternRendererCore;
        __debugPatternRendererCores?: Array<{
          instanceId: number;
          renderer: PatternRendererCore;
          createdAt: string;
        }>;
      }
      const windowWithDebug = window as WindowWithDebug;
      windowWithDebug.__debugPatternRendererCore = this;
      
      // 全インスタンスのリストに追加
      windowWithDebug.__debugPatternRendererCores = windowWithDebug.__debugPatternRendererCores || [];
      windowWithDebug.__debugPatternRendererCores.push({
        instanceId: this.instanceId,
        renderer: this,
        createdAt: new Date().toISOString(),
      });
      
      logger.debug('[PatternRendererCore] Instance exposed for debugging', {
        instanceId: this.instanceId,
        totalInstances: windowWithDebug.__debugPatternRendererCores!.length,
      });
    }
  }
  
  /**
   * デバッグ用グローバル変数のクリーンアップ
   */
  private cleanupDebugGlobals(): void {
    if (typeof window !== 'undefined') {
      // 現在のインスタンスをリストから削除
      interface WindowWithDebugCleanup extends Window {
        __debugPatternRendererCore?: PatternRendererCore;
        __debugPatternRendererCores?: Array<{
          instanceId: number;
          renderer: PatternRendererCore;
          createdAt: string;
        }>;
      }
      const windowWithDebug = window as WindowWithDebugCleanup;
      const coresList = windowWithDebug.__debugPatternRendererCores;
      if (Array.isArray(coresList)) {
        const index = coresList.findIndex((item) => item.instanceId === this.instanceId);
        if (index >= 0) {
          coresList.splice(index, 1);
        }
      }
      
      // 最後のインスタンスの場合、メイン変数もクリア
      if (coresList && coresList.length === 0) {
        delete windowWithDebug.__debugPatternRendererCore;
        delete windowWithDebug.__debugPatternRendererCores;
      }
    }
  }
  
  /**
   * プラグインの追加
   */
  addPlugin(plugin: IRendererPlugin, metadata?: PluginMetadata, options?: PluginOptions): void {
    this.pluginRegistry.register(plugin, metadata, options);
  }
  
  /**
   * プラグインの削除
   */
  removePlugin(name: string): boolean {
    return this.pluginRegistry.unregister(name);
  }
  
  /**
   * プラグインの有効/無効切り替え
   */
  setPluginEnabled(name: string, enabled: boolean): boolean {
    return this.pluginRegistry.setPluginEnabled(name, enabled);
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState(): {
    instanceId: number;
    registryState: ReturnType<SeriesRegistry['getDebugState']>;
    pluginState: ReturnType<PluginRegistry['getDebugState']>;
    globalState: ReturnType<typeof GlobalStateManager.getDebugState>;
  } {
    return {
      instanceId: this.instanceId,
      registryState: this.registry.getDebugState(),
      pluginState: this.pluginRegistry.getDebugState(),
      globalState: GlobalStateManager.getDebugState(),
    };
  }
  
  /**
   * 古いパターンの自動クリーンアップ
   */
  cleanupOldPatterns(maxAgeMs: number = 300000): number {
    return this.registry.cleanupOldPatterns(maxAgeMs);
  }
  
  /**
   * レガシーAPIとの互換性用メソッド
   */
  
  /**
   * デバッグ用メトリックライン全削除（レガシー互換）
   */
  debugRemoveAllMetricLines(): void {
    logger.warn('[PatternRendererCore] Legacy debug method called');
    // 新しい実装では自動的にクリーンアップされるため、何もしない
  }
  
  /**
   * デバッグ用状態取得（レガシー互換）
   */
  debugGetState(): ReturnType<PatternRendererCore['getDebugState']> {
    return this.getDebugState();
  }
}