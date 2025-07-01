/**
 * Updated: 2024-12-27 - Chart Storeテストエラー修正
 * Changes: Fixed mock state management and test compatibility
 */

// Create initial state factory
const createInitialState = () => ({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  isChartReady: true,
  isLoading: false,
  error: null,
  indicators: { ma: false, rsi: false, macd: false, boll: false },
  settings: {
    ma: { ma1: 5, ma2: 10, ma3: 20 },
    rsi: { period: 14 },
    macd: {},
    boll: {}
  },
  drawingMode: null,
  drawings: [] as any[],
  selectedDrawingId: null,
  isDrawing: false,
  undoStack: [] as any[],
  redoStack: [] as any[],
  patterns: new Map()
});

// Simple mock state that works with test expectations
let mockState: any = createInitialState();

const mockActions = {
  setSymbol: jest.fn((symbol) => { mockState.symbol = symbol; }),
  setTimeframe: jest.fn((timeframe) => { mockState.timeframe = timeframe; }),
  setChartReady: jest.fn((ready) => { mockState.isChartReady = ready; }),
  setLoading: jest.fn((loading) => { mockState.isLoading = loading; }),
  setError: jest.fn((error) => { mockState.error = error; }),
  setIndicatorEnabled: jest.fn((key, enabled) => {
    mockState.indicators = { ...mockState.indicators, [key]: enabled };
  }),
  setIndicatorSetting: jest.fn((indicator, key, value) => {
    mockState.settings = {
      ...mockState.settings,
      [indicator]: { ...mockState.settings[indicator], [key]: value }
    };
  }),
  setIndicators: jest.fn((indicators) => {
    mockState.indicators = { ...mockState.indicators, ...indicators };
  }),
  updateIndicator: jest.fn((key, enabled) => {
    mockState.indicators = { ...mockState.indicators, [key]: enabled };
  }),
  setSettings: jest.fn((settings) => {
    mockState.settings = { ...mockState.settings, ...settings };
  }),
  updateSetting: jest.fn((key, value) => {
    mockState.settings = { ...mockState.settings, [key]: value };
  }),
  setDrawingMode: jest.fn((mode) => {
    mockState.drawingMode = mode;
  }),
  addDrawing: jest.fn((drawing) => {
    const newDrawing = { ...drawing, id: `drawing-${Date.now()}` };
    mockState.drawings = [...mockState.drawings, newDrawing];
    mockState.undoStack = [...mockState.undoStack, [...mockState.drawings]];
    return newDrawing;
  }),
  addDrawingAsync: jest.fn(async (drawing) => {
    const newDrawing = { ...drawing, id: `drawing-${Date.now()}` };
    mockState.drawings = [...mockState.drawings, newDrawing];
    return newDrawing;
  }),
  updateDrawing: jest.fn((id, updates) => {
    mockState.drawings = mockState.drawings.map(d => d.id === id ? { ...d, ...updates } : d);
  }),
  deleteDrawing: jest.fn((id) => {
    mockState.drawings = mockState.drawings.filter(d => d.id !== id);
    if (mockState.selectedDrawingId === id) {
      mockState.selectedDrawingId = null;
    }
  }),
  deleteDrawingAsync: jest.fn(async (id) => {
    mockState.drawings = mockState.drawings.filter(d => d.id !== id);
    if (mockState.selectedDrawingId === id) {
      mockState.selectedDrawingId = null;
    }
  }),
  selectDrawing: jest.fn((id) => { mockState.selectedDrawingId = id; }),
  clearAllDrawings: jest.fn(() => {
    mockState.drawings = [];
    mockState.selectedDrawingId = null;
  }),
  setIsDrawing: jest.fn((isDrawing) => { mockState.isDrawing = isDrawing; }),
  initializeDrawings: jest.fn(async () => {}),
  pushToUndoStack: jest.fn((drawings) => {
    mockState.undoStack = [...mockState.undoStack, drawings];
  }),
  clearRedoStack: jest.fn(() => {
    mockState.redoStack = [];
  }),
  undo: jest.fn(() => {
    if (mockState.undoStack.length > 0) {
      const previous = mockState.undoStack.pop();
      mockState.redoStack.push([...mockState.drawings]);
      mockState.drawings = previous;
    }
  }),
  redo: jest.fn(() => {
    if (mockState.redoStack.length > 0) {
      const next = mockState.redoStack.pop();
      mockState.undoStack.push([...mockState.drawings]);
      mockState.drawings = next;
    }
  }),
  addPattern: jest.fn((id, pattern) => { mockState.patterns.set(id, pattern); }),
  removePattern: jest.fn((id) => { mockState.patterns.delete(id); }),
  getPattern: jest.fn((id) => mockState.patterns.get(id)),
  clearPatterns: jest.fn(() => { mockState.patterns.clear(); }),
  reset: jest.fn(() => {
    const newState = createInitialState();
    Object.assign(mockState, newState);
  })
};

