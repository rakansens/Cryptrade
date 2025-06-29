'use client';

import { useConnectionBase, ConnectionConfig } from './use-connection-base';
import type { WebSocketHookOptions } from './use-websocket';

/**
 * Unified WebSocket hook that wraps useConnectionBase
 * Provides backward compatibility for existing useWebSocket consumers
 */
export function useWebSocketUnified(options: WebSocketHookOptions) {
  // Convert old options to new ConnectionConfig format
  const connectionConfig: ConnectionConfig = {
    type: 'websocket',
    url: options.url,
    protocols: options.protocols,
    
    reconnect: {
      enabled: options.reconnect ?? true,
      maxAttempts: options.maxReconnectAttempts ?? 10,
      interval: options.reconnectInterval ?? 1000,
      backoffMultiplier: options.reconnectDecay ?? 1.5,
      maxInterval: options.maxReconnectInterval ?? 30000,
      shouldReconnect: options.shouldReconnect ?? (() => true),
    },
    
    heartbeat: {
      enabled: options.heartbeat ?? false,
      interval: options.heartbeatInterval ?? 30000,
      message: options.heartbeatMessage ?? 'ping',
    },
    
    callbacks: {
      onOpen: options.onOpen,
      onClose: options.onClose,
      onMessage: options.onMessage,
      onError: options.onError,
      onReconnectAttempt: options.onReconnectAttempt,
      onReconnectFailed: options.onReconnectFailed,
      onReconnectSuccess: options.onReconnectSuccess,
    },
    
    messageHandler: {
      filter: options.filter,
    },
    
    autoConnect: options.autoConnect ?? true,
  };

  // Use the unified connection base
  const connection = useConnectionBase(connectionConfig);

  // Convert to old API format for backward compatibility
  return {
    // State
    readyState: connection.instance instanceof WebSocket 
      ? connection.instance.readyState 
      : connection.isConnected ? WebSocket.OPEN : WebSocket.CLOSED,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    lastMessage: connection.lastMessage,
    error: connection.error,
    reconnectAttempts: connection.reconnectAttempts,
    
    // Actions
    connect: connection.connect,
    disconnect: connection.disconnect,
    send: connection.send,
    reset: connection.reset,
    
    // Direct access to WebSocket instance
    webSocket: connection.instance as WebSocket | null,
  };
}

/**
 * Drop-in replacement for useWebSocket
 * @deprecated Use useConnectionBase directly for new code
 */
export const useWebSocket = useWebSocketUnified;