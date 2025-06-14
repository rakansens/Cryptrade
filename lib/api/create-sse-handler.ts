/**
 * SSE (Server-Sent Events) Handler Factory
 * 
 * Provides unified SSE streaming with error handling, cleanup, and filtering
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logging';
import { validateRequest } from './helpers/request-validator';
import { errorHandler } from './helpers/error-handler';
import type { StreamEvent } from '@/lib/api/types';

export interface SSEMessage extends StreamEvent {}

export interface SSEStream {
  write: (message: SSEMessage) => void;
  close: () => void;
  isClosed: boolean;
}

export interface SSEHandler<T = unknown> {
  onConnect?: (params: {
    request: NextRequest;
    data: T;
    stream: SSEStream;
  }) => Promise<void> | void;
  onDisconnect?: (params: {
    request: NextRequest;
    data: T;
    reason: string;
  }) => Promise<void> | void;
  onError?: (params: {
    request: NextRequest;
    data: T;
    error: Error;
  }) => Promise<void> | void;
}

export interface SSEConfig<T = unknown> {
  schema?: z.ZodSchema<T>;
  handler: SSEHandler<T>;
  heartbeat?: {
    enabled: boolean;
    interval: number;
    message?: SSEMessage;
  };
  cors?: {
    origin?: string;
    credentials?: boolean;
  };
  bufferSize?: number;
  timeout?: number;
}

/**
 * Create SSE endpoint handler
 */
export function createSSEHandler<T = unknown>(config: SSEConfig<T>) {
  return async function GET(request: NextRequest) {
    try {
      // Validate query parameters if schema provided
      let data: T = {} as T;
      if (config.schema) {
        const { searchParams } = new URL(request.url);
        const queryData: Record<string, string> = {};
        
        // Convert URLSearchParams to object
        for (const [key, value] of searchParams.entries()) {
          queryData[key] = value;
        }
        
        try {
          data = await validateRequest(queryData, config.schema);
        } catch (error) {
          return errorHandler(error as Error, request);
        }
      }

      // Create SSE stream
      const encoder = new TextEncoder();
      let heartbeatTimer: NodeJS.Timeout | undefined;
      let isClosed = false;
      let messageBuffer: string[] = [];

      const stream = new ReadableStream({
        start(controller) {
          const sseStream: SSEStream = {
            write: (message: SSEMessage) => {
              if (isClosed) return;
              
              try {
                const formatted = formatSSEMessage(message);
                
                // Buffer messages if needed
                if (config.bufferSize && messageBuffer.length >= config.bufferSize) {
                  messageBuffer.shift(); // Remove oldest message
                }
                
                if (config.bufferSize) {
                  messageBuffer.push(formatted);
                }
                
                controller.enqueue(encoder.encode(formatted));
              } catch (error) {
                logger.error('[SSE] Failed to write message', { error, message });
                cleanup('write_error');
              }
            },
            
            close: () => {
              cleanup('manual_close');
            },
            
            get isClosed() {
              return isClosed;
            }
          };

          const cleanup = (reason: string) => {
            if (isClosed) return;
            isClosed = true;
            
            if (heartbeatTimer) {
              clearInterval(heartbeatTimer);
            }
            
            try {
              controller.close();
            } catch (error) {
              // Already closed
            }
            
            // Call disconnect handler
            if (config.handler.onDisconnect) {
              config.handler.onDisconnect({ request, data, reason }).catch(error => {
                logger.error('[SSE] Disconnect handler error', { error, reason });
              });
            }
            
            logger.debug('[SSE] Connection closed', { reason });
          };

          // Send initial connection message
          sseStream.write({
            event: 'connected',
            data: { 
              message: 'SSE connection established',
              timestamp: Date.now()
            }
          });

          // Setup heartbeat if enabled
          if (config.heartbeat?.enabled) {
            const heartbeatMessage = config.heartbeat.message || {
              event: 'heartbeat',
              data: { timestamp: Date.now() }
            };
            
            heartbeatTimer = setInterval(() => {
              if (!isClosed) {
                sseStream.write({
                  ...heartbeatMessage,
                  data: { 
                    ...heartbeatMessage.data,
                    timestamp: Date.now()
                  }
                });
              }
            }, config.heartbeat.interval);
          }

          // Setup cleanup handlers
          request.signal.addEventListener('abort', () => cleanup('client_disconnect'));
          
          // Setup timeout if specified
          if (config.timeout) {
            setTimeout(() => {
              if (!isClosed) {
                cleanup('timeout');
              }
            }, config.timeout);
          }

          // Call connect handler
          if (config.handler.onConnect) {
            Promise.resolve(config.handler.onConnect({ request, data, stream: sseStream }))
              .catch(error => {
                logger.error('[SSE] Connect handler error', { error });
                if (config.handler.onError) {
                  config.handler.onError({ request, data, error }).catch(err => {
                    logger.error('[SSE] Error handler failed', { err });
                  });
                }
                cleanup('connect_error');
              });
          }
        },
      });

      // Set CORS headers
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      };

      if (config.cors) {
        headers['Access-Control-Allow-Origin'] = config.cors.origin || '*';
        if (config.cors.credentials) {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
      }

      return new Response(stream, { headers });

    } catch (error) {
      logger.error('[SSE] Handler error', { error });
      return errorHandler(error as Error, request);
    }
  };
}

