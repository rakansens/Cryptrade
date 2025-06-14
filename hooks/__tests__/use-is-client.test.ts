import { renderHook } from '@testing-library/react';
import { useIsClient } from '../use-is-client';

describe('useIsClient', () => {
  it('should return false on initial render (SSR)', () => {
    const { result } = renderHook(() => useIsClient());
    
    // On the first render (which simulates SSR), it should be false
    expect(result.current).toBe(false);
  });

  it('should return true after effect runs (client-side)', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    
    // Initially false
    expect(result.current).toBe(false);
    
    // After effect runs (simulating hydration), it should be true
    rerender();
    expect(result.current).toBe(true);
  });

  it('should maintain true state on subsequent renders', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    
    // After first effect
    rerender();
    expect(result.current).toBe(true);
    
    // Should stay true
    rerender();
    expect(result.current).toBe(true);
    
    rerender();
    expect(result.current).toBe(true);
  });
});