import { useChartUIEventHandlers } from './useChartUIEventHandlers';
import { useDrawingEventHandlers } from './useDrawingEventHandlers';
import { usePatternEventHandlers } from './usePatternEventHandlers';
import { useChartControlAgentEvents } from '../../components/chart/hooks/useChartControlAgentEvents';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';

/**
 * Agent Event Bridge Hook
 * 
 * 分離された各イベントハンドラーフックを統合する中継フック
 * 既存の useAgentEventHandlers の代替として機能
 */

export function useAgentEventBridge(handlers: ChartEventHandlers) {
  // Chart control events (existing implementation)
  useChartControlAgentEvents(handlers);
  
  // UI events (indicator, symbol, timeframe changes)
  useChartUIEventHandlers(handlers);
  
  // Drawing events (add, delete, style updates, undo/redo)
  useDrawingEventHandlers(handlers);
  
  // Pattern events (add, remove, style updates)
  usePatternEventHandlers(handlers);
}