import { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';
import type { StreamEvent as StreamEventType, StreamHandler as StreamHandlerType, StreamContext } from '@/lib/api/types';

export interface StreamEvent extends StreamEventType {}

export interface StreamHandler<T = unknown> extends StreamHandlerType<T> {}

export interface SSEOptions {
  keepAliveInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * StreamingResponseBuilder - Utilities for creating SSE/streaming responses
 * 
 * @example
 * ```typescript
 * const builder = new StreamingResponseBuilder();
 * 
 * // Create SSE stream from async generator
 * const stream = builder.createSSEStream(async function* () {
 *   yield { event: 'start', data: { timestamp: Date.now() } };
 *   yield { event: 'data', data: { value: 42 } };
 *   yield { event: 'end', data: { success: true } };
 * });
 * 
 * return new Response(stream, {
 *   headers: builder.getSSEHeaders()
 * });
 * ```
 */
export class StreamingResponseBuilder {
  private encoder = new TextEncoder();
  
  constructor(private options: SSEOptions = {}) {
    this.options = {
      keepAliveInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Format a single SSE message
   */
  private formatSSEMessage(event: StreamEvent): string {
    let message = '';
    
    if (event.id) {
      message += `id: ${event.id}\n`;
    }
    
    if (event.event) {
      message += `event: ${event.event}\n`;
    }
    
    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }
    
    // Handle different data types
    const data = typeof event.data === 'string' 
      ? event.data 
      : JSON.stringify(event.data);
    
    // Split data by newlines for proper SSE formatting
    const lines = data.split('\n');
    for (const line of lines) {
      message += `data: ${line}\n`;
    }
    
    message += '\n';
    return message;
  }

  /**
   * Create an SSE stream from an async generator
   */
  createSSEStream(
    eventGenerator: AsyncGenerator<StreamEvent, void, unknown> | (() => AsyncGenerator<StreamEvent, void, unknown>)
  ): ReadableStream {
    const { keepAliveInterval } = this.options;
    
    return new ReadableStream({
      async start(controller) {
        let keepAliveTimer: NodeJS.Timeout | null = null;
        
        try {
          // Set up keep-alive
          if (keepAliveInterval && keepAliveInterval > 0) {
            keepAliveTimer = setInterval(() => {
              try {
                const heartbeat = `:heartbeat ${Date.now()}\n\n`;
                controller.enqueue(new TextEncoder().encode(heartbeat));
              } catch (error) {
                // Controller might be closed
                if (keepAliveTimer) {
                  clearInterval(keepAliveTimer);
                  keepAliveTimer = null;
                }
              }
            }, keepAliveInterval);
          }
          
          // Get the actual generator
          const generator = typeof eventGenerator === 'function' ? eventGenerator() : eventGenerator;
          
          // Process events
          for await (const event of generator) {
            try {
              const formatted = new StreamingResponseBuilder().formatSSEMessage(event);
              controller.enqueue(new TextEncoder().encode(formatted));
            } catch (error) {
              logger.error('[SSE Stream] Failed to enqueue event', { error });
              // Continue processing other events
            }
          }
          
        } catch (error) {
          logger.error('[SSE Stream] Generator error', { error });
          
          // Send error event
          try {
            const errorEvent = new StreamingResponseBuilder().formatSSEMessage({
              event: 'error',
              data: {
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
              },
            });
            controller.enqueue(new TextEncoder().encode(errorEvent));
          } catch (e) {
            // Controller might be closed
          }
          
          controller.error(error);
        } finally {
          // Clean up
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
          }
          
          try {
            controller.close();
          } catch (e) {
            // Controller might already be closed
          }
        }
      },
    });
  }

  /**
   * Create a text stream for simple text streaming
   */
  createTextStream(
    textGenerator: AsyncGenerator<string, void, unknown>
  ): ReadableStream {
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const text of textGenerator) {
            controller.enqueue(new TextEncoder().encode(text));
          }
          controller.close();
        } catch (error) {
          logger.error('[Text Stream] Generator error', { error });
          controller.error(error);
        }
      },
    });
  }

  /**
   * Create an event stream with automatic retry and error handling
   */
  createEventStream(
    handler: StreamHandler,
    request: NextRequest,
    context: StreamContext = {}
  ): ReadableStream {
    const { maxRetries, retryDelay } = this.options;
    let retryCount = 0;
    
    return this.createSSEStream(async function* () {
      // Send initial connection event
      yield {
        event: 'connected',
        data: {
          timestamp: Date.now(),
          sessionId: context.sessionId,
        },
      };
      
      while (retryCount <= maxRetries!) {
        try {
          // Execute the handler
          const generator = handler({ request, context });
          
          for await (const data of generator) {
            // Reset retry count on successful data
            retryCount = 0;
            
            // Yield the data
            if (typeof data === 'object' && 'event' in data) {
              yield data as StreamEvent;
            } else {
              yield {
                event: 'data',
                data,
              };
            }
          }
          
          // Successfully completed
          break;
          
        } catch (error) {
          retryCount++;
          
          logger.error('[Event Stream] Handler error', {
            error,
            retryCount,
            maxRetries,
          });
          
          if (retryCount > maxRetries!) {
            // Max retries exceeded
            yield {
              event: 'error',
              data: {
                message: 'Max retries exceeded',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
              },
            };
            throw error;
          }
          
          // Send retry event
          yield {
            event: 'retry',
            data: {
              attempt: retryCount,
              maxRetries,
              nextRetryIn: retryDelay,
              timestamp: Date.now(),
            },
            retry: retryDelay,
          };
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay!));
        }
      }
      
      // Send completion event
      yield {
        event: 'done',
        data: {
          timestamp: Date.now(),
          success: true,
        },
      };
    });
  }

  /**
   * Get standard SSE headers
   */
  getSSEHeaders(): HeadersInit {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    };
  }

  /**
   * Create a transform stream for processing SSE events
   */
  createSSETransformStream(): TransformStream<StreamEvent, Uint8Array> {
    const encoder = this.encoder;
    const formatMessage = this.formatSSEMessage.bind(this);
    
    return new TransformStream({
      transform(chunk, controller) {
        try {
          const formatted = formatMessage(chunk);
          controller.enqueue(encoder.encode(formatted));
        } catch (error) {
          logger.error('[SSE Transform] Failed to transform event', { error });
          // Skip malformed events
        }
      },
    });
  }
}

