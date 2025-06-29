import { useEffect, useRef, useCallback } from 'react';
import { binanceAPI } from '@/lib/binance/api-service';
import { getBinanceConnection } from '@/lib/ws';
import { useMarketActions, usePriceData, useSymbolLoading } from '@/store/market.store';
import { useIsClient } from '@/hooks/use-is-client';
import type { BinanceKlineMessage, ProcessedKline } from '@/types/market';
import { useChartDataBase } from '@/hooks/shared/useChartDataBase';
import { OHLCVConverter } from '@/lib/chart/data-converters';

export interface UseCandlestickDataOptions {
  symbol: string;
  interval: string;
  limit?: number;
}

export interface UseCandlestickDataReturn {
  priceData: ProcessedKline[];
  isLoading: boolean;
  error: null;
  refresh: () => Promise<void>;
}

export function useCandlestickData({ 
  symbol, 
  interval, 
  limit = 1000 
}: UseCandlestickDataOptions): UseCandlestickDataReturn {
  const isClient = useIsClient();
  
  // 共通基盤初期化
  const chartDataBase = useChartDataBase<ProcessedKline[]>({
    hookName: 'useCandlestickData',
    enableAutoCleanup: true,
    logLevel: 'info'
  });
  
  const { setPriceData, addKline, updateLastKline, setSymbolLoading, setConnectionError } = useMarketActions();
  const priceData = usePriceData(symbol);
  const isLoading = useSymbolLoading(symbol);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoadRef = useRef(false);

  // Load initial historical data
  const loadInitialData = useCallback(async () => {
    if (isInitialLoadRef.current || !isClient || !chartDataBase.isMounted()) return;
    
    return await chartDataBase.executeSafely(
      'Load initial historical data',
      async () => {
        setSymbolLoading(symbol, true);
        
        const klines = await binanceAPI.fetchKlines(symbol, interval, limit);
        setPriceData(symbol, klines);
        isInitialLoadRef.current = true;
        
        return klines;
      },
      {
        symbol,
        interval,
        limit,
        operation: 'historical_data_fetch'
      }
    ).finally(() => {
      if (chartDataBase.isMounted()) {
        setSymbolLoading(symbol, false);
      }
    });
  }, [symbol, interval, limit, isClient, chartDataBase, setPriceData, setSymbolLoading]);

  // Subscribe to real-time kline updates
  useEffect(() => {
    if (!symbol || !interval || !isClient) return;

    const streamKey = `${symbol.toLowerCase()}@kline_${interval}`;
    
    logger.info('[CandlestickData] Starting kline stream', { symbol, interval, streamKey });

    const binanceConnectionManager = getBinanceConnection();
    const unsubscribe = binanceConnectionManager.subscribe(
      streamKey,
      ((data: BinanceKlineMessage) => {
        try {
          if (data.e === "kline" && data.s === symbol.toUpperCase()) {
            // Use unified converter for consistent data transformation
            const kline = OHLCVConverter.fromBinanceWebSocket(data);

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
      }) as (data: unknown) => void
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