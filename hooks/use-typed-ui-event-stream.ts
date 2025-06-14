/**
 * Typed UI Event Stream Hook
 * 
 * 型安全なUIイベントストリーム
 * any型を排除し、すべてのイベントを型定義から自動生成
 */

'use client';

import { useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import { 
  EventTypeName, 
  EventPayload, 
  ALL_EVENT_TYPES,
  validateEventPayload,
  createTypedEvent,
  SSEEventData,
  EventGroups
} from '@/types/events/all-event-types';

/**
 * 型安全なイベント公開関数の型
 */
type PublishEventFunction = <T extends EventTypeName>(
  eventType: T,
  payload?: EventPayload<T>
) => Promise<void>;

/**
 * UIイベントストリームのオプション
 */
interface UseTypedUIEventStreamOptions {
  /**
   * 受信するイベントタイプのフィルター
   * 未指定の場合はすべてのイベントを受信
   */
  eventFilter?: EventTypeName[];
  
  /**
   * イベントグループ単位でのフィルター
   * 例: ['drawing', 'chart'] で描画とチャート関連のみ受信
   */
  groupFilter?: (keyof typeof EventGroups)[];
  
  /**
   * エラーハンドリング
   */
  onError?: (error: Error) => void;
  
  /**
   * 接続状態の変更通知
   */
  onConnectionChange?: (connected: boolean) => void;
  
  /**
   * デバッグモード
   */
  debug?: boolean;
}

/**
 * フックの戻り値
 */
interface TypedUIEventStreamResult {
  /**
   * イベントを公開する関数（型安全）
   */
  publish: PublishEventFunction;
  
  /**
   * 接続状態
   */
  isConnected: boolean;
  
  /**
   * 最後のエラー
   */
  lastError: Error | null;
  
  /**
   * 手動での再接続
   */
  reconnect: () => void;
  
  /**
   * 接続の切断
   */
  disconnect: () => void;
}

/**
 * 型安全なUIイベントストリームフック
 */
export function useTypedUIEventStream(
  options: UseTypedUIEventStreamOptions = {}
): TypedUIEventStreamResult {
  const { 
    eventFilter,
    groupFilter,
    onError,
    onConnectionChange,
    debug = false
  } = options;

  // イベントタイプのフィルタリング
  const filteredEventTypes = (() => {
    // フィルターが指定されていない場合はすべて
    if (!eventFilter && !groupFilter) {
      return ALL_EVENT_TYPES;
    }
    
    let types = new Set<EventTypeName>();
    
    // 個別のイベントタイプフィルター
    if (eventFilter) {
      eventFilter.forEach(type => types.add(type));
    }
    
    // グループフィルター
    if (groupFilter) {
      groupFilter.forEach(group => {
        EventGroups[group].forEach(type => types.add(type as EventTypeName));
      });
    }
    
    return Array.from(types);
  })();

  // 型安全なイベント公開関数
  const publish: PublishEventFunction = useCallback(async (eventType, payload) => {
    try {
      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        throw new Error('publish can only be called in browser environment');
      }

      // ペイロードの検証
      if (payload !== undefined) {
        const validation = validateEventPayload(eventType, payload);
        if (!validation.success) {
          throw new Error(`Invalid payload for ${eventType}: ${validation.error.message}`);
        }
      }

      // API へのイベント送信
      const response = await fetch('/api/ui-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventType,
          data: payload,
          timestamp: Date.now(),
          metadata: {
            source: 'typed-ui-event-stream',
            sessionId: (window as Window & { __sessionId?: string }).__sessionId, // セッションIDがあれば
          }
        } as SSEEventData),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to publish event: ${response.status} ${response.statusText} ${errorText}`);
      }

      const result = await response.json();
      
      if (debug) {
        logger.info('[TypedUIEvent] Event published', { 
          eventType, 
          payload,
          result 
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TypedUIEvent] Failed to publish event', { 
        eventType, 
        payload,
        error: errorMessage 
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }, [debug, onError]);

  // SSE ストリームの設定
  const { isStreaming, error, reconnect, disconnect } = useSSEStream({
    url: '/api/ui-events',
    eventTypes: filteredEventTypes,
    onOpen: () => {
      if (debug) {
        logger.info('[TypedUIEvent] SSE connection opened');
      }
      onConnectionChange?.(true);
    },
    onEvent: (type, ev) => {
      try {
        const data = JSON.parse(ev.data);
        
        // イベントタイプの決定
        const eventName = (type === 'message' ? data.event : type) as EventTypeName;
        
        // フィルタリングチェック
        if (!filteredEventTypes.includes(eventName)) {
          if (debug) {
            logger.debug('[TypedUIEvent] Event filtered out', { eventName });
          }
          return;
        }
        
        // ペイロードの検証
        const validation = validateEventPayload(eventName, data.data ?? data);
        if (!validation.success) {
          logger.warn('[TypedUIEvent] Invalid event payload received', {
            eventName,
            error: validation.error,
            data,
          });
          return;
        }
        
        // CustomEvent をディスパッチ
        const event = createTypedEvent(eventName, validation.data);
        window.dispatchEvent(event);
        
        if (debug) {
          logger.info('[TypedUIEvent] Event dispatched', {
            eventName,
            payload: validation.data,
          });
        }
      } catch (err) {
        logger.error('[TypedUIEvent] Failed to process event', { 
          type, 
          data: ev.data, 
          error: String(err) 
        });
      }
    },
    onError: (e) => {
      logger.warn('[TypedUIEvent] SSE error', e);
      onConnectionChange?.(false);
      onError?.(new Error('SSE connection error'));
    },
  });

  return {
    publish,
    isConnected: isStreaming,
    lastError: error,
    reconnect,
    disconnect,
  };
}

/**
 * イベントリスナーを登録するヘルパー関数
 */
export function useTypedEventListener<T extends EventTypeName>(
  eventType: T,
  handler: (payload: EventPayload<T>) => void,
  deps: React.DependencyList = []
) {
  useCallback(() => {
    const handleEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      
      const validation = validateEventPayload(eventType, event.detail);
      if (validation.success) {
        handler(validation.data);
      } else {
        logger.warn('[TypedEventListener] Invalid event payload', {
          eventType,
          error: validation.error,
          detail: event.detail,
        });
      }
    };

    window.addEventListener(eventType, handleEvent);
    return () => window.removeEventListener(eventType, handleEvent);
  }, [eventType, ...deps])();
}

/**
 * 複数のイベントリスナーを一度に登録するヘルパー
 */
export function useTypedEventListeners(
  listeners: Array<{
    eventType: EventTypeName;
    handler: (payload: unknown) => void;
  }>,
  deps: React.DependencyList = []
) {
  useCallback(() => {
    const cleanups: (() => void)[] = [];
    
    listeners.forEach(({ eventType, handler }) => {
      const handleEvent = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        
        const validation = validateEventPayload(eventType, event.detail);
        if (validation.success) {
          handler(validation.data);
        }
      };

      window.addEventListener(eventType, handleEvent);
      cleanups.push(() => window.removeEventListener(eventType, handleEvent));
    });

    return () => cleanups.forEach(cleanup => cleanup());
  }, [...deps])();
}