/**
 * Utility functions for common streaming patterns
 */

/**
 * Stream JSON objects as SSE events
 */
export async function* streamJSON<T>(
  items: AsyncIterable<T> | Iterable<T>,
  eventType: string = 'data'
): AsyncGenerator<StreamEvent> {
  for await (const item of items) {
    yield {
      event: eventType,
      data: item,
    };
  }
}

/**
 * Stream text with character-by-character effect
 */
export async function* streamTextWithEffect(
  text: string,
  delayMs: number = 20,
  eventType: string = 'text'
): AsyncGenerator<StreamEvent> {
  let accumulated = '';
  
  for (const char of text) {
    accumulated += char;
    yield {
      event: eventType,
      data: {
        char,
        accumulated,
        progress: accumulated.length / text.length,
      },
    };
    
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final event
  yield {
    event: `${eventType}:complete`,
    data: {
      text: accumulated,
      length: accumulated.length,
    },
  };
}

/**
 * Create a progress stream for long-running operations
 */
export class ProgressStream {
  private current = 0;
  private total: number;
  private startTime = Date.now();
  
  constructor(total: number, private label: string = 'Progress') {
    this.total = total;
  }
  
  async *stream(): AsyncGenerator<StreamEvent> {
    yield {
      event: 'progress:start',
      data: {
        label: this.label,
        total: this.total,
        timestamp: this.startTime,
      },
    };
  }
  
  update(current: number, message?: string): StreamEvent {
    this.current = current;
    const progress = this.total > 0 ? this.current / this.total : 0;
    const elapsed = Date.now() - this.startTime;
    const eta = progress > 0 ? (elapsed / progress) * (1 - progress) : 0;
    
    return {
      event: 'progress:update',
      data: {
        label: this.label,
        current: this.current,
        total: this.total,
        progress,
        percentage: Math.round(progress * 100),
        elapsed,
        eta: Math.round(eta),
        message,
      },
    };
  }
  
  complete(message?: string): StreamEvent {
    const elapsed = Date.now() - this.startTime;
    
    return {
      event: 'progress:complete',
      data: {
        label: this.label,
        total: this.total,
        elapsed,
        message: message || 'Complete',
      },
    };
  }
}