// 新規ファイル: キーポイントマーカー描画専用ユーティリティ
// PatternRenderer の巨大化を防ぐために切り出し

import type { ISeriesApi, SeriesMarker, SeriesType, Time } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { logger } from '@/lib/utils/logger';

/**
 * キーポイントを元に SeriesMarker 配列を生成し、既存マーカーとマージして mainSeries へ適用
 * @param id        パターンID
 * @param visualization PatternVisualization
 * @param mainSeries   lightweight-charts のメインシリーズ
 * @param markerStore  PatternRenderer が保持する markers Map
 */
export function renderKeyPointMarkers(
  id: string,
  visualization: PatternVisualization,
  mainSeries: ISeriesApi<SeriesType>,
  markerStore: Map<string, SeriesMarker<Time>[]>
): void {
  try {
    logger.info('[KeyPointMarkerRenderer] Start', {
      id,
      keyPointsCount: visualization.keyPoints?.length || 0,
    });

    if (!visualization.keyPoints || visualization.keyPoints.length === 0) {
      logger.warn('[KeyPointMarkerRenderer] No key points to render', { id });
      return;
    }

    // Validate mainSeries
    if (!mainSeries) throw new Error('Main series is not available');

    // Sort keyPoints by time
    const sorted = [...visualization.keyPoints].sort((a, b) => {
      const tA = typeof a.time === 'number' ? a.time : 0;
      const tB = typeof b.time === 'number' ? b.time : 0;
      return tA - tB;
    });

    // Convert to SeriesMarker
    const markers: SeriesMarker<Time>[] = sorted.map((point, idx) => {
      if (point == null || point.time == null || point.value == null) {
        throw new Error(`Invalid key point @${idx}`);
      }
      const position = point.type === 'peak' ? 'aboveBar' : point.type === 'trough' ? 'belowBar' : 'inBar';
      const color =
        point.type === 'peak'
          ? '#ff4444'
          : point.type === 'trough'
          ? '#44ff44'
          : point.type === 'neckline'
          ? '#ffaa00'
          : point.type === 'target'
          ? '#00aaff'
          : '#888888';

      return {
        time: point.time as Time,
        position,
        color,
        shape: 'circle',
        text: point.label || '',
        size: 2,
      };
    });

    // 保存
    markerStore.set(id, markers);

    let existing: SeriesMarker<Time>[] = [];
    try {
      existing = mainSeries.markers() || [];
    } catch (err) {
      logger.warn('[KeyPointMarkerRenderer] Could not get existing markers', {
        error: String(err),
      });
    }

    const all = [...existing, ...markers].sort((a, b) => {
      const tA = typeof a.time === 'number' ? a.time : 0;
      const tB = typeof b.time === 'number' ? b.time : 0;
      return tA - tB;
    });

    try {
      mainSeries.setMarkers(all);
    } catch (err) {
      logger.error('[KeyPointMarkerRenderer] Failed to set markers', {
        error: String(err),
        count: all.length,
      });
      throw err;
    }

    logger.info('[KeyPointMarkerRenderer] Done', { id, added: markers.length });
  } catch (error) {
    logger.error('[KeyPointMarkerRenderer] Error', {
      id,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    throw error;
  }
} 