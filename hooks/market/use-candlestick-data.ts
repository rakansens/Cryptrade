import { useEffect, useRef, useCallback } from 'react';
import { binanceAPI } from '@/lib/binance/api-service';
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
  const { setPriceData, addKline, updateLastKline, setSymbolLoading, setConnectionError } = useMarketActions();
  const priceData = usePriceData(symbol);
  const isLoading = useSymbolLoading(symbol);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoadRef = useRef(false);

  // Load initial historical data
  const loadInitialData = useCallback(async () => {
    if (isInitialLoadRef.current || !isClient) return;
    
    try {
      setSymbolLoading(symbol, true);
      logger.info('[CandlestickData] Loading initial data', { symbol, interval, limit });
      
      const klines = await binanceAPI.fetchKlines(symbol, interval, limit);
      setPriceData(symbol, klines);
      isInitialLoadRef.current = true;
      
      logger.info('[CandlestickData] Initial data loaded', { 
        symbol, 
        interval, 
        count: klines.length 
      });
      
    } catch (error) {
      logger.error('[CandlestickData] Failed to load initial data', { 
        symbol, 
        interval 
      }, error);
      setConnectionError(`Failed to load chart data for ${symbol}`);
    } finally {
      setSymbolLoading(symbol, false);
    }
  }, [symbol, interval, limit, isClient, setPriceData, setSymbolLoading, setConnectionError]);

  // Subscribe to real-time kline updates
  useEffect(() => {
    if (!symbol || !interval || !isClient) return;

    const streamKey = `${symbol.toLowerCase()}@kline_${interval}`;
    
    logger.info('[CandlestickData] Starting kline stream', { symbol, interval, streamKey });

    const binanceConnectionManager = getBinanceConnection();
    const unsubscribe = binanceConnectionManager.subscribe(
      streamKey,
      (data: BinanceKlineMessage) => {
        try {
          if (data.e === "kline" && data.s === symbol.toUpperCase()) {
            const kline: ProcessedKline = {
              time: Math.floor(data.k.t / 1000), // Convert ms to seconds
              open: parseFloat(data.k.o),
              high: parseFloat(data.k.h),
              low: parseFloat(data.k.l),
              close: parseFloat(data.k.c),
              volume: parseFloat(data.k.v),
            };

            if (data.k.x) {
              // Kline is closed, add new candle
              addKline(symbol, kline);
              logger.debug('[CandlestickData] Added new kline', { symbol, time: kline.time });
            } else {
              // Kline is still forming, update last candle
              updateLastKline(symbol, kline);
            }
          }
        } catch (error) {
          logger.error('[CandlestickData] Error processing kline data', { symbol }, error);
          setConnectionError(`Failed to process kline data for ${symbol}`);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      logger.info('[CandlestickData] Cleaning up kline stream', { symbol, interval });
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol, interval, isClient, addKline, updateLastKline, setConnectionError]);

  // Load initial data when symbol or interval changes
  useEffect(() => {
    isInitialLoadRef.current = false;
    loadInitialData();
  }, [loadInitialData]);

  return {
    priceData,
    isLoading,
    error: null,
    refresh: loadInitialData,
  };
}