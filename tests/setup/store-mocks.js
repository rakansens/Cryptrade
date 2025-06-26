// tests/setup/store-mocks.js
// Store and state management mocks for test environment

jest.mock('zustand/middleware', () => ({
  createJSONStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
  persist: jest.fn((stateCreator, options) => {
    // persistミドルウェアは、stateCreatorをそのまま返す
    return stateCreator;
  }),
  subscribeWithSelector: jest.fn((stateCreator) => stateCreator),
  devtools: jest.fn((stateCreator, options) => stateCreator),
}));

jest.mock('zustand/middleware/immer', () => ({
  immer: jest.fn((stateCreator) => stateCreator),
}));

// Mock chart stores
jest.mock('@/store/chart', () => ({
  useChartBaseStore: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      patterns: new Map(),
      reset: jest.fn(),
      isChartReady: true,
      isLoading: false,
      error: null,
      setChartReady: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartStoreBase: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT', 
      timeframe: '1h',
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      patterns: new Map(),
      reset: jest.fn(),
      drawings: [],
      indicators: {},
      drawingMode: null,
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      settings: {}
    };
    return selector ? selector(state) : state;
  }),
  useIndicatorStore: jest.fn((selector) => {
    const state = {
      indicators: {},
      settings: {},
      setIndicators: jest.fn(),
      updateIndicator: jest.fn(),
      setIndicatorEnabled: jest.fn(),
      setIndicatorSetting: jest.fn(),
      setSettings: jest.fn(),
      updateSetting: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useDrawingStore: jest.fn((selector) => {
    const state = {
      drawingMode: null,
      drawings: [],
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      setDrawingMode: jest.fn(),
      addDrawing: jest.fn(),
      addDrawingAsync: jest.fn(),
      updateDrawing: jest.fn(),
      deleteDrawing: jest.fn(),
      deleteDrawingAsync: jest.fn(),
      selectDrawing: jest.fn(),
      clearAllDrawings: jest.fn(),
      setIsDrawing: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      initializeDrawings: jest.fn(),
      pushToUndoStack: jest.fn(),
      clearRedoStack: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  usePatternStore: jest.fn((selector) => {
    const state = {
      patterns: new Map(),
      addPattern: jest.fn(),
      removePattern: jest.fn(),
      clearPatterns: jest.fn(),
      getPattern: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartStore: jest.fn((selector) => {
    const state = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      isChartReady: true,
      isLoading: false,
      error: null,
      indicators: {},
      settings: {},
      drawingMode: null,
      drawings: [],
      selectedDrawingId: null,
      isDrawing: false,
      undoStack: [],
      redoStack: [],
      patterns: new Map(),
      // All actions
      setSymbol: jest.fn(),
      setTimeframe: jest.fn(),
      setChartReady: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      setIndicators: jest.fn(),
      updateIndicator: jest.fn(),
      setIndicatorEnabled: jest.fn(),
      setIndicatorSetting: jest.fn(),
      setSettings: jest.fn(),
      updateSetting: jest.fn(),
      setDrawingMode: jest.fn(),
      addDrawing: jest.fn(),
      addDrawingAsync: jest.fn(),
      updateDrawing: jest.fn(),
      deleteDrawing: jest.fn(),
      deleteDrawingAsync: jest.fn(),
      selectDrawing: jest.fn(),
      clearAllDrawings: jest.fn(),
      setIsDrawing: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      initializeDrawings: jest.fn(),
      addPattern: jest.fn(),
      removePattern: jest.fn(),
      clearPatterns: jest.fn(),
      getPattern: jest.fn(),
      pushToUndoStack: jest.fn(),
      clearRedoStack: jest.fn()
    };
    return selector ? selector(state) : state;
  }),
  useChartActions: jest.fn(() => ({
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
    setIndicators: jest.fn(),
    updateIndicator: jest.fn(),
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
    setSettings: jest.fn(),
    updateSetting: jest.fn(),
    setChartReady: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    reset: jest.fn()
  })),
  useDrawingActions: jest.fn(() => ({
    setDrawingMode: jest.fn(),
    addDrawing: jest.fn(),
    updateDrawing: jest.fn(),
    deleteDrawing: jest.fn(),
    selectDrawing: jest.fn(),
    clearAllDrawings: jest.fn(),
    setIsDrawing: jest.fn(),
    getDrawing: jest.fn((id) => {
      if (id === 'drawing-456') {
        return { id, type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } };
      }
      return null;
    })
  })),
  usePatternActions: jest.fn(() => ({
    addPattern: jest.fn(),
    removePattern: jest.fn(),
    clearPatterns: jest.fn(),
    getPattern: jest.fn()
  })),
  // Convenience hooks
  useChartSymbol: jest.fn(() => 'BTCUSDT'),
  useChartTimeframe: jest.fn(() => '1h'),
  useChartIndicators: jest.fn(() => ({ ma: false, rsi: false, macd: false, boll: false })),
  useChartSettings: jest.fn(() => ({ ma: { ma1: 20, ma2: 50, ma3: 100 }, boll: { period: 20, stdDev: 2 }, rsi: { period: 14 }, macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } })),
  useIsChartReady: jest.fn(() => true),
  useChartDrawings: jest.fn(() => []),
  useChartPatterns: jest.fn(() => new Map()),
  useDrawingMode: jest.fn(() => null),
  useSelectedDrawing: jest.fn(() => null),
  useIsDrawing: jest.fn(() => false),
  useChart: jest.fn(() => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: { ma: false, rsi: false, macd: false, boll: false },
    settings: { ma: { ma1: 20, ma2: 50, ma3: 100 }, boll: { period: 20, stdDev: 2 }, rsi: { period: 14 }, macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
    isChartReady: true,
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
    setIndicators: jest.fn(),
    updateIndicator: jest.fn(),
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
    setSettings: jest.fn(),
    updateSetting: jest.fn(),
    setChartReady: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    reset: jest.fn()
  }))
}));

// Mock more specific hooks
jest.mock('@/hooks/use-view-persistence-simple', () => ({
  useViewPersistenceSimple: jest.fn(() => ({
    viewState: {},
    setViewState: jest.fn(),
  })),
  useViewPersistence: jest.fn(() => ({
    currentView: 'home',
    showHome: true,
    showChat: false,
    setView: jest.fn(),
    goToChat: jest.fn(),
    goToHome: jest.fn(),
  }))
}));

jest.mock('@/hooks/use-view-persistence', () => ({
  useViewPersistence: jest.fn(() => ({
    currentView: 'home',
    showHome: true,
    showChat: false,
    setView: jest.fn(),
    goToChat: jest.fn(),
    goToHome: jest.fn(),
  }))
}));

jest.mock('@/hooks/market/use-candlestick-data', () => ({
  useCandlestickData: jest.fn(() => ({
    priceData: [],
    isLoading: false,
    error: null,
  }))
}));

jest.mock('@/hooks/chat/use-proposal-management', () => ({
  useProposalManagement: jest.fn(() => ({
    proposals: [],
    addProposal: jest.fn(),
    removeProposal: jest.fn(),
    updateProposal: jest.fn(),
  }))
}));

jest.mock('@/hooks/chat/use-message-handling', () => ({
  useMessageHandling: jest.fn(() => ({
    messages: [],
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
    editMessage: jest.fn(),
  }))
}));

jest.mock('@/hooks/chart/useChartUIEventHandlers', () => ({
  useChartUIEventHandlers: jest.fn()
}));

jest.mock('@/hooks/chart/useDrawingEventHandlers', () => ({
  useDrawingEventHandlers: jest.fn()
}));

jest.mock('@/hooks/chart/usePatternEventHandlers', () => ({
  usePatternEventHandlers: jest.fn()
}));