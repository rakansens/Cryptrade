'use client';

import { useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import type { PublishableEvent } from '@/types/events';

/**
 * UIイベントストリームを購読するフック
 * SSE経由でサーバーからのUIイベントを受信し、window.dispatchEventで配信
 */
// Type guard for checking if object has event property
function hasEventProperty(obj: unknown): obj is { event: string; [key: string]: unknown } {
  return typeof obj === 'object' && obj !== null && 'event' in obj && typeof (obj as { event: unknown }).event === 'string';
}

// Type guard for checking if object has type property
function hasTypeProperty(obj: unknown): obj is { type: string; [key: string]: unknown } {
  return typeof obj === 'object' && obj !== null && 'type' in obj && typeof (obj as { type: unknown }).type === 'string';
}

export function useUIEventStream() {
  const publish = useCallback(async (eventData: PublishableEvent) => {
    // CustomEvent 判定（ブラウザ環境のみ）
    const isCustomEvent = typeof window !== 'undefined' && eventData instanceof CustomEvent;

    let eventName: string | undefined;
    if (isCustomEvent) {
      eventName = eventData.type;
    } else if (hasTypeProperty(eventData)) {
      eventName = eventData.type;
    } else if (hasEventProperty(eventData)) {
      eventName = eventData.event;
    }

    // detail or full object
    const payloadData = isCustomEvent ? eventData.detail : eventData;

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
    onError: (e) => logger.warn('[UI-Event] SSE error', { error: e }),
  });

  return { publish };
}