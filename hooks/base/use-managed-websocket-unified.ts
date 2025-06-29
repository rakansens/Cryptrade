'use client';

import { useConnectionBase, ConnectionConfig } from './use-connection-base';
import type { UseManagedWebSocketOptions } from './use-managed-websocket';

/**
 * Unified managed WebSocket hook that wraps useConnectionBase
 * Provides backward compatibility for existing useManagedWebSocket consumers
 */
export function useManagedWebSocketUnified(options: UseManagedWebSocketOptions) {
  // Convert old options to new ConnectionConfig format
  const connectionConfig: ConnectionConfig = {
    type: 'websocket',
    url: options.url,
    id: options.id,
    
    reconnect: {
      enabled: options.reconnect ?? true,
      maxAttempts: options.maxReconnectAttempts ?? 10,
      interval: options.reconnectInterval ?? 1000,
      backoffMultiplier: 1.5,
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
    },
    
    autoConnect: options.autoConnect ?? true,
  };

  // Use the unified connection base
  const connection = useConnectionBase(connectionConfig);

  // Convert to old API format for backward compatibility
  return {
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    error: connection.error,
    connect: connection.connect,
    disconnect: connection.disconnect,
    send: connection.send,
  };
}

/**
 * Drop-in replacement for useManagedWebSocket
 * @deprecated Use useConnectionBase directly for new code
 */
export const useManagedWebSocket = useManagedWebSocketUnified;