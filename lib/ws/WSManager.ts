/**
 * WebSocket Manager with RxJS Observable API
 * Provides connection sharing, automatic reconnection with jitter, and resource cleanup
 */

import { Observable, Subject, BehaviorSubject, EMPTY, timer } from 'rxjs';
import { 
  webSocket, 
  WebSocketSubject, 
  WebSocketSubjectConfig 
} from 'rxjs/webSocket';
import { 
  map,
  tap,
  retry,
  retryWhen,
  scan,
  delayWhen,
  takeUntil,
  share,
  shareReplay,
  finalize,
  catchError,
  switchMap
} from 'rxjs/operators';
import { logger } from '@/lib/utils/logger';
import type { 
  WSMessage, 
  WSManagerOptions, 
  StreamState, 
  ReconnectionState,
  WebSocketError,
  WebSocketMetrics,
  StreamInfo,
  ConnectionState,
  ExtendedMetrics,
  RetryDelayPreview,
  RetryState
} from './types';

export class WSManager {
  private readonly options: Required<WSManagerOptions>;
  private readonly streams = new Map<string, StreamState<unknown>>();
  private readonly destroy$ = new Subject<void>();
  private connectionState$ = new BehaviorSubject<ConnectionState>('disconnected');
  private cleanupTimer?: NodeJS.Timeout;
  
  // Metrics tracking
  private metrics: WebSocketMetrics = {
    totalRetryAttempts: 0,
    totalReconnections: 0,
    totalStreamCreations: 0,
    totalStreamCleanups: 0,
    lastRetryTime: 0,
    lastErrorTime: 0,
    activeConnectionsHWM: 0 // High water mark
  };
  
  constructor(options: WSManagerOptions) {
    this.options = {
      maxRetryAttempts: 10,
      baseRetryDelay: 1000, // 1 second base delay
      maxRetryDelay: 30000, // 30 second maximum delay (requirement)
      jitterRange: 0.5, // Kept for backward compatibility, but full jitter is used
      debug: false,
      ...options
    };

    // Validate retry configuration
    if (this.options.maxRetryDelay > 30000) {
      logger.warn('[WSManager] maxRetryDelay exceeds 30s limit, clamping to 30s', {
        requested: this.options.maxRetryDelay,
        clamped: 30000
      });
      this.options.maxRetryDelay = 30000;
    }

    if (this.options.debug) {
      logger.info('[WSManager] Initialized', { options: this.options });
    }

    // Start periodic cleanup for idle connections
    this.startPeriodicCleanup();
  }

  /**
   * Subscribe to a WebSocket stream with Observable API
   * Automatically shares connections for the same stream using shareReplay with refCount
   */
  public subscribe<T extends object = Record<string, unknown>>(
    streamName: string
  ): Observable<T> {
    if (this.options.debug) {
      logger.debug('[WSManager] Subscribe requested', { streamName });
    }

    // Check if stream already exists
    let streamState = this.streams.get(streamName);
    
    if (!streamState) {
      // Create new shared observable
      const sharedObservable = this.createStreamObservable<T>(streamName).pipe(
        // Add finalize operator to handle cleanup when refCount reaches 0
        finalize(() => {
          if (this.options.debug) {
            logger.debug('[WSManager] Stream refCount reached 0, cleaning up', { streamName });
          }
          this.handleStreamCleanup(streamName);
        })
      );
      
      streamState = {
        observable: sharedObservable as Observable<unknown>,
        refCount: 0, // Will be managed by shareReplay
        lastActivity: Date.now()
      };
      
      this.streams.set(streamName, streamState);
      
      // Update metrics
      this.metrics.totalStreamCreations++;
      this.metrics.activeConnectionsHWM = Math.max(this.metrics.activeConnectionsHWM, this.streams.size);
      
      if (this.options.debug) {
        logger.debug('[WSManager] Created new shared stream', { 
          streamName, 
          totalStreams: this.streams.size,
          hwm: this.metrics.activeConnectionsHWM
        });
      }
    }

    // Update last activity
    streamState.lastActivity = Date.now();
    
    if (this.options.debug) {
      logger.debug('[WSManager] Returning shared observable', { 
        streamName,
        isExisting: this.streams.has(streamName)
      });
    }
    
    return streamState.observable as Observable<T>;
  }

