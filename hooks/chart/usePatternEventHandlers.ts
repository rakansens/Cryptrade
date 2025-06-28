import { usePatternActions, usePatternStore, useChartBaseStore } from '@/store/chart';
import { 
  validatePatternEvent,
  type AddPatternEvent,
  type RemovePatternEvent,
  type UpdatePatternStyleEvent
} from '@/types/events/pattern-events';
import { getPatternRenderer } from '@/lib/chart/agent-utils';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';
import type { PatternData } from '@/store/chart/types';
import type { PatternVisualization } from '@/types/store.types';
import type { PatternMetrics } from '@/types/pattern.types';
import { useEventHandlerBase, createEventHandlerConfig, createEventListeners } from '@/hooks/shared/useEventHandlerBase';

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

  // Event handler configuration
  const config = createEventHandlerConfig<any>(
    {
      'chart:addPattern': 'Add pattern',
      'chart:removePattern': 'Remove pattern',
      'chart:updatePatternStyle': 'Update pattern style',
    },
    {
      'chart:addPattern': (data) => `Pattern "${data.pattern?.type}" added to chart`,
      'chart:removePattern': () => `Pattern removed`,
      'chart:updatePatternStyle': () => 'パターンスタイルを更新しました',
    },
    validatePatternEvent
  );

  // Event processors
  const processors = {
    // Add Pattern Processor
    addPattern: async (data: AddPatternEvent) => {
      const { id, pattern } = data;
      
      logger.info('[Pattern Event] Handling add pattern', { 
        id, 
        patternType: pattern.type,
        hasMetrics: !!pattern.metrics,
        metrics: pattern.metrics
      });
      
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
      
      // Add metrics from pattern data
      if (pattern.metrics) {
        const metrics: PatternMetrics = {
          ...(pattern.metrics.confidence !== undefined && { confidence: pattern.metrics.confidence }),
          ...(pattern.metrics.stopLoss !== undefined && { stopLoss: pattern.metrics.stopLoss }),
          ...(pattern.metrics.entryPrice !== undefined && { entryPrice: pattern.metrics.entryPrice }),
          ...(pattern.metrics.targetPrice !== undefined && { targetPrice: pattern.metrics.targetPrice }),
          ...(pattern.metrics.riskReward !== undefined && { riskReward: pattern.metrics.riskReward })
        };
        fullPatternData.metrics = metrics;
      }
      
      // Store pattern in state
      addPattern(id, fullPatternData);
      
      // Get current PatternRenderer instance
      const currentPatternRenderer = getPatternRenderer(handlers as any);
      
      if (!currentPatternRenderer) {
        logger.warn('[Pattern Event] Pattern renderer not available');
        throw new Error('Pattern renderer not initialized');
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
          ...(pattern.metrics.targetPrice !== undefined
            ? { targetLevel: pattern.metrics.targetPrice }
            : {}),
          ...(pattern.metrics.stopLoss !== undefined && { stopLoss: pattern.metrics.stopLoss })
        } : undefined
      );
    },

    // Remove Pattern Processor
    removePattern: async (data: RemovePatternEvent) => {
      const { id } = data;
      
      logger.info('[Pattern Event] Handling remove pattern', { patternId: id });
      
      // Remove from state
      removePattern(id);
      
      // Get PatternRenderer from handlers
      const currentPatternRenderer = getPatternRenderer(handlers as any);
      
      if (!currentPatternRenderer) {
        logger.warn('[Pattern Event] Pattern renderer not available for removal');
        throw new Error('Pattern renderer not initialized');
      }
      
      // Remove from chart
      currentPatternRenderer.removePattern(id);
    },

    // Update Pattern Style Processor
    updatePatternStyle: async (data: UpdatePatternStyleEvent) => {
      const { patternId, patternStyle, lineStyles, immediate } = data;
      
      logger.info('[Pattern Event] Handling update pattern style', { 
        patternId, 
        hasPatternStyle: !!patternStyle,
        hasLineStyles: !!lineStyles,
        immediate
      });
      
      // Get current pattern from store
      const patterns = usePatternStore.getState().patterns;
      const pattern = Array.from(patterns.values()).find(p => p.id === patternId);
      
      if (!pattern) {
        logger.warn('[Pattern Event] Pattern not found for style update', { patternId });
        throw new Error(`Pattern ${patternId} not found`);
      }
      
      // Get PatternRenderer from handlers
      const currentPatternRenderer = getPatternRenderer(handlers as any);
      
      if (!currentPatternRenderer) {
        logger.warn('[Pattern Event] Pattern renderer not available for style update');
        throw new Error('Pattern renderer not initialized');
      }
      
      // Re-render with new styles
      if (immediate) {
        // Apply styles immediately with re-render
        const updatedVisualization = {
          ...pattern.visualization,
        };
        
        // Apply pattern-level styles
        if (patternStyle) {
          if ('zones' in updatedVisualization && Array.isArray(updatedVisualization.zones)) {
            updatedVisualization.zones = updatedVisualization.zones.map((zone: any) => ({
              ...zone,
              style: { ...zone.style, ...patternStyle }
            }));
          }
        }
        
        // Apply line-specific styles
        if (lineStyles && 'lines' in updatedVisualization && Array.isArray(updatedVisualization.lines)) {
          updatedVisualization.lines = updatedVisualization.lines.map((line: any, index: number) => {
            const specificStyle = lineStyles[index];
            return specificStyle ? {
              ...line,
              style: { ...line.style, ...specificStyle }
            } : line;
          });
        }
        
        // Transform visualization for areas if needed
        let patternVisualization = updatedVisualization;
        
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
            ...(pattern.metrics.targetPrice !== undefined && { targetLevel: pattern.metrics.targetPrice }),
            ...(pattern.metrics.stopLoss !== undefined && { stopLoss: pattern.metrics.stopLoss })
          } : undefined
        );
      }
    }
  };

  // Create event listeners
  const eventListeners = createEventListeners([
    { eventType: 'chart:addPattern', processor: processors.addPattern },
    { eventType: 'chart:removePattern', processor: processors.removePattern },
    { eventType: 'chart:updatePatternStyle', processor: processors.updatePatternStyle },
  ]);

  // Use the base hook
  useEventHandlerBase(config, eventListeners, [
    addPattern,
    removePattern,
    clearPatterns,
    handlers.patternRenderer,
    handlers.getPatternRenderer,
  ]);
}