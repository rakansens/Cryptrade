// 新規ファイル: パターンライン描画ユーティリティ

import type { IChartApi, ISeriesApi, SeriesType, Time, LineWidth } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { logger } from '@/lib/utils/logger';

export interface PatternLineRendererDeps {
  chart: IChartApi;
  getLineColor: (type: string) => string;
  convertLineStyle: (style: string) => number;
  globalAllSeries: Map<string, { patternId: string; series: ISeriesApi<SeriesType>; type: string; createdAt: number }>;
}

export function renderPatternLines(
  id: string,
  visualization: PatternVisualization,
  deps: PatternLineRendererDeps
): ISeriesApi<SeriesType>[] {
  const { chart, getLineColor, convertLineStyle, globalAllSeries } = deps;
  try {
    logger.info('[PatternLineRenderer] Start', {
      id,
      linesCount: visualization.lines?.length || 0,
    });

    if (!visualization.lines || visualization.lines.length === 0) return [];

    const lineSeries: ISeriesApi<SeriesType>[] = [];

    visualization.lines.forEach((line, lineIndex) => {
      try {
        const fromPoint = visualization.keyPoints[line.from];
        const toPoint = visualization.keyPoints[line.to];
        if (!fromPoint || !toPoint) {
          logger.warn('[PatternLineRenderer] Missing endpoints', { id, lineIndex });
          return;
        }

        const series = chart.addLineSeries({
          color: line.style?.color || getLineColor(line.type),
          lineWidth: (line.style?.lineWidth ?? 2) as LineWidth,
          lineStyle: convertLineStyle(line.style?.lineStyle || 'solid'),
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        // Ensure points order
        const data = fromPoint.time < toPoint.time
          ? [
              { time: fromPoint.time as Time, value: fromPoint.value },
              { time: toPoint.time as Time, value: toPoint.value },
            ]
          : [
              { time: toPoint.time as Time, value: toPoint.value },
              { time: fromPoint.time as Time, value: fromPoint.value },
            ];

        series.setData(data);
        lineSeries.push(series);

        globalAllSeries.set(`${id}_line_${lineIndex}_${Date.now()}`, {
          patternId: id,
          series,
          type: 'line',
          createdAt: Date.now(),
        });
      } catch (err) {
        logger.error('[PatternLineRenderer] Failed to create line', {
          id,
          lineIndex,
          error: String(err),
        });
      }
    });

    logger.info('[PatternLineRenderer] Done', { id, created: lineSeries.length });
    return lineSeries;
  } catch (error) {
    logger.error('[PatternLineRenderer] Error', {
      id,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    
    // フォールバック: 既存のライン描画を保持
    const existingLines = Array.from(globalAllSeries.entries())
      .filter(([key, value]) => value.patternId === id && value.type === 'line')
      .map(([_, value]) => value.series);
    
    if (existingLines.length > 0) {
      logger.warn('[PatternLineRenderer] Using existing lines as fallback', {
        id,
        existingCount: existingLines.length
      });
      return existingLines;
    }
    
    // 開発環境では空配列を返す
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[PatternLineRenderer] Returning empty array in development');
      return [];
    }
    
    // 本番環境ではエラーを投げる
    throw new Error(`Failed to render pattern lines: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 