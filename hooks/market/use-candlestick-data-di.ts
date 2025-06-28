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
import { useChartDataBase } from '@/hooks/shared/useChartDataBase';

export interface UseCandlestickDataOptions {
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
  
  // 共通基盤初期化
  const chartDataBase = useChartDataBase<ProcessedKline[]>({
    hookName: 'useCandlestickData',
    enableAutoCleanup: true,
    logLevel: 'info'
  });
  
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

  // Fetch historical data
  const fetchHistoricalData = useCallback(async () => {
    if (!symbol || !isClient || !chartDataBase.isMounted()) return;
    
    return await chartDataBase.executeSafely(
      'Fetch historical data',
      async () => {
        setSymbolLoading(symbol, true);
        
        const data = await binanceAPI.fetchKlines(symbol, interval, limit);
        
        if (chartDataBase.isMounted()) {
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
          
          chartDataBase.safeLog('info', 'Historical data set', { 
            symbol, 
            dataLength: data.length 
          });
        }
        
        return data;
      },
      {
        symbol,
        interval,
        additionalInfo: { limit }
      }
    ).catch((error) => {
      if (chartDataBase.isMounted()) {
        setConnectionError(error instanceof Error ? error.message : 'Failed to fetch data');
      }
      return null;
    }).finally(() => {
      if (chartDataBase.isMounted()) {
        setSymbolLoading(symbol, false);
      }
    });
  }, [symbol, interval, limit, isClient, binanceAPI, setPriceData, setConnectionError, setSymbolLoading, chartDataBase]);

  // WebSocket message handler
  const handleKlineMessage = useCallback((message: BinanceKlineMessage) => {
    if (!chartDataBase.isMounted() || message.s !== symbol) return;
    
    const kline = message.k;
    const newCandle: ProcessedKline = chartDataBase.formatChartData([{
      time: Math.floor(kline.t / 1000),
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
    }])[0];

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
  }, [symbol, addKline, updateLastKline, updatePrice, chartDataBase]);

  // Setup WebSocket subscription
  useEffect(() => {
    if (!isClient || !symbol || !chartDataBase.isMounted()) return;
    
    const setupWebSocket = async () => {
      await chartDataBase.executeSafely(
        'Setup WebSocket subscription',
        async () => {
          const connection = await getBinanceConnection();
          
          if (!connection) {
            chartDataBase.safeLog('warn', 'WebSocket connection not available');
            return;
          }

          const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
          
          unsubscribeRef.current = connection.subscribe(
            streamName,
            handleKlineMessage as any
          );
          
          chartDataBase.safeLog('info', 'WebSocket subscription setup', { 
            symbol, 
            interval, 
            streamName 
          });
        },
        {
          symbol,
          interval
        }
      );
    };
    
    setupWebSocket();
    
    // WebSocketクリーンアップを基盤に登録
    const cleanup = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    chartDataBase.registerCleanup(cleanup);
    
    return cleanup;
  }, [symbol, interval, isClient, handleKlineMessage, chartDataBase]);

  // Fetch data on mount and symbol/interval change
  useEffect(() => {
    if (chartDataBase.isMounted()) {
      fetchHistoricalData();
    }
  }, [fetchHistoricalData, chartDataBase]);

  return {
    priceData,
    isLoading: isLoadingSymbol,
    refetch: fetchHistoricalData,
  };
}