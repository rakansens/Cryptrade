import { useEffect, useRef } from 'react';
import { useChartDrawings } from '@/store/chart.store';
import { ChartDrawingManager } from '@/lib/chart/drawing-primitives';
import { logger } from '@/lib/utils/logger';

/**
 * Drawing Restore Hook
 * 
 * Restores drawings to the chart after re-initialization or timeframe changes
 * This ensures drawings persist across chart resets
 */

interface UseDrawingRestoreProps {
  drawingManager: ChartDrawingManager | null;
  isChartReady: boolean;
  timeframe: string;
}

export function useDrawingRestore({ drawingManager, isChartReady, timeframe }: UseDrawingRestoreProps) {
  const drawings = useChartDrawings();
  const lastTimeframeRef = useRef(timeframe);
  const restoredDrawingsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!drawingManager || !isChartReady || drawings.length === 0) {
      return;
    }

    // Check if timeframe changed
    const timeframeChanged = lastTimeframeRef.current !== timeframe;
    lastTimeframeRef.current = timeframe;

    // Always restore drawings after chart initialization or timeframe change
    if (timeframeChanged || restoredDrawingsRef.current.size === 0) {
      logger.info('[DrawingRestore] Restoring drawings', {
        drawingCount: drawings.length,
        timeframeChanged,
        timeframe
      });

      // Clear existing drawings first to avoid duplicates
      drawingManager.clearAll();
      restoredDrawingsRef.current.clear();

      // Restore all drawings from store
      drawings.forEach((drawing) => {
        try {
          if (!restoredDrawingsRef.current.has(drawing.id)) {
            logger.info('[DrawingRestore] Restoring drawing', { 
              id: drawing.id, 
              type: drawing.type 
            });
            
            // Add drawing based on type
            switch (drawing.type) {
              case 'trendline':
                if (drawing.points.length >= 2) {
                  // Validate points before adding
                  const point1 = drawing.points[0];
                  const point2 = drawing.points[1];
                  
                  if (!point1 || !point2 || 
                      typeof point1.time !== 'number' || 
                      typeof point1.value !== 'number' ||
                      typeof point2.time !== 'number' || 
                      typeof point2.value !== 'number') {
                    logger.warn('[DrawingRestore] Invalid trendline points', { 
                      id: drawing.id,
                      points: drawing.points 
                    });
                    break;
                  }
                  
                  drawingManager.addTrendline(
                    point1,
                    point2,
                    drawing.style,
                    drawing.id
                  );
                }
                break;
              case 'horizontal':
                if (drawing.points.length >= 1) {
                  drawingManager.addHorizontalLine(
                    drawing.points[0].value,
                    drawing.style,
                    drawing.id
                  );
                }
                break;
              case 'vertical':
                if (drawing.points.length >= 1) {
                  drawingManager.addVerticalLine(
                    drawing.points[0].time,
                    drawing.style,
                    drawing.id
                  );
                }
                break;
              case 'fibonacci':
                if (drawing.points.length >= 2) {
                  drawingManager.addFibonacci(
                    drawing.points[0],
                    drawing.points[1],
                    drawing.style,
                    drawing.id
                  );
                }
                break;
              default:
                logger.warn('[DrawingRestore] Unknown drawing type', { 
                  type: drawing.type 
                });
            }
            
            restoredDrawingsRef.current.add(drawing.id);
          }
        } catch (error) {
          logger.error('[DrawingRestore] Failed to restore drawing', { 
            id: drawing.id, 
            type: drawing.type,
            points: drawing.points,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      logger.info('[DrawingRestore] Drawing restoration complete', {
        restoredCount: restoredDrawingsRef.current.size
      });
    }
  }, [drawingManager, isChartReady, drawings, timeframe]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      restoredDrawingsRef.current.clear();
    };
  }, []);
}