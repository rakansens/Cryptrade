import { renderHook, act } from '@testing-library/react';
import { useLineTracking, usePriceStream } from '../use-line-tracking';
import { useAnalysisHistory, useAnalysisActions } from '@/store/analysis-history.store';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/store/analysis-history.store');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock dynamic imports
jest.mock('@/lib/notifications/browser-notifications', () => ({
  notifications: {
    showLineTouch: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/lib/binance/websocket-manager', () => ({
  binanceWS: {
    subscribe: jest.fn(),
  },
}));

describe('useLineTracking', () => {
  const mockRecords = [
    {
      id: 'record-1',
      symbol: 'BTCUSDT',
      tracking: { status: 'active', startTime: Date.now() - 1000000, touches: [] },
      proposal: { price: 50000, mlPrediction: { expectedBounces: 2 } },
    },
    {
      id: 'record-2',
      symbol: 'ETHUSDT',
      tracking: { status: 'active', startTime: Date.now() - 1000000, touches: [] },
      proposal: { price: 3000 },
    },
    {
      id: 'record-3',
      symbol: 'BTCUSDT',
      tracking: { status: 'completed', touches: [] },
      proposal: { price: 45000 },
    },
  ];

  const mockActions = {
    addTouchEvent: jest.fn(),
    updateTrackingStatus: jest.fn(),
    completeTracking: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalysisHistory as jest.Mock).mockReturnValue(mockRecords);
    (useAnalysisActions as jest.Mock).mockReturnValue(mockActions);
  });

  describe('activeRecords', () => {
    it('should filter only active records', () => {
      const { result } = renderHook(() => useLineTracking());
      
      expect(result.current.activeRecords).toHaveLength(2);
      expect(result.current.activeRecords[0].id).toBe('record-1');
      expect(result.current.activeRecords[1].id).toBe('record-2');
    });

    it('should memoize active records', () => {
      const { result, rerender } = renderHook(() => useLineTracking());
      
      const firstActiveRecords = result.current.activeRecords;
      rerender();
      const secondActiveRecords = result.current.activeRecords;
      
      // Should be the same reference if records haven't changed
      expect(firstActiveRecords).toBe(secondActiveRecords);
    });
  });

  describe('processPriceUpdate', () => {
    it('should detect line touch when price is within threshold', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.processPriceUpdate({
          symbol: 'BTCUSDT',
          price: 50050, // Within 0.2% of 50000
          volume: 1000,
          timestamp: Date.now(),
        });
      });

      expect(mockActions.addTouchEvent).toHaveBeenCalledWith('record-1', {
        price: 50050,
        result: expect.any(String),
        volume: 1000,
        strength: expect.any(Number),
      });
      expect(logger.info).toHaveBeenCalledWith(
        '[LineTracking] Touch recorded',
        expect.objectContaining({ recordId: 'record-1' })
      );
    });

    it('should not detect touch when price is outside threshold', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.processPriceUpdate({
          symbol: 'BTCUSDT',
          price: 51000, // More than 0.2% away from 50000
          volume: 1000,
          timestamp: Date.now(),
        });
      });

      expect(mockActions.addTouchEvent).not.toHaveBeenCalled();
    });

    it('should only process matching symbols', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.processPriceUpdate({
          symbol: 'ETHUSDT',
          price: 3005,
          volume: 500,
          timestamp: Date.now(),
        });
      });

      // Should only process record-2 (ETHUSDT), not record-1 (BTCUSDT)
      expect(mockActions.addTouchEvent).toHaveBeenCalledTimes(1);
      expect(mockActions.addTouchEvent).toHaveBeenCalledWith('record-2', expect.any(Object));
    });

    it('should show browser notification on touch', async () => {
      const { result } = renderHook(() => useLineTracking());
      const { notifications } = await import('@/lib/notifications/browser-notifications');
      
      await act(async () => {
        result.current.processPriceUpdate({
          symbol: 'BTCUSDT',
          price: 50050,
          volume: 1000,
          timestamp: Date.now(),
        });
      });

      // Give time for dynamic import
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(notifications.showLineTouch).toHaveBeenCalledWith(
        'BTCUSDT',
        50050,
        expect.any(String)
      );
    });

    it('should auto-complete tracking after 48 hours', () => {
      // Modify mock to have old tracking start time
      const oldRecord = {
        ...mockRecords[0],
        tracking: {
          status: 'active',
          startTime: Date.now() - (49 * 60 * 60 * 1000), // 49 hours ago
          touches: [
            { result: 'bounce', time: Date.now() - 1000000 },
            { result: 'bounce', time: Date.now() - 500000 },
          ],
        },
      };
      
      (useAnalysisHistory as jest.Mock).mockReturnValue([oldRecord]);
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.processPriceUpdate({
          symbol: 'BTCUSDT',
          price: 51000,
          volume: 1000,
          timestamp: Date.now(),
        });
      });

      expect(mockActions.completeTracking).toHaveBeenCalledWith('record-1', 'success');
      expect(logger.info).toHaveBeenCalledWith(
        '[LineTracking] Auto-completed tracking',
        expect.objectContaining({ recordId: 'record-1', finalResult: 'success' })
      );
    });
  });

  describe('recordTouch', () => {
    it('should manually record a touch event', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.recordTouch('record-1', 'bounce');
      });

      expect(mockActions.addTouchEvent).toHaveBeenCalledWith('record-1', {
        price: 50000,
        result: 'bounce',
        volume: 1000,
        strength: 0.9,
      });
      expect(logger.info).toHaveBeenCalledWith(
        '[LineTracking] Manual touch recorded',
        { recordId: 'record-1', result: 'bounce' }
      );
    });

    it('should not record touch for non-active record', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.recordTouch('record-3', 'bounce'); // record-3 is completed
      });

      expect(mockActions.addTouchEvent).not.toHaveBeenCalled();
    });
  });

  describe('completeRecord', () => {
    it('should manually complete a record', () => {
      const { result } = renderHook(() => useLineTracking());
      
      act(() => {
        result.current.completeRecord('record-1', 'success');
      });

      expect(mockActions.completeTracking).toHaveBeenCalledWith('record-1', 'success');
      expect(logger.info).toHaveBeenCalledWith(
        '[LineTracking] Manual completion',
        { recordId: 'record-1', result: 'success' }
      );
    });
  });
});

