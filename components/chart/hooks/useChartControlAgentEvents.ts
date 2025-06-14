// 新規ファイル: Chartコントロール系エージェントイベント専用Hook
// 目的: useAgentEventHandlers 内の肥大化した chart 操作イベントを分離し SRP を維持

import { useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

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

  useEffect(() => {
    // --- ハンドラ定義 --- //
    const handleFitContent = () => {
      logger.info('[Agent Event] Handling chart:fitContent');
      fitContent?.();
    };

    const handleZoomIn = (e: CustomEvent) => {
      const factor = e.detail?.factor || 1.2;
      logger.info('[Agent Event] Handling chart:zoomIn', { factor });
      zoomIn?.(factor);
    };

    const handleZoomOut = (e: CustomEvent) => {
      const factor = e.detail?.factor || 0.8;
      logger.info('[Agent Event] Handling chart:zoomOut', { factor });
      zoomOut?.(factor);
    };

    const handleResetView = () => {
      logger.info('[Agent Event] Handling chart:resetView');
      resetView?.();
    };

    // --- イベント登録 --- //
    const bindings: [string, EventListener][] = [
      ['chart:fitContent', handleFitContent as EventListener],
      ['chart:requestFitContent', handleFitContent as EventListener], // 互換エイリアス
      ['chart:zoomIn', handleZoomIn as EventListener],
      ['chart:zoomOut', handleZoomOut as EventListener],
      ['chart:resetView', handleResetView as EventListener],
    ];

    bindings.forEach(([type, listener]) => window.addEventListener(type, listener));
    logger.info('[ChartControlAgentEvents] Registered', { eventCount: bindings.length });

    return () => {
      bindings.forEach(([type, listener]) => window.removeEventListener(type, listener));
      logger.info('[ChartControlAgentEvents] Cleaned up');
    };
  }, [fitContent, zoomIn, zoomOut, resetView]);
} 