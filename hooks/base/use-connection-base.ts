/**
 * Connection Base Hook
 * 
 * Unified connection management for WebSocket, SSE, and other streaming connections
 * Consolidates common patterns from useWebSocket, useManagedWebSocket, and useStreamBase
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';
import { useCleanupBase } from '@/hooks/shared/useCleanupBase';
import { useDependencyBase, createCommonDependencyGroups } from '@/hooks/shared/useDependencyBase';

export interface ConnectionConfig {
  // Connection basics
  type: 'websocket' | 'sse' | 'custom';
  url: string;
  id?: string;
  protocols?: string | string[];
  
  // Reconnection settings
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    interval?: number;
    backoffMultiplier?: number;
    maxInterval?: number;
    shouldReconnect?: (event: CloseEvent | Event) => boolean;
  };
  
  // Heartbeat settings
  heartbeat?: {
    enabled?: boolean;
    interval?: number;
    message?: string | (() => string);
    timeout?: number;
  };
  
  // Event callbacks
  callbacks?: {
    onOpen?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onReconnectAttempt?: (attempt: number) => void;
    onReconnectFailed?: () => void;
    onReconnectSuccess?: () => void;
  };
  
  // Message handling
  messageHandler?: {
    filter?: (message: MessageEvent) => boolean;
    parse?: (data: any) => any;
    validate?: (parsed: any) => boolean;
  };
  
  // Options
  autoConnect?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  lastMessage: MessageEvent | null;
  reconnectAttempts: number;
}

export interface ConnectionActions {
  connect: () => void;
  disconnect: () => void;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  reset: () => void;
}

// Default configuration values
const DEFAULT_CONFIG = {
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    interval: 1000,
    backoffMultiplier: 1.5,
    maxInterval: 30000,
    shouldReconnect: () => true,
  },
  heartbeat: {
    enabled: false,
    interval: 30000,
    message: 'ping',
    timeout: 5000,
  },
  autoConnect: true,
  logLevel: 'info' as const,
};

/**
 * Unified connection management hook
 * Handles WebSocket, SSE, and custom connection types with common patterns
 */
