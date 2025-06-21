import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { useCandlestickData } from '@/hooks/market/use-candlestick-data-di';

// Mock dependencies
jest.mock('@/lib/binance/binance-context', () => ({
  useBinanceAPI: jest.fn(() => ({
    getKlines: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('@/lib/ws', () => ({
  getBinanceConnection: jest.fn(() => ({
    subscribeKline: jest.fn(() => jest.fn()),
    subscribeTrade: jest.fn(() => jest.fn())
  }))
}));

jest.mock('@/store/market.store', () => ({
  useMarketActions: jest.fn(() => ({
    setPriceData: jest.fn(),
    updatePrice: jest.fn(),
    addKline: jest.fn(),
    updateLastKline: jest.fn(),
    setConnectionError: jest.fn(),
    setSymbolLoading: jest.fn()
  })),
  usePriceData: jest.fn(() => ({
    price: 0,
    change24h: 0,
    volume24h: 0,
    high24h: 0,
    low24h: 0,
    klines: []
  })),
  useSymbolLoading: jest.fn(() => false)
}));

jest.mock('@/hooks/use-is-client', () => ({
  useIsClient: jest.fn(() => true)
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useCandlestickData', () => {
  const defaultOptions = {
    symbol: 'BTCUSDT',
    interval: '1m',
    limit: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCandlestickData(defaultOptions));
    
    expect(result.current).toBeDefined();
    expect(result.current.priceData).toBeDefined();
    expect(result.current.isLoading).toBeDefined();
  });

  it('should handle data fetching', async () => {
    const { result } = renderHook(() => useCandlestickData(defaultOptions));
    
    await act(async () => {
      // Wait for initial data fetch
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Check that loading state is managed
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should handle symbol changes', () => {
    const { result, rerender } = renderHook(
      ({ symbol, interval }) => useCandlestickData({ symbol, interval }),
      { initialProps: { symbol: 'BTCUSDT', interval: '1m' } }
    );
    
    // Change symbol
    rerender({ symbol: 'ETHUSDT', interval: '1m' });
    
    // Should trigger new data fetch
    expect(result.current).toBeDefined();
  });
});
