import { useEffect, useRef } from 'react';
import { getBinanceConnection } from '@/lib/ws';
import { useMarketActions, useMarketConnection, usePriceUpdate } from '@/store/market.store';
import { useIsClient } from '@/hooks/use-is-client';
import type { BinanceTradeMessage } from '@/types/market';
import { logger } from '@/lib/utils/logger';

export function usePriceStream(symbol: string = "BTCUSDT") {
  const isClient = useIsClient();
  const { updatePrice, setConnected, setConnectionError } = useMarketActions();
  const { isConnected, error } = useMarketConnection();
  const priceUpdate = usePriceUpdate(symbol);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastConnectionUpdate = useRef<number>(0);

  useEffect(() => {
    if (!symbol || !isClient) return;

    const streamKey = `${symbol.toLowerCase()}@trade`;
    
    logger.info('[PriceStream] Starting price stream', { symbol, streamKey });

    // Subscribe to price stream
    const binanceConnectionManager = getBinanceConnection();
    const unsubscribe = binanceConnectionManager.subscribe(
      streamKey,
      (data: BinanceTradeMessage) => {
        try {
          if (data.e === "trade" && data.s === symbol.toUpperCase()) {
            updatePrice(data);
            
            // Only update connection status if not connected or it's been a while
            const now = Date.now();
            if (!isConnected || error || (now - lastConnectionUpdate.current) > 30000) {
              setConnected(true);
              setConnectionError(null);
              lastConnectionUpdate.current = now;
            }
          }
        } catch (error) {
          logger.error('[PriceStream] Error processing trade data', { symbol }, error);
          setConnectionError(`Failed to process price data for ${symbol}`);
          lastConnectionUpdate.current = Date.now();
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Monitor connection status  
    const connectionStatus = binanceConnectionManager.getConnectionStatus();
    setConnected(connectionStatus);

    return () => {
      logger.info('[PriceStream] Cleaning up price stream', { symbol });
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol, isClient, updatePrice, setConnected, setConnectionError]);

  return {
    priceUpdate,
    isConnected,
    error,
    currentPrice: priceUpdate?.price || 0,
    change: priceUpdate?.change || 0,
    changePercent: priceUpdate?.changePercent || 0,
  };
}