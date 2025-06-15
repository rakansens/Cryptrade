import { useEffect } from 'react';
import { usePatternActions, usePatternStore, useChartBaseStore } from '@/store/chart';
import { 
  validatePatternEvent,
  type AddPatternEvent,
  type RemovePatternEvent,
  type UpdatePatternStyleEvent
} from '@/types/events/pattern-events';
import { 
  handleAgentError, 
  showAgentSuccess, 
  handleValidationError,
  getPatternRenderer 
} from '@/lib/chart/agent-utils';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';
import type { PatternData } from '@/store/chart/types';
import type { PatternMetrics, PatternVisualization } from '@/types/store.types';

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
  
  const { symbol, timeframe } = useChartBaseStore();

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

      const { id, pattern } = validation.data.data as AddPatternEvent;
      logger.info('[Pattern Event] Handling add pattern', { 
        id, 
        patternType: pattern.type,
        hasMetrics: !!pattern.metrics,
        metrics: pattern.metrics
      });
      
      try {
        // Create full PatternData object with required fields
        const fullPatternData: PatternData = {
          id,
          type: pattern.type,
          symbol: symbol,
          interval: timeframe,
          startTime: Date.now(),
          endTime: Date.now(),
          visualization: pattern.visualization || { keyPoints: [] } as PatternVisualization
        };
        
        // Add optional properties
        if (pattern.tradingImplication) {
          fullPatternData.description = pattern.tradingImplication;
          fullPatternData.tradingImplication = pattern.tradingImplication;
        }
        if (pattern.confidence !== undefined) {
          fullPatternData.confidence = pattern.confidence;
        }
        
        // Add metrics with required fields
        if (pattern.metrics) {
          // Cast to any to handle type mismatch between different PatternMetrics definitions
          const anyMetrics = pattern.metrics as any;
          
          // Ensure required fields are present
          const metrics: PatternMetrics = {
            height: anyMetrics.height ?? 0, // Default value since it's required
            width: anyMetrics.width ?? 0,  // Default value since it's required
            ...(anyMetrics.angle !== undefined && { angle: anyMetrics.angle }),
            ...(anyMetrics.retracement !== undefined && { retracement: anyMetrics.retracement }),
            ...(anyMetrics.volume !== undefined && { volume: anyMetrics.volume }),
            ...(anyMetrics.priceChange !== undefined && { priceChange: anyMetrics.priceChange }),
            ...(anyMetrics.duration !== undefined && { duration: anyMetrics.duration }),
            ...(anyMetrics.confidence !== undefined && { confidence: anyMetrics.confidence }),
            ...(anyMetrics.stopLoss !== undefined && { stopLoss: anyMetrics.stopLoss }),
            ...(anyMetrics.entryPrice !== undefined && { entryPrice: anyMetrics.entryPrice }),
            ...(anyMetrics.targetPrice !== undefined && { targetPrice: anyMetrics.targetPrice }),
            ...(anyMetrics.riskReward !== undefined && { riskReward: anyMetrics.riskReward }),
            ...(anyMetrics.breakoutLevel !== undefined && { breakoutLevel: anyMetrics.breakoutLevel })
          };
          fullPatternData.metrics = metrics;
        }
        
        // Store pattern in state
        addPattern(id, fullPatternData);
        
        // Get current PatternRenderer instance
        const currentPatternRenderer = getPatternRenderer(handlers as any);
        
        if (!currentPatternRenderer) {
          logger.warn('[Pattern Event] Pattern renderer not available');
          handleAgentError(new Error('Pattern renderer not initialized'), {
            eventType: 'chart:addPattern',
            operation: 'Add pattern',
            id,
          }, 'Pattern renderer not initialized');
          return;
        }
        
        // Transform visualization if needed
        let patternVisualization = pattern.visualization;
        
        // If visualization has markers instead of keyPoints, transform it
        if (pattern.visualization && 'markers' in pattern.visualization) {
          const markers = (pattern.visualization as any).markers || [];
          patternVisualization = {
            lines: (pattern.visualization as any).lines?.map((l: any, idx: number) => ({
              from: idx * 2,
              to: idx * 2 + 1,
              type: 'outline' as const,
              style: l.style
            })) || [],
            keyPoints: markers.map((m: any) => ({
              time: m.time,
              value: m.value,
              type: 'peak' as const,
              label: m.text
            })),
            areas: (pattern.visualization as any).zones?.map((z: any) => ({
              points: [0, 1, 2, 3], // Simple placeholder
              style: z.style
            }))
          } as any;
        }
        
        // Render the pattern
        currentPatternRenderer.renderPattern(
          id, 
          patternVisualization as any, 
          pattern.type,
          pattern.metrics ? {
            ...(pattern.metrics.targetPrice !== undefined && { target_level: pattern.metrics.targetPrice }),
            ...(pattern.metrics.stopLoss !== undefined && { stop_loss: pattern.metrics.stopLoss }),
            ...((pattern.metrics as any).breakoutLevel !== undefined && { breakout_level: (pattern.metrics as any).breakoutLevel })
          } : undefined
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

      const { id } = validation.data.data as RemovePatternEvent;
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
        const currentPatternRenderer = getPatternRenderer(handlers as any);
        
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

      const { patternId, patternStyle, lineStyles, immediate } = validation.data.data as UpdatePatternStyleEvent;
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
        const currentPatternRenderer = getPatternRenderer(handlers as any);
        
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
                pattern.visualization.lines = pattern.visualization.lines.map((line: any) => {
                  // Ensure line is an object before spreading
                  const baseLine = typeof line === 'object' && line !== null ? line : {};
                  return {
                    ...baseLine,
                    style: {
                      ...(baseLine.style && typeof baseLine.style === 'object' ? baseLine.style : {}),
                      ...(baseStyle.color !== undefined && { color: baseStyle.color }),
                      ...(baseStyle.lineWidth !== undefined && { lineWidth: baseStyle.lineWidth }),
                      ...(baseStyle.lineStyle !== undefined && { lineStyle: baseStyle.lineStyle }),
                    }
                  };
                });
              }
              
              // Update zone styles
              if ('areas' in pattern.visualization && (pattern.visualization as any).areas) {
                (pattern.visualization as any).areas = (pattern.visualization as any).areas.map((area: any) => ({
                  ...area,
                  style: {
                    ...area.style,
                    ...(baseStyle.color !== undefined && { fillColor: baseStyle.color }),
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
          // Transform visualization if needed
          let patternVisualization = pattern.visualization;
          
          // If visualization has markers instead of keyPoints, transform it
          if (pattern.visualization && 'markers' in pattern.visualization) {
            const markers = (pattern.visualization as any).markers || [];
            patternVisualization = {
              type: pattern.visualization?.type || 'pattern',
              lines: (pattern.visualization as any).lines?.map((l: any, idx: number) => ({
                from: idx * 2,
                to: idx * 2 + 1,
                type: 'outline' as const,
                style: l.style
              })) || [],
              keyPoints: markers.map((m: any) => ({
                time: m.time,
                value: m.value,
                type: 'peak' as const,
                label: m.text
              })),
              zones: (pattern.visualization as any).zones?.map((z: any) => ({
                points: [0, 1, 2, 3], // Simple placeholder
                style: z.style
              }))
            } as any;
          }
          
          currentPatternRenderer.removePattern(patternId);
          currentPatternRenderer.renderPattern(
            patternId,
            patternVisualization as any,
            pattern.type,
            pattern.metrics ? {
              target_level: (pattern.metrics as any).targetPrice || (pattern.metrics as any).target_level,
              stop_loss: (pattern.metrics as any).stopLoss || (pattern.metrics as any).stop_loss,
              breakout_level: (pattern.metrics as any).breakoutLevel || (pattern.metrics as any).breakout_level
            } : undefined
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