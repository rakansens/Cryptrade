import { useEffect } from 'react';
import { logger } from '@/lib/utils/logger';
import type { PatternRenderer, PatternVisualization, PatternMetrics } from '@/types/pattern.types';

/**
 * Debug hook for pattern renderer issues
 */
export function usePatternDebug(patternRenderer: PatternRenderer | null) {
  useEffect(() => {
    if (!patternRenderer) return;
    
    // Add debug event listeners
    const handleDebugGetState = () => {
      if (patternRenderer && patternRenderer.debugGetState) {
        const state = patternRenderer.debugGetState();
        logger.info('[PatternDebug] Current PatternRenderer state:', {
          ...state,
          timestamp: new Date().toISOString()
        });
        
        // Also log detailed metric lines info
        if (state.metricLinesDetails) {
          state.metricLinesDetails.forEach(({ id, lineCount }) => {
            logger.info(`[PatternDebug] Pattern ${id} has ${lineCount} metric lines`);
          });
        }
      }
    };
    
    const handleDebugStorePatterns = () => {
      // Get patterns from store
      const storeState = (window as Window & { __CHART_STORE__?: { getState: () => { patterns: Map<string, unknown> } } }).__CHART_STORE__?.getState();
      if (storeState) {
        const patterns = storeState.patterns;
        logger.info('[PatternDebug] Store patterns:', {
          count: patterns.size,
          ids: Array.from(patterns.keys()),
          timestamp: new Date().toISOString()
        });
      }
    };
    
    // Override removePattern to add more logging
    const originalRemovePattern = patternRenderer.removePattern;
    patternRenderer.removePattern = function(id: string) {
      logger.info('[PatternDebug] removePattern called with ID:', id);
      
      // Log current state before removal
      const stateBefore = this.debugGetState();
      logger.info('[PatternDebug] State before removal:', stateBefore);
      
      // Call original method
      const result = originalRemovePattern.call(this, id);
      
      // Log state after removal
      const stateAfter = this.debugGetState();
      logger.info('[PatternDebug] State after removal:', stateAfter);
      
      return result;
    };
    
    // Override renderPattern to add more logging
    const originalRenderPattern = patternRenderer.renderPattern;
    patternRenderer.renderPattern = function(id: string, visualization: PatternVisualization, patternType: string, metrics?: PatternMetrics) {
      logger.info('[PatternDebug] renderPattern called:', {
        id,
        patternType,
        hasMetrics: !!metrics,
        metrics
      });
      
      // Call original method
      const result = originalRenderPattern.call(this, id, visualization, patternType, metrics);
      
      // Log state after rendering
      const stateAfter = this.debugGetState();
      logger.info('[PatternDebug] State after rendering:', stateAfter);
      
      return result;
    };
    
    // Add event listeners
    window.addEventListener('debug:getPatternRendererState', handleDebugGetState);
    window.addEventListener('debug:getStorePatterns', handleDebugStorePatterns);
    
    // Cleanup
    return () => {
      window.removeEventListener('debug:getPatternRendererState', handleDebugGetState);
      window.removeEventListener('debug:getStorePatterns', handleDebugStorePatterns);
      
      // Restore original methods
      if (originalRemovePattern) {
        patternRenderer.removePattern = originalRemovePattern;
      }
      if (originalRenderPattern) {
        patternRenderer.renderPattern = originalRenderPattern;
      }
    };
  }, [patternRenderer]);
  
  return null;
}