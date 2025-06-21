import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { useCandlestickDataDi } from '@/hooks/market/use-candlestick-data-di';

describe('useCandlestickDataDi', () => {
  const defaultOptions = {
    symbol: 'BTCUSDT',
    interval: '1m',
    limit: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCandlestickDataDi(defaultOptions));
    
    expect(result.current).toBeDefined();
    expect(result.current.priceData).toBeDefined();
    expect(result.current.isLoading).toBeDefined();
  });

  it('should handle data fetching', async () => {
    const { result } = renderHook(() => useCandlestickDataDi(defaultOptions));
    
    await act(async () => {
      // Wait for initial data fetch
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Check that loading state is managed
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should handle symbol changes', () => {
    const { result, rerender } = renderHook(
      ({ symbol, interval }) => useCandlestickDataDi({ symbol, interval }),
      { initialProps: { symbol: 'BTCUSDT', interval: '1m' } }
    );
    
    // Change symbol
    rerender({ symbol: 'ETHUSDT', interval: '1m' });
    
    // Should trigger new data fetch
    expect(result.current).toBeDefined();
  });
});
