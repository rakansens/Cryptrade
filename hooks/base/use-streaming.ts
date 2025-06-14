'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

/**
 * Base hook for handling streaming responses (SSE, fetch streams, etc.)
 * Provides common functionality for streaming data handling
 */

export interface StreamingHookOptions<T> {
  endpoint: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  
  // Callbacks
  onMessage?: (data: T) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onEnd?: () => void;
  
  // Options
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  parseResponse?: (chunk: string) => T | null;
}

export interface StreamingHookReturn<T> {
  data: T | null;
  isStreaming: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useStreaming<T = unknown>(options: StreamingHookOptions<T>): StreamingHookReturn<T> {
  const {
    endpoint,
    method = 'POST',
    body,
    headers,
    onMessage,
    onError,
    onStart,
    onEnd,
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 5,
    parseResponse = (chunk: string) => {
      try {
        return JSON.parse(chunk);
      } catch {
        return null;
      }
    }
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsStreaming(false);
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    logger.debug('[useStreaming] Disconnecting', { endpoint });
    cleanup();
    reconnectAttemptsRef.current = 0;
  }, [cleanup, endpoint]);

  // Connect function
  const connect = useCallback(async () => {
    // Don't connect if already streaming or component unmounted
    if (isStreaming || !isMountedRef.current) {
      return;
    }

    // Clear previous error
    setError(null);
    setIsStreaming(true);
    onStart?.();

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      logger.debug('[useStreaming] Connecting to stream', { endpoint, method });

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            logger.debug('[useStreaming] Stream ended', { endpoint });
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete messages (separated by newlines)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              // Handle SSE format
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                const parsedData = parseResponse(dataStr);
                if (parsedData !== null) {
                  setData(parsedData);
                  onMessage?.(parsedData);
                }
              } else {
                // Handle plain JSON lines
                const parsedData = parseResponse(line);
                if (parsedData !== null) {
                  setData(parsedData);
                  onMessage?.(parsedData);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown streaming error');
      
      // Don't treat abort as an error
      if (error.name !== 'AbortError') {
        logger.error('[useStreaming] Stream failed', { endpoint, error: error.message });
        setError(error);
        onError?.(error);
        
        // Attempt reconnection if enabled
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts && isMountedRef.current) {
          reconnectAttemptsRef.current++;
          const delay = reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff
          
          logger.info('[useStreaming] Scheduling reconnect', { 
            attempt: reconnectAttemptsRef.current, 
            delay 
          });
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsStreaming(false);
        onEnd?.();
      }
    }
  }, [
    endpoint,
    method,
    body,
    headers,
    isStreaming,
    onStart,
    onMessage,
    onError,
    onEnd,
    parseResponse,
    reconnect,
    reconnectInterval,
    maxReconnectAttempts,
  ]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [autoConnect]); // Only run on mount

  return {
    data,
    isStreaming,
    error,
    connect,
    disconnect,
  };
}

/**
 * Hook specifically for Server-Sent Events (SSE)
 */
export interface SSEHookOptions<T> extends Omit<StreamingHookOptions<T>, 'method'> {
  eventTypes?: string[];
}

export function useSSE<T = unknown>(options: SSEHookOptions<T>): StreamingHookReturn<T> & {
  eventSource: EventSource | null;
} {
  const { eventTypes = [], ...streamingOptions } = options;
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(async () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const es = new EventSource(options.endpoint);
      eventSourceRef.current = es;
      setEventSource(es);

      es.onopen = () => {
        logger.debug('[useSSE] Connection opened', { endpoint: options.endpoint });
        options.onStart?.();
      };

      es.onerror = (event) => {
        logger.error('[useSSE] Connection error', { endpoint: options.endpoint, event });
        const error = new Error('SSE connection failed');
        options.onError?.(error);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          options.onMessage?.(data);
        } catch (error) {
          logger.error('[useSSE] Failed to parse message', { error });
        }
      };

      // Register custom event listeners
      eventTypes.forEach(eventType => {
        es.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse(event.data);
            options.onMessage?.(data);
          } catch (error) {
            logger.error('[useSSE] Failed to parse event', { eventType, error });
          }
        });
      });

    } catch (error) {
      logger.error('[useSSE] Failed to create EventSource', { error });
      options.onError?.(error instanceof Error ? error : new Error('Failed to create EventSource'));
    }
  }, [options.endpoint, options.onStart, options.onError, options.onMessage, eventTypes]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setEventSource(null);
    }
  }, []);

  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []);

  // For SSE, we don't use the base streaming hook
  return {
    data: null,
    isStreaming: eventSource?.readyState === EventSource.OPEN || false,
    error: null,
    connect,
    disconnect,
    eventSource,
  };
}