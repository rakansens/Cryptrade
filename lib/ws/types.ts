/**
 * WebSocket message types and interfaces for the WSManager
 */

import { Observable } from 'rxjs';

// WebSocket raw message types
export type RawWebSocketMessage = string | ArrayBuffer | Blob;

// WebSocket error types
export type WebSocketError = Error | Event | { type: string; message: string };

// WebSocket message structure
export interface WSMessage<T extends object = Record<string, unknown>> {
  stream?: string;
  data?: T;
}

export interface WSConfig {
  url: string;
  maxRetryAttempts?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  jitterRange?: number;
}

// Stream state with proper generic type
export interface StreamState<T = unknown> {
  observable: Observable<T>;
  refCount: number;
  lastActivity: number;
}

// Reconnection state with enhanced error tracking
export interface ReconnectionState {
  attempt: number;
  nextRetryDelay: number;
  isReconnecting: boolean;
  lastError?: WebSocketError;
}

// Generic message handler type with proper constraints
export type MessageHandler<T = unknown> = (data: T) => void;
export type UnsubscribeFunction = () => void;

// WebSocket metrics interface
export interface WebSocketMetrics {
  totalRetryAttempts: number;
  totalReconnections: number;
  totalStreamCreations: number;
  totalStreamCleanups: number;
  lastRetryTime: number;
  lastErrorTime: number;
  activeConnectionsHWM: number;
}

// Stream info for debugging
export interface StreamInfo {
  name: string;
  refCount: number;
  lastActivity: number;
}

// Debug info structure
export interface DebugInfo {
  activeStreams: number;
  subscriptions: Array<{ streamName: string; subscriptionCount: number }>;
  wsManagerInfo: {
    activeStreams: number;
    streamInfo: StreamInfo[];
    metrics: ExtendedMetrics;
  };
}

// Retry state for exponential backoff
export interface RetryState {
  attempt: number;
  error: WebSocketError;
}

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// WebSocket configuration for RxJS
export interface WebSocketConfig<T> {
  url: string;
  openObserver?: {
    next: (event: Event) => void;
  };
  closeObserver?: {
    next: (event: CloseEvent) => void;
  };
  closingObserver?: {
    next: () => void;
  };
}

// Extended metrics for monitoring
export interface ExtendedMetrics extends WebSocketMetrics {
  activeConnections: number;
  retryCount: number;
  uptime: number;
  implementation: string;
}

// Retry delay preview for debugging
export interface RetryDelayPreview {
  exponentialDelay: number;
  clampedDelay: number;
  minDelay: number;
  maxDelay: number;
}

export interface WSManagerOptions {
  /** WebSocket URL */
  url: string;
  /** Maximum number of retry attempts (default: 10) */
  maxRetryAttempts?: number;
  /** Base retry delay in milliseconds (default: 1000) */
  baseRetryDelay?: number;
  /** Maximum retry delay in milliseconds (default: 30000) */
  maxRetryDelay?: number;
  /** Jitter range as fraction of delay (default: 0.5) */
  jitterRange?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}