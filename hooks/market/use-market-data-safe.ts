/**
 * Safe market data hook with proper cancellation and race condition handling
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAsyncState } from '@/hooks/base/use-async-state';
import { EnhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';
import { binanceWS } from '@/lib/binance/websocket-manager';
import { createDebouncedAsync, StateUpdateQueue } from '@/lib/utils/concurrent';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline } from '@/types/market';

export interface MarketDataState {
  symbol: string;
  data: ProcessedKline[];
  lastUpdate: number;
  isRealtime: boolean;
}

export interface UseMarketDataSafeOptions {
  symbol: string;
  interval?: string;
  limit?: number;
  enableRealtime?: boolean;
  debounceMs?: number;
}

export function useMarketDataSafe({
  symbol,
  interval = '1h',
  limit = 500,
  enableRealtime = true,
  debounceMs = 300
}: UseMarketDataSafeOptions) {
  const marketService = useRef(new EnhancedMarketDataService());
  const abortControllerRef = useRef<AbortController | null>(null);
  const stateQueueRef = useRef<StateUpdateQueue<MarketDataState> | null>(null);
  
  // Use our safe async state hook
  const {
    data: marketData,
    loading,
    error,
    execute: fetchData,
    reset
  } = useAsyncState(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    logger.debug('[useMarketDataSafe] Fetching market data', { symbol, interval, limit });
    
    try {
      const response = await marketService.current.fetchMultiTimeframeData(
        symbol,
        [{ interval, weight: 1, dataPoints: limit }],
        signal
      );
      
      const data = response.timeframes[interval]?.data || [];
      
      return {
        symbol,
        data,
        lastUpdate: Date.now(),
        isRealtime: false
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('[useMarketDataSafe] Request aborted');
        throw new Error('Request cancelled');
      }
      throw error;
    }
  });

  // Create debounced fetch function
  const debouncedFetch = useRef(
    createDebouncedAsync(fetchData, debounceMs)
  );

  // Initialize state update queue
  useEffect(() => {
    if (!stateQueueRef.current && marketData) {
      stateQueueRef.current = new StateUpdateQueue(
        marketData,
        async (newState) => {
          // This is where we would update the state
          // In a real implementation, we'd use a state management solution
          logger.debug('[useMarketDataSafe] State updated', { 
            symbol: newState.symbol, 
            dataLength: newState.data.length,
            isRealtime: newState.isRealtime 
          });
        }
      );
    }
  }, [marketData]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!enableRealtime || !marketData || !symbol) return;
    
    let unsubscribe: (() => void) | null = null;
    
    const setupWebSocket = async () => {
      try {
        unsubscribe = await binanceWS.subscribe(symbol, (update) => {
          if (!stateQueueRef.current) return;
          
          // Queue state update to prevent race conditions
          stateQueueRef.current.enqueue(async (currentState) => {
            const newCandle: ProcessedKline = {
              timestamp: update.timestamp,
              open: update.price,
              high: update.price,
              low: update.price,
              close: update.price,
              volume: update.volume,
              processed: true
            };
            
            // Update or append candle
            const updatedData = [...currentState.data];
            const lastCandle = updatedData[updatedData.length - 1];
            
            if (lastCandle && isSameCandle(lastCandle.timestamp, newCandle.timestamp, interval)) {
              // Update existing candle
              updatedData[updatedData.length - 1] = {
                ...lastCandle,
                high: Math.max(lastCandle.high, newCandle.high),
                low: Math.min(lastCandle.low, newCandle.low),
                close: newCandle.close,
                volume: lastCandle.volume + newCandle.volume
              };
            } else {
              // Add new candle
              updatedData.push(newCandle);
              
              // Maintain limit
              if (updatedData.length > limit) {
                updatedData.shift();
              }
            }
            
            return {
              ...currentState,
              data: updatedData,
              lastUpdate: Date.now(),
              isRealtime: true
            };
          });
        });
        
        logger.info('[useMarketDataSafe] WebSocket subscription established', { symbol });
      } catch (error) {
        logger.error('[useMarketDataSafe] Failed to setup WebSocket', { symbol, error });
      }
    };
    
    setupWebSocket();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [symbol, interval, limit, enableRealtime, marketData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Cancel debounced operations
      debouncedFetch.current.cancel();
    };
  }, []);

  // Refetch function with debouncing
  const refetch = useCallback(() => {
    return debouncedFetch.current.execute();
  }, []);

  return {
    data: marketData?.data || [],
    symbol: marketData?.symbol || symbol,
    lastUpdate: marketData?.lastUpdate || 0,
    isRealtime: marketData?.isRealtime || false,
    loading,
    error,
    refetch,
    reset
  };
}

/**
 * Check if two timestamps belong to the same candle based on interval
 */
function isSameCandle(timestamp1: number, timestamp2: number, interval: string): boolean {
  const intervalMs = getIntervalMs(interval);
  return Math.floor(timestamp1 / intervalMs) === Math.floor(timestamp2 / intervalMs);
}

/**
 * Convert interval string to milliseconds
 */
function getIntervalMs(interval: string): number {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // Default to 1 hour
  }
}