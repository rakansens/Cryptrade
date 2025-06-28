/**
 * Refactored Drawing Event Handlers
 * 
 * Example of using useEventHandlerFramework to reduce code duplication
 * Reduces from ~420 lines to ~200 lines while maintaining all functionality
 */

import { useCallback } from 'react';
import { useDrawingActions, useChartStore, useDrawingStore } from '@/store/chart';
import { useAddApprovedDrawing } from '@/store/proposal-approval.store';
import { 
  useEventHandlerFramework, 
  createEventDefinition,
  commonValidators,
  commonSuccessMessages,
  type EventDefinition 
} from '@/hooks/shared/useEventHandlerFramework';
import { validateChartDrawing, type DrawingStyle, type ChartDrawing } from '@/types/drawing';
import { validateDrawingEvent } from '@/types/events/drawing-events';
import { executeDrawingOperation, prepareDrawingData } from '@/lib/chart/agent-utils';
import { useCursor } from './useCursor';
import type { Time } from 'lightweight-charts';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';
import type { DrawingMode, ChartDrawing as ChartDrawingLW } from '@/types/chart.types';

// Helper function to convert between ChartDrawing types
function toChartDrawingLW(drawing: ChartDrawing): ChartDrawingLW {
  return {
    ...drawing,
    points: drawing.points.map(p => ({
      time: p.time as Time,
      value: p.value
    })),
    style: {
      ...drawing.style,
      showLabels: drawing.style.showLabels ?? false
    }
  } as ChartDrawingLW;
}

/**
 * Refactored Drawing Event Handlers using the framework
 */
