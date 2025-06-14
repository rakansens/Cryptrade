// 新規ファイル: パターンのターゲット/ストップロス/ブレイクアウト線描画ユーティリティ
// PatternRenderer.drawMetricLines の切り出し

import type { IChartApi, ISeriesApi, SeriesType, Time, LineWidth } from 'lightweight-charts';
import { logger } from '@/lib/utils/logger';
import type { PatternVisualization } from '@/types/pattern';

export interface PatternMetricRendererDeps {
  chart: IChartApi;
  convertLineStyle: (style: string) => number;
  globalAllSeries: Map<string, { patternId: string; series: ISeriesApi<SeriesType>; type: string; createdAt: number }>;
  globalMetricLines: Map<string, { series: ISeriesApi<SeriesType>[]; instanceId: number; createdAt: number }>;
  metricLinesStore: Map<string, ISeriesApi<SeriesType>[]>; // instance map
  instanceId: number;
}

export interface PatternMetrics {
  target_level?: number;
  stop_loss?: number;
  breakout_level?: number;
}

export function renderMetricLines(
  id: string,
  visualization: PatternVisualization,
  metrics: PatternMetrics,
  baseStyle: { color?: string; lineWidth?: number; lineStyle?: string } | undefined,
  deps: PatternMetricRendererDeps
): ISeriesApi<SeriesType>[] {
  const { chart, convertLineStyle, globalAllSeries, globalMetricLines, metricLinesStore, instanceId } = deps;

  /**
   * duplication guard
   * --------------------------------------------------
   * 時間足切替などで同一 patternId の metricLines を
   * 何度も addLineSeries してしまうと、ラベルが無限に増殖する。
   * ここでは patternId をキーとして既に描画済みか確認し、
   * もし存在する場合は一旦既存シリーズを chart から除去し
   * ストア(Map)からも削除してから再生成することで
   * 重複を根絶する。
   */

  // 既に存在する場合はクリーンアップ
  if (metricLinesStore.has(id)) {
    const existing = metricLinesStore.get(id) || [];
    existing.forEach(s => {
      try {
        chart.removeSeries(s);
      } catch (e) {
        logger.warn('[PatternMetricRenderer] Failed to remove existing metric series', {
          id,
          error: String(e),
        });
      }
    });
    metricLinesStore.delete(id);
  }

  // global 側にも存在する場合は削除（リーク防止）
  if (globalMetricLines.has(id)) {
    const entry = globalMetricLines.get(id);
    entry?.series.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch (e) {
        logger.warn('[PatternMetricRenderer] Failed to remove global metric series', {
          id,
          error: String(e),
        });
      }
    });
    globalMetricLines.delete(id);
  }

  const metricSeries: ISeriesApi<SeriesType>[] = [];

  if (!visualization.keyPoints || visualization.keyPoints.length === 0) return metricSeries;

  const times = visualization.keyPoints.map(p => p.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeExtension = (maxTime - minTime) * 0.5;
  const startTime = minTime - timeExtension;
  const endTime = maxTime + timeExtension;

  const makeSeries = (
    key: 'target' | 'stoploss' | 'breakout',
    value: number,
    color: string,
    lineStyleStr: 'dashed' | 'dotted'
  ) => {
    const series = chart.addLineSeries({
      color: baseStyle?.color || color,
      lineWidth: (baseStyle?.lineWidth ?? 2) as LineWidth,
      lineStyle: convertLineStyle(baseStyle?.lineStyle || lineStyleStr),
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: `${key.toUpperCase()}: $${value.toLocaleString()}`,
    });
    series.setData([
      { time: startTime as Time, value },
      { time: endTime as Time, value },
    ]);
    metricSeries.push(series);
    globalAllSeries.set(`${id}_metric_${key}_${Date.now()}`, {
      patternId: id,
      series,
      type: 'metric',
      createdAt: Date.now(),
    });
  };

  if (metrics.target_level) makeSeries('target', metrics.target_level, '#4CAF50', 'dashed');
  if (metrics.stop_loss) makeSeries('stoploss', metrics.stop_loss, '#F44336', 'dashed');
  if (metrics.breakout_level) makeSeries('breakout', metrics.breakout_level, '#FF9800', 'dotted');

  if (metricSeries.length) {
    metricLinesStore.set(id, metricSeries);
    globalMetricLines.set(id, { series: metricSeries, instanceId, createdAt: Date.now() });
    logger.info('[PatternMetricRenderer] Stored metric lines', { id, count: metricSeries.length });
  }

  return metricSeries;
} 