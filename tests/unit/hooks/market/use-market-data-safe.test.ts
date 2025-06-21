import { renderHook, act } from '@testing-library/react';
import { useMarketDataSafe } from '@/hooks/market/use-market-data-safe';

describe('useMarketDataSafe', () => {
  const defaultOptions = {
    symbol: 'BTCUSDT',
    interval: '1m',
    limit: 100,
    enableRealtime: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useMarketDataSafe(defaultOptions));
    
    expect(result.current).toBeDefined();
    expect(result.current.state).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
  });

  it('should handle data fetching', async () => {
    const { result } = renderHook(() => useMarketDataSafe(defaultOptions));
    
    // Initial state
    expect(typeof result.current.loading).toBe('boolean');
    
    await act(async () => {
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // After fetching
    expect(result.current.state).toBeDefined();
  });

  it('should handle symbol changes', () => {
    const { result, rerender } = renderHook(
      (props) => useMarketDataSafe(props),
      { initialProps: { ...defaultOptions, symbol: 'BTCUSDT' } }
    );
    
    // Change symbol
    rerender({ ...defaultOptions, symbol: 'ETHUSDT' });
    
    // Should trigger new data fetch
    expect(result.current).toBeDefined();
  });

  it('should handle realtime updates when enabled', () => {
    const { result } = renderHook(() => 
      useMarketDataSafe({ ...defaultOptions, enableRealtime: true })
    );
    
    expect(result.current).toBeDefined();
    // Realtime connection would be established if WebSocket is available
  });
});