  /**
   * Create Observable for a specific stream with retry logic and proper sharing
   */
  private createStreamObservable<T>(streamName: string): Observable<T> {
    const url = this.buildStreamUrl(streamName);
    
    if (this.options.debug) {
      logger.debug('[WSManager] Creating shared WebSocket observable', { url, streamName });
    }

    const wsSubject = this.createWebSocketSubject(url);
    
    return wsSubject.pipe(
      // Map and filter messages for this specific stream
      map(message => this.extractStreamData(message, streamName) as T),
      // Retry with exponential backoff and jitter
      retryWhen(errors => 
        errors.pipe(
          scan((acc, error) => ({ 
            ...acc, 
            attempt: acc.attempt + 1, 
            error 
          }), { attempt: 0, error: null } as RetryState),
          tap(({ attempt, error }) => {
            if (this.options.debug) {
              logger.warn('[WSManager] Stream error, preparing retry', { 
                streamName, 
                attempt, 
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }),
          delayWhen(({ attempt }) => {
            if (attempt >= this.options.maxRetryAttempts) {
              const errorMsg = `Max retry attempts (${this.options.maxRetryAttempts}) exceeded for stream: ${streamName}`;
              logger.error('[WSManager] Max retries exceeded', { 
                streamName, 
                attempt, 
                maxRetryAttempts: this.options.maxRetryAttempts 
              });
              throw new Error(errorMsg);
            }
            
            const delay = this.calculateRetryDelay(attempt);
            
            // Update retry metrics
            this.metrics.totalRetryAttempts++;
            this.metrics.lastRetryTime = Date.now();
            
            logger.info('[WSManager] Retrying connection with exponential backoff', { 
              streamName, 
              attempt: attempt + 1, // Show human-readable attempt number
              maxAttempts: this.options.maxRetryAttempts,
              delayMs: delay,
              delaySeconds: Math.round(delay / 1000),
              strategy: 'exponential_backoff_with_full_jitter',
              totalRetries: this.metrics.totalRetryAttempts
            });
            
            return timer(delay);
          })
        )
      ),
      // Handle cleanup when stream is no longer needed
      finalize(() => {
        if (this.options.debug) {
          logger.debug('[WSManager] Stream observable finalized', { streamName });
        }
      }),
      // Share replay with refCount for connection sharing
      shareReplay({ 
        refCount: true, 
        bufferSize: 1 
      }),
      // Handle errors that bubble up
      catchError(error => {
        logger.error('[WSManager] Unrecoverable stream error', { 
          streamName, 
          error: error.message 
        });
        this.handleStreamCleanup(streamName);
        throw error;
      })
    );
  }

  /**
   * Create WebSocket subject with proper configuration
   */
  private createWebSocketSubject<T = unknown>(url: string): WebSocketSubject<T> {
    const config: WebSocketSubjectConfig<T> = {
      url,
      openObserver: {
        next: () => {
          this.connectionState$.next('connected');
          if (this.options.debug) {
            logger.info('[WSManager] WebSocket connected', { url });
          }
        }
      },
      closeObserver: {
        next: () => {
          this.connectionState$.next('disconnected');
          if (this.options.debug) {
            logger.warn('[WSManager] WebSocket closed', { url });
          }
        }
      }
    };

    return webSocket<T>(config);
  }

  /**
   * Extract stream-specific data from WebSocket message
   */
  private extractStreamData<T = unknown>(message: WSMessage<Record<string, unknown>> | unknown, streamName: string): T {
    // Handle different message formats
    if (typeof message === 'object' && message !== null && 'stream' in message && 'data' in message) {
      const wsMessage = message as WSMessage<Record<string, unknown>>;
      // Multi-stream format: { stream: "btcusdt@trade", data: {...} }
      if (wsMessage.stream === streamName) {
        return wsMessage.data as T;
      }
      throw new Error(`Message for different stream: ${wsMessage.stream}, expected: ${streamName}`);
    }
    
    // Single stream format: direct data
    return message as T;
  }

  /**
   * Build WebSocket URL for a specific stream
   */
  private buildStreamUrl(streamName: string): string {
    // For now, use simple concatenation
    // This can be enhanced based on specific WebSocket server requirements
    const baseUrl = this.options.url;
    return baseUrl.endsWith('/') ? `${baseUrl}${streamName}` : `${baseUrl}/${streamName}`;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * Implements full jitter strategy to avoid thundering herd
   * Formula: randomBetween(0, min(maxRetryDelay, baseRetryDelay * 2^attempt))
   */
  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.options.baseRetryDelay * Math.pow(2, attempt);
    
    // Clamp to maximum delay (30s by default)
    const clampedDelay = Math.min(exponentialDelay, this.options.maxRetryDelay);
    
    // Full jitter: random value between 0 and clampedDelay
    // This is more effective than ±X% jitter for preventing thundering herd
    const jitteredDelay = Math.random() * clampedDelay;
    
    // Ensure minimum delay of 100ms to prevent overwhelming the server
    const finalDelay = Math.max(100, jitteredDelay);
    
    if (this.options.debug) {
      logger.debug('[WSManager] Calculated retry delay', {
        attempt,
        exponentialDelay,
        clampedDelay,
        finalDelay: Math.round(finalDelay),
        maxRetryDelay: this.options.maxRetryDelay
      });
    }
    
    return Math.round(finalDelay);
  }

  /**
   * Note: refCount is now managed by shareReplay({ refCount: true })
   * This method is kept for backward compatibility but is largely unused
   */
  private decrementRefCount(streamName: string): void {
    // With shareReplay({ refCount: true }), reference counting is handled automatically
    // This method is mainly for debugging purposes now
    if (this.options.debug) {
      logger.debug('[WSManager] RefCount decrement (handled by shareReplay)', { streamName });
    }
  }

  /**
   * Handle stream cleanup when no more subscribers
   * Implements automatic resource cleanup with connection pooling
   */
  private handleStreamCleanup(streamName: string): void {
    const streamState = this.streams.get(streamName);
    
    if (!streamState) {
      if (this.options.debug) {
        logger.debug('[WSManager] Stream already cleaned up', { streamName });
      }
      return;
    }

    if (this.options.debug) {
      logger.info('[WSManager] Cleaning up stream', { 
        streamName,
        lastActivity: new Date(streamState.lastActivity).toISOString(),
        ageMs: Date.now() - streamState.lastActivity
      });
    }

    this.streams.delete(streamName);
    
    // Update cleanup metrics
    this.metrics.totalStreamCleanups++;
    
    if (this.options.debug) {
      logger.info('[WSManager] Stream cleaned up successfully', { 
        streamName, 
        remainingStreams: this.streams.size,
        activeConnections: this.getActiveStreamsCount()
      });
    }

    // Trigger garbage collection hint for large cleanup operations
    if (this.streams.size === 0 && typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
        if (this.options.debug) {
          logger.debug('[WSManager] Triggered garbage collection after all streams cleanup');
        }
      } catch (error) {
        // Ignore GC errors in production
      }
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): Observable<ConnectionState> {
    return this.connectionState$.asObservable();
  }

  /**
   * Get current active streams count
   */
  public getActiveStreamsCount(): number {
    return this.streams.size;
  }

  /**
   * Get stream information for debugging
   */
  public getStreamInfo(): StreamInfo[] {
    return Array.from(this.streams.entries()).map(([name, state]) => ({
      name,
      refCount: state.refCount,
      lastActivity: state.lastActivity
    }));
  }

  /**
   * Get retry delay preview for a specific attempt (for testing/debugging)
   */
  public getRetryDelayPreview(attempt: number): RetryDelayPreview {
    const exponentialDelay = this.options.baseRetryDelay * Math.pow(2, attempt);
    const clampedDelay = Math.min(exponentialDelay, this.options.maxRetryDelay);
    
    return {
      exponentialDelay,
      clampedDelay,
      minDelay: 100, // Minimum delay enforced
      maxDelay: clampedDelay
    };
  }

  /**
   * Get monitoring metrics for SRE/observability (T-6 requirement)
   */
  public getMetrics(): ExtendedMetrics {
    return {
      // Primary monitoring metrics
      activeConnections: this.streams.size,
      retryCount: this.metrics.totalRetryAttempts,
      
      // Extended metrics 
      totalReconnections: this.metrics.totalReconnections,
      totalStreamCreations: this.metrics.totalStreamCreations,
      totalStreamCleanups: this.metrics.totalStreamCleanups,
      activeConnectionsHWM: this.metrics.activeConnectionsHWM,
      lastRetryTime: this.metrics.lastRetryTime,
      lastErrorTime: this.metrics.lastErrorTime,
      uptime: Date.now() - (this.metrics.lastRetryTime || Date.now()),
      implementation: 'WSManager'
    };
  }

  /**
   * Export metrics in Prometheus format (for monitoring systems)
   */
  public getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const timestamp = Date.now();
    
    return [
      `# HELP ws_manager_active_connections Current number of active WebSocket connections`,
      `# TYPE ws_manager_active_connections gauge`,
      `ws_manager_active_connections ${metrics.activeConnections} ${timestamp}`,
      ``,
      `# HELP ws_manager_retry_count_total Total number of retry attempts`,
      `# TYPE ws_manager_retry_count_total counter`, 
      `ws_manager_retry_count_total ${metrics.retryCount} ${timestamp}`,
      ``,
      `# HELP ws_manager_stream_creations_total Total number of streams created`,
      `# TYPE ws_manager_stream_creations_total counter`,
      `ws_manager_stream_creations_total ${metrics.totalStreamCreations} ${timestamp}`,
      ``,
      `# HELP ws_manager_stream_cleanups_total Total number of streams cleaned up`,
      `# TYPE ws_manager_stream_cleanups_total counter`,
      `ws_manager_stream_cleanups_total ${metrics.totalStreamCleanups} ${timestamp}`,
      ``,
      `# HELP ws_manager_active_connections_hwm High water mark of active connections`,
      `# TYPE ws_manager_active_connections_hwm gauge`,
      `ws_manager_active_connections_hwm ${metrics.activeConnectionsHWM} ${timestamp}`
    ].join('\\n');
  }

  /**
   * Start periodic cleanup for idle connections
   * Automatically removes streams that haven't been active for 5 minutes
   */
  private startPeriodicCleanup(): void {
    const CLEANUP_INTERVAL = 60000; // Check every minute
    const IDLE_TIMEOUT = 300000; // 5 minutes idle timeout
    
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const idleStreams: string[] = [];
      
      for (const [streamName, streamState] of this.streams.entries()) {
        const idleTime = now - streamState.lastActivity;
        if (idleTime > IDLE_TIMEOUT) {
          idleStreams.push(streamName);
        }
      }
      
      if (idleStreams.length > 0) {
        if (this.options.debug) {
          logger.info('[WSManager] Cleaning up idle streams', { 
            idleStreams,
            idleTimeoutMs: IDLE_TIMEOUT
          });
        }
        
        idleStreams.forEach(streamName => {
          this.handleStreamCleanup(streamName);
        });
      }
    }, CLEANUP_INTERVAL);
    
    if (this.options.debug) {
      logger.debug('[WSManager] Started periodic cleanup', { 
        intervalMs: CLEANUP_INTERVAL,
        idleTimeoutMs: IDLE_TIMEOUT
      });
    }
  }

