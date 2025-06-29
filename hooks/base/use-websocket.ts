'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';
import { useCleanupBase } from '@/hooks/shared/useCleanupBase';
import { useDependencyBase, createCommonDependencyGroups } from '@/hooks/shared/useDependencyBase';

/**
 * Base hook for WebSocket connections
 * Provides common functionality for WebSocket handling with automatic reconnection
 */

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

const DEFAULT_RECONNECT_INTERVAL = 1000;
const DEFAULT_RECONNECT_DECAY = 1.5;
const DEFAULT_MAX_RECONNECT_INTERVAL = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/**
 * @deprecated This is the legacy implementation. Use the unified version instead.
 * This function is kept for reference only during migration.
 */
function useWebSocketLegacy(options: WebSocketHookOptions): WebSocketHookReturn {
  const {
    url,
    protocols,
    reconnect = true,
    reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
    reconnectDecay = DEFAULT_RECONNECT_DECAY,
    maxReconnectInterval = DEFAULT_MAX_RECONNECT_INTERVAL,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    heartbeat = false,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
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

  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [error, setError] = useState<Event | null>(null);

  const webSocketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const urlRef = useRef(url);

  // 共通クリーンアップ管理
  const cleanupBase = useCleanupBase({
    hookName: 'useWebSocket',
    logLevel: 'info',
    autoCleanupOnUnmount: true
  });

  // 依存配列管理
  const dependencyBase = useDependencyBase({
    hookName: 'useWebSocket',
    groups: [
      createCommonDependencyGroups.options([
        protocols, reconnect, reconnectInterval, reconnectDecay,
        maxReconnectInterval, maxReconnectAttempts, shouldReconnect, filter
      ]),
      createCommonDependencyGroups.eventHandlers([
        onOpen, onClose, onMessage, onError,
        onReconnectAttempt, onReconnectFailed, onReconnectSuccess
      ]),
      createCommonDependencyGroups.stateManagement([
        isConnecting, readyState
      ]),
      createCommonDependencyGroups.externalResources([
        startHeartbeat, stopHeartbeat
      ])
    ],
    logLevel: 'info'
  });

  // Update URL ref when it changes
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Send heartbeat
  const sendHeartbeat = useCallback(() => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof heartbeatMessage === 'function' ? heartbeatMessage() : heartbeatMessage;
      webSocketRef.current.send(message);
      logger.debug('[useWebSocket] Heartbeat sent', { url: urlRef.current });
    }
  }, [heartbeatMessage]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (!heartbeat) return;
    
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, heartbeatInterval);
    logger.debug('[useWebSocket] Heartbeat started', { interval: heartbeatInterval });
  }, [heartbeat, heartbeatInterval, sendHeartbeat]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      logger.debug('[useWebSocket] Heartbeat stopped');
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    logger.info('[useWebSocket] Disconnecting', { url: urlRef.current });
    
    cleanup();
    reconnectAttemptsRef.current = 0;
    
    if (webSocketRef.current) {
      // Clear all event handlers before closing
      webSocketRef.current.onopen = null;
      webSocketRef.current.onclose = null;
      webSocketRef.current.onmessage = null;
      webSocketRef.current.onerror = null;
      
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    
    stopHeartbeat();
    setIsConnecting(false);
  }, [cleanup, stopHeartbeat]);

  // Connect function
  const connect = useCallback(() => {
    // Don't connect if already connected/connecting or component unmounted
    if (!isMountedRef.current || isConnecting || webSocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      logger.info('[useWebSocket] Connecting', { url: urlRef.current, attempt: reconnectAttemptsRef.current + 1 });
      
      const ws = new WebSocket(urlRef.current, protocols);
      webSocketRef.current = ws;

      ws.onopen = (event) => {
        logger.info('[useWebSocket] Connected', { url: urlRef.current });
        
        if (!isMountedRef.current) return;
        
        setReadyState(ws.readyState);
        setIsConnecting(false);
        
        // Reset reconnect attempts on successful connection
        if (reconnectAttemptsRef.current > 0) {
          onReconnectSuccess?.();
        }
        reconnectAttemptsRef.current = 0;
        
        startHeartbeat();
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        logger.info('[useWebSocket] Connection closed', { 
          url: urlRef.current, 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean 
        });
        
        if (!isMountedRef.current) return;
        
        setReadyState(ws.readyState);
        setIsConnecting(false);
        stopHeartbeat();
        onClose?.(event);
        
        // Attempt reconnection if enabled
        if (reconnect && shouldReconnect(event) && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          const timeout = Math.min(
            reconnectInterval * Math.pow(reconnectDecay, reconnectAttemptsRef.current - 1),
            maxReconnectInterval
          );
          
          logger.info('[useWebSocket] Scheduling reconnect', { 
            attempt: reconnectAttemptsRef.current, 
            timeout 
          });
          
          onReconnectAttempt?.(reconnectAttemptsRef.current);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, timeout);
        } else if (reconnect && reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logger.error('[useWebSocket] Max reconnection attempts reached');
          onReconnectFailed?.();
        }
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        if (filter(event)) {
          setLastMessage(event);
          onMessage?.(event);
        }
      };

      ws.onerror = (event) => {
        logger.error('[useWebSocket] Connection error', { url: urlRef.current, event });
        
        if (!isMountedRef.current) return;
        
        setError(event);
        setIsConnecting(false);
        onError?.(event);
      };

      // Update ready state periodically
      const stateInterval = setInterval(() => {
        if (isMountedRef.current && ws.readyState !== readyState) {
          setReadyState(ws.readyState);
        }
      }, 100);

      // Cleanup interval when connection closes
      const cleanupStateInterval = () => {
        clearInterval(stateInterval);
      };
      
      ws.addEventListener('close', cleanupStateInterval);
      
      // Store cleanup function for disconnect
      const originalOnClose = ws.onclose;
      ws.onclose = (event) => {
        cleanupStateInterval();
        originalOnClose?.call(ws, event);
      };

    } catch (error) {
      logger.error('[useWebSocket] Failed to create WebSocket', { url: urlRef.current, error });
      setIsConnecting(false);
      setError(new Event('WebSocket creation failed'));
    }
  }, dependencyBase.mergedDependencies);

  // Send message function
  const sendMessage = useCallback((message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(message);
      logger.debug('[useWebSocket] Message sent', { url: urlRef.current });
    } else {
      logger.warn('[useWebSocket] Cannot send message, WebSocket is not open', { 
        readyState: webSocketRef.current?.readyState 
      });
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // 共通クリーンアップベースを使用してクリーンアップタスクを登録
    cleanupBase.registerCleanupTask({
      id: 'websocket-mount-state',
      cleanup: () => {
        isMountedRef.current = false;
      },
      priority: 'high'
    });

    cleanupBase.registerCleanupTask({
      id: 'websocket-disconnect',
      cleanup: () => disconnect(),
      priority: 'high'
    });

    cleanupBase.cleanupTimeout(reconnectTimeoutRef, 'reconnect-timeout');
    cleanupBase.cleanupTimeout(heartbeatIntervalRef, 'heartbeat-interval');
    cleanupBase.cleanupRef(webSocketRef, (ws) => ws.close(), 'websocket-ref');

    return () => {
      cleanupBase.executeAllCleanupTasks();
    };
  }, []); // Only run on mount/unmount

  // Reconnect if URL changes while connected
  useEffect(() => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN && urlRef.current !== url) {
      logger.info('[useWebSocket] URL changed, reconnecting', { from: urlRef.current, to: url });
      disconnect();
      connect();
    }
  }, [url, disconnect, connect]);

  return {
    readyState,
    isConnected: readyState === WebSocket.OPEN,
    isConnecting,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage,
    webSocket: webSocketRef.current,
  };
}

