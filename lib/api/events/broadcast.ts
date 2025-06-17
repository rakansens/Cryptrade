import { SSEBroadcast } from '@/lib/api/create-sse-handler';

export interface BroadcastPayload {
  type: string;
  data?: unknown;
  timestamp?: number;
}

// Shared broadcast channel instance
export const eventBroadcast = new SSEBroadcast();

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