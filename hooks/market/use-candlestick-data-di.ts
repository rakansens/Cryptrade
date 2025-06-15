/**
 * Candlestick Data Hook (DI Version)
 * 
 * DIパターンを使用したバージョン
 * 既存のuse-candlestick-data.tsと同じ機能を提供
 */

import { useEffect, useRef, useCallback } from 'react';
import { useBinanceAPI } from '@/lib/binance/binance-context';
import { getBinanceConnection } from '@/lib/ws';
import { useMarketActions, usePriceData, useSymbolLoading } from '@/store/market.store';
import { useIsClient } from '@/hooks/use-is-client';
import type { BinanceKlineMessage, ProcessedKline, BinanceTradeMessage } from '@/types/market';
import { logger } from '@/lib/utils/logger';

interface UseCandlestickDataOptions {
  symbol: string;
  interval: string;
  limit?: number;
}

export function useCandlestickData({ 
  symbol, 
  interval, 
  limit = 1000 
}: UseCandlestickDataOptions) {
  const isClient = useIsClient();
  const binanceAPI = useBinanceAPI(); // DI pattern
  
  const isLoadingSymbol = useSymbolLoading(symbol);
  const priceData = usePriceData(symbol);
  const { 
    setPriceData,
    updatePrice,
    addKline,
    updateLastKline,
    setConnectionError,
    setSymbolLoading
  } = useMarketActions();
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Fetch historical data
  const fetchHistoricalData = useCallback(async () => {
    if (!symbol || !isClient) return;
    
    try {
      setSymbolLoading(symbol, true);
      logger.info('[useCandlestickData] Fetching historical data', { symbol, interval, limit });
      
      const data = await binanceAPI.fetchKlines(symbol, interval, limit);
      
      if (isMountedRef.current) {
        setPriceData(symbol, data);
        
        if (data.length > 0) {
          const latestCandle = data[data.length - 1];
          // Create a trade message from the latest candle data
          const tradeMessage: BinanceTradeMessage = {
            E: Date.now(), // Event time
            s: symbol,
            t: Date.now(), // Trade ID
            p: latestCandle!.close.toString(),
            q: '0', // Quantity not available from candle data
            T: latestCandle!.time, // Trade time
            m: false, // Is buyer maker - default to false
          };
          updatePrice(tradeMessage);
        }
        
        logger.info('[useCandlestickData] Historical data set', { 
          symbol, 
          dataLength: data.length 
        });
      }
    } catch (error) {
      logger.error('[useCandlestickData] Failed to fetch historical data', { symbol, interval }, error);
      if (isMountedRef.current) {
        setConnectionError(error instanceof Error ? error.message : 'Failed to fetch data');
      }
    } finally {
      if (isMountedRef.current) {
        setSymbolLoading(symbol, false);
      }
    }
  }, [symbol, interval, limit, isClient, binanceAPI, setPriceData, setConnectionError, setSymbolLoading]);

  // WebSocket message handler
  const handleKlineMessage = useCallback((message: BinanceKlineMessage) => {
    if (!isMountedRef.current || message.s !== symbol) return;
    
    const kline = message.k;
    const newCandle: ProcessedKline = {
      time: Math.floor(kline.t / 1000),
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
    };

    // If candle is closed, add it as a new candle, otherwise update the last one
    if (kline.x) {
      addKline(symbol, newCandle);
    } else {
      updateLastKline(symbol, newCandle);
    }
    
    // Update the real-time price
    updatePrice({
      e: 'trade',
      E: Date.now(),
      s: symbol,
      p: kline.c,
      q: kline.q,
      T: kline.T,
      m: true,
      M: true
    } as any);
  }, [symbol, addKline, updateLastKline, updatePrice]);

  // Setup WebSocket subscription
  useEffect(() => {
    if (!isClient || !symbol) return;
    
    const setupWebSocket = async () => {
      try {
        const connection = await getBinanceConnection();
        
        if (!connection) {
          logger.warn('[useCandlestickData] WebSocket connection not available');
          return;
        }

        const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        
        unsubscribeRef.current = connection.subscribe(
          streamName,
          handleKlineMessage as any
        );
        
        logger.info('[useCandlestickData] WebSocket subscription setup', { 
          symbol, 
          interval, 
          streamName 
        });
      } catch (error) {
        logger.error('[useCandlestickData] Failed to setup WebSocket', { symbol, interval }, error);
      }
    };
    
    setupWebSocket();
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol, interval, isClient, handleKlineMessage]);

  // Fetch data on mount and symbol/interval change
  useEffect(() => {
    isMountedRef.current = true;
    fetchHistoricalData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchHistoricalData]);

  return {
    priceData,
    isLoading: isLoadingSymbol,
    refetch: fetchHistoricalData,
  };
}