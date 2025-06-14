// hooks/base/use-sse-stream.ts
// EventSource ベースの共通 SSE フック
// [2025-06-11] 初版

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

export interface UseSSEStreamOptions {
  /** 接続先 URL */
  url: string;
  /** 受け取りたいイベントタイプ。空配列の場合は 'message' のみ */
  eventTypes?: string[];
  /** 接続開始コールバック */
  onOpen?: () => void;
  /** 各イベント受信 */
  onEvent?: (type: string, ev: MessageEvent) => void;
  /** エラー */
  onError?: (error: Event) => void;
  /** 自動接続 (デフォルト true) */
  autoConnect?: boolean;
}

export function useSSEStream({
  url,
  eventTypes = [],
  onOpen,
  onEvent,
  onError,
  autoConnect = true,
}: UseSSEStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    logger.info('[useSSEStream] connecting', { url });
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsStreaming(true);
      onOpen?.();
    };

    es.onerror = (e) => {
      logger.error('[useSSEStream] error', { url, e });
      setIsStreaming(false);
      setLastError(new Error('SSE error'));
      onError?.(e);
    };

    es.onmessage = (ev) => {
      onEvent?.('message', ev);
    };

    eventTypes.forEach((t) => {
      es.addEventListener(t, (ev) => onEvent?.(t, ev as MessageEvent));
    });
  }, [url, JSON.stringify(eventTypes)]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, autoConnect]);

  return {
    connect,
    disconnect,
    isStreaming,
    error: lastError,
  };
} 