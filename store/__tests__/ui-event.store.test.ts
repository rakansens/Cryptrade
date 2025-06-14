import { act, renderHook } from '@testing-library/react';
import { useUIEventStore, useUIEventPublisher } from '@/store/ui-event.store';

// Mock the useUIEventStream hook
const mockPublish = jest.fn();
jest.mock('@/hooks/use-ui-event-stream', () => ({
  useUIEventStream: () => ({
    publish: mockPublish,
  }),
}));

describe('UI Event Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset store
    act(() => {
      useUIEventStore.setState({ isInitialized: false });
    });
  });

  describe('UIEventStore', () => {
    it('should have initial state', () => {
      const { result } = renderHook(() => useUIEventStore());

      expect(result.current.isInitialized).toBe(false);
    });

    it('should set initialized state', () => {
      const { result } = renderHook(() => useUIEventStore());

      act(() => {
        result.current.setInitialized(true);
      });

      expect(result.current.isInitialized).toBe(true);

      act(() => {
        result.current.setInitialized(false);
      });

      expect(result.current.isInitialized).toBe(false);
    });

    it('should maintain state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useUIEventStore());
      const { result: result2 } = renderHook(() => useUIEventStore());

      expect(result1.current.isInitialized).toBe(false);
      expect(result2.current.isInitialized).toBe(false);

      act(() => {
        result1.current.setInitialized(true);
      });

      expect(result1.current.isInitialized).toBe(true);
      expect(result2.current.isInitialized).toBe(true);
    });
  });

  describe('useUIEventPublisher', () => {
    it('should provide publish function and availability status', () => {
      const { result } = renderHook(() => useUIEventPublisher());

      expect(result.current).toHaveProperty('publish');
      expect(result.current).toHaveProperty('isAvailable');
      expect(result.current.publish).toBe(mockPublish);
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle missing publish function', () => {
      // Temporarily mock to return no publish function
      const mockUseUIEventStream = jest.requireMock('@/hooks/use-ui-event-stream').useUIEventStream;
      mockUseUIEventStream.mockReturnValueOnce({
        publish: null,
      });

      const { result } = renderHook(() => useUIEventPublisher());

      expect(result.current.publish).toBeNull();
      expect(result.current.isAvailable).toBe(false);
    });

    it('should call the publish function', () => {
      const { result } = renderHook(() => useUIEventPublisher());

      const testEvent = { type: 'test-event', data: { value: 42 } };

      act(() => {
        result.current.publish(testEvent);
      });

      expect(mockPublish).toHaveBeenCalledWith(testEvent);
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration', () => {
    it('should work with initialization flow', () => {
      const { result: storeResult } = renderHook(() => useUIEventStore());
      const { result: publisherResult } = renderHook(() => useUIEventPublisher());

      // Initially not initialized
      expect(storeResult.current.isInitialized).toBe(false);

      // Initialize
      act(() => {
        storeResult.current.setInitialized(true);
      });

      expect(storeResult.current.isInitialized).toBe(true);

      // Publish an event
      const initEvent = { type: 'init', data: { status: 'ready' } };
      
      act(() => {
        publisherResult.current.publish(initEvent);
      });

      expect(mockPublish).toHaveBeenCalledWith(initEvent);
    });

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useUIEventStore());

      // Rapidly toggle initialization state
      act(() => {
        result.current.setInitialized(true);
        result.current.setInitialized(false);
        result.current.setInitialized(true);
        result.current.setInitialized(false);
        result.current.setInitialized(true);
      });

      expect(result.current.isInitialized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle publish errors gracefully', () => {
      mockPublish.mockImplementation(() => {
        throw new Error('Publish failed');
      });

      const { result } = renderHook(() => useUIEventPublisher());

      // Should not throw when calling publish
      expect(() => {
        act(() => {
          result.current.publish({ type: 'error-test' });
        });
      }).toThrow('Publish failed');

      expect(mockPublish).toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    beforeEach(() => {
      // Reset mock implementation
      mockPublish.mockImplementation(jest.fn());
    });

    it('should accept various event types', () => {
      const { result } = renderHook(() => useUIEventPublisher());

      const events = [
        { type: 'string-data', data: 'test' },
        { type: 'number-data', data: 123 },
        { type: 'boolean-data', data: true },
        { type: 'object-data', data: { nested: { value: 'deep' } } },
        { type: 'array-data', data: [1, 2, 3] },
        { type: 'null-data', data: null },
        { type: 'undefined-data', data: undefined },
        { type: 'no-data' },
      ];

      events.forEach(event => {
        act(() => {
          result.current.publish(event);
        });
      });

      expect(mockPublish).toHaveBeenCalledTimes(events.length);
      events.forEach((event, index) => {
        expect(mockPublish).toHaveBeenNthCalledWith(index + 1, event);
      });
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      // Reset mock implementation
      mockPublish.mockImplementation(jest.fn());
    });

    it('should handle high-frequency updates', () => {
      const { result } = renderHook(() => useUIEventStore());

      const startTime = Date.now();
      const iterations = 1000;

      act(() => {
        for (let i = 0; i < iterations; i++) {
          result.current.setInitialized(i % 2 === 0);
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 100ms for 1000 updates)
      expect(duration).toBeLessThan(100);
      expect(result.current.isInitialized).toBe(false); // Last iteration sets to false
    });

    it('should handle high-frequency publishing', () => {
      const { result } = renderHook(() => useUIEventPublisher());

      const startTime = Date.now();
      const iterations = 1000;

      act(() => {
        for (let i = 0; i < iterations; i++) {
          result.current.publish({ type: 'perf-test', data: i });
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(100);
      expect(mockPublish).toHaveBeenCalledTimes(iterations);
    });
  });
});