/**
 * Format SSE message according to spec
 */
function formatSSEMessage(message: SSEMessage): string {
  let formatted = '';
  
  if (message.id) {
    formatted += `id: ${message.id}\n`;
  }
  
  if (message.event) {
    formatted += `event: ${message.event}\n`;
  }
  
  if (message.retry) {
    formatted += `retry: ${message.retry}\n`;
  }
  
  // Handle multi-line data
  const dataStr = typeof message.data === 'string' 
    ? message.data 
    : JSON.stringify(message.data);
  
  const dataLines = dataStr.split('\n');
  for (const line of dataLines) {
    formatted += `data: ${line}\n`;
  }
  
  formatted += '\n'; // End with double newline
  
  return formatted;
}

/**
 * Create OPTIONS handler for SSE endpoints
 */
export function createSSEOptionsHandler(corsConfig?: {
  origin?: string;
  credentials?: boolean;
}) {
  return async function OPTIONS() {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (corsConfig) {
      headers['Access-Control-Allow-Origin'] = corsConfig.origin || '*';
      if (corsConfig.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }

    return new Response(null, { status: 200, headers });
  };
}

/**
 * Helper to create broadcast channels for SSE
 */
export class SSEBroadcast {
  private subscribers = new Set<SSEStream>();
  private messageHistory: SSEMessage[] = [];
  private maxHistory: number;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Add subscriber to broadcast
   */
  subscribe(stream: SSEStream): () => void {
    this.subscribers.add(stream);
    
    // Send recent messages to new subscriber
    this.messageHistory.forEach(message => {
      if (!stream.isClosed) {
        stream.write(message);
      }
    });

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(stream);
    };
  }

  /**
   * Broadcast message to all subscribers
   */
  broadcast(message: SSEMessage): void {
    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    // Send to all active subscribers
    const activeSubscribers = new Set<SSEStream>();
    
    for (const stream of this.subscribers) {
      if (!stream.isClosed) {
        try {
          stream.write(message);
          activeSubscribers.add(stream);
        } catch (error) {
          logger.error('[SSE Broadcast] Failed to write to stream', { error });
        }
      }
    }

    // Clean up closed streams
    this.subscribers = activeSubscribers;
  }

  /**
   * Get current subscriber count
   */
  getSubscriberCount(): number {
    // Filter out closed streams
    const activeStreams = Array.from(this.subscribers).filter(s => !s.isClosed);
    this.subscribers = new Set(activeStreams);
    return this.subscribers.size;
  }

  /**
   * Close all streams and cleanup
   */
  close(): void {
    for (const stream of this.subscribers) {
      if (!stream.isClosed) {
        stream.close();
      }
    }
    this.subscribers.clear();
    this.messageHistory = [];
  }
}