export function useDrawingEventHandlersRefactored(handlers: ChartEventHandlers) {
  const {
    setDrawingMode,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    clearAllDrawings,
    setIsDrawing,
  } = useDrawingActions();

  const undo = useChartStore((state) => state.undo);
  const redo = useChartStore((state) => state.redo);
  const getState = () => useDrawingStore.getState();

  const { setDrawingCursor, resetCursor } = useCursor();

  // Create event definitions
  const eventDefinitions: EventDefinition[] = [
    // Start Drawing
    createEventDefinition({
      type: 'chart:startDrawing',
      operation: 'Start drawing',
      validate: (data: any) => validateDrawingEvent('chart:startDrawing', data),
      processor: (data: any) => {
        setDrawingMode(data.type as DrawingMode);
        setIsDrawing(true);
        setDrawingCursor();
      },
      successMessage: (data: any) => `Started ${data.type} drawing`,
    }),

    // Add Drawing
    createEventDefinition({
      type: 'chart:addDrawing',
      operation: 'Add drawing',
      validate: (data: any) => validateDrawingEvent('chart:addDrawing', data),
      processor: async (data: any) => {
        const points = data.points?.map((p: any) => ({
          time: p.time as Time,
          value: p.value
        }));
        
        const drawingData = prepareDrawingData({
          id: data.id,
          type: data.type,
          points: points || [],
          style: {
            color: data.style?.color ?? '#3498db',
            lineWidth: data.style?.lineWidth ?? 2,
            lineStyle: data.style?.lineStyle ?? 'solid',
            showLabels: data.style?.showLabels ?? false
          },
          ...(data.price !== undefined && { price: data.price }),
          ...(data.time !== undefined && { time: data.time }),
          ...(data.levels !== undefined && { levels: data.levels }),
        });
        
        const validatedDrawing = validateChartDrawing(drawingData);
        
        await executeDrawingOperation(async () => {
          addDrawing(validatedDrawing);
          
          if (handlers.drawingManager) {
            handlers.drawingManager.addDrawing(toChartDrawingLW(validatedDrawing));
          }
        }, {
          eventType: 'chart:addDrawing',
          operation: 'Add drawing',
          id: data.id,
        });
        
        setIsDrawing(false);
        setDrawingMode('none');
        resetCursor();
      },
      successMessage: (data: any) => `Drawing ${data.type} added`,
      async: true,
    }),

    // Add Drawing with Metadata
    createEventDefinition({
      type: 'chart:addDrawingWithMetadata',
      operation: 'Add drawing with metadata',
      validate: commonValidators.hasRequiredFields(['id', 'type', 'points']),
      processor: async (data: any) => {
        const drawingData = {
          id: data.id,
          type: data.type,
          points: data.points,
          style: {
            color: data.style?.color || '#ff0000',
            lineWidth: data.style?.lineWidth || 2,
            lineStyle: data.style?.lineStyle || 'solid',
            showLabels: data.style?.showLabels ?? true
          },
          visible: data.visible ?? true,
          interactive: data.interactive ?? true,
          ...(data.price !== undefined && { price: data.price }),
          ...(data.time !== undefined && { time: data.time }),
          ...(data.levels !== undefined && { levels: data.levels }),
          ...(data.metadata !== undefined && { metadata: data.metadata }),
        };
        
        const validDrawing = validateChartDrawing(drawingData);
        
        addDrawing(validDrawing);
        
        if (handlers.drawingManager) {
          handlers.drawingManager.addDrawing(toChartDrawingLW(validDrawing));
        }
      },
      successMessage: 'Proposal drawing added to chart',
    }),

    // Delete Drawing
    createEventDefinition({
      type: 'chart:deleteDrawing',
      operation: 'Delete drawing',
      validate: commonValidators.hasId,
      processor: async (data: any) => {
        await executeDrawingOperation(async () => {
          deleteDrawing(data.id);
          
          if (handlers.drawingManager) {
            handlers.drawingManager.removeDrawing(data.id);
          }
        }, {
          eventType: 'chart:deleteDrawing',
          operation: 'Delete drawing',
          id: data.id,
        });
      },
      successMessage: 'Drawing removed successfully',
      async: true,
    }),

    // Clear All Drawings
    createEventDefinition({
      type: 'chart:clearAllDrawings',
      operation: 'Clear all drawings',
      processor: () => {
        clearAllDrawings();
        
        if (handlers.drawingManager) {
          handlers.drawingManager.clearAll();
        }
        
        setDrawingMode('none');
        setIsDrawing(false);
        resetCursor();
      },
      successMessage: 'All drawings cleared',
    }),

    // Undo/Redo operations
    createEventDefinition({
      type: 'chart:undo',
      operation: 'Undo',
      validate: (data: any) => data && typeof data.steps === 'number' && data.steps > 0,
      processor: (data: any) => {
        for (let i = 0; i < data.steps; i++) {
          undo();
        }
      },
      successMessage: (data: any) => `Undid ${data.steps} step(s)`,
    }),

    createEventDefinition({
      type: 'chart:redo',
      operation: 'Redo',
      validate: (data: any) => data && typeof data.steps === 'number' && data.steps > 0,
      processor: (data: any) => {
        for (let i = 0; i < data.steps; i++) {
          redo();
        }
      },
      successMessage: (data: any) => `Redid ${data.steps} step(s)`,
    }),

    // Style updates
    createEventDefinition({
      type: 'chart:updateDrawingStyle',
      operation: 'Update drawing style',
      validate: commonValidators.hasRequiredFields(['drawingId', 'style']),
      processor: (data: any) => {
        const drawings = getState().drawings;
        const drawing = drawings.find((d) => d.id === data.drawingId);
        
        if (!drawing) {
          throw new Error('Drawing not found');
        }
        
        const currentStyle = drawing.style || {
          color: '#3498db',
          lineWidth: 2,
          lineStyle: 'solid' as const,
          showLabels: false
        };
        
        const validStyle: DrawingStyle = {
          color: data.style.color ?? currentStyle.color,
          lineWidth: data.style.lineWidth ?? currentStyle.lineWidth,
          lineStyle: data.style.lineStyle ?? currentStyle.lineStyle,
          showLabels: data.style.showLabels ?? currentStyle.showLabels,
        };

        updateDrawing(data.drawingId, { style: validStyle });

        if (handlers.drawingManager) {
          handlers.drawingManager.updateDrawing(data.drawingId, { style: validStyle });
          
          if (data.immediate && (handlers.drawingManager as any).redrawDrawing) {
            (handlers.drawingManager as any).redrawDrawing(data.drawingId);
          }
        }
      },
      successMessage: 'スタイルを更新しました',
    }),

    // Update all styles
    createEventDefinition({
      type: 'chart:updateAllStyles',
      operation: 'Update all styles',
      validate: commonValidators.hasRequiredFields(['type', 'style']),
      processor: (data: any) => {
        const drawings = getState().drawings.filter((d) => d.type === data.type);
        
        drawings.forEach((drawing) => {
          const mergedStyle: DrawingStyle = {
            color: data.style.color ?? drawing.style.color,
            lineWidth: data.style.lineWidth ?? drawing.style.lineWidth,
            lineStyle: data.style.lineStyle ?? drawing.style.lineStyle,
            showLabels: data.style.showLabels ?? drawing.style.showLabels ?? false,
          };
          updateDrawing(drawing.id, { style: mergedStyle });
          
          if (handlers.drawingManager) {
            handlers.drawingManager.updateDrawing(drawing.id, { style: mergedStyle });
          }
        });
      },
      successMessage: (data: any) => 
        `Updated ${getState().drawings.filter(d => d.type === data.type).length} ${data.type} drawings`,
    }),
  ];

  // Shorthand operations
  const shorthandOps = [
    { type: 'chart:undoLastDrawing', baseType: 'chart:undo', data: { steps: 1 } },
    { type: 'chart:redoLastDrawing', baseType: 'chart:redo', data: { steps: 1 } },
  ];

  shorthandOps.forEach(({ type, baseType, data }) => {
    const baseEvent = eventDefinitions.find(e => e.type === baseType);
    if (baseEvent) {
      eventDefinitions.push({
        ...baseEvent,
        type,
        operation: type.split(':')[1],
        processor: () => baseEvent.processor(data),
        successMessage: type.includes('undo') ? 'Last drawing removed' : 'Last drawing restored',
      });
    }
  });

  // Use the event handler framework
  const framework = useEventHandlerFramework({
    domain: 'chart',
    hookName: 'useDrawingEventHandlers',
    events: eventDefinitions,
    enableNotifications: true,
    logLevel: 'info',
  });

  // Return framework capabilities if needed
  return framework;
}