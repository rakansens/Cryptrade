import { useEffect } from 'react';
import { usePatternActions, usePatternStore } from '@/store/chart';
import { validatePatternEvent } from '@/types/events/pattern-events';
import { 
  handleAgentError, 
  showAgentSuccess, 
  handleValidationError,
  getPatternRenderer 
} from '@/lib/chart/agent-utils';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';

/**
 * Pattern Event Handlers Hook
 * 
 * パターン関連のカスタムイベント（追加、削除、スタイル更新）を処理
 */

export function usePatternEventHandlers(handlers: ChartEventHandlers) {
  const {
    addPattern,
    removePattern,
    clearPatterns,
  } = usePatternActions();

  useEffect(() => {
    // Add Pattern Handler
    const handleAddPattern = (event: CustomEvent) => {
      const validation = validatePatternEvent('chart:addPattern', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:addPattern',
          operation: 'Add pattern',
          payload: event.detail,
        });
        return;
      }

      const { id, pattern } = validation.data.data;
      logger.info('[Pattern Event] Handling add pattern', { 
        id, 
        patternType: pattern.type,
        hasMetrics: !!pattern.metrics,
        metrics: pattern.metrics
      });
      
      try {
        // Store pattern in state
        addPattern(id, pattern);
        
        // Get current PatternRenderer instance
        const currentPatternRenderer = getPatternRenderer(handlers);
        
        if (!currentPatternRenderer) {
          logger.warn('[Pattern Event] Pattern renderer not available');
          handleAgentError(new Error('Pattern renderer not initialized'), {
            eventType: 'chart:addPattern',
            operation: 'Add pattern',
            id,
          }, 'Pattern renderer not initialized');
          return;
        }
        
        // Render the pattern
        currentPatternRenderer.renderPattern(
          id, 
          pattern.visualization, 
          pattern.type,
          pattern.metrics // Pass metrics for target/stop loss lines
        );
        
        showAgentSuccess({
          eventType: 'chart:addPattern',
          operation: 'Add pattern',
          id,
        }, `Pattern "${pattern.type}" added to chart`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:addPattern',
          operation: 'Add pattern',
          id,
          payload: { id, pattern },
        });
      }
    };
    
    // Remove Pattern Handler
    const handleRemovePattern = (event: CustomEvent) => {
      const validation = validatePatternEvent('chart:removePattern', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:removePattern',
          operation: 'Remove pattern',
          payload: event.detail,
        });
        return;
      }

      const { id } = validation.data.data;
      logger.info('[Pattern Event] Handling remove pattern', { id });
      
      try {
        // Check patterns in store first
        const patterns = usePatternStore.getState().patterns;
        logger.info('[Pattern Event] Current patterns in store:', { 
          patternIds: Array.from(patterns.keys()),
          requestedId: id,
          hasPattern: patterns.has(id)
        });
        
        // Remove from store
        removePattern(id);
        
        // Get current PatternRenderer instance
        const currentPatternRenderer = getPatternRenderer(handlers);
        
        if (!currentPatternRenderer) {
          logger.warn('[Pattern Event] Pattern renderer not available');
          handleAgentError(new Error('Pattern renderer not available'), {
            eventType: 'chart:removePattern',
            operation: 'Remove pattern',
            id,
          }, 'Pattern renderer not available');
          return;
        }
        
        // Remove from renderer
        currentPatternRenderer.removePattern(id);
        
        // Verify removal
        const patternsAfter = usePatternStore.getState().patterns;
        logger.info('[Pattern Event] Pattern removal complete', { 
          id, 
          stillInStore: patternsAfter.has(id),
          remainingPatterns: patternsAfter.size 
        });
        
        showAgentSuccess({
          eventType: 'chart:removePattern',
          operation: 'Remove pattern',
          id,
        }, 'Pattern removed from chart');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:removePattern',
          operation: 'Remove pattern',
          id,
          payload: { id },
        });
      }
    };
    
    // Update Pattern Style Handler
    const handleUpdatePatternStyle = (event: CustomEvent) => {
      const validation = validatePatternEvent('chart:updatePatternStyle', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:updatePatternStyle',
          operation: 'Update pattern style',
          payload: event.detail,
        });
        return;
      }

      const { patternId, patternStyle, lineStyles, immediate } = validation.data.data;
      logger.info('[Pattern Event] Handling update pattern style', { 
        patternId, 
        patternStyle, 
        lineStyles, 
        immediate 
      });
      
      try {
        const patterns = usePatternStore.getState().patterns;
        const pattern = patterns.get(patternId);
        
        if (!pattern) {
          logger.warn('[Pattern Event] Pattern not found for style update', { patternId });
          handleAgentError(new Error('Pattern not found'), {
            eventType: 'chart:updatePatternStyle',
            operation: 'Update pattern style',
            id: patternId,
          }, 'パターンが見つかりません');
          return;
        }
        
        // Get current PatternRenderer instance
        const currentPatternRenderer = getPatternRenderer(handlers);
        
        if (!currentPatternRenderer) {
          logger.error('[Pattern Event] Pattern renderer not available for style update');
          handleAgentError(new Error('Pattern renderer not available'), {
            eventType: 'chart:updatePatternStyle',
            operation: 'Update pattern style',
            id: patternId,
          }, 'パターンレンダラーが利用できません');
          return;
        }
        
        // Apply pattern style updates
        if (patternStyle) {
          logger.info('[Pattern Event] Applying pattern style updates', { patternStyle });
          
          // Handle base style updates (color, lineWidth, etc.)
          if (patternStyle.baseStyle) {
            const baseStyle = patternStyle.baseStyle;
            logger.info('[Pattern Event] Applying base style to pattern', { baseStyle });
            
            // Update the pattern visualization with new base style
            if (pattern.visualization) {
              // Update line styles
              if (pattern.visualization.lines) {
                pattern.visualization.lines = pattern.visualization.lines.map((line) => ({
                  ...line,
                  style: {
                    ...line.style,
                    ...(baseStyle.color !== undefined && { color: baseStyle.color }),
                    ...(baseStyle.lineWidth !== undefined && { lineWidth: baseStyle.lineWidth }),
                    ...(baseStyle.lineStyle !== undefined && { lineStyle: baseStyle.lineStyle }),
                  }
                }));
              }
              
              // Update zone styles
              if (pattern.visualization.zones) {
                pattern.visualization.zones = pattern.visualization.zones.map((zone) => ({
                  ...zone,
                  style: {
                    ...zone.style,
                    ...(baseStyle.color !== undefined && { color: baseStyle.color }),
                  }
                }));
              }
            }
          }
        }
        
        // Apply line style updates
        if (lineStyles) {
          logger.info('[Pattern Event] Applying line style updates', { lineStyles });
          // TODO: Implement line-specific style updates
        }
        
        // Force redraw if immediate or base style was updated
        if (immediate || patternStyle?.baseStyle) {
          // Re-render the pattern with new styles
          currentPatternRenderer.removePattern(patternId);
          currentPatternRenderer.renderPattern(
            patternId,
            pattern.visualization,
            pattern.type,
            pattern.metrics
          );
        }
        
        showAgentSuccess({
          eventType: 'chart:updatePatternStyle',
          operation: 'Update pattern style',
          id: patternId,
        }, 'パターンスタイルを更新しました');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:updatePatternStyle',
          operation: 'Update pattern style',
          id: patternId,
          payload: { patternId, patternStyle, lineStyles, immediate },
        });
      }
    };

    // Event listeners array
    const eventListeners = [
      ['chart:addPattern', handleAddPattern],
      ['chart:removePattern', handleRemovePattern],
      ['chart:updatePatternStyle', handleUpdatePatternStyle],
    ] as const;

    // Register event listeners
    eventListeners.forEach(([eventType, handler]) => {
      window.addEventListener(eventType, handler as EventListener);
    });

    logger.info('[Pattern Event Handlers] Registered pattern event listeners', {
      eventCount: eventListeners.length,
      events: eventListeners.map(([type]) => type),
    });

    // Cleanup function
    return () => {
      eventListeners.forEach(([eventType, handler]) => {
        window.removeEventListener(eventType, handler as EventListener);
      });
      logger.info('[Pattern Event Handlers] Cleaned up pattern event listeners');
    };
  }, [
    addPattern,
    removePattern,
    clearPatterns,
    handlers.patternRenderer,
    handlers.getPatternRenderer,
  ]);
}