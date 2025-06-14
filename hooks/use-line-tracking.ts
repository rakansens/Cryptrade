// Hook for tracking approved lines and recording their performance

import { useEffect, useCallback, useMemo } from 'react';
import { useAnalysisHistory, useAnalysisActions } from '@/store/analysis-history.store';
import { logger } from '@/lib/utils/logger';
import type { TouchEvent, AnalysisRecord } from '@/types/analysis-history';

interface PriceUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export function useLineTracking() {
  // Get all records and filter in useMemo to avoid infinite loops
  const allRecords = useAnalysisHistory(state => state.records);
  
  // Memoize active records to prevent infinite re-renders
  const activeRecords = useMemo(
    () => allRecords.filter(r => r.tracking.status === 'active'),
    [allRecords]
  );
  
  const { addTouchEvent, updateTrackingStatus, completeTracking } = useAnalysisActions();

  // Check if price touches a line
  const checkLineTouch = useCallback((record: AnalysisRecord, currentPrice: number, volume: number) => {
    if (!record.proposal.price) return null;
    
    const distance = Math.abs(currentPrice - record.proposal.price);
    const touchThreshold = record.proposal.price * 0.002; // 0.2% threshold
    
    if (distance <= touchThreshold) {
      // Determine touch strength based on how close it is
      const strength = 1 - (distance / touchThreshold);
      
      // Check if this is a bounce or break
      // For demo purposes, we'll use simple heuristics
      const result = strength > 0.8 ? 'bounce' : 'test';
      
      return {
        price: currentPrice,
        result,
        volume,
        strength: Math.min(1, strength)
      } as Omit<TouchEvent, 'time'>;
    }
    
    return null;
  }, []);

  // Auto-complete tracking after certain conditions
  const checkAutoComplete = useCallback((record: AnalysisRecord) => {
    const duration = Date.now() - record.tracking.startTime;
    const touches = record.tracking.touches;
    
    // Auto-complete after 48 hours
    if (duration > 48 * 60 * 60 * 1000) {
      const bounces = touches.filter((t) => t.result === 'bounce').length;
      const predicted = record.proposal.mlPrediction?.expectedBounces || 1;
      
      let finalResult: 'success' | 'partial' | 'failure';
      if (bounces >= predicted) {
        finalResult = 'success';
      } else if (bounces > 0) {
        finalResult = 'partial';
      } else {
        finalResult = 'failure';
      }
      
      completeTracking(record.id, finalResult);
      logger.info('[LineTracking] Auto-completed tracking', { 
        recordId: record.id, 
        duration: duration / 1000 / 3600, 
        bounces, 
        predicted,
        finalResult 
      });
    }
  }, [completeTracking]);

  // Process price update for all active records
  const processPriceUpdate = useCallback((update: PriceUpdate) => {
    activeRecords.forEach(record => {
      // Only process records for matching symbol
      if (record.symbol !== update.symbol) return;
      
      // Check for line touch
      const touch = checkLineTouch(record, update.price, update.volume);
      if (touch) {
        addTouchEvent(record.id, touch);
        logger.info('[LineTracking] Touch recorded', { 
          recordId: record.id, 
          price: update.price,
          result: touch.result,
          strength: touch.strength 
        });
        
        // Show browser notification for touch events (only in client)
        if (typeof window !== 'undefined') {
          import('@/lib/notifications/browser-notifications').then(({ notifications }) => {
            notifications.showLineTouch(update.symbol, update.price, touch.result)
              .catch(error => logger.warn('[LineTracking] Failed to show notification', error));
          });
        }
      }
      
      // Check if should auto-complete
      checkAutoComplete(record);
    });
  }, [activeRecords, checkLineTouch, addTouchEvent, checkAutoComplete]);

  // Log active records changes
  useEffect(() => {
    if (activeRecords.length === 0) {
      logger.info('[LineTracking] No active records to track');
      return;
    }
    
    // Get unique symbols from active records
    const activeSymbols = [...new Set(activeRecords.map(r => r.symbol))];
    logger.info('[LineTracking] Tracking symbols', activeSymbols);
  }, [activeRecords.length]); // Only depend on length to avoid infinite loops

  // Manual touch recording (for testing)
  const recordTouch = useCallback((recordId: string, result: 'bounce' | 'break' | 'test') => {
    const record = activeRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const touch: Omit<TouchEvent, 'time'> = {
      price: record.proposal.price || 50000,
      result,
      volume: 1000,
      strength: 0.9
    };
    
    addTouchEvent(recordId, touch);
    logger.info('[LineTracking] Manual touch recorded', { recordId, result });
  }, [activeRecords, addTouchEvent]);

  // Manual completion
  const completeRecord = useCallback((recordId: string, result: 'success' | 'partial' | 'failure') => {
    completeTracking(recordId, result);
    logger.info('[LineTracking] Manual completion', { recordId, result });
  }, [completeTracking]);

  return {
    activeRecords,
    recordTouch,
    completeRecord,
    processPriceUpdate
  };
}

// Hook for WebSocket price streams with Binance integration
export function usePriceStream(symbols: string[]) {
  const { processPriceUpdate } = useLineTracking();
  
  useEffect(() => {
    if (symbols.length === 0) return;
    
    // Import the WebSocket manager lazily
    const initializeWebSocket = async () => {
      try {
        const { binanceWS } = await import('@/lib/binance/websocket-manager');
        
        // Subscribe to all symbols
        const unsubscribeFunctions = symbols.map(symbol => {
          logger.info('[PriceStream] Subscribing to real-time data', { symbol });
          
          return binanceWS.subscribe(symbol, (update) => {
            processPriceUpdate(update);
          });
        });
        
        // Return cleanup function
        return () => {
          unsubscribeFunctions.forEach(unsub => unsub());
          logger.info('[PriceStream] Unsubscribed from all symbols');
        };
        
      } catch (error) {
        logger.error('[PriceStream] Failed to initialize WebSocket', error);
        
        // Fallback to mock data if WebSocket fails
        logger.info('[PriceStream] Falling back to mock price stream', symbols);
        return null;
      }
    };
    
    let cleanup: (() => void) | null = null;
    
    // Initialize the WebSocket connection
    initializeWebSocket().then(cleanupFn => {
      cleanup = cleanupFn;
    });
    
    // Cleanup on unmount
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [symbols, processPriceUpdate]);
}