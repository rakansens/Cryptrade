import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useAlerts } from '@/hooks/use-alerts';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import { logger } from '@/lib/utils/logger';
import { getServerSession } from '@/lib/auth/server';

// Mock dependencies
jest.mock('@/hooks/base/use-sse-stream');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/auth/server');

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    
    // Mock authentication session
    jest.mocked(getServerSession).mockResolvedValue({
      user: { id: 'test-user-id' },
      expires: '2024-12-31T23:59:59.999Z'
    });
  });

  it('should initialize with empty alerts array', () => {
    const { result } = renderHook(() => useAlerts());
    
    expect(result.current.alerts).toEqual([]);
    expect(result.current.fetchAlerts).toBeDefined();
    expect(result.current.createAlert).toBeDefined();
  });

  it('should not fetch alerts when userId is not provided', () => {
    renderHook(() => useAlerts());
    
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch alerts when userId is provided', async () => {
    const mockAlerts = [
      { id: '1', symbol: 'BTC', conditions: { price: 50000, type: 'above' } },
      { id: '2', symbol: 'ETH', conditions: { price: 3000, type: 'below' } }
    ];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts })
    });

    const { result } = renderHook(() => useAlerts('user123'));
    
    // Manually trigger fetch
    await act(async () => {
      await result.current.fetchAlerts();
    });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/alerts');
      expect(result.current.alerts).toEqual(mockAlerts);
    });
  });

  it('should handle fetch alerts error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAlerts('user123'));
    
    // Manually trigger fetch that will fail
    await act(async () => {
      await result.current.fetchAlerts();
    });
    
    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[useAlerts] Failed to fetch alerts',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  it('should create alert successfully', async () => {
    const newAlert = { id: '3', symbol: 'SOL', conditions: { price: 100, type: 'above' } };
    
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ alert: newAlert }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ alerts: [newAlert] }) });

    const { result } = renderHook(() => useAlerts('user123'));

    await act(async () => {
      await result.current.createAlert('SOL', { price: 100, type: 'above' });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: 'SOL', conditions: { price: 100, type: 'above' } })
      });
      expect(result.current.alerts).toContainEqual(newAlert);
    });
  });

  it('should not create alert when userId is not provided', async () => {
    const { result } = renderHook(() => useAlerts());
    
    await act(async () => {
      await result.current.createAlert('BTC', { price: 50000, type: 'above' });
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle create alert error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAlerts('user123'));

    await act(async () => {
      try {
        await result.current.createAlert('BTC', { price: 50000, type: 'above' });
      } catch (error) {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[useAlerts] Failed to create alert',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  it('should handle SSE events for matching userId', () => {
    const mockOnEvent = jest.fn();
    jest.mocked(useSSEStream).mockImplementation(({ onEvent }) => {
      mockOnEvent.mockImplementation(onEvent);
    });

    renderHook(() => useAlerts('user123'));

    const event = {
      data: JSON.stringify({ userId: 'user123', alertId: 'alert1' })
    };

    act(() => {
      mockOnEvent('alertTriggered', event);
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[useAlerts] Alert triggered',
      { userId: 'user123', alertId: 'alert1' }
    );
  });

  it('should ignore SSE events for different userId', () => {
    const mockOnEvent = jest.fn();
    jest.mocked(useSSEStream).mockImplementation(({ onEvent }) => {
      mockOnEvent.mockImplementation(onEvent);
    });

    renderHook(() => useAlerts('user123'));

    const event = {
      data: JSON.stringify({ userId: 'differentUser', alertId: 'alert1' })
    };

    act(() => {
      mockOnEvent('alertTriggered', event);
    });

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should handle invalid SSE event data', () => {
    const mockOnEvent = jest.fn();
    jest.mocked(useSSEStream).mockImplementation(({ onEvent }) => {
      mockOnEvent.mockImplementation(onEvent);
    });

    renderHook(() => useAlerts('user123'));

    const event = { data: 'invalid json' };

    act(() => {
      mockOnEvent('alertTriggered', event);
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[useAlerts] Failed to parse event',
      { data: 'invalid json' }
    );
  });

  it('should update userId and refetch alerts', async () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId?: string }) => useAlerts(userId),
      { initialProps: { userId: undefined as string | undefined } }
    );

    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: [{ id: '1', symbol: 'BTC' }] })
    });

    rerender({ userId: 'user123' });

    // Wait for automatic fetch triggered by userId change
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/alerts');
    });
  });
});