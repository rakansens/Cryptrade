/**
 * Chart Store Index
 * 
 * 既存のAPIを維持しながら、内部的には分割されたストアを使用
 * 後方互換性を保証
 */

import { useChartBaseStore } from './stores/chart-base.store';
import { useIndicatorStore } from './stores/indicator.store';
import { useDrawingStore } from './stores/drawing.store';
import { usePatternStore } from './stores/pattern.store';
import type { ChartStore } from './types';

// Re-export types
export * from './types';

// ========================================
// Legacy Store Interface (後方互換性)
// ========================================

/**
 * 従来のuseChartStoreインターフェースを維持
 * 内部的には分割されたストアを使用
 */
export const useChartStore = <T>(selector: (state: ChartStore) => T): T => {
  // 各ストアから必要な部分を取得
  const baseState = useChartBaseStore();
  const indicatorState = useIndicatorStore();
  const drawingState = useDrawingStore();
  const patternState = usePatternStore();

  // 統合された状態を作成
  const combinedState: ChartStore = {
    // Base state
    symbol: baseState.symbol,
    timeframe: baseState.timeframe,
    isChartReady: baseState.isChartReady,
    isLoading: baseState.isLoading,
    error: baseState.error,
    
    // Indicator state
    indicators: indicatorState.indicators,
    settings: indicatorState.settings,
    
    // Drawing state
    drawingMode: drawingState.drawingMode,
    drawings: drawingState.drawings,
    selectedDrawingId: drawingState.selectedDrawingId,
    isDrawing: drawingState.isDrawing,
    undoStack: drawingState.undoStack,
    redoStack: drawingState.redoStack,
    
    // Pattern state
    patterns: patternState.patterns,
    
    // All actions
    setSymbol: baseState.setSymbol,
    setTimeframe: baseState.setTimeframe,
    setChartReady: baseState.setChartReady,
    setLoading: baseState.setLoading,
    setError: baseState.setError,
    reset: baseState.reset,
    
    setIndicators: indicatorState.setIndicators,
    updateIndicator: indicatorState.updateIndicator,
    setIndicatorEnabled: indicatorState.setIndicatorEnabled,
    setIndicatorSetting: indicatorState.setIndicatorSetting,
    setSettings: indicatorState.setSettings,
    updateSetting: indicatorState.updateSetting,
    
    setDrawingMode: drawingState.setDrawingMode,
    addDrawing: drawingState.addDrawing,
    addDrawingAsync: drawingState.addDrawingAsync,
    updateDrawing: drawingState.updateDrawing,
    deleteDrawing: drawingState.deleteDrawing,
    deleteDrawingAsync: drawingState.deleteDrawingAsync,
    selectDrawing: drawingState.selectDrawing,
    clearAllDrawings: drawingState.clearAllDrawings,
    setIsDrawing: drawingState.setIsDrawing,
    undo: drawingState.undo,
    redo: drawingState.redo,
    
    addPattern: patternState.addPattern,
    removePattern: patternState.removePattern,
    clearPatterns: patternState.clearPatterns,
    getPattern: patternState.getPattern,
    
    // Undo/Redo specific actions (for type compatibility)
    pushToUndoStack: () => {}, // Not exposed in original implementation
    clearRedoStack: () => {}, // Not exposed in original implementation
  };

  return selector(combinedState);
};

// Legacy base store reference
// For backward compatibility with subscribe functionality,
// we expose the drawing store directly since that's what's most commonly subscribed to
export const useChartStoreBase = useDrawingStore;

// ========================================
// Legacy Hooks (後方互換性)
// ========================================

export const useChartSymbol = () => 
  useChartBaseStore(state => state.symbol);

export const useChartTimeframe = () => 
  useChartBaseStore(state => state.timeframe);

export const useChartIndicators = () => 
  useIndicatorStore(state => state.indicators);

export const useChartSettings = () => 
  useIndicatorStore(state => state.settings);

export const useIsChartReady = () => 
  useChartBaseStore(state => state.isChartReady);

// Drawing hooks
export const useChartDrawings = () => 
  useDrawingStore(state => state.drawings);

export const useChartPatterns = () => 
  usePatternStore(state => state.patterns);

export const useDrawingMode = () => 
  useDrawingStore(state => state.drawingMode);

export const useSelectedDrawing = () => 
  useDrawingStore(state => state.selectedDrawingId);

export const useIsDrawing = () => 
  useDrawingStore(state => state.isDrawing);

// Actions hooks
export const useChartActions = () => {
  const baseStore = useChartBaseStore();
  const indicatorStore = useIndicatorStore();
  
  return {
    setSymbol: baseStore.setSymbol,
    setTimeframe: baseStore.setTimeframe,
    setIndicators: indicatorStore.setIndicators,
    updateIndicator: indicatorStore.updateIndicator,
    setIndicatorEnabled: indicatorStore.setIndicatorEnabled,
    setIndicatorSetting: indicatorStore.setIndicatorSetting,
    setSettings: indicatorStore.setSettings,
    updateSetting: indicatorStore.updateSetting,
    setChartReady: baseStore.setChartReady,
    setLoading: baseStore.setLoading,
    setError: baseStore.setError,
    reset: baseStore.reset,
  };
};

export const useDrawingActions = () => {
  const drawingStore = useDrawingStore();
  
  return {
    setDrawingMode: drawingStore.setDrawingMode,
    addDrawing: drawingStore.addDrawing,
    updateDrawing: drawingStore.updateDrawing,
    deleteDrawing: drawingStore.deleteDrawing,
    selectDrawing: drawingStore.selectDrawing,
    clearAllDrawings: drawingStore.clearAllDrawings,
    setIsDrawing: drawingStore.setIsDrawing,
  };
};

export const usePatternActions = () => {
  const patternStore = usePatternStore();
  
  return {
    addPattern: patternStore.addPattern,
    removePattern: patternStore.removePattern,
    clearPatterns: patternStore.clearPatterns,
    getPattern: patternStore.getPattern,
  };
};

// Combined hook
export const useChart = () => {
  const symbol = useChartSymbol();
  const timeframe = useChartTimeframe();
  const indicators = useChartIndicators();
  const settings = useChartSettings();
  const isChartReady = useIsChartReady();
  const actions = useChartActions();
  
  return {
    symbol,
    timeframe,
    indicators,
    settings,
    isChartReady,
    ...actions,
  };
};

// ========================================
// New Fine-grained Hooks (新しいAPI)
// ========================================

// Direct store access for better performance
export { useChartBaseStore } from './stores/chart-base.store';
export { useIndicatorStore } from './stores/indicator.store';
export { useDrawingStore } from './stores/drawing.store';
export { usePatternStore } from './stores/pattern.store';

// ========================================
// Debug Support
// ========================================

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Expose stores for debugging
  // @ts-ignore
  window.__CHART_STORE = useChartStore;
  // @ts-ignore
  window.__CHART_BASE_STORE = useChartBaseStore;
  // @ts-ignore
  window.__INDICATOR_STORE = useIndicatorStore;
  // @ts-ignore
  window.__DRAWING_STORE = useDrawingStore;
  // @ts-ignore
  window.__PATTERN_STORE = usePatternStore;
}