// Combined state and actions - ensure fresh state references
const createStore = () => ({ ...mockState, ...mockActions });

// Reset state before each test
let resetMockState = () => {
  mockState = createInitialState();
  jest.clearAllMocks();
};

// Export for test setup
export { resetMockState };

export const useChartStore = jest.fn((selector) => {
  const store = createStore();
  return selector ? selector(store) : store;
});

export const useChartBaseStore = jest.fn(() => ({
  symbol: mockState.symbol,
  timeframe: mockState.timeframe,
  isChartReady: mockState.isChartReady,
  isLoading: mockState.isLoading,
  error: mockState.error,
  setSymbol: mockActions.setSymbol,
  setTimeframe: mockActions.setTimeframe,
  setChartReady: mockActions.setChartReady,
  setLoading: mockActions.setLoading,
  setError: mockActions.setError,
  reset: mockActions.reset
}));

export const useIndicatorStore = jest.fn(() => ({
  indicators: mockState.indicators,
  settings: mockState.settings,
  setIndicators: mockActions.setIndicators,
  updateIndicator: mockActions.updateIndicator,
  setIndicatorEnabled: mockActions.setIndicatorEnabled,
  setIndicatorSetting: mockActions.setIndicatorSetting,
  setSettings: mockActions.setSettings,
  updateSetting: mockActions.updateSetting
}));

export const useDrawingStore = jest.fn(() => ({
  drawingMode: mockState.drawingMode,
  drawings: mockState.drawings,
  selectedDrawingId: mockState.selectedDrawingId,
  isDrawing: mockState.isDrawing,
  undoStack: mockState.undoStack,
  redoStack: mockState.redoStack,
  setDrawingMode: mockActions.setDrawingMode,
  addDrawing: mockActions.addDrawing,
  addDrawingAsync: mockActions.addDrawingAsync,
  updateDrawing: mockActions.updateDrawing,
  deleteDrawing: mockActions.deleteDrawing,
  deleteDrawingAsync: mockActions.deleteDrawingAsync,
  selectDrawing: mockActions.selectDrawing,
  clearAllDrawings: mockActions.clearAllDrawings,
  setIsDrawing: mockActions.setIsDrawing,
  initializeDrawings: mockActions.initializeDrawings,
  pushToUndoStack: mockActions.pushToUndoStack,
  clearRedoStack: mockActions.clearRedoStack,
  undo: mockActions.undo,
  redo: mockActions.redo
}));

export const usePatternStore = jest.fn(() => ({
  patterns: mockState.patterns,
  addPattern: mockActions.addPattern,
  removePattern: mockActions.removePattern,
  getPattern: mockActions.getPattern,
  clearPatterns: mockActions.clearPatterns
}));

export const useChartSymbol = jest.fn(() => mockState.symbol);
export const useChartTimeframe = jest.fn(() => mockState.timeframe);
export const useChartIndicators = jest.fn(() => mockState.indicators);
export const useChartDrawings = jest.fn(() => mockState.drawings);
export const useChartPatterns = jest.fn(() => mockState.patterns);
export const useDrawingMode = jest.fn(() => mockState.drawingMode);
export const useChartActions = jest.fn(() => mockActions);
export const useDrawingActions = jest.fn(() => mockActions);
export const usePatternActions = jest.fn(() => mockActions);
export const useChart = jest.fn(() => createStore());