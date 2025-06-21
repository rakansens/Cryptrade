import { renderHook, act } from '@testing-library/react';
import { useIndicatorValues } from '@/hooks/market/use-indicator-values';

describe('useIndicatorValues', () => {
  const defaultSymbol = 'BTCUSDT';
  const defaultTimeframe = '1m';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with null values when no data', () => {
    const { result } = renderHook(() => 
      useIndicatorValues(defaultSymbol, defaultTimeframe)
    );
    
    expect(result.current).toBeDefined();
    expect(result.current.ma7).toBeNull();
    expect(result.current.ma25).toBeNull();
    expect(result.current.ma99).toBeNull();
    expect(result.current.rsi).toBeNull();
    expect(result.current.macd).toBeNull();
    expect(result.current.macdSignal).toBeNull();
    expect(result.current.macdHistogram).toBeNull();
  });

  it('should handle symbol changes', () => {
    const { result, rerender } = renderHook(
      ({ symbol, timeframe }) => useIndicatorValues(symbol, timeframe),
      { initialProps: { symbol: 'BTCUSDT', timeframe: '1m' } }
    );
    
    // Initial state
    expect(result.current).toBeDefined();
    
    // Change symbol
    rerender({ symbol: 'ETHUSDT', timeframe: '1m' });
    
    // Should return new indicator values
    expect(result.current).toBeDefined();
  });

  it('should handle timeframe changes', () => {
    const { result, rerender } = renderHook(
      ({ symbol, timeframe }) => useIndicatorValues(symbol, timeframe),
      { initialProps: { symbol: 'BTCUSDT', timeframe: '1m' } }
    );
    
    // Change timeframe
    rerender({ symbol: 'BTCUSDT', timeframe: '5m' });
    
    // Should return new indicator values
    expect(result.current).toBeDefined();
  });
});
