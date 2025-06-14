import { NextRequest } from 'next/server';

/**
 * Server-Sent Events (SSE) エンドポイント
 * 
 * Mastraエージェントからのリアルタイムイベント配信
 * - UI操作イベント
 * - 市場データ更新
 * - システム通知
 */

interface SSEEvent {
  type: string;
  data?: unknown;
  message?: string;
  timestamp: number;
}

// グローバルクライアント管理
declare global {
  var __clientStreams: Set<(event: SSEEvent) => void>;
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // SSE初期化
      const sseHeaders = [
        'data: {"type":"connected","message":"SSE connection established","timestamp":' + Date.now() + '}\n\n',
      ];
      
      sseHeaders.forEach(header => {
        controller.enqueue(encoder.encode(header));
      });

      // プッシュ関数を定義
      const pushEvent = (event: SSEEvent) => {
        try {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (error) {
          console.error('[SSE] Failed to push event:', error);
        }
      };

      // グローバルコレクションに追加
      if (!globalThis.__clientStreams) {
        globalThis.__clientStreams = new Set();
      }
      globalThis.__clientStreams.add(pushEvent);

      // ハートビート (30秒間隔)
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // クリーンアップ
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        globalThis.__clientStreams?.delete(pushEvent);
        try {
          controller.close();
        } catch (error) {
          // Already closed
        }
      };

      // 接続終了時のクリーンアップ
      req.signal.addEventListener('abort', cleanup);
      
      // エラーハンドリング
      req.signal.addEventListener('error', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * イベント配信ヘルパー関数
 */
export function broadcastEvent(event: {
  type: string;
  data?: unknown;
  timestamp?: number;
}) {
  if (!globalThis.__clientStreams) {
    return;
  }

  const eventData = {
    ...event,
    timestamp: event.timestamp || Date.now(),
  };

  // 全接続クライアントにブロードキャスト
  for (const pushEvent of globalThis.__clientStreams) {
    try {
      pushEvent(eventData);
    } catch (error) {
      console.error('[SSE] Failed to broadcast to client:', error);
      // エラーのあるクライアントを削除
      globalThis.__clientStreams.delete(pushEvent);
    }
  }
}