// パターンエリア(ハイライト)描画ユーティリティ
// 現在はヒストグラムシリーズを使用した基本実装

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { logger } from '@/lib/utils/logger';
import { isDevelopment } from '@/config/env';

export interface PatternAreaRendererDeps {
  chart: IChartApi;
  globalAllSeries: Map<string, { patternId: string; series: ISeriesApi<SeriesType>; type: string; createdAt: number }>;
}

export function renderPatternAreas(
  id: string,
  visualization: PatternVisualization,
  deps: PatternAreaRendererDeps
): ISeriesApi<SeriesType>[] {
  const { chart, globalAllSeries } = deps;
  const areaSeries: ISeriesApi<SeriesType>[] = [];
  
  try {
    if (!visualization.areas || visualization.areas.length === 0) {
      return [];
    }
    
    logger.info('[PatternAreaRenderer] Rendering pattern areas', {
      id,
      areaCount: visualization.areas.length
    });
    
    // Process each area
    visualization.areas.forEach((area, areaIndex) => {
      try {
        if (!area.points || area.points.length < 2) {
          logger.warn('[PatternAreaRenderer] Insufficient points for area', {
            id,
            areaIndex,
            pointCount: area.points?.length || 0
          });
          return;
        }
        
        // Find time bounds
        const times = area.points.map(p => p.time);
        const startTime = Math.min(...times);
        const endTime = Math.max(...times);
        
        // Find value bounds
        const values = area.points.map(p => p.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const heightValue = maxValue - minValue;
        
        // Create histogram series for rectangular area highlight
        const histogramSeries = chart.addHistogramSeries({
          color: area.color || 'rgba(33, 150, 243, 0.1)',
          priceFormat: {
            type: 'price',
          },
          priceLineVisible: false,
          lastValueVisible: false,
        });
        
        // Generate histogram data points
        const histogramData: { time: Time; value: number; color?: string }[] = [];
        
        // Create a rectangular highlight by using histogram bars
        // Sample points between start and end time
        const pointCount = Math.min(area.points.length, 20); // Limit points for performance
        for (let i = 0; i < pointCount; i++) {
          const ratio = i / (pointCount - 1);
          const time = startTime + (endTime - startTime) * ratio;
          
          histogramData.push({
            time: time as Time,
            value: heightValue,
            color: `${area.color || 'rgba(33, 150, 243, 0.1)'}${Math.round((area.opacity || 0.1) * 255).toString(16).padStart(2, '0')}`
          });
        }
        
        histogramSeries.setData(histogramData);
        
        // Apply custom price scale if needed to position the histogram
        histogramSeries.applyOptions({
          priceScaleId: 'right',
          scaleMargins: {
            top: 1 - (maxValue / 100), // Position based on pattern height
            bottom: minValue / 100,
          },
        });
        
        areaSeries.push(histogramSeries);
        
        // Track the series
        globalAllSeries.set(`${id}_area_${areaIndex}_${Date.now()}`, {
          patternId: id,
          series: histogramSeries,
          type: 'area',
          createdAt: Date.now(),
        });
        
        logger.debug('[PatternAreaRenderer] Created histogram area', {
          id,
          areaIndex,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          minValue,
          maxValue
        });
        
      } catch (err) {
        logger.error('[PatternAreaRenderer] Failed to create area', {
          id,
          areaIndex,
          error: String(err)
        });
      }
    });
    
    logger.info('[PatternAreaRenderer] Completed area rendering', {
      id,
      created: areaSeries.length
    });
    
    return areaSeries;
    
  } catch (error) {
    logger.error('[PatternAreaRenderer] Error rendering areas', {
      id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // 開発環境では空配列を返す
    if (isDevelopment()) {
      return [];
    }
    
    // 本番環境ではエラーを投げる
    throw new Error(`Failed to render pattern areas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
