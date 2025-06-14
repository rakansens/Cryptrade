import { useEffect, useRef } from 'react';
import { useChartPatterns } from '@/store/chart.store';
import { logger } from '@/lib/utils/logger';
import type { PatternRenderer } from '@/types/pattern.types';

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
            patternRenderer.renderPattern(id, pattern.visualization, pattern.type, pattern.metrics);
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
    return () => {
      restoredPatternsRef.current.clear();
    };
  }, []);
}