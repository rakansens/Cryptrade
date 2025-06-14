import { renderHook, act, waitFor } from '@testing-library/react';
import { useCandlestickData } from '../use-candlestick-data';
import { binanceAPI } from '@/lib/binance/api-service';
import { getBinanceConnection } from '@/lib/ws';
import { useMarketActions, usePriceData, useSymbolLoading } from '@/store/market.store';
import { useIsClient } from '@/hooks/use-is-client';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline, BinanceKlineMessage } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/binance/api-service');
jest.mock('@/lib/ws');
jest.mock('@/store/market.store');
jest.mock('@/hooks/use-is-client');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useCandlestickData', () => {
  const mockKlines: ProcessedKline[] = [
    { time: 1735830000, open: 100000, high: 101000, low: 99000, close: 100500, volume: 1000 },
    { time: 1735833600, open: 100500, high: 102000, low: 100000, close: 101500, volume: 1200 },
    { time: 1735837200, open: 101500, high: 103000, low: 101000, close: 102500, volume: 1500 },
  ];

  const mockMarketActions = {
    setPriceData: jest.fn(),
    addKline: jest.fn(),
    updateLastKline: jest.fn(),
    setSymbolLoading: jest.fn(),
    setConnectionError: jest.fn(),
  };

  const mockBinanceConnection = {
    subscribe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (useIsClient as jest.Mock).mockReturnValue(true);
    (useMarketActions as jest.Mock).mockReturnValue(mockMarketActions);
    (usePriceData as jest.Mock).mockReturnValue(mockKlines);
    (useSymbolLoading as jest.Mock).mockReturnValue(false);
    (getBinanceConnection as jest.Mock).mockReturnValue(mockBinanceConnection);
    (binanceAPI.fetchKlines as jest.Mock).mockResolvedValue(mockKlines);
    
    // Default subscribe mock that returns unsubscribe function
    mockBinanceConnection.subscribe.mockReturnValue(jest.fn());
  });

  describe('initialization', () => {
    it('should load initial data on mount', async () => {
      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 1000,
      }));

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 1000);
        expect(mockMarketActions.setPriceData).toHaveBeenCalledWith('BTCUSDT', mockKlines);
      });
    });

    it('should use default limit if not provided', async () => {
      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 1000);
      });
    });

    it('should not load data on server side', () => {
      (useIsClient as jest.Mock).mockReturnValue(false);

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      expect(binanceAPI.fetchKlines).not.toHaveBeenCalled();
    });

    it('should set loading state during initial load', async () => {
      let resolvePromise: (value: ProcessedKline[]) => void;
      const promise = new Promise<ProcessedKline[]>((resolve) => {
        resolvePromise = resolve;
      });
      (binanceAPI.fetchKlines as jest.Mock).mockReturnValue(promise);

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      expect(mockMarketActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', true);

      await act(async () => {
        resolvePromise!(mockKlines);
      });

      expect(mockMarketActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', false);
    });

    it('should handle initial load errors', async () => {
      const error = new Error('Failed to fetch');
      (binanceAPI.fetchKlines as jest.Mock).mockRejectedValue(error);

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[CandlestickData] Failed to load initial data',
          { symbol: 'BTCUSDT', interval: '1h' },
          error
        );
        expect(mockMarketActions.setConnectionError).toHaveBeenCalledWith(
          'Failed to load chart data for BTCUSDT'
        );
      });
    });

    it('should only load initial data once', async () => {
      const { rerender } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(1);
      });

      // Rerender without changing props
      rerender();

      // Should not fetch again
      expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(1);
    });
  });

  describe('websocket subscription', () => {
    it('should subscribe to kline stream', async () => {
      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalledWith(
          'btcusdt@kline_1h',
          expect.any(Function)
        );
      });
    });

    it('should handle closed klines', async () => {
      let messageHandler: (data: BinanceKlineMessage) => void;
      mockBinanceConnection.subscribe.mockImplementation((stream, handler) => {
        messageHandler = handler;
        return jest.fn();
      });

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalled();
      });

      const closedKlineMessage: BinanceKlineMessage = {
        e: 'kline',
        E: 1735840800000,
        s: 'BTCUSDT',
        k: {
          t: 1735840800000,
          T: 1735844400000,
          s: 'BTCUSDT',
          i: '1h',
          f: 100,
          L: 200,
          o: '102500.00',
          c: '103500.00',
          h: '104000.00',
          l: '102000.00',
          v: '1800.00',
          n: 100,
          x: true, // Closed kline
          q: '185400000.00',
          V: '900.00',
          Q: '93150000.00',
          B: '0',
        },
      };

      act(() => {
        messageHandler!(closedKlineMessage);
      });

      expect(mockMarketActions.addKline).toHaveBeenCalledWith('BTCUSDT', {
        time: 1735840800,
        open: 102500,
        high: 104000,
        low: 102000,
        close: 103500,
        volume: 1800,
      });
    });

    it('should handle updating klines', async () => {
      let messageHandler: (data: BinanceKlineMessage) => void;
      mockBinanceConnection.subscribe.mockImplementation((stream, handler) => {
        messageHandler = handler;
        return jest.fn();
      });

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalled();
      });

      const updatingKlineMessage: BinanceKlineMessage = {
        e: 'kline',
        E: 1735840800000,
        s: 'BTCUSDT',
        k: {
          t: 1735840800000,
          T: 1735844400000,
          s: 'BTCUSDT',
          i: '1h',
          f: 100,
          L: 200,
          o: '102500.00',
          c: '103200.00',
          h: '103500.00',
          l: '102000.00',
          v: '1500.00',
          n: 80,
          x: false, // Not closed
          q: '154800000.00',
          V: '750.00',
          Q: '77625000.00',
          B: '0',
        },
      };

      act(() => {
        messageHandler!(updatingKlineMessage);
      });

      expect(mockMarketActions.updateLastKline).toHaveBeenCalledWith('BTCUSDT', {
        time: 1735840800,
        open: 102500,
        high: 103500,
        low: 102000,
        close: 103200,
        volume: 1500,
      });
    });

    it('should filter messages by symbol', async () => {
      let messageHandler: (data: BinanceKlineMessage) => void;
      mockBinanceConnection.subscribe.mockImplementation((stream, handler) => {
        messageHandler = handler;
        return jest.fn();
      });

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalled();
      });

      const wrongSymbolMessage: BinanceKlineMessage = {
        e: 'kline',
        E: 1735840800000,
        s: 'ETHUSDT', // Different symbol
        k: {
          t: 1735840800000,
          T: 1735844400000,
          s: 'ETHUSDT',
          i: '1h',
          f: 100,
          L: 200,
          o: '3000.00',
          c: '3100.00',
          h: '3150.00',
          l: '2950.00',
          v: '500.00',
          n: 100,
          x: true,
          q: '1550000.00',
          V: '250.00',
          Q: '775000.00',
          B: '0',
        },
      };

      act(() => {
        messageHandler!(wrongSymbolMessage);
      });

      expect(mockMarketActions.addKline).not.toHaveBeenCalled();
      expect(mockMarketActions.updateLastKline).not.toHaveBeenCalled();
    });

    it('should handle websocket errors', async () => {
      let messageHandler: (data: BinanceKlineMessage) => void;
      mockBinanceConnection.subscribe.mockImplementation((stream, handler) => {
        messageHandler = handler;
        return jest.fn();
      });

      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalled();
      });

      act(() => {
        messageHandler!({} as BinanceKlineMessage); // Invalid message
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[CandlestickData] Error processing kline data',
        { symbol: 'BTCUSDT' },
        expect.any(Error)
      );
      expect(mockMarketActions.setConnectionError).toHaveBeenCalledWith(
        'Failed to process kline data for BTCUSDT'
      );
    });

    it('should cleanup subscription on unmount', async () => {
      const unsubscribe = jest.fn();
      mockBinanceConnection.subscribe.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[CandlestickData] Cleaning up kline stream',
        { symbol: 'BTCUSDT', interval: '1h' }
      );
    });
  });

  describe('symbol and interval changes', () => {
    it('should reload data when symbol changes', async () => {
      const { rerender } = renderHook(
        ({ symbol, interval }) => useCandlestickData({ symbol, interval }),
        { initialProps: { symbol: 'BTCUSDT', interval: '1h' } }
      );

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 1000);
      });

      rerender({ symbol: 'ETHUSDT', interval: '1h' });

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('ETHUSDT', '1h', 1000);
      });
    });

    it('should reload data when interval changes', async () => {
      const { rerender } = renderHook(
        ({ symbol, interval }) => useCandlestickData({ symbol, interval }),
        { initialProps: { symbol: 'BTCUSDT', interval: '1h' } }
      );

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 1000);
      });

      rerender({ symbol: 'BTCUSDT', interval: '4h' });

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 1000);
      });
    });

    it('should update websocket subscription when params change', async () => {
      const unsubscribe = jest.fn();
      mockBinanceConnection.subscribe.mockReturnValue(unsubscribe);

      const { rerender } = renderHook(
        ({ symbol, interval }) => useCandlestickData({ symbol, interval }),
        { initialProps: { symbol: 'BTCUSDT', interval: '1h' } }
      );

      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalledWith(
          'btcusdt@kline_1h',
          expect.any(Function)
        );
      });

      rerender({ symbol: 'ETHUSDT', interval: '4h' });

      expect(unsubscribe).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(mockBinanceConnection.subscribe).toHaveBeenCalledWith(
          'ethusdt@kline_4h',
          expect.any(Function)
        );
      });
    });
  });

  describe('return values', () => {
    it('should return price data from store', () => {
      const { result } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      expect(result.current.priceData).toBe(mockKlines);
    });

    it('should return loading state from store', () => {
      (useSymbolLoading as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      expect(result.current.isLoading).toBe(true);
    });

    it('should always return null error', () => {
      const { result } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      expect(result.current.error).toBeNull();
    });

    it('should provide refresh function', async () => {
      const { result } = renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
      }));

      await waitFor(() => {
        expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(binanceAPI.fetchKlines).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty symbol', () => {
      renderHook(() => useCandlestickData({
        symbol: '',
        interval: '1h',
      }));

      expect(binanceAPI.fetchKlines).not.toHaveBeenCalled();
      expect(mockBinanceConnection.subscribe).not.toHaveBeenCalled();
    });

    it('should handle empty interval', () => {
      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '',
      }));

      expect(binanceAPI.fetchKlines).not.toHaveBeenCalled();
      expect(mockBinanceConnection.subscribe).not.toHaveBeenCalled();
    });

    it('should log appropriate messages', async () => {
      renderHook(() => useCandlestickData({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 500,
      }));

      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[CandlestickData] Loading initial data',
          { symbol: 'BTCUSDT', interval: '1h', limit: 500 }
        );
        expect(logger.info).toHaveBeenCalledWith(
          '[CandlestickData] Initial data loaded',
          { symbol: 'BTCUSDT', interval: '1h', count: 3 }
        );
        expect(logger.info).toHaveBeenCalledWith(
          '[CandlestickData] Starting kline stream',
          { symbol: 'BTCUSDT', interval: '1h', streamKey: 'btcusdt@kline_1h' }
        );
      });
    });
  });
});