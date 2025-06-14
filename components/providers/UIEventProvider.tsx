'use client';

import { useUIEventStream } from '@/hooks/use-ui-event-stream';
import { useEffect } from 'react';

/**
 * UIイベントストリームを購読するプロバイダー
 * アプリケーション全体でSSEイベントを受信
 */
export function UIEventProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useUIEventStream();

  useEffect(() => {
    if (isConnected) {
      console.log('[UIEventProvider] SSE connected and ready to receive events');
    }
  }, [isConnected]);

  return <>{children}</>;
}