/**
 * Metric Renderer Plugin
 * 
 * パターンのメトリック（目標価格、ストップロス、ブレイクアウト）を水平線として描画
 */

import type { ISeriesApi, Time, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import type { 
  IMetricRendererPlugin, 
  PluginContext, 
  MetricStyle 
} from './interfaces';
import { PluginError } from './interfaces';
import { ValidationUtils, TimeUtils, NumberUtils } from './utils';
import { logger } from '@/lib/utils/logger';

interface MetricLineData {
  time: number;
  value: number;
}

interface PatternMetrics {
  target_level?: number;
  stop_loss?: number;
  breakout_level?: number;
  support_level?: number;
  resistance_level?: number;
}

export class MetricRenderer implements IMetricRendererPlugin {
  readonly name = 'MetricRenderer';
  
  private context?: PluginContext;
  private metricSeries = new Map<string, ISeriesApi<SeriesType>[]>();
  private metricStyle: MetricStyle = {
    showLabels: true,
    labelPosition: 'right',
    colors: {
      target: '#4CAF50',
      stopLoss: '#F44336',
      breakout: '#FF9800',
    },
    lineStyles: {
      target: 'dashed',
      stopLoss: 'dashed',
      breakout: 'dotted',
    },
  };
  
  /**
   * プラグインの初期化
   */
  initialize(context: PluginContext): void {
    this.context = context;
    logger.info('[MetricRenderer] Plugin initialized', {
      instanceId: context.instanceId,
    });
  }
  
  /**
   * メトリックの描画をサポートするかチェック
   */
  supports(data: PatternVisualization): boolean {
    // メトリック情報があるかチェック
    const hasMetrics = this.hasAnyMetrics(data);
    logger.debug('[MetricRenderer] Support check', {
      hasMetrics,
      metricsFound: this.getAvailableMetrics(data),
    });
    return hasMetrics;
  }
  
  /**
   * メトリック表示スタイル設定
   */
  setMetricStyle(style: MetricStyle): void {
    this.metricStyle = { ...this.metricStyle, ...style };
    logger.info('[MetricRenderer] Metric style updated', { style });
  }
  
  /**
   * メトリック値の更新
   */
  updateMetric(patternId: string, metric: string, value: number): void {
    logger.info('[MetricRenderer] Updating metric', {
      patternId,
      metric,
      value,
    });
    
    // 実際の更新はre-renderを推奨
    logger.warn('[MetricRenderer] Metric update requires re-rendering. Use remove() and render() instead.');
  }
  
  /**
   * メトリックラインを描画
   */
  async render(id: string, data: PatternVisualization, extra?: unknown): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'render', 'Plugin not initialized');
    }
    
    if (!this.supports(data)) {
      logger.warn('[MetricRenderer] Data not supported', { id });
      return;
    }
    
    try {
      // 入力データの検証
      if (!ValidationUtils.validatePatternId(id)) {
        throw new PluginError(this.name, 'render', `Invalid pattern ID: ${id}`);
      }
      
      // メトリック情報の抽出
      const metrics = this.extractMetrics(data, extra);
      if (Object.keys(metrics).length === 0) {
        logger.warn('[MetricRenderer] No valid metrics found', { id });
        return;
      }
      
      logger.info('[MetricRenderer] Starting metric rendering', {
        id,
        metrics,
        instanceId: this.context.instanceId,
      });
      
      // 既存のメトリックラインがある場合は削除
      await this.remove(id);
      
      // 時間範囲を計算
      const timeRange = this.calculateTimeRange(data);
      if (!timeRange) {
        throw new PluginError(this.name, 'render', 'Cannot calculate time range from data');
      }
      
      // メトリックラインを作成
      const createdSeries = await this.createMetricSeries(id, metrics, timeRange);
      
      if (createdSeries.length === 0) {
        logger.warn('[MetricRenderer] No metric lines created', { id });
        return;
      }
      
      // レジストリに登録
      this.metricSeries.set(id, createdSeries);
      this.context.registry.registerMetricLines(id, createdSeries, {
        metricsCount: Object.keys(metrics).length,
        metrics,
        createdAt: Date.now(),
      });
      
      logger.info('[MetricRenderer] Metrics rendered successfully', {
        id,
        metricsCreated: createdSeries.length,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = error instanceof PluginError 
        ? error 
        : new PluginError(this.name, 'render', `Unexpected error: ${String(error)}`, error as Error);
      
      logger.error('[MetricRenderer] Failed to render metrics', {
        id,
        error: pluginError.message,
        stack: pluginError.stack,
      });
      
      throw pluginError;
    }
  }
  
  /**
   * パターンのメトリックラインを削除
   */
  async remove(id: string): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'remove', 'Plugin not initialized');
    }
    
    try {
      const series = this.metricSeries.get(id);
      if (!series || series.length === 0) {
        logger.debug('[MetricRenderer] No metrics to remove', { id });
        return;
      }
      
      logger.info('[MetricRenderer] Removing metrics', {
        id,
        metricsCount: series.length,
        instanceId: this.context.instanceId,
      });
      
      // チャートからシリーズを削除
      let removedCount = 0;
      for (const s of series) {
        try {
          this.context.chart.removeSeries(s);
          removedCount++;
        } catch (error) {
          logger.warn('[MetricRenderer] Failed to remove series from chart', {
            id,
            error: String(error),
          });
        }
      }
      
      // レジストリから削除
      this.metricSeries.delete(id);
      
      logger.info('[MetricRenderer] Metrics removed successfully', {
        id,
        removedCount,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = new PluginError(
        this.name, 
        'remove', 
        `Failed to remove metrics: ${String(error)}`,
        error as Error
      );
      
      logger.error('[MetricRenderer] Failed to remove metrics', {
        id,
        error: pluginError.message,
      });
      
      throw pluginError;
    }
  }
  
  /**
   * プラグインのクリーンアップ
   */
  async dispose(): Promise<void> {
    logger.info('[MetricRenderer] Disposing plugin', {
      patternsToClean: this.metricSeries.size,
    });
    
    // すべてのパターンのメトリックを削除
    const patternIds = Array.from(this.metricSeries.keys());
    for (const id of patternIds) {
      try {
        await this.remove(id);
      } catch (error) {
        logger.warn('[MetricRenderer] Failed to remove pattern during disposal', {
          id,
          error: String(error),
        });
      }
    }
    
    // 内部状態をクリア
    this.metricSeries.clear();
    this.context = undefined;
    
    logger.info('[MetricRenderer] Plugin disposed');
  }
  
  /**
   * データからメトリック情報を抽出
   */
  private extractMetrics(data: PatternVisualization, extra?: unknown): PatternMetrics {
    const metrics: PatternMetrics = {};
    
    // extraパラメータからメトリックを取得（既存のAPIとの互換性）
    if (extra && typeof extra === 'object') {
      if (typeof extra.target_level === 'number') {
        metrics.target_level = extra.target_level;
      }
      if (typeof extra.stop_loss === 'number') {
        metrics.stop_loss = extra.stop_loss;
      }
      if (typeof extra.breakout_level === 'number') {
        metrics.breakout_level = extra.breakout_level;
      }
    }
    
    // データ内のメトリック情報をチェック
    if (data.metrics) {
      Object.assign(metrics, data.metrics);
    }
    
    // patterns配列内のメトリック情報をチェック
    if (data.patterns && Array.isArray(data.patterns)) {
      for (const pattern of data.patterns) {
        if (pattern.metrics) {
          Object.assign(metrics, pattern.metrics);
        }
      }
    }
    
    logger.debug('[MetricRenderer] Extracted metrics', {
      metrics,
      hasExtra: !!extra,
      hasDataMetrics: !!data.metrics,
    });
    
    return metrics;
  }
  
  /**
   * メトリック情報があるかチェック
   */
  private hasAnyMetrics(data: PatternVisualization): boolean {
    const metrics = this.extractMetrics(data);
    return Object.keys(metrics).length > 0;
  }
  
  /**
   * 利用可能なメトリックのリストを取得
   */
  private getAvailableMetrics(data: PatternVisualization): string[] {
    const metrics = this.extractMetrics(data);
    return Object.keys(metrics).filter(key => 
      typeof metrics[key as keyof PatternMetrics] === 'number'
    );
  }
  
  /**
   * 時間範囲を計算
   */
  private calculateTimeRange(data: PatternVisualization): { startTime: number; endTime: number } | null {
    if (!data.keyPoints || data.keyPoints.length === 0) {
      logger.warn('[MetricRenderer] No key points for time range calculation');
      return null;
    }
    
    const timeRange = this.context!.utilities.calculateTimeRange(data.keyPoints);
    return {
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    };
  }
  
  /**
   * メトリックシリーズを作成
   */
  private async createMetricSeries(
    patternId: string, 
    metrics: PatternMetrics,
    timeRange: { startTime: number; endTime: number }
  ): Promise<ISeriesApi<SeriesType>[]> {
    if (!this.context) {
      return [];
    }
    
    const createdSeries: ISeriesApi<SeriesType>[] = [];
    
    // Target Level
    if (metrics.target_level) {
      const series = this.createHorizontalLine(
        patternId,
        'target',
        metrics.target_level,
        timeRange,
        {
          color: this.metricStyle.colors?.target || '#4CAF50',
          lineStyle: this.metricStyle.lineStyles?.target || 'dashed',
          title: `目標: ${NumberUtils.formatPrice(metrics.target_level)}`,
        }
      );
      if (series) createdSeries.push(series);
    }
    
    // Stop Loss
    if (metrics.stop_loss) {
      const series = this.createHorizontalLine(
        patternId,
        'stopLoss',
        metrics.stop_loss,
        timeRange,
        {
          color: this.metricStyle.colors?.stopLoss || '#F44336',
          lineStyle: this.metricStyle.lineStyles?.stopLoss || 'dashed',
          title: `SL: ${NumberUtils.formatPrice(metrics.stop_loss)}`,
        }
      );
      if (series) createdSeries.push(series);
    }
    
    // Breakout Level
    if (metrics.breakout_level) {
      const series = this.createHorizontalLine(
        patternId,
        'breakout',
        metrics.breakout_level,
        timeRange,
        {
          color: this.metricStyle.colors?.breakout || '#FF9800',
          lineStyle: this.metricStyle.lineStyles?.breakout || 'dotted',
          title: `BO: ${NumberUtils.formatPrice(metrics.breakout_level)}`,
        }
      );
      if (series) createdSeries.push(series);
    }
    
    // Support Level
    if (metrics.support_level) {
      const series = this.createHorizontalLine(
        patternId,
        'support',
        metrics.support_level,
        timeRange,
        {
          color: '#00BCD4',
          lineStyle: 'solid',
          title: `サポート: ${NumberUtils.formatPrice(metrics.support_level)}`,
        }
      );
      if (series) createdSeries.push(series);
    }
    
    // Resistance Level
    if (metrics.resistance_level) {
      const series = this.createHorizontalLine(
        patternId,
        'resistance',
        metrics.resistance_level,
        timeRange,
        {
          color: '#E91E63',
          lineStyle: 'solid',
          title: `レジスタンス: ${NumberUtils.formatPrice(metrics.resistance_level)}`,
        }
      );
      if (series) createdSeries.push(series);
    }
    
    return createdSeries;
  }
  
  /**
   * 水平線を作成
   */
  private createHorizontalLine(
    patternId: string,
    metricType: string,
    value: number,
    timeRange: { startTime: number; endTime: number },
    style: {
      color: string;
      lineStyle: string;
      title: string;
    }
  ): ISeriesApi<SeriesType> | null {
    if (!this.context) {
      return null;
    }
    
    try {
      // ラインシリーズを作成
      const series = this.context.chart.addLineSeries({
        color: style.color,
        lineWidth: 2,
        lineStyle: this.context.utilities.convertLineStyle(style.lineStyle),
        priceLineVisible: false,
        lastValueVisible: this.metricStyle.showLabels,
        crosshairMarkerVisible: false,
        title: style.title,
      });
      
      // 水平線データを設定
      const lineData: MetricLineData[] = [
        { time: timeRange.startTime, value },
        { time: timeRange.endTime, value },
      ];
      
      series.setData(lineData.map(point => ({
        time: point.time as Time,
        value: point.value,
      })));
      
      logger.debug('[MetricRenderer] Created horizontal line', {
        patternId,
        metricType,
        value,
        style,
        dataPoints: lineData.length,
      });
      
      return series;
      
    } catch (error) {
      logger.warn('[MetricRenderer] Failed to create horizontal line', {
        patternId,
        metricType,
        value,
        error: String(error),
      });
      return null;
    }
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState() {
    return {
      name: this.name,
      initialized: !!this.context,
      patternsCount: this.metricSeries.size,
      patterns: Array.from(this.metricSeries.entries()).map(([id, series]) => ({
        id,
        seriesCount: series.length,
      })),
      metricStyle: this.metricStyle,
    };
  }
}