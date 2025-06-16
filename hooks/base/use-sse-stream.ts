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

interface UseSSEStreamReturn {
  connect: () => void;
  disconnect: () => void;
  isStreaming: boolean;
  error: Error | null;
}

export function useSSEStream({
  url,
  eventTypes = [],
  onOpen,
  onEvent,
  onError,
  autoConnect = true,
}: UseSSEStreamOptions): UseSSEStreamReturn {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const eventListenersRef = useRef<Array<{ type: string; handler: (ev: Event) => void }>>([]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      // Remove all event listeners
      eventListenersRef.current.forEach(({ type, handler }) => {
        eventSourceRef.current?.removeEventListener(type, handler);
      });
      eventListenersRef.current = [];
      
      // Clear built-in event handlers
      eventSourceRef.current.onopen = null;
      eventSourceRef.current.onerror = null;
      eventSourceRef.current.onmessage = null;
      
      // Close the connection
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const connect = useCallback(() => {
    // Cleanup existing connection
    if (eventSourceRef.current) {
      disconnect();
    }

    if (!isMountedRef.current) return;

    logger.info('[useSSEStream] connecting', { url });
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isMountedRef.current) return;
      setIsStreaming(true);
      onOpen?.();
    };

    es.onerror = (e) => {
      if (!isMountedRef.current) return;
      logger.error('[useSSEStream] error', { url, e });
      setIsStreaming(false);
      setLastError(new Error('SSE error'));
      onError?.(e);
    };

    es.onmessage = (ev) => {
      if (!isMountedRef.current) return;
      onEvent?.('message', ev);
    };

    // Store event listeners for cleanup
    eventListenersRef.current = [];
    
    eventTypes.forEach((t) => {
      const handler = (ev: Event) => {
        if (!isMountedRef.current) return;
        onEvent?.(t, ev as MessageEvent);
      };
      es.addEventListener(t, handler);
      eventListenersRef.current.push({ type: t, handler });
    });
  }, [url, JSON.stringify(eventTypes), disconnect]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
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