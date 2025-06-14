import { useAgentEventBridge } from '@/hooks/chart/useAgentEventBridge';
import type { ChartDrawingManager } from '@/lib/chart/drawing-primitives';
import type { PatternRenderer } from '@/types/pattern.types';
import type { ProcessedKline } from '@/types/market';

/**
 * Agent Event Handlers Hook
 * 
 * @deprecated This hook has been refactored into smaller, focused hooks.
 * Use useAgentEventBridge instead for new implementations.
 * 
 * Legacy interface maintained for backward compatibility.
 */

export interface ChartEventHandlers {
  fitContent?: () => void;
  zoomIn?: (factor?: number) => void;
  zoomOut?: (factor?: number) => void;
  resetView?: () => void;
  drawingManager?: ChartDrawingManager | null;
  chartData?: ProcessedKline[];
  patternRenderer?: PatternRenderer | null;
  getPatternRenderer?: () => PatternRenderer | null;
}

export function useAgentEventHandlers(handlers: ChartEventHandlers) {
  // Delegate to the new modular implementation
  useAgentEventBridge(handlers);
}