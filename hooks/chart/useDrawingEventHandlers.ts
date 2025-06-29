import { useEffect } from 'react';
import { useDrawingActions, useChartStore, useDrawingStore } from '@/store/chart';
import {
  validateDrawingEvent,
  type StartDrawingEvent,
  type AddDrawingEvent,
  type DeleteDrawingEvent,
  type UpdateDrawingStyleEvent,
  type UpdateAllStylesEvent,
  type UpdateDrawingColorEvent,
  type UpdateDrawingLineWidthEvent,
  type UndoEvent,
  type RedoEvent
} from '@/types/events/drawing-events';
import { validateChartDrawing, type DrawingStyle, type ChartDrawing } from '@/types/drawing';
import { 
  executeDrawingOperation,
  prepareDrawingData 
} from '@/lib/chart/agent-utils';
import { useCursor } from './useCursor';
import type { Time } from 'lightweight-charts';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';
import type { DrawingMode, ChartDrawing as ChartDrawingLW } from '@/types/chart.types';
import {
  useEventHandlerBase,
  createEventHandlerConfig,
  createEventListeners,
  type EventProcessor
} from '../shared';
import { logger } from '@/lib/utils/logger';

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
 * Drawing Event Handlers Hook
 * 
 * 描画関連のカスタムイベント（追加、削除、スタイル更新、undo/redo等）を処理
 * 基盤フック useEventHandlerBase を使用してコードの重複を削減
 */

// Event type union for better type safety
type DrawingEventData = 
  | StartDrawingEvent
  | AddDrawingEvent
  | DeleteDrawingEvent
  | UpdateDrawingStyleEvent
  | UpdateAllStylesEvent
  | UpdateDrawingColorEvent
  | UpdateDrawingLineWidthEvent
  | UndoEvent
  | RedoEvent;

