/**
 * WebSocket Manager exports
 */

export { WSManager } from './WSManager';
export { BinanceConnectionManagerShim, binanceConnectionManagerShim } from './compat-shim';
export { 
  BinanceConnectionMigration, 
  connectionMigration,
  getBinanceConnection,
  createBinanceConnectionAPI 
} from './migration';

export type {
  WSMessage,
  WSConfig,
  StreamState,
  ReconnectionState,
  MessageHandler,
  UnsubscribeFunction,
  WSManagerOptions,
  WebSocketError,
  WebSocketMetrics,
  StreamInfo,
  DebugInfo,
  RetryState,
  ConnectionState,
  WebSocketConfig,
  ExtendedMetrics,
  RetryDelayPreview,
  RawWebSocketMessage
} from './types';

export type { BinanceConnectionAPI } from './migration';