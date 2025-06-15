'use client';

import { useUIEventStream } from '@/hooks/use-ui-event-stream';
import { useEffect } from 'react';

/**
 * UIイベントストリームを購読するプロバイダー
 * アプリケーション全体でSSEイベントを受信
 */
export function UIEventProvider({ children }: { children: React.ReactNode }) {
  useUIEventStream();

  useEffect(() => {
    console.log('[UIEventProvider] UI event stream initialized');
  }, []);

  return <>{children}</>;
}