import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useMarketStore, useMarketBatching, useMarketPriceActions } from '../market.store';
import type { BinanceTradeMessage } from '@/types/market';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16); // Simulate 60fps
  return 1;
});

describe('Market Store Batching Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset store state before each test
    const { result } = renderHook(() => useMarketStore(state => state.reset));
    act(() => {
      result.current();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockTradeData = (symbol: string, price: string, timestamp: number): BinanceTradeMessage => ({
    e: 'trade',
    E: timestamp,
    s: symbol,
    t: 12345,
    p: price,
    q: '100.00000000',
    b: 88,
    a: 50,
    T: timestamp,
    m: false,
    M: true,
  });

  describe('Price Update Batching', () => {
    it('should batch multiple price updates into single state update', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: batchingResult } = renderHook(() => useMarketBatching());
      
      const trades = [
        createMockTradeData('BTCUSDT', '50000.00', Date.now()),
        createMockTradeData('ETHUSDT', '3000.00', Date.now()),
        createMockTradeData('ADAUSDT', '1.50', Date.now()),
      ];

      // Send multiple updates quickly
      act(() => {
        trades.forEach(trade => {
          actionsResult.current.updatePrice(trade);
        });
      });

      // Should be batching
      expect(batchingResult.current.isBatching).toBe(true);
      expect(batchingResult.current.pendingUpdatesCount).toBe(3);

      // Wait for requestAnimationFrame to process
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // After processing, should not be batching and pending updates should be cleared
      expect(batchingResult.current.isBatching).toBe(false);
      expect(batchingResult.current.pendingUpdatesCount).toBe(0);
    });

    it('should update currentPrices correctly after batch processing', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: storeResult } = renderHook(() => 
        useMarketStore(state => state.currentPrices)
      );

      const trades = [
        createMockTradeData('BTCUSDT', '50000.00', Date.now()),
        createMockTradeData('ETHUSDT', '3000.00', Date.now()),
      ];

      act(() => {
        trades.forEach(trade => {
          actionsResult.current.updatePrice(trade);
        });
      });

      // Wait for batch processing
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Verify prices were updated correctly
      expect(storeResult.current.BTCUSDT).toBeDefined();
      expect(storeResult.current.BTCUSDT.price).toBe(50000);
      expect(storeResult.current.ETHUSDT).toBeDefined();
      expect(storeResult.current.ETHUSDT.price).toBe(3000);
    });

    it('should handle rapid updates for same symbol correctly', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: storeResult } = renderHook(() => 
        useMarketStore(state => state.currentPrices)
      );

      const symbol = 'BTCUSDT';
      const trades = [
        createMockTradeData(symbol, '50000.00', Date.now()),
        createMockTradeData(symbol, '50100.00', Date.now() + 1),
        createMockTradeData(symbol, '50200.00', Date.now() + 2),
      ];

      act(() => {
        trades.forEach(trade => {
          actionsResult.current.updatePrice(trade);
        });
      });

      // Wait for batch processing
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Should use the latest price (overwrites previous pending updates)
      expect(storeResult.current[symbol].price).toBe(50200);
    });

    it('should calculate price changes correctly', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: storeResult } = renderHook(() => 
        useMarketStore(state => state.currentPrices)
      );

      const symbol = 'BTCUSDT';

      // First price update
      act(() => {
        actionsResult.current.updatePrice(
          createMockTradeData(symbol, '50000.00', Date.now())
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Second price update (higher)
      act(() => {
        actionsResult.current.updatePrice(
          createMockTradeData(symbol, '51000.00', Date.now() + 1000)
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const priceUpdate = storeResult.current[symbol];
      expect(priceUpdate.price).toBe(51000);
      expect(priceUpdate.change).toBe(1000);
      expect(priceUpdate.changePercent).toBeCloseTo(2, 1); // 2% increase
    });
  });

  describe('Direct Batch Updates', () => {
    it('should handle batchUpdatePrices correctly', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: storeResult } = renderHook(() => 
        useMarketStore(state => state.currentPrices)
      );

      const trades = [
        createMockTradeData('BTCUSDT', '50000.00', Date.now()),
        createMockTradeData('ETHUSDT', '3000.00', Date.now()),
        createMockTradeData('ADAUSDT', '1.50', Date.now()),
      ];

      act(() => {
        actionsResult.current.batchUpdatePrices(trades);
      });

      // Should update immediately without requestAnimationFrame
      expect(storeResult.current.BTCUSDT.price).toBe(50000);
      expect(storeResult.current.ETHUSDT.price).toBe(3000);
      expect(storeResult.current.ADAUSDT.price).toBe(1.5);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: batchingResult } = renderHook(() => useMarketBatching());

      // Generate 100 rapid updates
      const trades = Array.from({ length: 100 }, (_, i) => 
        createMockTradeData('BTCUSDT', `${50000 + i}.00`, Date.now() + i)
      );

      const startTime = performance.now();

      act(() => {
        trades.forEach(trade => {
          actionsResult.current.updatePrice(trade);
        });
      });

      const batchTime = performance.now() - startTime;

      // Batching should be very fast (under 10ms for 100 updates)
      expect(batchTime).toBeLessThan(10);
      expect(batchingResult.current.pendingUpdatesCount).toBe(1); // Latest overrides others

      // Wait for processing
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      expect(batchingResult.current.isBatching).toBe(false);
    });

    it('should maintain state consistency during batching', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());
      const { result: storeResult } = renderHook(() => 
        useMarketStore(state => ({ 
          currentPrices: state.currentPrices,
          lastUpdateTime: state.lastUpdateTime,
        }))
      );

      const initialUpdateTime = storeResult.current.lastUpdateTime;

      const trades = [
        createMockTradeData('BTCUSDT', '50000.00', Date.now()),
        createMockTradeData('ETHUSDT', '3000.00', Date.now()),
      ];

      act(() => {
        trades.forEach(trade => {
          actionsResult.current.updatePrice(trade);
        });
      });

      // Wait for batch processing
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Verify state consistency
      const finalUpdateTime = storeResult.current.lastUpdateTime;
      expect(finalUpdateTime).toBeGreaterThan(initialUpdateTime);
      expect(Object.keys(storeResult.current.currentPrices)).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle batching errors gracefully', async () => {
      const { result: actionsResult } = renderHook(() => useMarketPriceActions());

      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create invalid trade data
      const invalidTrade = {
        ...createMockTradeData('BTCUSDT', 'invalid-price', Date.now()),
        p: 'invalid-price',
      } as any;

      expect(() => {
        act(() => {
          actionsResult.current.updatePrice(invalidTrade);
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle missing requestAnimationFrame gracefully', async () => {
      // Temporarily remove requestAnimationFrame
      const originalRAF = global.requestAnimationFrame;
      delete (global as any).requestAnimationFrame;

      const { result: actionsResult } = renderHook(() => useMarketPriceActions());

      expect(() => {
        act(() => {
          actionsResult.current.updatePrice(
            createMockTradeData('BTCUSDT', '50000.00', Date.now())
          );
        });
      }).not.toThrow();

      // Restore requestAnimationFrame
      global.requestAnimationFrame = originalRAF;
    });
  });
});