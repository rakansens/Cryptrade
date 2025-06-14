/**
 * Base hooks for common functionality
 * These hooks provide reusable patterns for streaming, WebSocket connections, etc.
 *
 * [2025-06-11] useAsyncState を公開エクスポートに追加
 */

export { useStreaming, useSSE } from './use-streaming';
export type { StreamingHookOptions, StreamingHookReturn, SSEHookOptions } from './use-streaming';

export { useWebSocket, useMultiWebSocket } from './use-websocket';
export type { WebSocketHookOptions, WebSocketHookReturn, MultiWebSocketOptions } from './use-websocket';

// async utils
export { useAsyncState } from './use-async-state';