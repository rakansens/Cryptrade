// hooks/base/use-sse-stream.ts
// EventSource ベースの共通 SSE フック
// [2025-06-11] 初版
// [2025-06-28] 基盤使用にリファクタリング

'use client';

import { useCallback, useEffect } from 'react';
import { useStreamBase } from '@/hooks/shared/useStreamBase';

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

export interface UseSSEStreamReturn {
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
  // 共通基盤初期化
  const streamBase = useStreamBase<EventSource, MessageEvent>({
    hookName: 'useSSEStream',
    connectionType: 'sse',
    autoConnect,
    logLevel: 'info'
  });

  const disconnect = useCallback(() => {
    streamBase.disconnect();
  }, [streamBase]);

  const connect = useCallback(() => {
    // 既存接続をクリーンアップ
    disconnect();

    if (!streamBase.isMounted()) return;

    try {
      streamBase.safeLog('info', 'Connecting to SSE', { url });
      const es = new EventSource(url);
      
      // 接続インスタンスを保存
      streamBase.connectionRef.instance = es;

      // open イベント
      es.onopen = () => {
        streamBase.updateConnectionStatus('connected');
        onOpen?.();
      };

      // error イベント
      es.onerror = (e) => {
        const error = new Error('SSE connection error');
        streamBase.updateConnectionStatus('error', error);
        onError?.(e);
        
        // 自動再接続（必要な場合）
        if (streamBase.shouldReconnect.current) {
          streamBase.scheduleReconnect(connect);
        }
      };

      // デフォルトメッセージハンドラ
      es.onmessage = streamBase.createMessageHandler(
        (data) => onEvent?.('message', data as any),
        (raw) => ({ data: raw } as any)
      );

      // カスタムイベントタイプ
      eventTypes.forEach((eventType) => {
        streamBase.addEventListener(
          es,
          eventType,
          (ev: MessageEvent) => onEvent?.(eventType, ev)
        );
      });

      streamBase.updateConnectionStatus('connecting');
    } catch (error) {
      streamBase.safeLog('error', 'Failed to create EventSource', { 
        error: error instanceof Error ? error.message : String(error),
        url 
      });
      streamBase.updateConnectionStatus('error', error as Error);
    }
  }, [url, JSON.stringify(eventTypes), disconnect, onOpen, onEvent, onError, streamBase]);

  // 自動接続処理
  useEffect(() => {
    if (autoConnect && streamBase.isMounted()) {
      connect();
    }
  }, [autoConnect, connect, streamBase]);

  return {
    connect,
    disconnect,
    isStreaming: streamBase.isStreaming,
    error: streamBase.connectionError,
  };
} 