export function useConnectionBase<T = any>(
  config: ConnectionConfig
): ConnectionState & ConnectionActions & { instance: WebSocket | EventSource | null } {
  const {
    type,
    url,
    id = url,
    protocols,
    reconnect = DEFAULT_CONFIG.reconnect,
    heartbeat = DEFAULT_CONFIG.heartbeat,
    callbacks = {},
    messageHandler = {},
    autoConnect = DEFAULT_CONFIG.autoConnect,
    logLevel = DEFAULT_CONFIG.logLevel,
  } = config;

  // Merge with defaults
  const reconnectConfig = { ...DEFAULT_CONFIG.reconnect, ...reconnect };
  const heartbeatConfig = { ...DEFAULT_CONFIG.heartbeat, ...heartbeat };

  // State management
  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0,
  });

  // Refs
  const connectionRef = useRef<WebSocket | EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const urlRef = useRef(url);

  // Cleanup management
  const cleanupBase = useCleanupBase({
    hookName: `useConnectionBase_${type}`,
    logLevel,
    autoCleanupOnUnmount: true,
  });

  // Dependency management
  const dependencyBase = useDependencyBase({
    hookName: `useConnectionBase_${type}`,
    groups: [
      createCommonDependencyGroups.options([
        protocols, reconnectConfig, heartbeatConfig, messageHandler
      ]),
      createCommonDependencyGroups.eventHandlers(Object.values(callbacks)),
      createCommonDependencyGroups.stateManagement([state]),
    ],
    logLevel,
  });

  // Update URL ref
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Safe logging
  const safeLog = useCallback((level: typeof logLevel, message: string, data?: any) => {
    if (!isMountedRef.current) return;
    
    const shouldLog = level === 'error' || 
      (level === 'warn' && ['warn', 'info', 'debug'].includes(logLevel)) ||
      (level === 'info' && ['info', 'debug'].includes(logLevel)) ||
      (level === 'debug' && logLevel === 'debug');
    
    if (shouldLog) {
      logger[level](`[Connection:${type}] ${message}`, {
        id,
        status: state.status,
        ...data,
      });
    }
  }, [type, id, logLevel, state.status]);

  // Update state helper
  const updateState = useCallback((updates: Partial<ConnectionState>) => {
    if (!isMountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Heartbeat management
  const sendHeartbeat = useCallback(() => {
    if (type !== 'websocket' || !connectionRef.current || 
        (connectionRef.current as WebSocket).readyState !== WebSocket.OPEN) {
      return;
    }

    const message = typeof heartbeatConfig.message === 'function' 
      ? heartbeatConfig.message() 
      : heartbeatConfig.message;

    (connectionRef.current as WebSocket).send(message);
    safeLog('debug', 'Heartbeat sent');

    // Set timeout for heartbeat response
    if (heartbeatConfig.timeout) {
      heartbeatTimeoutRef.current = setTimeout(() => {
        safeLog('warn', 'Heartbeat timeout - reconnecting');
        disconnect();
        scheduleReconnect();
      }, heartbeatConfig.timeout);
    }
  }, [type, heartbeatConfig, safeLog]);

  const startHeartbeat = useCallback(() => {
    if (!heartbeatConfig.enabled || type !== 'websocket') return;

    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, heartbeatConfig.interval);
    safeLog('debug', 'Heartbeat started', { interval: heartbeatConfig.interval });
  }, [heartbeatConfig, type, sendHeartbeat, safeLog]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
    safeLog('debug', 'Heartbeat stopped');
  }, [safeLog]);

  // Message handling
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    // Clear heartbeat timeout on any message
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }

    // Apply filter if provided
    if (messageHandler.filter && !messageHandler.filter(event)) {
      safeLog('debug', 'Message filtered out');
      return;
    }

    // Parse message if parser provided
    let parsedData = event.data;
    if (messageHandler.parse) {
      try {
        parsedData = messageHandler.parse(event.data);
      } catch (error) {
        safeLog('error', 'Failed to parse message', { 
          error: error instanceof Error ? error.message : String(error),
          rawData: event.data,
        });
        return;
      }
    }

    // Validate if validator provided
    if (messageHandler.validate && !messageHandler.validate(parsedData)) {
      safeLog('warn', 'Message validation failed', { parsedData });
      return;
    }

    updateState({ lastMessage: event });
    callbacks.onMessage?.(event);
  }, [messageHandler, callbacks, updateState, safeLog]);

  // Reconnection logic
  const scheduleReconnect = useCallback(() => {
    if (!reconnectConfig.enabled || 
        state.reconnectAttempts >= reconnectConfig.maxAttempts ||
        !isMountedRef.current) {
      if (state.reconnectAttempts >= reconnectConfig.maxAttempts) {
        updateState({ status: 'error', error: new Error('Max reconnection attempts reached') });
        callbacks.onReconnectFailed?.();
      }
      return;
    }

    const attempts = state.reconnectAttempts + 1;
    const delay = Math.min(
      reconnectConfig.interval * Math.pow(reconnectConfig.backoffMultiplier, attempts - 1),
      reconnectConfig.maxInterval
    );

    safeLog('info', 'Scheduling reconnection', { attempt: attempts, delay });
    updateState({ status: 'reconnecting', reconnectAttempts: attempts });
    callbacks.onReconnectAttempt?.(attempts);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, [reconnectConfig, state.reconnectAttempts, callbacks, updateState, safeLog]);

  // Connection cleanup
  const cleanupConnection = useCallback(() => {
    const instance = connectionRef.current;
    if (!instance) return;

    if (type === 'websocket' && instance instanceof WebSocket) {
      instance.onopen = null;
      instance.onclose = null;
      instance.onmessage = null;
      instance.onerror = null;
      if (instance.readyState === WebSocket.OPEN) {
        instance.close();
      }
    } else if (type === 'sse' && instance instanceof EventSource) {
      instance.onopen = null;
      instance.onerror = null;
      instance.onmessage = null;
      instance.close();
    }

    connectionRef.current = null;
    safeLog('debug', 'Connection cleaned up');
  }, [type, safeLog]);

  // Disconnect function
  const disconnect = useCallback(() => {
    safeLog('info', 'Disconnecting');

    // Cancel reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Stop heartbeat
    stopHeartbeat();

    // Cleanup connection
    cleanupConnection();

    // Update state
    updateState({
      status: 'disconnected',
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
    });
  }, [stopHeartbeat, cleanupConnection, updateState, safeLog]);

  // Connect function
  const connect = useCallback(() => {
    if (!isMountedRef.current || 
        state.isConnecting || 
        state.isConnected ||
        connectionRef.current) {
      return;
    }

    updateState({ 
      status: 'connecting', 
      isConnecting: true, 
      error: null 
    });

    try {
      let instance: WebSocket | EventSource;

      if (type === 'websocket') {
        instance = new WebSocket(urlRef.current, protocols);
        
        instance.onopen = (event) => {
          if (!isMountedRef.current) return;
          
          safeLog('info', 'Connected');
          updateState({
            status: 'connected',
            isConnected: true,
            isConnecting: false,
            reconnectAttempts: 0,
          });

          if (state.reconnectAttempts > 0) {
            callbacks.onReconnectSuccess?.();
          }

          startHeartbeat();
          callbacks.onOpen?.(event);
        };

        instance.onclose = (event) => {
          if (!isMountedRef.current) return;

          safeLog('info', 'Connection closed', { 
            code: event.code, 
            reason: event.reason 
          });

          updateState({
            status: 'disconnected',
            isConnected: false,
            isConnecting: false,
          });

          stopHeartbeat();
          callbacks.onClose?.(event);

          if (reconnectConfig.shouldReconnect(event)) {
            scheduleReconnect();
          }
        };

        instance.onmessage = handleMessage;

        instance.onerror = (event) => {
          if (!isMountedRef.current) return;

          safeLog('error', 'Connection error');
          updateState({ error: new Error('Connection error') });
          callbacks.onError?.(event);
        };

      } else if (type === 'sse') {
        instance = new EventSource(urlRef.current);

        instance.onopen = (event) => {
          if (!isMountedRef.current) return;

          safeLog('info', 'SSE Connected');
          updateState({
            status: 'connected',
            isConnected: true,
            isConnecting: false,
            reconnectAttempts: 0,
          });

          if (state.reconnectAttempts > 0) {
            callbacks.onReconnectSuccess?.();
          }

          callbacks.onOpen?.(event);
        };

        instance.onmessage = handleMessage;

        instance.onerror = (event) => {
          if (!isMountedRef.current) return;

          safeLog('error', 'SSE Error');
          updateState({
            status: 'disconnected',
            isConnected: false,
            isConnecting: false,
            error: new Error('SSE connection error'),
          });

          callbacks.onError?.(event);

          if (reconnectConfig.shouldReconnect(event)) {
            scheduleReconnect();
          }
        };

      } else {
        throw new Error(`Unsupported connection type: ${type}`);
      }

      connectionRef.current = instance;

    } catch (error) {
      safeLog('error', 'Failed to create connection', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      updateState({
        status: 'error',
        isConnecting: false,
        error: error instanceof Error ? error : new Error('Connection failed'),
      });
    }
  }, dependencyBase.mergedDependencies);

  // Send function (WebSocket only)
  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (type !== 'websocket') {
      safeLog('warn', 'Send is only available for WebSocket connections');
      return;
    }

    const ws = connectionRef.current as WebSocket;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
      safeLog('debug', 'Message sent');
    } else {
      safeLog('warn', 'Cannot send message - not connected');
    }
  }, [type, safeLog]);

  // Reset function
  const reset = useCallback(() => {
    disconnect();
    updateState({
      status: 'disconnected',
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
      reconnectAttempts: 0,
    });
  }, [disconnect, updateState]);

  // Register cleanup tasks
  useEffect(() => {
    cleanupBase.registerCleanupTask({
      id: 'connection-disconnect',
      cleanup: disconnect,
      priority: 'high',
    });

    cleanupBase.cleanupTimeout(reconnectTimeoutRef, 'reconnect-timeout');
    cleanupBase.cleanupTimeout(heartbeatIntervalRef, 'heartbeat-interval');
    cleanupBase.cleanupTimeout(heartbeatTimeoutRef, 'heartbeat-timeout');
    cleanupBase.cleanupRef(connectionRef, cleanupConnection, 'connection-instance');

    return () => {
      isMountedRef.current = false;
      cleanupBase.executeAllCleanupTasks();
    };
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [autoConnect]);

  // Handle URL changes
  useEffect(() => {
    if (connectionRef.current && urlRef.current !== url) {
      safeLog('info', 'URL changed - reconnecting');
      disconnect();
      connect();
    }
  }, [url, disconnect, connect, safeLog]);

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    send,
    reset,
    
    // Instance access
    instance: connectionRef.current,
  };
}

// Type exports for consumers
export type ConnectionBase = ReturnType<typeof useConnectionBase>;
export type ConnectionInstance = WebSocket | EventSource | null;