export function useDrawingEventHandlers(handlers: ChartEventHandlers) {
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

  // Event operation mappings
  const operations = {
    'chart:startDrawing': 'Start drawing',
    'chart:addDrawing': 'Add drawing',
    'chart:addDrawingWithMetadata': 'Add drawing with metadata',
    'chart:deleteDrawing': 'Delete drawing',
    'chart:clearAllDrawings': 'Clear all drawings',
    'chart:undo': 'Undo',
    'chart:redo': 'Redo',
    'chart:undoLastDrawing': 'Undo last drawing',
    'chart:redoLastDrawing': 'Redo last drawing',
    'chart:updateDrawingStyle': 'Update drawing style',
    'chart:updateAllStyles': 'Update all styles',
    'chart:updateDrawingColor': 'Update drawing color',
    'chart:updateDrawingLineWidth': 'Update drawing line width',
  };

  // Success message generators (generic to avoid type conflicts)
  const successMessages = {
    'chart:startDrawing': (data: any) => 
      `Started ${data.type} drawing`,
    'chart:addDrawing': (data: any) => 
      `Drawing ${data.type} added`,
    'chart:addDrawingWithMetadata': () => 
      'Proposal drawing added to chart',
    'chart:deleteDrawing': () => 
      'Drawing removed successfully',
    'chart:clearAllDrawings': () => 
      'All drawings cleared',
    'chart:undo': (data: any) => 
      `Undid ${data.steps} step(s)`,
    'chart:redo': (data: any) => 
      `Redid ${data.steps} step(s)`,
    'chart:undoLastDrawing': () => 
      'Last drawing removed',
    'chart:redoLastDrawing': () => 
      'Last drawing restored',
    'chart:updateDrawingStyle': () => 
      'スタイルを更新しました',
    'chart:updateAllStyles': (data: any) => 
      `Updated ${getState().drawings.filter(d => d.type === data.type).length} ${data.type} drawings`,
    'chart:updateDrawingColor': () => 
      'Drawing color updated',
    'chart:updateDrawingLineWidth': () => 
      'Line width updated',
  };

  // Event handler configuration
  const config = createEventHandlerConfig<any>(
    operations,
    successMessages,
    validateDrawingEvent
  );

  // Event processors (using any type to avoid type conflicts)
  const startDrawingProcessor: EventProcessor<any> = (data) => {
    setDrawingMode(data.type as DrawingMode);
    setIsDrawing(true);
    setDrawingCursor();
  };

  const addDrawingProcessor: EventProcessor<any> = async (data) => {
    // Convert event data points to DrawingPoint format with Time type
    const points = data.points?.map((p: any) => ({
      time: p.time as Time,
      value: p.value
    }));
    
    // Create drawing data with required fields
    const drawingData: Parameters<typeof prepareDrawingData>[0] = {
      id: data.id,
      type: data.type,
      points: points || [],
      style: {
        color: data.style?.color ?? '#3498db',
        lineWidth: data.style?.lineWidth ?? 2,
        lineStyle: data.style?.lineStyle ?? 'solid',
        showLabels: data.style?.showLabels ?? false
      }
    };
    
    // Add optional properties only if they have values
    if (data.price !== undefined) {
      drawingData.price = data.price;
    }
    if (data.time !== undefined) {
      drawingData.time = data.time;
    }
    if (data.levels !== undefined) {
      drawingData.levels = data.levels;
    }
    
    const drawing = prepareDrawingData(drawingData);
    const validatedDrawing = validateChartDrawing(drawing);
    
    await executeDrawingOperation(async () => {
      // Use async version if available
      if ('addDrawingAsync' in addDrawing) {
        await (addDrawing as { addDrawingAsync: (drawing: ChartDrawing) => Promise<ChartDrawing> }).addDrawingAsync(validatedDrawing);
      } else {
        addDrawing(validatedDrawing);
      }
      
      // Add to chart if drawing manager is available
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
  };

  const addDrawingWithMetadataProcessor: EventProcessor<any> = async (data) => {
    // Validate drawing data structure
    const drawingData: any = {
      id: data.id,
      type: data.type,
      points: data.points,
      style: {
        color: data.style?.color || '#ff0000',
        lineWidth: data.style?.lineWidth || 2,
        lineStyle: data.style?.lineStyle || 'solid',
        showLabels: data.style?.showLabels !== undefined ? data.style.showLabels : true
      },
      visible: data.visible !== undefined ? data.visible : true,
      interactive: data.interactive !== undefined ? data.interactive : true
    };
    
    // Add optional properties only if they have values
    if (data.price !== undefined) {
      drawingData.price = data.price;
    }
    if (data.time !== undefined) {
      drawingData.time = data.time;
    }
    if (data.levels !== undefined) {
      drawingData.levels = data.levels;
    }
    if (data.metadata !== undefined) {
      drawingData.metadata = data.metadata;
    }
    
    const validDrawing = validateChartDrawing(drawingData);
    
    // Add to store
    addDrawing(validDrawing);
    
    // Add to chart if drawing manager is available
    if (handlers.drawingManager) {
      handlers.drawingManager.addDrawing(toChartDrawingLW(validDrawing));
    } else {
      logger.warn('[Drawing Event] No drawing manager available');
    }
  };

  const deleteDrawingProcessor: EventProcessor<any> = async (data) => {
    await executeDrawingOperation(async () => {
      // Use async version if available
      if ('deleteDrawingAsync' in deleteDrawing) {
        await (deleteDrawing as { deleteDrawingAsync: (id: string) => Promise<void> }).deleteDrawingAsync(data.id);
      } else {
        deleteDrawing(data.id);
      }
      
      // Remove from chart if drawing manager is available
      if (handlers.drawingManager) {
        handlers.drawingManager.removeDrawing(data.id);
      }
    }, {
      eventType: 'chart:deleteDrawing',
      operation: 'Delete drawing',
      id: data.id,
    });
  };

  const clearAllDrawingsProcessor: EventProcessor<any> = () => {
    clearAllDrawings();
    
    // Clear from chart if drawing manager is available
    if (handlers.drawingManager) {
      handlers.drawingManager.clearAll();
    }
    
    setDrawingMode('none');
    setIsDrawing(false);
    resetCursor();
  };

  const undoProcessor: EventProcessor<any> = (data) => {
    for (let i = 0; i < data.steps; i++) {
      undo();
    }
  };

  const redoProcessor: EventProcessor<any> = (data) => {
    for (let i = 0; i < data.steps; i++) {
      redo();
    }
  };

  const undoLastDrawingProcessor: EventProcessor<any> = () => {
    undo();
  };

  const redoLastDrawingProcessor: EventProcessor<any> = () => {
    redo();
  };

  const updateDrawingStyleProcessor: EventProcessor<any> = (data) => {
    const drawings = getState().drawings;
    const drawing = drawings.find((d) => d.id === data.drawingId);
    
    if (!drawing) {
      throw new Error('Drawing not found');
    }
    
    // Merge with existing style - ensure all required properties
    const currentStyle = drawing.style || {
      color: '#3498db',
      lineWidth: 2,
      lineStyle: 'solid' as const,
      showLabels: false
    };
    
    const validStyle: DrawingStyle = {
      color: data.style.color !== undefined ? data.style.color : currentStyle.color,
      lineWidth: data.style.lineWidth !== undefined ? data.style.lineWidth : currentStyle.lineWidth,
      lineStyle: data.style.lineStyle !== undefined ? data.style.lineStyle : currentStyle.lineStyle,
      showLabels: data.style.showLabels !== undefined ? data.style.showLabels : currentStyle.showLabels ?? false,
    };

    updateDrawing(data.drawingId, { style: validStyle });

    if (handlers.drawingManager) {
      handlers.drawingManager.updateDrawing(data.drawingId, { style: validStyle });
      
      // If immediate flag is set, force redraw
      if (data.immediate && (handlers.drawingManager as { redrawDrawing?: (id: string) => void })?.redrawDrawing) {
        (handlers.drawingManager as unknown as { redrawDrawing: (id: string) => void }).redrawDrawing(data.drawingId);
      }
    }
  };

  const updateAllStylesProcessor: EventProcessor<any> = (data) => {
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
  };

  const updateDrawingColorProcessor: EventProcessor<any> = (data) => {
    const drawing = getState().drawings.find((d) => d.id === data.id);
    if (!drawing) {
      throw new Error('Drawing not found');
    }
    
    const validStyle: DrawingStyle = {
      color: data.color,
      lineWidth: drawing.style?.lineWidth ?? 2,
      lineStyle: drawing.style?.lineStyle ?? 'solid',
      showLabels: drawing.style?.showLabels ?? false,
    };
    
    updateDrawing(data.id, { style: validStyle });
    
    if (handlers.drawingManager) {
      handlers.drawingManager.updateDrawing(data.id, { style: validStyle });
    }
  };

  const updateDrawingLineWidthProcessor: EventProcessor<any> = (data) => {
    const drawing = getState().drawings.find((d) => d.id === data.id);
    if (!drawing) {
      throw new Error('Drawing not found');
    }
    
    const validStyle: DrawingStyle = {
      color: drawing.style?.color ?? '#00e676',
      lineWidth: data.lineWidth,
      lineStyle: drawing.style?.lineStyle ?? 'solid',
      showLabels: drawing.style?.showLabels ?? false,
    };
    
    updateDrawing(data.id, { style: validStyle });
    
    if (handlers.drawingManager) {
      handlers.drawingManager.updateDrawing(data.id, { style: validStyle });
    }
  };

  // Event listener configurations
  const eventListeners = createEventListeners([
    { eventType: 'chart:startDrawing', processor: startDrawingProcessor },
    { eventType: 'chart:addDrawing', processor: addDrawingProcessor },
    { eventType: 'chart:addDrawingWithMetadata', processor: addDrawingWithMetadataProcessor },
    { eventType: 'chart:deleteDrawing', processor: deleteDrawingProcessor },
    { eventType: 'chart:clearAllDrawings', processor: clearAllDrawingsProcessor },
    { eventType: 'chart:undo', processor: undoProcessor },
    { eventType: 'chart:redo', processor: redoProcessor },
    { eventType: 'chart:undoLastDrawing', processor: undoLastDrawingProcessor },
    { eventType: 'chart:redoLastDrawing', processor: redoLastDrawingProcessor },
    { eventType: 'chart:updateDrawingStyle', processor: updateDrawingStyleProcessor },
    { eventType: 'chart:updateAllStyles', processor: updateAllStylesProcessor },
    { eventType: 'chart:updateDrawingColor', processor: updateDrawingColorProcessor },
    { eventType: 'chart:updateDrawingLineWidth', processor: updateDrawingLineWidthProcessor },
  ]);

  // Use the base event handler hook
  useEventHandlerBase(
    config,
    eventListeners,
    [
      setDrawingMode,
      addDrawing,
      updateDrawing,
      deleteDrawing,
      clearAllDrawings,
      setIsDrawing,
      undo,
      redo,
      setDrawingCursor,
      resetCursor,
      handlers.drawingManager,
    ]
  );

  // Add custom logging for Drawing Event Handlers
  useEffect(() => {
    logger.info('[Drawing Event Handlers] Registered drawing event listeners', {
      eventCount: eventListeners.length,
      events: eventListeners.map(({ eventType }) => eventType),
    });
    
    // Return cleanup function for custom unmount logging
    return () => {
      logger.info('[Drawing Event Handlers] Cleaned up drawing event listeners');
    };
  }, []);
}