  /**
   * Stop periodic cleanup timer
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      
      if (this.options.debug) {
        logger.debug('[WSManager] Stopped periodic cleanup');
      }
    }
  }

  /**
   * Force cleanup of idle streams (for manual cleanup)
   */
  public forceCleanupIdleStreams(idleTimeoutMs: number = 300000): number {
    const now = Date.now();
    const streamsBefore = this.streams.size;
    const idleStreams: string[] = [];
    
    for (const [streamName, streamState] of this.streams.entries()) {
      const idleTime = now - streamState.lastActivity;
      if (idleTime > idleTimeoutMs) {
        idleStreams.push(streamName);
      }
    }
    
    idleStreams.forEach(streamName => {
      this.handleStreamCleanup(streamName);
    });
    
    const cleanedCount = streamsBefore - this.streams.size;
    
    if (this.options.debug) {
      logger.info('[WSManager] Force cleanup completed', { 
        cleanedStreams: cleanedCount,
        remainingStreams: this.streams.size,
        idleTimeoutMs
      });
    }
    
    return cleanedCount;
  }

  /**
   * Destroy all streams and cleanup resources
   */
  public destroy(): void {
    if (this.options.debug) {
      logger.info('[WSManager] Destroying manager', { 
        activeStreams: this.streams.size 
      });
    }

    // Stop periodic cleanup
    this.stopPeriodicCleanup();

    // Signal all observables to complete
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear all streams
    this.streams.clear();
    
    // Complete connection state
    this.connectionState$.complete();
    
    if (this.options.debug) {
      logger.info('[WSManager] Manager destroyed successfully');
    }
  }
}