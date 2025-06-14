'use client';

import { useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import { useSSEStream } from '@/hooks/base/use-sse-stream';

/**
 * UIイベントストリームを購読するフック
 * SSE経由でサーバーからのUIイベントを受信し、window.dispatchEventで配信
 */
export function useUIEventStream() {
  const publish = useCallback(async (eventData: Event | CustomEvent | Record<string, unknown>) => {
    // CustomEvent 判定（ブラウザ環境のみ）
    const isCustomEvent = typeof window !== 'undefined' && eventData instanceof CustomEvent;

    const eventName: string | undefined = isCustomEvent
      ? eventData.type
      : (eventData?.type ?? eventData?.event);

    // detail or full object
    const payloadData = isCustomEvent ? (eventData as CustomEvent).detail : eventData;

    try {
      const response = await fetch('/api/ui-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventName,
          data: payloadData,
        }),
      });

      if (!response.ok) {
        // 返却ボディを取得してデバッグに残す
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to publish event: ${response.status} ${response.statusText} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('[UI-Event] Failed to publish event', { eventName, payloadData }, error);
      throw error;
    }
  }, []);

  useSSEStream({
    url: '/api/ui-events',
    eventTypes: [
      'ui-event',
      'ping',
      'draw:trendline',
      'draw:fibonacci',
      'draw:horizontal',
      'draw:vertical',
      'chart:fitContent',
      'chart:startDrawing',
      'chart:addDrawing',
      'chart:deleteDrawing',
      'chart:clearAllDrawings',
      'chart:setDrawingMode',
      'ui:changeSymbol',
      'ui:changeTimeframe',
      'ui:toggleIndicator',
      'proposal:approve',
      'proposal:reject',
      'proposal:approve-all',
      'proposal:reject-all',
    ],
    onEvent: (type, ev) => {
      try {
        const payload = JSON.parse(ev.data);
        const eventName = type === 'message' ? payload.event || 'message' : type;
        window.dispatchEvent(new CustomEvent(eventName, { detail: payload.data ?? payload }));
      } catch (err) {
        logger.error('[UI-Event] failed to parse', { type, data: ev.data, err });
      }
    },
    onError: (e) => logger.warn('[UI-Event] SSE error', e),
  });

  return { publish };
}