import { useEffect, useCallback, useMemo } from 'react';
import { binanceAPI } from '@/lib/binance/api-service';
import { useMarketStore } from '@/store/market.store';
import type { BinanceTicker24hr } from '@/types/market';
import { logger } from '@/lib/utils/logger';

export function useMarketTicker(symbol: string) {
  // Get individual actions to avoid complex hook dependencies
  const setTicker = useMarketStore(state => state.setTicker);
  const setConnectionError = useMarketStore(state => state.setConnectionError);
  const setSymbolLoading = useMarketStore(state => state.setSymbolLoading);
  
  // Use individual selectors to avoid creating new objects
  const priceUpdate = useMarketStore(state => state.currentPrices[symbol]);
  const ticker = useMarketStore(state => state.tickers[symbol]);
  
  const stats = useMemo(() => ({
    currentPrice: priceUpdate?.price || 0,
    change: priceUpdate?.change || 0,
    changePercent: priceUpdate?.changePercent || 0,
    volume: ticker?.volume24h || '0',
    high24h: ticker?.high24h || '0',
    low24h: ticker?.low24h || '0',
  }), [priceUpdate, ticker]);

  const fetchTicker = useCallback(async () => {
    if (!symbol) return;

    try {
      setSymbolLoading(symbol, true);
      logger.info('[MarketStats] Fetching 24hr ticker', { symbol });
      
      const tickerData = await binanceAPI.fetchTicker24hr(symbol) as BinanceTicker24hr;
      
      // Convert Binance ticker to our MarketTicker format
      const ticker = {
        symbol: tickerData.symbol,
        price: tickerData.lastPrice,
        priceChange: tickerData.priceChange,
        priceChangePercent: tickerData.priceChangePercent,
        high24h: tickerData.highPrice,
        low24h: tickerData.lowPrice,
        volume24h: tickerData.volume,
      };
      
      setTicker(symbol, ticker);
      
      logger.info('[MarketStats] 24hr ticker updated', { 
        symbol, 
        price: ticker.price,
        change: ticker.priceChangePercent 
      });
      
    } catch (error) {
      logger.error('[MarketStats] Failed to fetch 24hr ticker', { symbol }, error);
      setConnectionError(`Failed to fetch market stats for ${symbol}`);
    } finally {
      setSymbolLoading(symbol, false);
    }
  }, [symbol, setTicker, setConnectionError, setSymbolLoading]);

  // Fetch initial ticker data
  useEffect(() => {
    fetchTicker();
  }, [fetchTicker]);

  // Periodic refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchTicker, 30000);
    return () => clearInterval(interval);
  }, [fetchTicker]);

  return {
    ...stats,
    refresh: fetchTicker,
  };
}