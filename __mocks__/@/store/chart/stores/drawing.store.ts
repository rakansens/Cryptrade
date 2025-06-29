/**
 * Updated: Complete redesign of drawing store mock to match actual implementation
 * Changes: Added proper state structure, undo/redo functionality, async operations, and persistence
 */

import { create } from 'zustand';

// Define types inline to avoid import issues in mock
type DrawingMode = 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'arrow' | null;

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabels: boolean;
}

interface ChartDrawing {
  id: string;
  type: string;
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  interactive: boolean;
  time?: number;
  price?: number;
  levels?: number[];
  metadata?: Record<string, any>;
}

interface DrawingState {
  drawingMode: DrawingMode;
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  isDrawing: boolean;
}

interface UndoRedoState {
  undoStack: ChartDrawing[][];
  redoStack: ChartDrawing[][];
}

interface DrawingActions {
  setDrawingMode: (mode: DrawingMode) => void;
  addDrawing: (drawing: ChartDrawing) => void;
  addDrawingAsync: (drawing: ChartDrawing) => Promise<ChartDrawing>;
  updateDrawing: (id: string, updates: Partial<ChartDrawing>) => void;
  deleteDrawing: (id: string) => void;
  deleteDrawingAsync: (id: string) => Promise<void>;
  selectDrawing: (id: string | null) => void;
  clearAllDrawings: () => void;
  setIsDrawing: (isDrawing: boolean) => void;
  initializeDrawings: () => Promise<void>;
  reset: () => void;
}

interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
  pushToUndoStack: (drawings: ChartDrawing[]) => void;
  clearRedoStack: () => void;
}

// Mock the external dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/components/ui/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@/lib/storage/chart-persistence-wrapper', () => ({
  chartPersistence: {
    loadDrawings: jest.fn(() => Promise.resolve([])),
    saveDrawings: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/types/drawing', () => ({
  validateChartDrawing: jest.fn((drawing) => drawing),
}));

jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

// Define initial state
const initialState: DrawingState & UndoRedoState = {
  drawingMode: 'trendline',
  drawings: [],
  selectedDrawingId: null,
  isDrawing: false,
  undoStack: [],
  redoStack: [],
};

// Mock drawing for testing
const createMockDrawing = (id: string = 'test-drawing'): ChartDrawing => ({
  id,
  type: 'trendline',
  points: [
    { x: 100, y: 200 },
    { x: 300, y: 150 }
  ],
  style: {
    color: '#00e676',
    lineWidth: 2,
    lineStyle: 'solid' as const,
    showLabels: false
  },
  visible: true,
  interactive: true
});

export interface DrawingStoreState
  extends DrawingState,
    UndoRedoState,
    DrawingActions,
    UndoRedoActions {}

// Create mock store that matches the actual implementation structure
export const useDrawingStore = create<DrawingStoreState>()((set, get) => ({
  // Initial state
  ...initialState,

  // Initialize drawings asynchronously
  initializeDrawings: jest.fn(async () => {
    try {
      const loadedDrawings: ChartDrawing[] = [];
      set({ drawings: loadedDrawings });
    } catch (error) {
      // Handle error silently in mock
    }
  }),

  // Actions
  setDrawingMode: jest.fn((mode) => {
    set({ drawingMode: mode });
  }),

  addDrawing: jest.fn((drawing) => {
    set((state) => {
      const newDrawings = [...state.drawings, drawing];
      return {
        drawings: newDrawings,
        undoStack: [...state.undoStack, state.drawings],
        redoStack: [] // Clear redo stack on new action
      };
    });
  }),

  addDrawingAsync: jest.fn(async (drawing) => {
    return new Promise((resolve) => {
      set((state) => {
        const newDrawings = [...state.drawings, drawing];
        return {
          drawings: newDrawings,
          undoStack: [...state.undoStack, state.drawings],
          redoStack: []
        };
      });
      
      // Simulate async completion
      setTimeout(() => {
        resolve(drawing);
      }, 10);
    });
  }),

  updateDrawing: jest.fn((id, updates) => {
    set((state) => {
      const newDrawings = state.drawings.map((drawing) => {
        if (drawing.id === id) {
          return { ...drawing, ...updates };
        }
        return drawing;
      });
      
      return { drawings: newDrawings };
    });
  }),

  deleteDrawing: jest.fn((id) => {
    set((state) => {
      const newDrawings = state.drawings.filter((drawing) => drawing.id !== id);
      return {
        drawings: newDrawings,
        selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
        undoStack: [...state.undoStack, state.drawings],
        redoStack: []
      };
    });
  }),

  deleteDrawingAsync: jest.fn(async (id) => {
    return new Promise((resolve) => {
      set((state) => {
        const newDrawings = state.drawings.filter((drawing) => drawing.id !== id);
        return {
          drawings: newDrawings,
          selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
          undoStack: [...state.undoStack, state.drawings],
          redoStack: []
        };
      });
      
      // Simulate async completion
      setTimeout(() => {
        resolve();
      }, 10);
    });
  }),

  selectDrawing: jest.fn((id) => {
    set({ selectedDrawingId: id });
  }),

  clearAllDrawings: jest.fn(() => {
    set((state) => ({
      drawings: [],
      selectedDrawingId: null,
      undoStack: [...state.undoStack, state.drawings],
      redoStack: []
    }));
  }),

  setIsDrawing: jest.fn((isDrawing) => {
    set({ isDrawing });
  }),

  // Explicit stack operations
  pushToUndoStack: jest.fn((drawings: ChartDrawing[]) => {
    set((state) => ({ undoStack: [...state.undoStack, drawings] }));
  }),

  clearRedoStack: jest.fn(() => {
    set({ redoStack: [] });
  }),

  // Undo/Redo actions
  undo: jest.fn(() => {
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
  }),

  redo: jest.fn(() => {
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
  }),

  reset: jest.fn(() => {
    set({
      ...initialState,
      drawings: [], // Clear drawings on reset
    });
  }),
}));

// Mock getState method to return current state
(useDrawingStore as any).getState = jest.fn(() => {
  const store = useDrawingStore();
  return {
    drawingMode: store.drawingMode,
    drawings: store.drawings,
    selectedDrawingId: store.selectedDrawingId,
    isDrawing: store.isDrawing,
    undoStack: store.undoStack,
    redoStack: store.redoStack,
    initializeDrawings: store.initializeDrawings,
    setDrawingMode: store.setDrawingMode,
    addDrawing: store.addDrawing,
    addDrawingAsync: store.addDrawingAsync,
    updateDrawing: store.updateDrawing,
    deleteDrawing: store.deleteDrawing,
    deleteDrawingAsync: store.deleteDrawingAsync,
    selectDrawing: store.selectDrawing,
    clearAllDrawings: store.clearAllDrawings,
    setIsDrawing: store.setIsDrawing,
    pushToUndoStack: store.pushToUndoStack,
    clearRedoStack: store.clearRedoStack,
    undo: store.undo,
    redo: store.redo,
    reset: store.reset,
  };
});

// Mock setState method
(useDrawingStore as any).setState = jest.fn((partial) => {
  const currentState = (useDrawingStore as any).getState();
  const newState = typeof partial === 'function' ? partial(currentState) : partial;
  Object.assign(currentState, newState);
});

// Mock subscribe method
(useDrawingStore as any).subscribe = jest.fn((listener) => {
  return jest.fn(); // Unsubscribe function
});

// Export mock drawing helper for tests
export { createMockDrawing };