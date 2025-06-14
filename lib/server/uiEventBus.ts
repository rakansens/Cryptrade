import { EventEmitter } from 'events';

/**
 * UIイベントのペイロード型
 */
export interface UIEventPayload {
  event: string;          // e.g. 'draw:trendline'
  data: Record<string, any>;
}

/**
 * サーバーサイドのUIイベントバス
 * Agent Selection Toolからのイベントを受け取り、SSE経由でブラウザに配信
 */
export const uiEventBus = new EventEmitter();

/**
 * UIイベントバスインスタンスを取得する関数
 */
export function getUIEventBus() {
  return uiEventBus;
}

/**
 * UIイベントを発行するヘルパー関数
 * Process isolation対策: HTTP POST経由でイベントを送信
 */
export async function emitUIEvent(payload: UIEventPayload) {
  try {
    // Priority 1: Try HTTP POST for cross-process communication
    const response = await fetch('http://localhost:3000/api/ui-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error('[emitUIEvent] HTTP POST failed:', response.status);
      // Fallback to direct emit
      uiEventBus.emit('ui-event', payload);
    }
  } catch (error) {
    console.error('[emitUIEvent] HTTP POST Error:', error);
    // Fallback to direct emit only
    try {
      uiEventBus.emit('ui-event', payload);
    } catch (emitError) {
      console.error('[emitUIEvent] Direct emit also failed:', emitError);
    }
  }
}