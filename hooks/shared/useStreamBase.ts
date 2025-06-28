/**
 * Stream Base Hook
 * 
 * SSE/WebSocket等のストリーミング処理系フックの共通基盤
 * useSSEStream/useStreaming/usePriceStream等の重複パターンを統合
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';

export interface StreamConfig {
  hookName: string;
  connectionType: 'sse' | 'websocket' | 'custom';
  autoConnect?: boolean;
  reconnectDelay?: number;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
}

export interface StreamConnection<T = any> {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  instance?: T;
  error?: Error;
}

export interface EventListenerEntry {
  type: string;
  handler: (event: any) => void;
  options?: AddEventListenerOptions;
}

/**
 * ストリーミング処理系フックの共通基盤
 */
export function useStreamBase<TConnection = any, TMessage = any>(config: StreamConfig) {
  const { hookName, connectionType, autoConnect = true, reconnectDelay = 5000, logLevel = 'info' } = config;
  
  // Connection state
  const connectionRef = useRef<StreamConnection<TConnection>>({
    id: `${hookName}_${Date.now()}`,
    status: 'disconnected'
  });
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  
  // Mount state
  const isMountedRef = useRef(true);
  
  // Event listeners management
  const eventListenersRef = useRef<EventListenerEntry[]>([]);
  
  // Reconnection
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldReconnectRef = useRef(autoConnect);

  /**
   * 安全なログ出力
   */
  const safeLog = useCallback((level: typeof logLevel, message: string, context?: any) => {
    if (!isMountedRef.current) return;
    
    const logContext = {
      hook: hookName,
      connectionType,
      connectionId: connectionRef.current.id,
      status: connectionRef.current.status,
      ...context
    };
    
    logger[level](message, logContext);
  }, [hookName, connectionType, logLevel]);

  /**
   * 接続状態更新
   */
  const updateConnectionStatus = useCallback((
    status: StreamConnection['status'], 
    error?: Error
  ) => {
    if (!isMountedRef.current) return;
    
    connectionRef.current.status = status;
    connectionRef.current.error = error;
    
    setIsStreaming(status === 'connected');
    setConnectionError(error || null);
    
    safeLog(error ? 'error' : logLevel, `Connection ${status}`, { 
      error: error?.message,
      previousStatus: connectionRef.current.status 
    });
  }, [safeLog, logLevel]);

  /**
   * イベントリスナー登録
   */
  const addEventListener = useCallback((
    target: any,
    type: string,
    handler: (event: any) => void,
    options?: AddEventListenerOptions
  ) => {
    if (!target || typeof target.addEventListener !== 'function') {
      safeLog('warn', 'Invalid event target', { type });
      return;
    }
    
    // Wrap handler with mount check
    const wrappedHandler = (event: any) => {
      if (!isMountedRef.current) return;
      
      try {
        handler(event);
      } catch (error) {
        safeLog('error', `Error in ${type} handler`, { 
          error: error instanceof Error ? error.message : String(error),
          eventType: type 
        });
      }
    };
    
    target.addEventListener(type, wrappedHandler, options);
    eventListenersRef.current.push({ type, handler: wrappedHandler, options });
    
    safeLog('debug', `Added ${type} listener`, { 
      listenerCount: eventListenersRef.current.length 
    });
  }, [safeLog]);

  /**
   * 全イベントリスナー削除
   */
  const removeAllEventListeners = useCallback((target: any) => {
    if (!target || typeof target.removeEventListener !== 'function') return;
    
    eventListenersRef.current.forEach(({ type, handler, options }) => {
      try {
        target.removeEventListener(type, handler, options);
      } catch (error) {
        safeLog('warn', `Failed to remove ${type} listener`, { error });
      }
    });
    
    const removedCount = eventListenersRef.current.length;
    eventListenersRef.current = [];
    
    safeLog('debug', 'Removed all event listeners', { removedCount });
  }, [safeLog]);

  /**
   * 接続インスタンスクリーンアップ
   */
  const cleanupConnection = useCallback((instance: any) => {
    if (!instance) return;
    
    // EventSource specific cleanup
    if (connectionType === 'sse' && 'close' in instance) {
      instance.onopen = null;
      instance.onerror = null;
      instance.onmessage = null;
      instance.close();
    }
    
    // WebSocket specific cleanup
    else if (connectionType === 'websocket' && 'close' in instance) {
      instance.onopen = null;
      instance.onerror = null;
      instance.onmessage = null;
      instance.onclose = null;
      
      if (instance.readyState === WebSocket.OPEN) {
        instance.close();
      }
    }
    
    safeLog('debug', 'Connection instance cleaned up');
  }, [connectionType, safeLog]);

  /**
   * 完全な切断処理
   */
  const disconnect = useCallback(() => {
    // Cancel reconnection
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    const instance = connectionRef.current.instance;
    if (instance) {
      // Remove listeners first
      removeAllEventListeners(instance);
      
      // Then cleanup connection
      cleanupConnection(instance);
      
      // Clear reference
      connectionRef.current.instance = undefined;
    }
    
    updateConnectionStatus('disconnected');
    safeLog('info', 'Disconnected');
  }, [removeAllEventListeners, cleanupConnection, updateConnectionStatus, safeLog]);

  /**
   * メッセージ処理ラッパー
   */
  const createMessageHandler = useCallback((
    onMessage?: (data: TMessage) => void,
    parseMessage?: (raw: any) => TMessage | null
  ) => {
    return (event: any) => {
      if (!isMountedRef.current || !onMessage) return;
      
      try {
        let data: TMessage | null = null;
        
        // Parse based on connection type
        if (connectionType === 'sse' && event.data) {
          data = parseMessage ? parseMessage(event.data) : JSON.parse(event.data);
        } else if (connectionType === 'websocket' && event.data) {
          const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          data = parseMessage ? parseMessage(text) : JSON.parse(text);
        } else if (parseMessage) {
          data = parseMessage(event);
        }
        
        if (data !== null) {
          onMessage(data);
        }
      } catch (error) {
        safeLog('error', 'Failed to parse message', { 
          error: error instanceof Error ? error.message : String(error),
          rawData: event.data 
        });
      }
    };
  }, [connectionType, safeLog]);

  /**
   * 再接続処理
   */
  const scheduleReconnect = useCallback((connect: () => void) => {
    if (!shouldReconnectRef.current || !isMountedRef.current) return;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    safeLog('info', `Scheduling reconnection in ${reconnectDelay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && shouldReconnectRef.current) {
        safeLog('info', 'Attempting reconnection');
        connect();
      }
    }, reconnectDelay);
  }, [reconnectDelay, safeLog]);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    isMountedRef.current = true;
    safeLog('debug', 'Hook initialized');
    
    return () => {
      isMountedRef.current = false;
      shouldReconnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      disconnect();
      safeLog('debug', 'Hook cleanup completed');
    };
  }, []);

  return {
    // State
    connectionRef: connectionRef.current,
    isStreaming,
    connectionError,
    isMounted: () => isMountedRef.current,
    
    // Connection management
    updateConnectionStatus,
    disconnect,
    scheduleReconnect,
    
    // Event management
    addEventListener,
    removeAllEventListeners,
    createMessageHandler,
    
    // Utilities
    safeLog,
    cleanupConnection,
    
    // Config
    shouldReconnect: shouldReconnectRef,
  };
}

export type StreamBase = ReturnType<typeof useStreamBase>;