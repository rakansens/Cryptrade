/**
 * Server-Sent Events (SSE) ユーティリティ
 * 
 * Mastraエージェントからクライアントへのリアルタイム通信
 */

export interface SSEEvent {
  type: string;
  data: unknown;
  timestamp?: number;
  id?: string;
}

/**
 * UI操作イベントをSSE経由でブロードキャスト
 */
export function broadcastUIEvent(event: {
  event: string;
  data: unknown;
  source?: string;
}) {
  broadcastEvent({
    type: 'ui_operation',
    data: {
      event: event.event,
      payload: event.data,
      source: event.source || 'mastra-agent',
    },
  });
}

/**
 * Chart操作イベントをSSE経由でブロードキャスト
 */
export function broadcastChartEvent(operations: Array<{
  type: string;
  action: string;
  parameters: unknown;
  clientEvent?: {
    event: string;
    data: unknown;
  };
}>) {
  operations.forEach(op => {
    if (op.clientEvent) {
      broadcastUIEvent({
        event: op.clientEvent.event,
        data: op.clientEvent.data,
        source: 'chart-control-tool',
      });
    }
  });
}

/**
 * 市場データ更新をSSE経由でブロードキャスト
 */
export function broadcastMarketDataUpdate(data: {
  symbol: string;
  price: number;
  change: number;
  timestamp?: number;
}) {
  broadcastEvent({
    type: 'market_data_update',
    data,
  });
}

/**
 * エージェント実行ステータスをSSE経由でブロードキャスト
 */
export function broadcastAgentStatus(status: {
  agentId: string;
  status: 'started' | 'completed' | 'failed';
  message?: string;
  executionTime?: number;
}) {
  broadcastEvent({
    type: 'agent_status',
    data: status,
  });
}

/**
 * イベント配信のコア関数
 */
function broadcastEvent(event: SSEEvent) {
  // Next.js App Routerではグローバル変数を使用
  if (typeof globalThis !== 'undefined' && globalThis.__clientStreams) {
    const eventData = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    for (const pushEvent of globalThis.__clientStreams as Set<(event: SSEEvent) => void>) {
      try {
        pushEvent(eventData);
      } catch (error) {
        console.error('[SSE] Failed to broadcast to client:', error);
        // エラーのあるクライアントを削除
        (globalThis.__clientStreams as Set<(event: SSEEvent) => void>).delete(pushEvent);
      }
    }
  }
}

/**
 * SSE接続数を取得
 */
export function getConnectedClientsCount(): number {
  return globalThis.__clientStreams?.size || 0;
}

/**
 * すべてのSSE接続を閉じる
 */
export function disconnectAllClients() {
  if (globalThis.__clientStreams) {
    globalThis.__clientStreams.clear();
  }
}