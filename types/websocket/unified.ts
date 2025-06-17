/**
 * 統一されたWebSocket型定義
 */

/**
 * 型付きWebSocketメッセージ
 * @template T - メッセージペイロードの型
 */
export interface TypedWebSocketMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * WebSocketサブスクリプション
 */
export interface WebSocketSubscription {
  id: string;
  channel: string;
  params?: Record<string, unknown>;
  active: boolean;
}

/**
 * WebSocketエラーメッセージ
 */
export interface WebSocketErrorMessage {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
}

/**
 * WebSocket接続状態
 */
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

/**
 * WebSocket接続オプション
 */
export interface WebSocketOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
}