// Import and re-export the unified implementation
import { useWebSocketUnified } from './use-websocket-unified';

/**
 * WebSocket hook with automatic reconnection and heartbeat support
 * 
 * @deprecated The internal implementation has been replaced with useConnectionBase.
 * For new code, consider using useConnectionBase directly.
 */
export const useWebSocket = useWebSocketUnified;

// Export the legacy implementation for reference during migration
export { useWebSocketLegacy };

/**
 * Hook for managing multiple WebSocket connections
 */
export interface MultiWebSocketOptions {
  connections: Array<{
    id: string;
    url: string;
    options?: Omit<WebSocketHookOptions, 'url'>;
  }>;
  onMessage?: (id: string, event: MessageEvent) => void;
  onError?: (id: string, event: Event) => void;
  onOpen?: (id: string, event: Event) => void;
  onClose?: (id: string, event: CloseEvent) => void;
}

export function useMultiWebSocket(options: MultiWebSocketOptions) {
  const { connections, onMessage, onError, onOpen, onClose } = options;
  const [connectionStates, setConnectionStates] = useState<Record<string, WebSocketHookReturn>>({});
  const connectionsRef = useRef<Record<string, WebSocketHookReturn>>({});

  useEffect(() => {
    const newConnections: Record<string, WebSocketHookReturn> = {};

    connections.forEach(({ id, url, options: connOptions = {} }) => {
      // This would need to be implemented differently to actually use the hook
      // For now, this is a conceptual implementation
      // Would create WebSocket connections with these options:
      // - url, connOptions merged with global handlers
      // - onMessage/onError/onOpen/onClose would call both local and global handlers
      logger.warn('[useMultiWebSocket] Multi-connection management needs custom implementation', {
        id,
        url,
        hasOptions: !!connOptions
      });
    });

    connectionsRef.current = newConnections;
    setConnectionStates(newConnections);

    return () => {
      Object.values(connectionsRef.current).forEach(conn => {
        conn.disconnect();
      });
    };
  }, [connections, onMessage, onError, onOpen, onClose]);

  return connectionStates;
}