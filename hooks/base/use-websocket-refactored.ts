/**
 * Refactored WebSocket Hook
 * 
 * This is an example of how to refactor useWebSocket to use useConnectionBase
 * Reduces code from ~400 lines to ~100 lines while maintaining all functionality
 */

'use client';

import { useMemo } from 'react';
import { useConnectionBase, type ConnectionConfig } from './use-connection-base';

export interface WebSocketHookOptions {
  url: string;
  protocols?: string | string[];
  
  // Connection options
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectDecay?: number;
  maxReconnectInterval?: number;
  maxReconnectAttempts?: number;
  
  // Heartbeat options
  heartbeat?: boolean;
  heartbeatInterval?: number;
  heartbeatMessage?: string | (() => string);
  
  // Callbacks
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onReconnectAttempt?: (attemptNumber: number) => void;
  onReconnectFailed?: () => void;
  onReconnectSuccess?: () => void;
  
  // Message handling
  shouldReconnect?: (event: CloseEvent) => boolean;
  filter?: (message: MessageEvent) => boolean;
  
  // Auto connect
  autoConnect?: boolean;
}

export interface WebSocketHookReturn {
  // State
  readyState: number;
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: MessageEvent | null;
  error: Event | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  
  // WebSocket instance
  webSocket: WebSocket | null;
}

/**
 * Refactored WebSocket hook using useConnectionBase
 * Maintains backward compatibility while reducing code duplication
 */
export function useWebSocketRefactored(options: WebSocketHookOptions): WebSocketHookReturn {
  const {
    url,
    protocols,
    reconnect = true,
    reconnectInterval = 1000,
    reconnectDecay = 1.5,
    maxReconnectInterval = 30000,
    maxReconnectAttempts = 10,
    heartbeat = false,
    heartbeatInterval = 30000,
    heartbeatMessage = 'ping',
    onOpen,
    onClose,
    onMessage,
    onError,
    onReconnectAttempt,
    onReconnectFailed,
    onReconnectSuccess,
    shouldReconnect = () => true,
    filter = () => true,
    autoConnect = true,
  } = options;

  // Convert options to ConnectionConfig format
  const connectionConfig = useMemo<ConnectionConfig>(() => ({
    type: 'websocket',
    url,
    protocols,
    reconnect: {
      enabled: reconnect,
      maxAttempts: maxReconnectAttempts,
      interval: reconnectInterval,
      backoffMultiplier: reconnectDecay,
      maxInterval: maxReconnectInterval,
      shouldReconnect: (event) => {
        // For WebSocket, we get CloseEvent
        if (event instanceof CloseEvent) {
          return shouldReconnect(event);
        }
        // For other events, reconnect by default
        return true;
      },
    },
    heartbeat: {
      enabled: heartbeat,
      interval: heartbeatInterval,
      message: heartbeatMessage,
    },
    callbacks: {
      onOpen,
      onClose,
      onMessage,
      onError,
      onReconnectAttempt,
      onReconnectFailed,
      onReconnectSuccess,
    },
    messageHandler: {
      filter,
    },
    autoConnect,
  }), [
    url,
    protocols,
    reconnect,
    reconnectInterval,
    reconnectDecay,
    maxReconnectInterval,
    maxReconnectAttempts,
    heartbeat,
    heartbeatInterval,
    heartbeatMessage,
    onOpen,
    onClose,
    onMessage,
    onError,
    onReconnectAttempt,
    onReconnectFailed,
    onReconnectSuccess,
    shouldReconnect,
    filter,
    autoConnect,
  ]);

  // Use the base connection hook
  const connection = useConnectionBase(connectionConfig);

  // Map to expected return format for backward compatibility
  const readyState = useMemo(() => {
    if (!connection.instance || !(connection.instance instanceof WebSocket)) {
      return WebSocket.CLOSED;
    }
    return connection.instance.readyState;
  }, [connection.instance]);

  return {
    // State mapping
    readyState,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    lastMessage: connection.lastMessage,
    error: connection.error ? new Event('WebSocket error') : null,
    
    // Actions
    connect: connection.connect,
    disconnect: connection.disconnect,
    sendMessage: connection.send,
    
    // WebSocket instance
    webSocket: connection.instance as WebSocket | null,
  };
}

/**
 * Example of how to create a specialized WebSocket hook
 * This shows how new hooks can be created with minimal code
 */
export function useJsonWebSocket<T = any>(
  url: string,
  options?: Omit<WebSocketHookOptions, 'url' | 'filter'> & {
    onJsonMessage?: (data: T) => void;
    validateJson?: (data: any) => data is T;
  }
) {
  const { onJsonMessage, validateJson, ...restOptions } = options || {};

  const wsOptions: WebSocketHookOptions = {
    ...restOptions,
    url,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Validate if validator provided
        if (validateJson && !validateJson(data)) {
          console.warn('Invalid JSON data received:', data);
          return;
        }
        
        onJsonMessage?.(data);
      } catch (error) {
        console.error('Failed to parse JSON message:', error);
      }
    },
  };

  return useWebSocketRefactored(wsOptions);
}

/**
 * Example: Binary WebSocket hook
 */
export function useBinaryWebSocket(
  url: string,
  options?: Omit<WebSocketHookOptions, 'url'> & {
    onBinaryMessage?: (data: ArrayBuffer) => void;
  }
) {
  const { onBinaryMessage, ...restOptions } = options || {};

  const wsOptions: WebSocketHookOptions = {
    ...restOptions,
    url,
    onMessage: async (event) => {
      if (event.data instanceof Blob) {
        const buffer = await event.data.arrayBuffer();
        onBinaryMessage?.(buffer);
      } else if (event.data instanceof ArrayBuffer) {
        onBinaryMessage?.(event.data);
      }
    },
  };

  return useWebSocketRefactored(wsOptions);
}