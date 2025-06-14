import { createSSEHandler, createSSEOptionsHandler, SSEBroadcast } from '@/lib/api/create-sse-handler';

/**
 * Server-Sent Events (SSE) エンドポイント
 *
 * Mastraエージェントからのリアルタイムイベント配信
 * - UI操作イベント
 * - 市場データ更新
 * - システム通知
 */

export interface BroadcastPayload {
  type: string;
  data?: unknown;
  timestamp?: number;
}

// Broadcast channel for all event subscribers
export const eventBroadcast = new SSEBroadcast();

export const GET = createSSEHandler({
  handler: {
    onConnect({ stream }) {
      eventBroadcast.subscribe(stream);
    }
  },
  heartbeat: { enabled: true, interval: 30000 },
  cors: { origin: '*' }
});

export const OPTIONS = createSSEOptionsHandler({ origin: '*' });

/**
 * イベント配信ヘルパー関数
 */
export function broadcastEvent(event: BroadcastPayload) {
  eventBroadcast.broadcast({
    data: {
      ...event,
      timestamp: event.timestamp || Date.now()
    }
  });
}
