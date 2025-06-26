/**
 * Updated: Complete redesign of chart store types mock to match actual implementation
 * Changes: Added all proper type definitions, default values, and exported types with inline definitions
 */

// Define all types inline to avoid import dependencies in mock environment
export type SymbolValue = 'BTCUSDT' | 'ETHUSDT' | 'ADAUSDT' | 'SOLUSDT' | 'DOGEUSDT';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
export type DrawingMode = 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'arrow' | null;

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabels: boolean;
}

export interface ChartDrawing {
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

export interface PatternVisualization {
  points: Array<{ x: number; y: number }>;
  lines: Array<any>;
  areas: Array<any>;
}

export interface PatternMetrics {
  accuracy: number;
  strength: number;
  reliability: number;
}

export interface PatternData {
  id: string;
  type: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  visualization: PatternVisualization;
  metrics?: PatternMetrics;
  description?: string;
  tradingImplication?: string;
  confidence?: number;
}

export type IndicatorOptions = {
  ma: boolean;
  rsi: boolean;
  macd: boolean;
  boll: boolean;
};

export type IndicatorSettings = {
  ma: {
    ma1: number;
    ma2: number;
    ma3: number;
  };
  rsi: number;
  rsiUpper: number;
  rsiLower: number;
  macd: {
    short: number;
    long: number;
    signal: number;
  };
  boll: { period: number; stdDev: number };
  lineWidth: {
    ma: number;
    ma1: number;
    ma2: number;
    ma3: number;
    rsi: number;
    macd: number;
    boll: number;
  };
  colors: {
    ma1: string;
    ma2: string;
    ma3: string;
    rsi: string;
    macd: string;
    boll: string;
  };
};

export type IndicatorValue = string | number | boolean | object;

// Base State Types
export interface ChartBaseState {
  symbol: SymbolValue;
  timeframe: Timeframe;
  isChartReady: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChartBaseActions {
  setSymbol: (symbol: SymbolValue) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setChartReady: (ready: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Indicator State Types
export interface IndicatorState {
  indicators: IndicatorOptions;
  settings: IndicatorSettings;
}

export interface IndicatorActions {
  setIndicators: (indicators: IndicatorOptions) => void;
  updateIndicator: (key: keyof IndicatorOptions, enabled: boolean) => void;
  setIndicatorEnabled: (indicator: keyof IndicatorOptions, enabled: boolean) => void;
  setIndicatorSetting: (indicator: string, key: string, value: IndicatorValue) => void;
  setSettings: (settings: IndicatorSettings) => void;
  updateSetting: <K extends keyof IndicatorSettings>(key: K, value: IndicatorSettings[K]) => void;
  reset: () => void;
}

// Drawing State Types
export interface DrawingState {
  drawingMode: DrawingMode;
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  isDrawing: boolean;
}

export interface DrawingActions {
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

// Pattern State Types
export interface PatternState {
  patterns: Map<string, PatternData>;
}

export interface PatternActions {
  addPattern: (id: string, pattern: PatternData) => void;
  removePattern: (id: string) => void;
  clearPatterns: () => void;
  getPattern: (id: string) => PatternData | undefined;
  initializePatterns: () => Promise<void>;
  reset: () => void;
}

// Undo/Redo State Types
export interface UndoRedoState {
  undoStack: ChartDrawing[][];
  redoStack: ChartDrawing[][];
}

export interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
  pushToUndoStack: (drawings: ChartDrawing[]) => void;
  clearRedoStack: () => void;
}

// Combined Types
export type ChartState = ChartBaseState & 
  IndicatorState & 
  DrawingState & 
  PatternState & 
  UndoRedoState;

export type ChartActions = ChartBaseActions & 
  IndicatorActions & 
  DrawingActions & 
  PatternActions & 
  UndoRedoActions;

export type ChartStore = ChartState & ChartActions;

// Default Values
export const DEFAULT_SYMBOL: SymbolValue = 'BTCUSDT';
export const DEFAULT_TIMEFRAME: Timeframe = '1h';

export const DEFAULT_INDICATORS: IndicatorOptions = {
  ma: false,
  rsi: false,
  macd: false,
  boll: false,
};

export const DEFAULT_SETTINGS: IndicatorSettings = {
  ma: {
    ma1: 7,
    ma2: 25,
    ma3: 99,
  },
  rsi: 14,
  rsiUpper: 70,
  rsiLower: 30,
  macd: {
    short: 12,
    long: 26,
    signal: 9,
  },
  boll: { period: 20, stdDev: 2 },
  lineWidth: {
    ma: 2,
    ma1: 2,
    ma2: 2,
    ma3: 2,
    rsi: 2,
    macd: 2,
    boll: 1,
  },
  colors: {
    ma1: '#2962ff',
    ma2: '#ff6d00',
    ma3: '#00e676',
    rsi: '#7b61ff',
    macd: '#2962ff',
    boll: '#2962ff',
  },
};

// Utility Types
export type StoreSelector<T> = (state: ChartStore) => T;

export interface StoreDebugOptions {
  name: string;
  enabled?: boolean;
}

// Mock-specific types
export interface MockChartStore extends ChartStore {
  __mockType?: 'chart-store';
}