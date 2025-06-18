/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useIsClient } from '../../../hooks/use-is-client';

describe('useIsClient', () => {
  it('should return true after initial render in jsdom', () => {
    const { result } = renderHook(() => useIsClient());
    
    // In jsdom, effects run synchronously, so it's immediately true
    expect(result.current).toBe(true);
  });

  it('should maintain true state on subsequent renders', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    
    // Already true after initial render
    expect(result.current).toBe(true);
    
    // Should stay true
    rerender();
    expect(result.current).toBe(true);
    
    rerender();
    expect(result.current).toBe(true);
  });

  it('should be a stable hook with no dependencies', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    
    const firstResult = result.current;
    
    // Multiple rerenders should give same result
    rerender();
    expect(result.current).toBe(firstResult);
    
    rerender();
    expect(result.current).toBe(firstResult);
  });
});
