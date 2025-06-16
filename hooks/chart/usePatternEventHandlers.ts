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
import type { PatternVisualization } from '@/types/store.types';
import type { PatternMetrics } from '@/types/pattern.types';

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
        const visualization: PatternVisualization = {
          type: (pattern.visualization as any)?.type || pattern.type,
          lines: (pattern.visualization?.lines || []).map((line: any) => {
            // Convert to PatternLine format if needed
            if ('start' in line && 'end' in line) {
              return line;
            } else if ('point1' in line && 'point2' in line) {
              return {
                start: { time: line.point1.time, price: line.point1.value },
                end: { time: line.point2.time, price: line.point2.value },
                type: line.type,
                style: line.style
              };
            } else if ('points' in line && Array.isArray(line.points) && line.points.length >= 2) {
              return {
                start: { time: line.points[0].time, price: line.points[0].value },
                end: { time: line.points[1].time, price: line.points[1].value },
                type: line.type,
                style: line.style?.lineStyle
              };
            }
            // Default case - create dummy line
            return {
              start: { time: Date.now(), price: 0 },
              end: { time: Date.now(), price: 0 },
              type: 'trend'
            };
          }),
          ...((pattern.visualization as any)?.zones && { zones: (pattern.visualization as any).zones }),
          ...((pattern.visualization as any)?.labels && { labels: (pattern.visualization as any).labels }),
          ...((pattern.visualization as any)?.keyPoints && { keyPoints: (pattern.visualization as any).keyPoints })
        };
        
        const fullPatternData: PatternData = {
          id,
          type: pattern.type,
          symbol: symbol,
          interval: timeframe,
          startTime: Date.now(),
          endTime: Date.now(),
          visualization
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
          const metrics: PatternMetrics = {
            height: pattern.metrics.height ?? 0, // Default value since it's required
            width: pattern.metrics.width ?? 0,  // Default value since it's required
            ...(pattern.metrics.angle !== undefined && { angle: pattern.metrics.angle }),
            ...(pattern.metrics.retracement !== undefined && { retracement: pattern.metrics.retracement }),
            ...(pattern.metrics.volume !== undefined && { volume: pattern.metrics.volume }),
            ...(pattern.metrics.priceChange !== undefined && { priceChange: pattern.metrics.priceChange }),
            ...(pattern.metrics.duration !== undefined && { duration: pattern.metrics.duration }),
            ...(pattern.metrics.confidence !== undefined && { confidence: pattern.metrics.confidence }),
            ...(pattern.metrics.stopLoss !== undefined && { stopLoss: pattern.metrics.stopLoss }),
            ...(pattern.metrics.entryPrice !== undefined && { entryPrice: pattern.metrics.entryPrice }),
            ...(pattern.metrics.targetPrice !== undefined && { targetPrice: pattern.metrics.targetPrice }),
            ...(pattern.metrics.riskReward !== undefined && { riskReward: pattern.metrics.riskReward }),
            ...(pattern.metrics.breakoutLevel !== undefined && { breakoutLevel: pattern.metrics.breakoutLevel })
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
              ...(pattern.metrics.targetLevel !== undefined || pattern.metrics.targetPrice !== undefined
                ? { targetLevel: pattern.metrics.targetLevel ?? pattern.metrics.targetPrice }
                : {}),
              ...(pattern.metrics.stopLoss !== undefined && { stopLoss: pattern.metrics.stopLoss }),
              ...(pattern.metrics.breakoutLevel !== undefined && { breakoutLevel: pattern.metrics.breakoutLevel })
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
                  // Handle different line structures
                  if ('start' in line && 'end' in line) {
                    // PatternLine structure from store.types.ts
                    return {
                      ...line,
                      style: baseStyle.lineStyle || line.style,
                    };
                  } else {
                    // Other line structure
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
                  }
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
        if (lineStyles && pattern.visualization?.lines) {
          logger.info('[Pattern Event] Applying line style updates', { lineStyles });
          lineStyles.forEach(({ lineId, style }) => {
            const targetLine = (pattern.visualization as any).lines.find((ln: any) => ln.id === lineId);
            if (targetLine) {
              targetLine.style = {
                ...(targetLine.style || {}),
                ...(style.color !== undefined && { color: style.color }),
                ...(style.lineWidth !== undefined && { lineWidth: style.lineWidth }),
                ...(style.lineStyle !== undefined && { lineStyle: style.lineStyle }),
              };
            } else {
              logger.warn('[Pattern Event] Line not found for style update', { patternId, lineId });
            }
          });

          // Persist updated lines back to store
          usePatternStore.setState(state => {
            const newPatterns = new Map(state.patterns);
            newPatterns.set(patternId, { ...pattern });
            return { patterns: newPatterns } as any;
          });
        }
        
        // Force redraw if immediate or any style was updated
        if (immediate || patternStyle?.baseStyle || lineStyles) {
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
              targetLevel: pattern.metrics.targetLevel ?? pattern.metrics.targetPrice,
              stopLoss: pattern.metrics.stopLoss,
              breakoutLevel: pattern.metrics.breakoutLevel
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