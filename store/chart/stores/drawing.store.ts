/**
 * Drawing Store
 * 
 * 描画ツールの状態管理とアクション
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/components/ui/toast';
import { chartPersistence } from '@/lib/storage/chart-persistence-wrapper';
import { validateDrawing } from '@/lib/validation/chart-drawing.schema';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import type { 
  DrawingState, 
  DrawingActions,
  ChartDrawing,
  UndoRedoState
} from '../types';

// Helper to ensure drawing has all required properties
function ensureCompleteDrawing(drawing: any): ChartDrawing {
  const baseDrawing = {
    id: drawing.id || `drawing-${Date.now()}`,
    type: drawing.type || 'trendline',
    points: drawing.points || [],
    style: drawing.style || {
      color: '#00e676',
      lineWidth: 2,
      lineStyle: 'solid' as const,
      showLabels: false
    },
    visible: drawing.visible ?? true,
    interactive: drawing.interactive ?? true
  };

  // Only add optional properties if they're defined
  const result: any = { ...baseDrawing };
  
  if (drawing.time !== undefined) {
    result.time = drawing.time;
  }
  if (drawing.price !== undefined) {
    result.price = drawing.price;
  }
  if (drawing.levels !== undefined) {
    result.levels = drawing.levels;
  }
  if (drawing.metadata !== undefined) {
    result.metadata = drawing.metadata;
  }
  
  return result as ChartDrawing;
}

const debug = createStoreDebugger('DrawingStore');

// Define initial state for consistency
const initialState: DrawingState & UndoRedoState = {
  drawingMode: null,
  drawings: [], // Don't load from persistence in initial state
  selectedDrawingId: null,
  isDrawing: false,
  undoStack: [],
  redoStack: [],
};

interface DrawingStoreState
  extends DrawingState,
    UndoRedoState,
    DrawingActions,
    UndoRedoActions {}

export const useDrawingStore = create<DrawingStoreState>()(
  devtools(
    subscribeWithSelector<DrawingStoreState>((set, get) => ({
      // Initial state with loaded drawings
      ...initialState,
      drawings: [], // Will be loaded asynchronously

      // Initialize drawings asynchronously
      initializeDrawings: async () => {
        try {
          const loadedDrawings = await chartPersistence.loadDrawings();
          const completeDrawings = loadedDrawings.map(ensureCompleteDrawing);
          set({ drawings: completeDrawings });
          logger.info('[DrawingStore] Drawings loaded', { count: completeDrawings.length });
        } catch (error) {
          logger.error('[DrawingStore] Failed to load drawings', { error });
        }
      },

      // Actions
      setDrawingMode: (mode) => {
        debug('setDrawingMode');
        set({ drawingMode: mode });
        logger.info('[DrawingStore] Drawing mode changed', { mode });
      },

      addDrawing: (drawing) => {
        debug('addDrawing');
        try {
          const validDrawing = validateDrawing(drawing);
          const completeDrawing = ensureCompleteDrawing(validDrawing);
          
          set((state) => {
            const newDrawings = [...state.drawings, completeDrawing];
            chartPersistence.saveDrawings(newDrawings as ChartDrawing[]);
            
            return {
              drawings: newDrawings,
              undoStack: [...state.undoStack, state.drawings],
              redoStack: [] // Clear redo stack on new action
            };
          });
          
          logger.info('[DrawingStore] Drawing added', { 
            id: completeDrawing.id, 
            type: completeDrawing.type 
          });
        } catch (error) {
          logger.error('[DrawingStore] Invalid drawing', { error });
          showToast('Invalid drawing data', 'error');
        }
      },

      addDrawingAsync: async (drawing) => {
        debug('addDrawingAsync');
        return new Promise((resolve, reject) => {
          try {
            const validDrawing = validateDrawing(drawing);
            const completeDrawing = ensureCompleteDrawing(validDrawing);
            
            const timeoutId = setTimeout(() => {
              window.removeEventListener('chart:drawingAdded', handleDrawingAdded);
              showToast('Drawing operation timed out', 'error');
              reject(new Error(`Drawing ${completeDrawing.id} addition timed out`));
            }, 5000);
            
            // Add drawing to store
            set((state) => {
              const newDrawings = [...state.drawings, completeDrawing];
              chartPersistence.saveDrawings(newDrawings as ChartDrawing[]);
              
              return {
                drawings: newDrawings,
                undoStack: [...state.undoStack, state.drawings],
                redoStack: []
              };
            });
            
            // Listen for confirmation from chart
            const handleDrawingAdded = (event: Event) => {
              const customEvent = event as CustomEvent;
              if (customEvent.detail.id === completeDrawing.id) {
                clearTimeout(timeoutId);
                window.removeEventListener('chart:drawingAdded', handleDrawingAdded);
                logger.info('[DrawingStore] Drawing addition confirmed', { 
                  id: completeDrawing.id 
                });
                showToast('Drawing added successfully', 'success');
                resolve(completeDrawing);
              }
            };
            
            window.addEventListener('chart:drawingAdded', handleDrawingAdded as EventListener);
            logger.info('[DrawingStore] Waiting for drawing confirmation', { 
              id: completeDrawing.id 
            });
          } catch (error) {
            logger.error('[DrawingStore] Invalid drawing in async add', { error });
            showToast('Invalid drawing data', 'error');
            reject(error);
          }
        });
      },

      updateDrawing: (id, updates) => {
        debug('updateDrawing');
        set((state) => {
          const newDrawings = state.drawings.map((drawing) => {
            if (drawing.id === id) {
              const updated = { ...drawing, ...updates };
              try {
                const validated = validateDrawing(updated);
                return ensureCompleteDrawing(validated);
              } catch (error) {
                logger.error('[DrawingStore] Invalid drawing update', { id, error });
                return drawing; // Keep original if validation fails
              }
            }
            return drawing;
          });
          
          chartPersistence.saveDrawings(newDrawings as ChartDrawing[]);
          return { drawings: newDrawings };
        });
        logger.info('[DrawingStore] Drawing updated', { id, updates });
      },

      deleteDrawing: (id) => {
        debug('deleteDrawing');
        set((state) => {
          const newDrawings = state.drawings.filter((drawing) => drawing.id !== id);
          chartPersistence.saveDrawings(newDrawings as ChartDrawing[]);
          
          return {
            drawings: newDrawings,
            selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
            undoStack: [...state.undoStack, state.drawings],
            redoStack: []
          };
        });
        logger.info('[DrawingStore] Drawing deleted', { id });
      },

      deleteDrawingAsync: async (id) => {
        debug('deleteDrawingAsync');
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            window.removeEventListener('chart:drawingDeleted', handleDrawingDeleted);
            showToast('Drawing deletion timed out', 'error');
            reject(new Error(`Drawing ${id} deletion timed out`));
          }, 5000);
          
          set((state) => {
            const newDrawings = state.drawings.filter((drawing) => drawing.id !== id);
            chartPersistence.saveDrawings(newDrawings as ChartDrawing[]);
            
            return {
              drawings: newDrawings,
              selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
              undoStack: [...state.undoStack, state.drawings],
              redoStack: []
            };
          });
          
          const handleDrawingDeleted = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail.id === id) {
              clearTimeout(timeoutId);
              window.removeEventListener('chart:drawingDeleted', handleDrawingDeleted);
              logger.info('[DrawingStore] Drawing deletion confirmed', { id });
              showToast('Drawing deleted successfully', 'success');
              resolve();
            }
          };
          
          window.addEventListener('chart:drawingDeleted', handleDrawingDeleted as EventListener);
          logger.info('[DrawingStore] Waiting for deletion confirmation', { id });
        });
      },

      selectDrawing: (id) => {
        debug('selectDrawing');
        set({ selectedDrawingId: id });
        logger.info('[DrawingStore] Drawing selected', { id });
      },

      clearAllDrawings: () => {
        debug('clearAllDrawings');
        set((state) => {
          chartPersistence.saveDrawings([]);
          return {
            drawings: [],
            selectedDrawingId: null,
            undoStack: [...state.undoStack, state.drawings],
            redoStack: []
          };
        });
        showToast('All drawings cleared', 'info');
        logger.info('[DrawingStore] All drawings cleared');
      },

      setIsDrawing: (isDrawing) => {
        debug('setIsDrawing');
        set({ isDrawing });
      },

      // Explicit stack operations
      pushToUndoStack: (drawings) => {
        debug('pushToUndoStack');
        set((state) => ({ undoStack: [...state.undoStack, drawings] }));
      },

      clearRedoStack: () => {
        debug('clearRedoStack');
        set({ redoStack: [] });
      },

      // Undo/Redo actions
      undo: () => {
        debug('undo');
        const { undoStack, drawings } = get();
        if (undoStack.length === 0) return;
        
        const previousDrawings = undoStack[undoStack.length - 1];
        if (!previousDrawings) return;
        
        const newUndoStack = undoStack.slice(0, -1);
        
        set((state) => ({
          drawings: previousDrawings,
          undoStack: newUndoStack,
          redoStack: [...state.redoStack, drawings]
        }));
        
        chartPersistence.saveDrawings(previousDrawings as ChartDrawing[]);
        showToast('Undo successful', 'info');
        logger.info('[DrawingStore] Undo performed');
      },

      redo: () => {
        debug('redo');
        const { redoStack, drawings } = get();
        if (redoStack.length === 0) return;
        
        const nextDrawings = redoStack[redoStack.length - 1];
        if (!nextDrawings) return;
        
        const newRedoStack = redoStack.slice(0, -1);
        
        set((state) => ({
          drawings: nextDrawings,
          redoStack: newRedoStack,
          undoStack: [...state.undoStack, drawings]
        }));
        
        chartPersistence.saveDrawings(nextDrawings as ChartDrawing[]);
        showToast('Redo successful', 'info');
        logger.info('[DrawingStore] Redo performed');
      },

      reset: () => {
        debug('reset');
        set({
          ...initialState,
          drawings: [], // Clear drawings on reset
        });
        chartPersistence.saveDrawings([]);
        logger.info('[DrawingStore] Store reset to initial state');
      },
    })),
    {
      name: 'drawing-store',
    }
  )
);

// Initialize drawings on store creation
if (typeof window !== 'undefined') {
  (useDrawingStore.getState() as any).initializeDrawings();
}