describe('usePriceStream', () => {
  const mockBinanceWS = {
    subscribe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalysisHistory as jest.Mock).mockReturnValue([]);
    (useAnalysisActions as jest.Mock).mockReturnValue({
      addTouchEvent: jest.fn(),
      updateTrackingStatus: jest.fn(),
      completeTracking: jest.fn(),
    });
    
    // Reset the mock for dynamic import
    jest.resetModules();
    jest.doMock('@/lib/binance/websocket-manager', () => ({
      binanceWS: mockBinanceWS,
    }));
  });

  it('should not initialize WebSocket with empty symbols', () => {
    renderHook(() => usePriceStream([]));
    
    expect(mockBinanceWS.subscribe).not.toHaveBeenCalled();
  });

  it('should subscribe to all provided symbols', async () => {
    const mockUnsubscribe = jest.fn();
    mockBinanceWS.subscribe.mockReturnValue(mockUnsubscribe);
    
    const { unmount } = renderHook(() => usePriceStream(['BTCUSDT', 'ETHUSDT']));
    
    // Wait for async initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockBinanceWS.subscribe).toHaveBeenCalledTimes(2);
    expect(mockBinanceWS.subscribe).toHaveBeenCalledWith('BTCUSDT', expect.any(Function));
    expect(mockBinanceWS.subscribe).toHaveBeenCalledWith('ETHUSDT', expect.any(Function));
    
    expect(logger.info).toHaveBeenCalledWith(
      '[PriceStream] Subscribing to real-time data',
      { symbol: 'BTCUSDT' }
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[PriceStream] Subscribing to real-time data',
      { symbol: 'ETHUSDT' }
    );
    
    // Test cleanup
    unmount();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('[PriceStream] Unsubscribed from all symbols');
  });

  it('should handle WebSocket initialization failure', async () => {
    // Mock import failure
    jest.doMock('@/lib/binance/websocket-manager', () => {
      throw new Error('WebSocket initialization failed');
    });
    
    renderHook(() => usePriceStream(['BTCUSDT']));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[PriceStream] Failed to initialize WebSocket',
      expect.any(Error)
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[PriceStream] Falling back to mock price stream',
      ['BTCUSDT']
    );
  });

  it('should re-subscribe when symbols change', async () => {
    const mockUnsubscribe = jest.fn();
    mockBinanceWS.subscribe.mockReturnValue(mockUnsubscribe);
    
    const { rerender } = renderHook(
      ({ symbols }) => usePriceStream(symbols),
      { initialProps: { symbols: ['BTCUSDT'] } }
    );
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockBinanceWS.subscribe).toHaveBeenCalledTimes(1);
    
    // Change symbols
    rerender({ symbols: ['ETHUSDT', 'BNBUSDT'] });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Should unsubscribe from old and subscribe to new
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockBinanceWS.subscribe).toHaveBeenCalledWith('ETHUSDT', expect.any(Function));
    expect(mockBinanceWS.subscribe).toHaveBeenCalledWith('BNBUSDT', expect.any(Function));
  });
});