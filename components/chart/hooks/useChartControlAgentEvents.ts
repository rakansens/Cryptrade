// 新規ファイル: Chartコントロール系エージェントイベント専用Hook
// 目的: useAgentEventHandlers 内の肥大化した chart 操作イベントを分離し SRP を維持

import { 
  useEventHandlerBase, 
  createEventHandlerConfig, 
  createEventListeners 
} from '@/hooks/shared/useEventHandlerBase';

export interface ChartControlHandlers {
  fitContent?: () => void;
  zoomIn?: (factor?: number) => void;
  zoomOut?: (factor?: number) => void;
  resetView?: () => void;
}

/**
 * useChartControlAgentEvents
 *
 * chart:fitContent / chart:zoomIn / chart:zoomOut / chart:resetView
 * に対応するイベントリスナーを登録・クリーンアップする軽量 Hook
 */
export function useChartControlAgentEvents(handlers: ChartControlHandlers) {
  const { fitContent, zoomIn, zoomOut, resetView } = handlers;

  // Event handler configuration
  const config = createEventHandlerConfig<any>(
    {
      'chart:fitContent': 'Fit content',
      'chart:requestFitContent': 'Fit content', // 互換エイリアス
      'chart:zoomIn': 'Zoom in',
      'chart:zoomOut': 'Zoom out',
      'chart:resetView': 'Reset view',
    },
    {
      'chart:fitContent': () => 'Chart content fitted',
      'chart:requestFitContent': () => 'Chart content fitted',
      'chart:zoomIn': (data) => `Zoomed in by factor ${data?.factor || 1.2}`,
      'chart:zoomOut': (data) => `Zoomed out by factor ${data?.factor || 0.8}`,
      'chart:resetView': () => 'Chart view reset',
    },
    // Simple validator - chart control events don't need complex validation
    (_eventType, detail) => ({ success: true, data: { data: detail } })
  );

  // Event processors
  const processors = {
    fitContent: async () => {
      fitContent?.();
    },
    
    zoomIn: async (data: any) => {
      const factor = data?.factor || 1.2;
      zoomIn?.(factor);
    },
    
    zoomOut: async (data: any) => {
      const factor = data?.factor || 0.8;
      zoomOut?.(factor);
    },
    
    resetView: async () => {
      resetView?.();
    }
  };

  // Create event listeners
  const eventListeners = createEventListeners([
    { eventType: 'chart:fitContent', processor: processors.fitContent },
    { eventType: 'chart:requestFitContent', processor: processors.fitContent }, // 互換エイリアス
    { eventType: 'chart:zoomIn', processor: processors.zoomIn },
    { eventType: 'chart:zoomOut', processor: processors.zoomOut },
    { eventType: 'chart:resetView', processor: processors.resetView },
  ]);

  // Use the base hook
  useEventHandlerBase(config, eventListeners, [fitContent, zoomIn, zoomOut, resetView]);
}