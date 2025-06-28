import { useEffect, useRef, useCallback } from 'react';
import { getBinanceConnection } from '@/lib/ws';
import { useMarketActions, useMarketConnection, usePriceUpdate } from '@/store/market.store';
import { useIsClient } from '@/hooks/use-is-client';
import type { BinanceTradeMessage } from '@/types/market';
import { useStreamBase } from '@/hooks/shared/useStreamBase';

export function usePriceStream(symbol: string = "BTCUSDT") {
  const isClient = useIsClient();
  const { updatePrice, setConnected, setConnectionError } = useMarketActions();
  const { isConnected, error } = useMarketConnection();
  const priceUpdate = usePriceUpdate(symbol);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastConnectionUpdate = useRef<number>(0);
  
  // 共通基盤初期化
  const streamBase = useStreamBase<any, BinanceTradeMessage>({
    hookName: 'usePriceStream',
    connectionType: 'custom', // Binance WebSocket manager
    autoConnect: false,
    logLevel: 'info'
  });

  // メッセージハンドラ
  const handleTradeMessage = useCallback((data: BinanceTradeMessage) => {
    if (!streamBase.isMounted()) return;
    
    try {
      if (data.e === "trade" && data.s === symbol.toUpperCase()) {
        updatePrice(data);
        
        // 接続状態更新（頻度を制限）
        const now = Date.now();
        if (!isConnected || error || (now - lastConnectionUpdate.current) > 30000) {
          setConnected(true);
          setConnectionError(null);
          lastConnectionUpdate.current = now;
        }
      }
    } catch (error) {
      streamBase.safeLog('error', 'Error processing trade data', { 
        symbol, 
        error: error instanceof Error ? error.message : String(error) 
      });
      if (streamBase.isMounted()) {
        setConnectionError(`Failed to process price data for ${symbol}`);
        lastConnectionUpdate.current = Date.now();
      }
    }
  }, [symbol, updatePrice, setConnected, setConnectionError, isConnected, error, streamBase]);

  useEffect(() => {
    if (!symbol || !isClient || !streamBase.isMounted()) return;

    const streamKey = `${symbol.toLowerCase()}@trade`;
    
    streamBase.safeLog('info', 'Starting price stream', { symbol, streamKey });

    // Binance WebSocket接続
    const binanceConnectionManager = getBinanceConnection();
    const unsubscribe = binanceConnectionManager.subscribe(
      streamKey,
      handleTradeMessage as any
    );

    unsubscribeRef.current = unsubscribe;

    // 接続状態監視  
    const connectionStatus = binanceConnectionManager.getConnectionStatus();
    if (streamBase.isMounted()) {
      setConnected(connectionStatus);
      streamBase.updateConnectionStatus(connectionStatus ? 'connected' : 'disconnected');
    }

    return () => {
      streamBase.safeLog('info', 'Cleaning up price stream', { symbol });
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol, isClient, handleTradeMessage, setConnected, streamBase]);

  return {
    priceUpdate,
    isConnected,
    error,
    currentPrice: priceUpdate?.price || 0,
    change: priceUpdate?.change || 0,
    changePercent: priceUpdate?.changePercent || 0,
  };
}