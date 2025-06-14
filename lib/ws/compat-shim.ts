/**
 * Compatibility shim for existing binanceConnectionManager API
 * Wraps the new WSManager to maintain backward compatibility
 */

import { Subscription } from 'rxjs';
import { WSManager } from './WSManager';
import { logger } from '@/lib/utils/logger';
import type { MessageHandler, UnsubscribeFunction, DebugInfo, ExtendedMetrics } from './types';

// Re-export for backward compatibility
export type { MessageHandler, UnsubscribeFunction };

interface StreamSubscription<T = unknown> {
  id: string;
  handler: MessageHandler<T>;
  streamName: string;
  rxjsSubscription: Subscription;
}

/**
 * Backward compatible wrapper for binanceConnectionManager
 * Provides the same API while using the new WSManager internally
 */
export class BinanceConnectionManagerShim {
  private wsManager: WSManager;
  private subscriptions: Map<string, StreamSubscription<unknown>[]> = new Map();
  private subscriptionId = 0;
  private isInitialized = false;

  constructor(baseUrl?: string) {
    const url = baseUrl || 'wss://stream.binance.com:9443/ws/';
    
    this.wsManager = new WSManager({
      url,
      maxRetryAttempts: 10,
      baseRetryDelay: 1000,
      maxRetryDelay: 30000,
      debug: false // Will be controlled by environment
    });

    this.isInitialized = true;
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('[BinanceWS-Shim] Initialized with WSManager backend');
    }
  }

  /**
   * Subscribe to a stream with handler callback (legacy API)
   * Converts to Observable subscription internally
   */
  public subscribe<T = unknown>(streamName: string, handler: MessageHandler<T>): UnsubscribeFunction {
    if (!this.isInitialized) {
      throw new Error('BinanceConnectionManager not initialized');
    }

    const subscriptionId = (++this.subscriptionId).toString();
    
    // Create Observable subscription
    const rxjsSubscription = this.wsManager.subscribe<T extends object ? T : Record<string, unknown>>(streamName).subscribe({
      next: (data) => {
        try {
          handler(data);
        } catch (error) {
          logger.error('[BinanceWS-Shim] Error in subscription handler', {
            streamName,
            subscriptionId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      },
      error: (error) => {
        logger.error('[BinanceWS-Shim] Stream error', {
          streamName,
          subscriptionId,
          error: error instanceof Error ? error.message : String(error)
        });
      },
      complete: () => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[BinanceWS-Shim] Stream completed', { streamName, subscriptionId });
        }
      }
    });

    const subscription: StreamSubscription<T> = {
      id: subscriptionId,
      handler,
      streamName,
      rxjsSubscription
    };

    // Add to subscriptions map
    if (!this.subscriptions.has(streamName)) {
      this.subscriptions.set(streamName, []);
    }
    this.subscriptions.get(streamName)!.push(subscription);

    logger.info('[BinanceWS-Shim] Added subscription', {
      streamName,
      subscriptionId,
      totalSubscriptions: this.subscriptions.get(streamName)!.length,
      backend: 'WSManager'
    });

    // Return unsubscribe function (compatible with legacy API)
    return () => {
      this.unsubscribe(streamName, subscriptionId);
    };
  }

  /**
   * Unsubscribe from a specific subscription
   */
  private unsubscribe(streamName: string, subscriptionId: string): void {
    const subscribers = this.subscriptions.get(streamName);
    if (!subscribers) return;

    const index = subscribers.findIndex(sub => sub.id === subscriptionId);
    if (index !== -1) {
      const subscription = subscribers[index];
      
      // Unsubscribe from RxJS Observable
      subscription.rxjsSubscription.unsubscribe();
      
      // Remove from internal tracking
      subscribers.splice(index, 1);
      
      // Remove stream entirely if no more subscribers
      if (subscribers.length === 0) {
        this.subscriptions.delete(streamName);
      }

      logger.info('[BinanceWS-Shim] Removed subscription', {
        streamName,
        subscriptionId,
        remainingSubscriptions: subscribers.length
      });
    }
  }

  /**
   * Get connection status (legacy API compatibility)
   * Maps WSManager connection state to boolean
   */
  public getConnectionStatus(): boolean {
    if (!this.isInitialized) return false;
    
    // Convert Observable to synchronous boolean for compatibility
    let isConnected = false;
    this.wsManager.getConnectionStatus().subscribe(status => {
      isConnected = status === 'connected';
    }).unsubscribe();
    
    return isConnected;
  }

  /**
   * Disconnect all streams (legacy API compatibility)
   */
  public disconnect(): void {
    logger.info('[BinanceWS-Shim] Disconnecting all streams...');
    
    // Unsubscribe all active subscriptions
    for (const [streamName, subscribers] of this.subscriptions.entries()) {
      subscribers.forEach(sub => {
        sub.rxjsSubscription.unsubscribe();
      });
    }
    
    // Clear subscriptions map
    this.subscriptions.clear();
    
    // Destroy WSManager
    if (this.isInitialized) {
      this.wsManager.destroy();
    }
    
    logger.info('[BinanceWS-Shim] Disconnected successfully');
  }

  /**
   * Get debug information about active subscriptions
   */
  public getDebugInfo(): DebugInfo {
    const subscriptions = Array.from(this.subscriptions.entries()).map(([streamName, subs]) => ({
      streamName,
      subscriptionCount: subs.length
    }));

    return {
      activeStreams: this.subscriptions.size,
      subscriptions,
      wsManagerInfo: {
        activeStreams: this.wsManager.getActiveStreamsCount(),
        streamInfo: this.wsManager.getStreamInfo(),
        metrics: this.wsManager.getMetrics()
      }
    };
  }

  /**
   * Get monitoring metrics (T-6 requirement - exposed through shim)
   */
  public getMetrics(): ExtendedMetrics {
    return this.wsManager.getMetrics();
  }

  /**
   * Get Prometheus metrics (for SRE monitoring)
   */
  public getPrometheusMetrics(): string {
    return this.wsManager.getPrometheusMetrics();
  }

  /**
   * Access underlying WSManager for advanced features
   * (Not part of legacy API - for migration purposes)
   */
  public getWSManager(): WSManager {
    return this.wsManager;
  }
}

// Create singleton instance for backward compatibility
export const binanceConnectionManagerShim = new BinanceConnectionManagerShim();