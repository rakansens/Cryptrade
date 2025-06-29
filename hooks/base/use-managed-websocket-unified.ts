import { useCallback, useEffect, useRef, useState } from 'react';
import { connectionManager } from '@/lib/ws/connection-manager';
import { logger } from '@/lib/utils/logger';

export interface UseManagedWebSocketOptions {
  url: string;
  id?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeat?: boolean;
  heartbeatInterval?: number;
  heartbeatMessage?: string | (() => string);
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  autoConnect?: boolean;
}

export interface UseManagedWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
}

export const useManagedWebSocketUnified = (options: UseManagedWebSocketOptions): UseManagedWebSocketReturn => {
  const {
    url,
    id = url,
    autoConnect = true,
    onOpen,
    onClose,
    onError,
    onMessage,
    reconnect = false,
    reconnectInterval = 5000,
    maxReconnectAttempts = 3,
    heartbeat = false,
    heartbeatInterval = 30000,
    heartbeatMessage = 'ping',
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (isConnecting || isConnected) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Use connectionManager to create WebSocket
      const websocket = connectionManager.createConnection(id, url);
      if (!websocket) {
        throw new Error('Failed to create WebSocket connection');
      }
      
      wsRef.current = websocket;
      
      websocket.onopen = (event) => {
        if (!isMountedRef.current) return;
        
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        onOpen?.(event);

        // Set up heartbeat if enabled
        if (heartbeat && websocket) {
          connectionManager.setHeartbeatInterval(
            id,
            () => {
              if (websocket && websocket.readyState === WebSocket.OPEN) {
                const message = typeof heartbeatMessage === 'function'
                  ? heartbeatMessage()
                  : heartbeatMessage;
                websocket.send(message);
              }
            },
            heartbeatInterval
          );
        }
      };

      websocket.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onClose?.(event);

        // Handle reconnection for abnormal closures
        if (reconnect && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          connectionManager.setReconnectTimeout(
            id,
            connect,
            reconnectInterval
          );
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError(new Error('Max reconnection attempts reached'));
        }
      };

      websocket.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        setError(new Error('WebSocket error'));
        setIsConnecting(false);
        onError?.(event);
      };

      websocket.onmessage = (event) => {
        if (!isMountedRef.current) return;
        onMessage?.(event);
      };

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
      setIsConnecting(false);
    }
  }, [url, id, onOpen, onClose, onError, onMessage, reconnect, reconnectInterval, maxReconnectAttempts, heartbeat, heartbeatInterval, heartbeatMessage, isConnecting, isConnected]);

  const disconnect = useCallback(() => {
    connectionManager.closeConnection(id);
    wsRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, [id]);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      logger.warn('[ManagedWebSocket] Cannot send, not connected', { id });
    }
  }, [id]);

  // Auto-connect effect
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Handle URL changes
  useEffect(() => {
    if (wsRef.current && url !== wsRef.current.url) {
      disconnect();
      connect();
    }
  }, [url, disconnect, connect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send,
  };
};