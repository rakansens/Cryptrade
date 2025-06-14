/**
 * Typed UI Event Provider
 * 
 * 型安全なUIイベントストリームプロバイダー
 * アプリケーション全体でSSEイベントを受信し、型安全性を保証
 */

'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTypedUIEventStream } from '@/hooks/use-typed-ui-event-stream';
import type { EventTypeName, EventPayload } from '@/types/events/all-event-types';
import { logger } from '@/lib/utils/logger';

/**
 * UIイベントコンテキストの型
 */
interface UIEventContextValue {
  /**
   * 型安全なイベント公開関数
   */
  publishEvent: <T extends EventTypeName>(
    eventType: T,
    payload?: EventPayload<T>
  ) => Promise<void>;
  
  /**
   * 接続状態
   */
  isConnected: boolean;
  
  /**
   * 最後のエラー
   */
  lastError: Error | null;
  
  /**
   * 再接続
   */
  reconnect: () => void;
}

/**
 * UIイベントコンテキスト
 */
const UIEventContext = createContext<UIEventContextValue | null>(null);

/**
 * プロバイダーのプロパティ
 */
interface TypedUIEventProviderProps {
  children: ReactNode;
  
  /**
   * デバッグモード
   */
  debug?: boolean;
  
  /**
   * イベントフィルター（受信するイベントタイプを制限）
   */
  eventFilter?: EventTypeName[];
  
  /**
   * グループフィルター（イベントグループ単位でフィルタリング）
   */
  groupFilter?: ('drawing' | 'chart' | 'ui' | 'proposal' | 'pattern' | 'system')[];
  
  /**
   * 接続状態変更時のコールバック
   */
  onConnectionChange?: (connected: boolean) => void;
  
  /**
   * エラー発生時のコールバック
   */
  onError?: (error: Error) => void;
}

/**
 * 型安全なUIイベントプロバイダー
 */
export function TypedUIEventProvider({
  children,
  debug = false,
  eventFilter,
  groupFilter,
  onConnectionChange,
  onError,
}: TypedUIEventProviderProps) {
  const {
    publish,
    isConnected,
    lastError,
    reconnect,
    disconnect,
  } = useTypedUIEventStream({
    eventFilter,
    groupFilter,
    debug,
    onConnectionChange: (connected) => {
      if (debug) {
        logger.info('[TypedUIEventProvider] Connection state changed', { connected });
      }
      onConnectionChange?.(connected);
    },
    onError: (error) => {
      logger.error('[TypedUIEventProvider] Error occurred', { error: error.message });
      onError?.(error);
    },
  });

  // クリーンアップ処理
  useEffect(() => {
    if (debug && isConnected) {
      logger.info('[TypedUIEventProvider] SSE connected and ready to receive events');
    }
    
    return () => {
      disconnect();
    };
  }, [isConnected, debug, disconnect]);

  const contextValue: UIEventContextValue = {
    publishEvent: publish,
    isConnected,
    lastError,
    reconnect,
  };

  return (
    <UIEventContext.Provider value={contextValue}>
      {children}
    </UIEventContext.Provider>
  );
}

/**
 * UIイベントコンテキストを使用するフック
 */
export function useUIEventContext() {
  const context = useContext(UIEventContext);
  if (!context) {
    throw new Error('useUIEventContext must be used within TypedUIEventProvider');
  }
  return context;
}

/**
 * 型安全なイベント公開フック
 */
export function usePublishEvent() {
  const { publishEvent } = useUIEventContext();
  return publishEvent;
}

/**
 * 接続状態を取得するフック
 */
export function useUIEventConnection() {
  const { isConnected, lastError, reconnect } = useUIEventContext();
  return { isConnected, lastError, reconnect };
}

/**
 * 特定のイベントタイプに特化した公開関数を作成するヘルパー
 */
export function createEventPublisher<T extends EventTypeName>(eventType: T) {
  return (publish: UIEventContextValue['publishEvent']) => {
    return (payload?: EventPayload<T>) => publish(eventType, payload);
  };
}

// 便利なイベント公開関数の事前定義
export const EventPublishers = {
  // Drawing events
  drawTrendline: createEventPublisher('draw:trendline'),
  drawFibonacci: createEventPublisher('draw:fibonacci'),
  drawHorizontal: createEventPublisher('draw:horizontal'),
  drawVertical: createEventPublisher('draw:vertical'),
  
  // Chart control events
  fitContent: createEventPublisher('chart:fitContent'),
  startDrawing: createEventPublisher('chart:startDrawing'),
  addDrawing: createEventPublisher('chart:addDrawing'),
  deleteDrawing: createEventPublisher('chart:deleteDrawing'),
  clearAllDrawings: createEventPublisher('chart:clearAllDrawings'),
  
  // UI control events
  changeSymbol: createEventPublisher('ui:changeSymbol'),
  changeTimeframe: createEventPublisher('ui:changeTimeframe'),
  toggleIndicator: createEventPublisher('ui:toggleIndicator'),
  
  // Proposal events
  approveProposal: createEventPublisher('proposal:approve'),
  rejectProposal: createEventPublisher('proposal:reject'),
  approveAllProposals: createEventPublisher('proposal:approve-all'),
  rejectAllProposals: createEventPublisher('proposal:reject-all'),
} as const;