'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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

/**
 * Managed WebSocket hook with automatic cleanup and memory leak prevention
 */
export function useManagedWebSocket(options: UseManagedWebSocketOptions): UseManagedWebSocketReturn {
  const {
    url,
    id = url,
    reconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    heartbeat = false,
    heartbeatInterval = 30000,
    heartbeatMessage = 'ping',
    onOpen,
    onClose,
    onMessage,
    onError,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Send heartbeat message
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof heartbeatMessage === 'function' 
        ? heartbeatMessage() 
        : heartbeatMessage;
      wsRef.current.send(message);
      logger.debug('[ManagedWebSocket] Heartbeat sent', { id });
    }
  }, [heartbeatMessage, id]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (!heartbeat) return;
    
    connectionManager.setHeartbeatInterval(id, sendHeartbeat, heartbeatInterval);
    logger.debug('[ManagedWebSocket] Heartbeat started', { id, interval: heartbeatInterval });
  }, [heartbeat, heartbeatInterval, id, sendHeartbeat]);

  // Handle reconnection
  const scheduleReconnect = useCallback(() => {
    if (!reconnect || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        logger.error('[ManagedWebSocket] Max reconnect attempts reached', { id });
        setError(new Error('Max reconnection attempts reached'));
      }
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(
      reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1),
      30000
    );

    logger.info('[ManagedWebSocket] Scheduling reconnect', { 
      id, 
      attempt: reconnectAttemptsRef.current, 
      delay 
    });

    connectionManager.setReconnectTimeout(id, () => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, [reconnect, reconnectInterval, maxReconnectAttempts, id]);

  // Connect function
  const connect = useCallback(() => {
    if (!isMountedRef.current || isConnecting || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    logger.info('[ManagedWebSocket] Connecting', { id, url });

    const ws = connectionManager.createConnection(id, url);
    if (!ws) {
      setIsConnecting(false);
      setError(new Error('Failed to create WebSocket connection'));
      return;
    }

    wsRef.current = ws;

    ws.onopen = (event) => {
      if (!isMountedRef.current) return;
      
      logger.info('[ManagedWebSocket] Connected', { id });
      setIsConnected(true);
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
      
      startHeartbeat();
      onOpen?.(event);
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current) return;
      
      logger.info('[ManagedWebSocket] Disconnected', { 
        id, 
        code: event.code, 
        reason: event.reason 
      });
      
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
      
      onClose?.(event);
      
      // Schedule reconnection if needed
      if (event.code !== 1000) { // Not a normal closure
        scheduleReconnect();
      }
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      onMessage?.(event);
    };

    ws.onerror = (event) => {
      if (!isMountedRef.current) return;
      
      logger.error('[ManagedWebSocket] Error', { id });
      setError(new Error('WebSocket error'));
      onError?.(event);
    };
  }, [
    id,
    url,
    isConnecting,
    startHeartbeat,
    onOpen,
    onClose,
    onMessage,
    onError,
    scheduleReconnect,
  ]);

  // Disconnect function
  const disconnect = useCallback(() => {
    logger.info('[ManagedWebSocket] Disconnecting', { id });
    
    reconnectAttemptsRef.current = 0;
    connectionManager.closeConnection(id);
    wsRef.current = null;
    
    setIsConnected(false);
    setIsConnecting(false);
  }, [id]);

  // Send message function
  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      logger.warn('[ManagedWebSocket] Cannot send, not connected', { id });
    }
  }, [id]);

  // Auto-connect and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []); // Only on mount/unmount

  // Handle URL changes
  useEffect(() => {
    if (wsRef.current && url !== wsRef.current.url) {
      logger.info('[ManagedWebSocket] URL changed, reconnecting', { id });
      disconnect();
      connect();
    }
  }, [url, id, disconnect, connect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send,
  };
}