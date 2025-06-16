import { useEffect, useRef } from 'react';
import { useChartPatterns } from '@/store/chart.store';
import { logger } from '@/lib/utils/logger';
import type { PatternRenderer, PatternVisualization as PatternViz } from '@/types/pattern.types';

/**
 * Pattern Restore Hook
 * 
 * Restores patterns to the chart after re-initialization
 * This ensures patterns persist across timeframe changes
 */

interface UsePatternRestoreProps {
  patternRenderer: PatternRenderer | null;
  isChartReady: boolean;
  timeframe: string;
}

export function usePatternRestore({ patternRenderer, isChartReady, timeframe }: UsePatternRestoreProps) {
  const patterns = useChartPatterns();
  const lastTimeframeRef = useRef(timeframe);
  const restoredPatternsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!patternRenderer || !isChartReady || patterns.size === 0) {
      return;
    }

    // Check if timeframe changed
    const timeframeChanged = lastTimeframeRef.current !== timeframe;
    lastTimeframeRef.current = timeframe;

    // Always restore patterns after chart initialization or timeframe change
    if (timeframeChanged || restoredPatternsRef.current.size === 0) {
      logger.info('[PatternRestore] Restoring patterns', {
        patternCount: patterns.size,
        timeframeChanged,
        timeframe
      });

      // Clear restored patterns tracking
      restoredPatternsRef.current.clear();

      // Restore all patterns from store
      patterns.forEach((pattern, id) => {
        try {
          if (!restoredPatternsRef.current.has(id)) {
            logger.info('[PatternRestore] Restoring pattern', { id, type: pattern.type });
            // Convert store visualization to pattern visualization
            const patternViz: PatternViz = {
              type: pattern.visualization.type as PatternViz['type'],
              points: pattern.visualization.keyPoints?.map(kp => ({
                time: kp.time,
                value: kp.price
              })) || [],
              lines: pattern.visualization.lines?.map(line => ({
                point1: { time: line.start.time, value: line.start.price },
                point2: { time: line.end.time, value: line.end.price }
              })) || [],
              labels: pattern.visualization.labels?.map(label => ({
                point: { time: label.position.time, value: label.position.price },
                text: label.text,
                color: label.style?.color,
                fontSize: label.style?.fontSize
              })) as PatternViz['labels'] || []
            };
            // Convert store metrics to pattern metrics if present
            const patternMetrics = pattern.metrics ? {
              confidence: 0.8, // Default confidence as store doesn't have it
              strength: 0.7,   // Default strength as store doesn't have it
              ...(pattern.metrics.volume !== undefined && { volume: pattern.metrics.volume }),
              ...(pattern.metrics.priceChange !== undefined && { priceChange: pattern.metrics.priceChange }),
              ...(pattern.metrics.duration !== undefined && { duration: pattern.metrics.duration })
            } : undefined;
            patternRenderer.renderPattern(id, patternViz, pattern.type, patternMetrics);
            restoredPatternsRef.current.add(id);
          }
        } catch (error) {
          logger.error('[PatternRestore] Failed to restore pattern', { 
            id, 
            type: pattern.type,
            error 
          });
        }
      });

      logger.info('[PatternRestore] Pattern restoration complete', {
        restoredCount: restoredPatternsRef.current.size
      });
    }
  }, [patternRenderer, isChartReady, patterns, timeframe]);

  // Clean up when component unmounts
  useEffect(() => {
    const restoredPatterns = restoredPatternsRef.current;
    return () => {
      restoredPatterns.clear();
    };
  }, []);
}