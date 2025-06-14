import { useEffect } from 'react';
import { useDrawingActions, useChartStore, useDrawingStore } from '@/store/chart';
import { validateDrawingEvent } from '@/types/events/drawing-events';
import { validateChartDrawing } from '@/types/drawing';
import { 
  handleAgentError, 
  showAgentSuccess, 
  handleValidationError,
  executeDrawingOperation,
  prepareDrawingData 
} from '@/lib/chart/agent-utils';
import { useCursor } from './useCursor';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';

/**
 * Drawing Event Handlers Hook
 * 
 * 描画関連のカスタムイベント（追加、削除、スタイル更新、undo/redo等）を処理
 */

export function useDrawingEventHandlers(handlers: ChartEventHandlers) {
  const {
    setDrawingMode,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    selectDrawing,
    clearAllDrawings,
    setIsDrawing,
  } = useDrawingActions();

  const undo = useChartStore((state) => state.undo);
  const redo = useChartStore((state) => state.redo);
  const getState = () => useDrawingStore.getState();

  const { setDrawingCursor, resetCursor } = useCursor();

  useEffect(() => {
    // Start Drawing Handler
    const handleStartDrawing = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:startDrawing', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:startDrawing',
          operation: 'Start drawing',
          payload: event.detail,
        });
        return;
      }

      const { type, style } = validation.data.data;
      logger.info('[Drawing Event] Handling start drawing', { type, style });
      
      try {
        setDrawingMode(type);
        setIsDrawing(true);
        setDrawingCursor();
        
        showAgentSuccess({
          eventType: 'chart:startDrawing',
          operation: 'Start drawing',
        }, `Started ${type} drawing`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:startDrawing',
          operation: 'Start drawing',
          payload: { type, style },
        });
      }
    };

    // Add Drawing Handler
    const handleAddDrawing = async (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:addDrawing', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:addDrawing',
          operation: 'Add drawing',
          payload: event.detail,
        });
        return;
      }

      const eventData = validation.data.data;
      logger.info('[Drawing Event] Handling add drawing', { 
        id: eventData.id, 
        type: eventData.type 
      });
      
      try {
        const drawing = prepareDrawingData(eventData);
        const validatedDrawing = validateChartDrawing(drawing);
        
        await executeDrawingOperation(async () => {
          // Use async version if available
          if ('addDrawingAsync' in addDrawing) {
            await (addDrawing as { addDrawingAsync: (drawing: typeof validatedDrawing) => Promise<void> }).addDrawingAsync(validatedDrawing);
          } else {
            addDrawing(validatedDrawing);
          }
          
          // Add to chart if drawing manager is available
          if (handlers.drawingManager) {
            handlers.drawingManager.addDrawing(validatedDrawing);
          }
        }, {
          eventType: 'chart:addDrawing',
          operation: 'Add drawing',
          id: eventData.id,
        });
        
        setIsDrawing(false);
        setDrawingMode('none');
        resetCursor();
        
        showAgentSuccess({
          eventType: 'chart:addDrawing',
          operation: 'Add drawing',
          id: eventData.id,
        }, `Drawing ${eventData.type} added`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:addDrawing',
          operation: 'Add drawing',
          id: eventData.id,
          payload: eventData,
        });
      }
    };

    // Add Drawing With Metadata Handler - for proposals
    const handleAddDrawingWithMetadata = async (event: CustomEvent) => {
      logger.info('[Drawing Event] Handling add drawing with metadata', event.detail);
      
      try {
        const eventData = event.detail;
        
        // Validate drawing data structure
        const drawingData = {
          id: eventData.id,
          type: eventData.type,
          points: eventData.points,
          style: {
            color: eventData.style?.color || '#ff0000',
            lineWidth: eventData.style?.lineWidth || 2,
            lineStyle: eventData.style?.lineStyle || 'solid',
            showLabels: eventData.style?.showLabels !== undefined ? eventData.style.showLabels : true,
            ...eventData.style
          },
          price: eventData.price,
          time: eventData.time,
          levels: eventData.levels,
          visible: eventData.visible !== undefined ? eventData.visible : true,
          interactive: eventData.interactive !== undefined ? eventData.interactive : true,
          metadata: eventData.metadata || {}
        };
        
        logger.info('[Drawing Event] Processing drawing with metadata', { drawingData });
        
        const validDrawing = validateChartDrawing(drawingData);
        
        // Add to store
        addDrawing(validDrawing);
        
        // Add to chart if drawing manager is available
        if (handlers.drawingManager) {
          handlers.drawingManager.addDrawing(validDrawing);
          logger.info('[Drawing Event] Added drawing to chart manager', { drawingId: validDrawing.id });
        } else {
          logger.warn('[Drawing Event] No drawing manager available');
        }
        
        showAgentSuccess({
          eventType: 'chart:addDrawingWithMetadata',
          operation: 'Add drawing with metadata',
          id: eventData.id,
        }, `Proposal drawing ${eventData.type} added to chart`);
        
      } catch (error) {
        logger.error('[Drawing Event] Failed to add drawing with metadata', error);
        handleAgentError(error, {
          eventType: 'chart:addDrawingWithMetadata',
          operation: 'Add drawing with metadata',
          payload: event.detail,
        });
      }
    };

    // Delete Drawing Handler
    const handleDeleteDrawing = async (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:deleteDrawing', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:deleteDrawing',
          operation: 'Delete drawing',
          payload: event.detail,
        });
        return;
      }

      const { id } = validation.data.data;
      logger.info('[Drawing Event] Handling delete drawing', { id });
      
      try {
        await executeDrawingOperation(async () => {
          // Use async version if available
          if ('deleteDrawingAsync' in deleteDrawing) {
            await (deleteDrawing as { deleteDrawingAsync: (id: string) => Promise<void> }).deleteDrawingAsync(id);
          } else {
            deleteDrawing(id);
          }
          
          // Remove from chart if drawing manager is available
          if (handlers.drawingManager) {
            handlers.drawingManager.removeDrawing(id);
          }
        }, {
          eventType: 'chart:deleteDrawing',
          operation: 'Delete drawing',
          id,
        });
        
        showAgentSuccess({
          eventType: 'chart:deleteDrawing',
          operation: 'Delete drawing',
          id,
        }, 'Drawing removed successfully');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:deleteDrawing',
          operation: 'Delete drawing',
          id,
          payload: event.detail,
        });
      }
    };

    // Clear All Drawings Handler
    const handleClearAllDrawings = () => {
      logger.info('[Drawing Event] Handling clear all drawings');
      
      try {
        clearAllDrawings();
        
        // Clear from chart if drawing manager is available
        if (handlers.drawingManager) {
          handlers.drawingManager.clearAll();
        }
        
        setDrawingMode('none');
        setIsDrawing(false);
        resetCursor();
        
        showAgentSuccess({
          eventType: 'chart:clearAllDrawings',
          operation: 'Clear all drawings',
        }, 'All drawings cleared');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:clearAllDrawings',
          operation: 'Clear all drawings',
        });
      }
    };

    // Undo Handler
    const handleUndo = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:undo', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:undo',
          operation: 'Undo',
          payload: event.detail,
        });
        return;
      }

      const { steps } = validation.data.data;
      logger.info('[Drawing Event] Handling undo', { steps });
      
      try {
        for (let i = 0; i < steps; i++) {
          undo();
        }
        
        showAgentSuccess({
          eventType: 'chart:undo',
          operation: 'Undo',
        }, `Undid ${steps} step(s)`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:undo',
          operation: 'Undo',
          payload: { steps },
        });
      }
    };

    // Redo Handler
    const handleRedo = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:redo', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:redo',
          operation: 'Redo',
          payload: event.detail,
        });
        return;
      }

      const { steps } = validation.data.data;
      logger.info('[Drawing Event] Handling redo', { steps });
      
      try {
        for (let i = 0; i < steps; i++) {
          redo();
        }
        
        showAgentSuccess({
          eventType: 'chart:redo',
          operation: 'Redo',
        }, `Redid ${steps} step(s)`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:redo',
          operation: 'Redo',
          payload: { steps },
        });
      }
    };

    // Undo Last Drawing Handler
    const handleUndoLastDrawing = () => {
      logger.info('[Drawing Event] Handling undo last drawing');
      
      try {
        const drawings = getState().drawings;
        if (drawings.length > 0) {
          const lastDrawing = drawings[drawings.length - 1];
          deleteDrawing(lastDrawing.id);
          
          showAgentSuccess({
            eventType: 'chart:undoLastDrawing',
            operation: 'Undo last drawing',
          }, 'Last drawing removed');
        } else {
          logger.warn('[Drawing Event] No drawings to undo');
        }
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:undoLastDrawing',
          operation: 'Undo last drawing',
        });
      }
    };

    // Redo Last Drawing Handler - placeholder
    const handleRedoLastDrawing = () => {
      logger.info('[Drawing Event] Handling redo last drawing');
      // TODO: Implement when undo/redo stack is available
      showAgentSuccess({
        eventType: 'chart:redoLastDrawing',
        operation: 'Redo last drawing',
      }, 'Redo functionality coming soon');
    };

    // Update Drawing Style Handler
    const handleUpdateDrawingStyle = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:updateDrawingStyle', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:updateDrawingStyle',
          operation: 'Update drawing style',
          payload: event.detail,
        });
        return;
      }

      const { drawingId, style, immediate } = validation.data.data;
      logger.info('[Drawing Event] Handling update drawing style', { drawingId, style, immediate });
      
      try {
        const drawings = getState().drawings;
        const drawing = drawings.find((d) => d.id === drawingId);
        
        if (!drawing) {
          logger.warn('[Drawing Event] Drawing not found for style update', { 
            drawingId, 
            availableIds: drawings.map((d) => d.id) 
          });
          handleAgentError(new Error('Drawing not found'), {
            eventType: 'chart:updateDrawingStyle',
            operation: 'Update drawing style',
            id: drawingId,
          }, '描画が見つかりません');
          return;
        }
        
        // Merge with existing style
        const validStyle = {
          color: style.color !== undefined ? style.color : drawing.style.color,
          lineWidth: style.lineWidth !== undefined ? style.lineWidth : drawing.style.lineWidth,
          lineStyle: style.lineStyle !== undefined ? style.lineStyle : drawing.style.lineStyle,
          showLabels: style.showLabels !== undefined ? style.showLabels : drawing.style.showLabels,
        };
        
        updateDrawing(drawingId, { style: validStyle });
        
        if (handlers.drawingManager) {
          handlers.drawingManager.updateDrawing(drawingId, { style: validStyle });
          
          // If immediate flag is set, force redraw
          if (immediate && (handlers.drawingManager as { redrawDrawing?: (id: string) => void })?.redrawDrawing) {
            (handlers.drawingManager as { redrawDrawing: (id: string) => void }).redrawDrawing(drawingId);
          }
        }
        
        showAgentSuccess({
          eventType: 'chart:updateDrawingStyle',
          operation: 'Update drawing style',
          id: drawingId,
        }, 'スタイルを更新しました');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:updateDrawingStyle',
          operation: 'Update drawing style',
          id: drawingId,
          payload: { drawingId, style, immediate },
        });
      }
    };

    // Update All Styles Handler
    const handleUpdateAllStyles = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:updateAllStyles', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:updateAllStyles',
          operation: 'Update all styles',
          payload: event.detail,
        });
        return;
      }

      const { type, style } = validation.data.data;
      logger.info('[Drawing Event] Handling update all styles', { type, style });
      
      try {
        const drawings = getState().drawings.filter((d) => d.type === type);
        
        drawings.forEach((drawing) => {
          updateDrawing(drawing.id, { style: { ...drawing.style, ...style } });
          
          if (handlers.drawingManager) {
            handlers.drawingManager.updateDrawing(drawing.id, { style });
          }
        });
        
        showAgentSuccess({
          eventType: 'chart:updateAllStyles',
          operation: 'Update all styles',
        }, `Updated ${drawings.length} ${type} drawings`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:updateAllStyles',
          operation: 'Update all styles',
          payload: { type, style },
        });
      }
    };

    // Update Drawing Color Handler
    const handleUpdateDrawingColor = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:updateDrawingColor', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:updateDrawingColor',
          operation: 'Update drawing color',
          payload: event.detail,
        });
        return;
      }

      const { id, color } = validation.data.data;
      logger.info('[Drawing Event] Handling update drawing color', { id, color });
      
      try {
        const drawing = getState().drawings.find((d) => d.id === id);
        if (!drawing) {
          handleAgentError(new Error('Drawing not found'), {
            eventType: 'chart:updateDrawingColor',
            operation: 'Update drawing color',
            id,
          }, '描画が見つかりません');
          return;
        }
        
        const validStyle = {
          ...drawing.style,
          color,
        };
        
        updateDrawing(id, { style: validStyle });
        
        if (handlers.drawingManager) {
          handlers.drawingManager.updateDrawing(id, { style: validStyle });
        }
        
        showAgentSuccess({
          eventType: 'chart:updateDrawingColor',
          operation: 'Update drawing color',
          id,
        }, 'Drawing color updated');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:updateDrawingColor',
          operation: 'Update drawing color',
          id,
          payload: { id, color },
        });
      }
    };

    // Update Drawing Line Width Handler
    const handleUpdateDrawingLineWidth = (event: CustomEvent) => {
      const validation = validateDrawingEvent('chart:updateDrawingLineWidth', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:updateDrawingLineWidth',
          operation: 'Update drawing line width',
          payload: event.detail,
        });
        return;
      }

      const { id, lineWidth } = validation.data.data;
      logger.info('[Drawing Event] Handling update drawing line width', { id, lineWidth });
      
      try {
        const drawing = getState().drawings.find((d) => d.id === id);
        if (!drawing) {
          handleAgentError(new Error('Drawing not found'), {
            eventType: 'chart:updateDrawingLineWidth',
            operation: 'Update drawing line width',
            id,
          }, '描画が見つかりません');
          return;
        }
        
        const validStyle = {
          ...drawing.style,
          lineWidth,
        };
        
        updateDrawing(id, { style: validStyle });
        
        if (handlers.drawingManager) {
          handlers.drawingManager.updateDrawing(id, { style: validStyle });
        }
        
        showAgentSuccess({
          eventType: 'chart:updateDrawingLineWidth',
          operation: 'Update drawing line width',
          id,
        }, 'Line width updated');
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:updateDrawingLineWidth',
          operation: 'Update drawing line width',
          id,
          payload: { id, lineWidth },
        });
      }
    };

    // Event listeners array
    const eventListeners = [
      ['chart:startDrawing', handleStartDrawing],
      ['chart:addDrawing', handleAddDrawing],
      ['chart:addDrawingWithMetadata', handleAddDrawingWithMetadata],
      ['chart:deleteDrawing', handleDeleteDrawing],
      ['chart:clearAllDrawings', handleClearAllDrawings],
      ['chart:undo', handleUndo],
      ['chart:redo', handleRedo],
      ['chart:undoLastDrawing', handleUndoLastDrawing],
      ['chart:redoLastDrawing', handleRedoLastDrawing],
      ['chart:updateDrawingStyle', handleUpdateDrawingStyle],
      ['chart:updateAllStyles', handleUpdateAllStyles],
      ['chart:updateDrawingColor', handleUpdateDrawingColor],
      ['chart:updateDrawingLineWidth', handleUpdateDrawingLineWidth],
    ] as const;

    // Register event listeners
    eventListeners.forEach(([eventType, handler]) => {
      window.addEventListener(eventType, handler as EventListener);
    });

    logger.info('[Drawing Event Handlers] Registered drawing event listeners', {
      eventCount: eventListeners.length,
      events: eventListeners.map(([type]) => type),
    });

    // Cleanup function
    return () => {
      eventListeners.forEach(([eventType, handler]) => {
        window.removeEventListener(eventType, handler as EventListener);
      });
      logger.info('[Drawing Event Handlers] Cleaned up drawing event listeners');
    };
  }, [
    setDrawingMode,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    selectDrawing,
    clearAllDrawings,
    setIsDrawing,
    undo,
    redo,
    setDrawingCursor,
    resetCursor,
    handlers.drawingManager,
  ]);
}