/**
 * Chart Store Types
 * 
 * チャートストアで使用される全ての型定義
 * 責務ごとに型を整理し、再利用性を向上
 */

import type { IndicatorOptions } from '@/types/market';
import type { IndicatorSettings, Timeframe, SymbolValue } from '@/constants/chart';
import type { PatternVisualization, PatternMetrics, IndicatorValue } from '@/types/store.types';

// ========================================
// Drawing Types
// ========================================

export interface DrawingPoint {
  time: number;
  value: number; // lightweight-charts標準のvalueキーを使用
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabels: boolean;
}

export interface ChartDrawing {
  id: string;
  type: 'trendline' | 'fibonacci' | 'horizontal' | 'vertical' | 'pattern';
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  interactive: boolean;
  metadata?: Record<string, unknown>;
}

export type DrawingMode = 'none' | 'trendline' | 'fibonacci' | 'horizontal' | 'vertical';

// ========================================
// Pattern Types
// ========================================

export interface PatternData {
  type: string;
  visualization: PatternVisualization;
  metrics?: PatternMetrics;
  tradingImplication?: string;
  confidence?: number;
}

// ========================================
// Chart Base State
// ========================================

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

// ========================================
// Indicator State
// ========================================

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
}

// ========================================
// Drawing State
// ========================================

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
}

// ========================================
// Pattern State
// ========================================

export interface PatternState {
  patterns: Map<string, PatternData>;
}

export interface PatternActions {
  addPattern: (id: string, pattern: PatternData) => void;
  removePattern: (id: string) => void;
  clearPatterns: () => void;
  getPattern: (id: string) => PatternData | undefined;
}

// ========================================
// Undo/Redo State
// ========================================

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

// ========================================
// Combined Types
// ========================================

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

// ========================================
// Default Values
// ========================================

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

// ========================================
// Utility Types
// ========================================

export type StoreSelector<T> = (state: ChartStore) => T;

export interface StoreDebugOptions {
  name: string;
  enabled?: boolean;
}