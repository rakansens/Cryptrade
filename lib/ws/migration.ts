/**
 * Migration utilities for transitioning from old binanceConnectionManager to WSManager
 * Provides gradual migration path and feature flags
 */

import { binanceConnectionManager } from '@/lib/binance/connection-manager';
import { binanceConnectionManagerShim } from './compat-shim';
import { logger } from '@/lib/utils/logger';
import type { MessageHandler } from './types';

// Safe environment access for client/server compatibility
function getFeatureFlag(): boolean {
  if (typeof window !== 'undefined') {
    // Browser environment - use process.env directly (safer)
    return process.env.USE_NEW_WS_MANAGER === 'true' || false;
  } else {
    // Server environment - can safely use centralized env
    try {
      const { env } = require('@/config/env');
      return env.USE_NEW_WS_MANAGER === 'true' || false;
    } catch {
      return process.env.USE_NEW_WS_MANAGER === 'true' || false;
    }
  }
}

// Feature flag for WSManager migration
const USE_WS_MANAGER = getFeatureFlag();

/**
 * Migration wrapper that switches between old and new implementations
 * Based on feature flag or runtime detection
 */
export class BinanceConnectionMigration {
  private static instance: BinanceConnectionMigration;
  private useNewImplementation: boolean;

  private constructor() {
    this.useNewImplementation = USE_WS_MANAGER;
    
    logger.info('[BinanceWS-Migration] Initialized', {
      useNewImplementation: this.useNewImplementation,
      featureFlag: USE_WS_MANAGER,
      implementation: this.useNewImplementation ? 'WSManager' : 'Legacy'
    });
  }

  public static getInstance(): BinanceConnectionMigration {
    if (!BinanceConnectionMigration.instance) {
      BinanceConnectionMigration.instance = new BinanceConnectionMigration();
    }
    return BinanceConnectionMigration.instance;
  }

  /**
   * Get the appropriate connection manager based on feature flag
   */
  public getConnectionManager() {
    if (this.useNewImplementation) {
      return binanceConnectionManagerShim;
    } else {
      return binanceConnectionManager;
    }
  }

  /**
   * Enable WSManager implementation (for runtime switching)
   */
  public enableWSManager(): void {
    if (!this.useNewImplementation) {
      logger.info('[BinanceWS-Migration] Switching to WSManager implementation');
      
      // Disconnect old implementation if active
      if (binanceConnectionManager.getConnectionStatus()) {
        binanceConnectionManager.disconnect();
      }
      
      this.useNewImplementation = true;
    }
  }

  /**
   * Fallback to legacy implementation (for runtime switching)
   */
  public enableLegacy(): void {
    if (this.useNewImplementation) {
      logger.info('[BinanceWS-Migration] Switching to Legacy implementation');
      
      // Disconnect new implementation if active
      binanceConnectionManagerShim.disconnect();
      
      this.useNewImplementation = false;
    }
  }

  /**
   * Check which implementation is currently active
   */
  public getCurrentImplementation(): 'WSManager' | 'Legacy' {
    return this.useNewImplementation ? 'WSManager' : 'Legacy';
  }

  /**
   * Get performance metrics for comparison
   */
  public getPerformanceMetrics() {
    const current = this.getConnectionManager();
    
    if (this.useNewImplementation) {
      const debugInfo = binanceConnectionManagerShim.getDebugInfo();
      return {
        implementation: 'WSManager',
        activeStreams: debugInfo.activeStreams,
        subscriptions: debugInfo.subscriptions,
        wsManagerInfo: debugInfo.wsManagerInfo,
        features: [
          'connection_sharing',
          'exponential_backoff_with_jitter',
          'automatic_cleanup',
          'observable_api'
        ]
      };
    } else {
      return {
        implementation: 'Legacy',
        isConnected: binanceConnectionManager.getConnectionStatus(),
        features: [
          'basic_reconnection',
          'subscription_management'
        ]
      };
    }
  }
}

// Export singleton instance
export const connectionMigration = BinanceConnectionMigration.getInstance();

/**
 * Convenience function to get the active connection manager
 * This is the main API that should be used throughout the codebase
 */
export function getBinanceConnection() {
  return connectionMigration.getConnectionManager();
}

/**
 * Type-safe wrapper that provides the common API surface
 * Works with both implementations
 */
export interface BinanceConnectionAPI {
  subscribe<T = unknown>(streamName: string, handler: MessageHandler<T>): () => void;
  getConnectionStatus(): boolean;
  disconnect(): void;
}

/**
 * Ensure both implementations conform to the same interface
 */
export function createBinanceConnectionAPI(): BinanceConnectionAPI {
  const manager = getBinanceConnection();
  
  return {
    subscribe: manager.subscribe.bind(manager),
    getConnectionStatus: manager.getConnectionStatus.bind(manager),
    disconnect: manager.disconnect.bind(manager)
  };
}