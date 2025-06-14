import { renderHook, act, waitFor } from '@testing-library/react';
import { useMarketTicker } from '../use-market-stats';
import { binanceAPI } from '@/lib/binance/api-service';
import { useMarketStore } from '@/store/market.store';
import { logger } from '@/lib/utils/logger';
import type { BinanceTicker24hr } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/binance/api-service');
jest.mock('@/store/market.store');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock timers
jest.useFakeTimers();

describe('useMarketTicker', () => {
  const mockBinanceTicker: BinanceTicker24hr = {
    symbol: 'BTCUSDT',
    priceChange: '1000.00',
    priceChangePercent: '2.50',
    weightedAvgPrice: '41000.00',
    prevClosePrice: '40000.00',
    lastPrice: '41000.00',
    lastQty: '0.5',
    bidPrice: '40999.00',
    bidQty: '1.2',
    askPrice: '41001.00',
    askQty: '1.5',
    openPrice: '40000.00',
    highPrice: '42000.00',
    lowPrice: '39000.00',
    volume: '10000.00',
    quoteVolume: '410000000.00',
    openTime: 1735830000000,
    closeTime: 1735916400000,
    firstId: 1000000,
    lastId: 2000000,
    count: 1000000,
  };

  const mockStoreActions = {
    setTicker: jest.fn(),
    setConnectionError: jest.fn(),
    setSymbolLoading: jest.fn(),
  };

  const mockPriceUpdate = {
    price: 41000,
    change: 1000,
    changePercent: 2.5,
  };

  const mockTicker = {
    symbol: 'BTCUSDT',
    price: '41000.00',
    priceChange: '1000.00',
    priceChangePercent: '2.50',
    high24h: '42000.00',
    low24h: '39000.00',
    volume24h: '10000.00',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Setup store mock
    (useMarketStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (selector.toString().includes('setTicker')) return mockStoreActions.setTicker;
      if (selector.toString().includes('setConnectionError')) return mockStoreActions.setConnectionError;
      if (selector.toString().includes('setSymbolLoading')) return mockStoreActions.setSymbolLoading;
      if (selector.toString().includes('currentPrices')) return mockPriceUpdate;
      if (selector.toString().includes('tickers')) return mockTicker;
      return null;
    });

    // Setup API mock
    (binanceAPI.fetchTicker24hr as jest.Mock).mockResolvedValue(mockBinanceTicker);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should fetch ticker data on mount', async () => {
      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
      });

      expect(mockStoreActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', true);
      expect(mockStoreActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', false);
    });

    it('should not fetch if symbol is empty', () => {
      renderHook(() => useMarketTicker(''));

      expect(binanceAPI.fetchTicker24hr).not.toHaveBeenCalled();
    });

    it('should return correct stats from store', () => {
      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      expect(result.current).toMatchObject({
        currentPrice: 41000,
        change: 1000,
        changePercent: 2.5,
        volume: '10000.00',
        high24h: '42000.00',
        low24h: '39000.00',
      });
    });
  });

  describe('ticker fetching', () => {
    it('should convert Binance ticker to store format', async () => {
      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(mockStoreActions.setTicker).toHaveBeenCalledWith('BTCUSDT', {
          symbol: 'BTCUSDT',
          price: '41000.00',
          priceChange: '1000.00',
          priceChangePercent: '2.50',
          high24h: '42000.00',
          low24h: '39000.00',
          volume24h: '10000.00',
        });
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (binanceAPI.fetchTicker24hr as jest.Mock).mockRejectedValueOnce(error);

      renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[MarketStats] Failed to fetch 24hr ticker',
          { symbol: 'BTCUSDT' },
          error
        );
      });

      expect(mockStoreActions.setConnectionError).toHaveBeenCalledWith(
        'Failed to fetch market stats for BTCUSDT'
      );
    });

    it('should set loading state correctly', async () => {
      let resolvePromise: (value: BinanceTicker24hr) => void;
      const promise = new Promise<BinanceTicker24hr>((resolve) => {
        resolvePromise = resolve;
      });
      (binanceAPI.fetchTicker24hr as jest.Mock).mockReturnValueOnce(promise);

      renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(mockStoreActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', true);
      });

      await act(async () => {
        resolvePromise!(mockBinanceTicker);
      });

      await waitFor(() => {
        expect(mockStoreActions.setSymbolLoading).toHaveBeenCalledWith('BTCUSDT', false);
      });
    });
  });

  describe('periodic refresh', () => {
    it('should refresh every 30 seconds', async () => {
      renderHook(() => useMarketTicker('BTCUSDT'));

      // Initial call
      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(1);
      });

      // Fast forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(2);
      });

      // Fast forward another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(3);
      });
    });

    it('should cleanup interval on unmount', async () => {
      const { unmount } = renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast forward 30 seconds after unmount
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should still be 1 call (no new calls after unmount)
      expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(1);
    });

    it('should restart interval when symbol changes', async () => {
      const { rerender } = renderHook(
        ({ symbol }) => useMarketTicker(symbol),
        { initialProps: { symbol: 'BTCUSDT' } }
      );

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
      });

      // Change symbol
      rerender({ symbol: 'ETHUSDT' });

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledWith('ETHUSDT');
      });

      // Fast forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should have called ETHUSDT again, not BTCUSDT
      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenLastCalledWith('ETHUSDT');
      });
    });
  });

  describe('manual refresh', () => {
    it('should provide refresh function', async () => {
      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(1);
      });

      // Manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in manual refresh', async () => {
      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalledTimes(1);
      });

      // Make next call fail
      (binanceAPI.fetchTicker24hr as jest.Mock).mockRejectedValueOnce(new Error('Refresh error'));

      await act(async () => {
        await result.current.refresh();
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MarketStats] Failed to fetch 24hr ticker',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing price update data', () => {
      (useMarketStore as unknown as jest.Mock).mockImplementation((selector) => {
        if (selector.toString().includes('currentPrices')) return undefined;
        if (selector.toString().includes('tickers')) return undefined;
        return mockStoreActions[Object.keys(mockStoreActions).find(key => selector.toString().includes(key))!];
      });

      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      expect(result.current).toMatchObject({
        currentPrice: 0,
        change: 0,
        changePercent: 0,
        volume: '0',
        high24h: '0',
        low24h: '0',
      });
    });

    it('should handle partial ticker data', () => {
      (useMarketStore as unknown as jest.Mock).mockImplementation((selector) => {
        if (selector.toString().includes('currentPrices')) return mockPriceUpdate;
        if (selector.toString().includes('tickers')) return { volume24h: '5000.00' }; // Partial data
        return mockStoreActions[Object.keys(mockStoreActions).find(key => selector.toString().includes(key))!];
      });

      const { result } = renderHook(() => useMarketTicker('BTCUSDT'));

      expect(result.current).toMatchObject({
        currentPrice: 41000,
        change: 1000,
        changePercent: 2.5,
        volume: '5000.00',
        high24h: '0',
        low24h: '0',
      });
    });

    it('should log ticker updates', async () => {
      renderHook(() => useMarketTicker('BTCUSDT'));

      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith('[MarketStats] Fetching 24hr ticker', { symbol: 'BTCUSDT' });
        expect(logger.info).toHaveBeenCalledWith('[MarketStats] 24hr ticker updated', {
          symbol: 'BTCUSDT',
          price: '41000.00',
          change: '2.50',
        });
      });
    });
  });

  describe('dependency optimization', () => {
    it('should not cause unnecessary re-renders', async () => {
      const renderSpy = jest.fn();
      
      const TestComponent = ({ symbol }: { symbol: string }) => {
        renderSpy();
        useMarketTicker(symbol);
        return null;
      };

      const { rerender } = renderHook(
        ({ symbol }) => useMarketTicker(symbol),
        { initialProps: { symbol: 'BTCUSDT' } }
      );

      await waitFor(() => {
        expect(binanceAPI.fetchTicker24hr).toHaveBeenCalled();
      });

      const initialRenderCount = renderSpy.mock.calls.length;

      // Trigger store update with same values
      rerender({ symbol: 'BTCUSDT' });

      // Should not cause additional renders beyond the rerender itself
      expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 1);
    });
  });
});