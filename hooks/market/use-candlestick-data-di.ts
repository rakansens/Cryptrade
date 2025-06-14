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
import type { BinanceKlineMessage, ProcessedKline } from '@/types/market';
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
    updateLatestPrice,
    appendNewCandle,
    setMarketStatus,
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
          updateLatestPrice(symbol, parseFloat(latestCandle.close));
        }
        
        logger.info('[useCandlestickData] Historical data set', { 
          symbol, 
          dataLength: data.length 
        });
      }
    } catch (error) {
      logger.error('[useCandlestickData] Failed to fetch historical data', { symbol, interval }, error);
      if (isMountedRef.current) {
        setMarketStatus({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setSymbolLoading(symbol, false);
      }
    }
  }, [symbol, interval, limit, isClient, binanceAPI, setPriceData, updateLatestPrice, setMarketStatus, setSymbolLoading]);

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

    appendNewCandle(symbol, newCandle, kline.x);
    updateLatestPrice(symbol, newCandle.close);
  }, [symbol, appendNewCandle, updateLatestPrice]);

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
          handleKlineMessage
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