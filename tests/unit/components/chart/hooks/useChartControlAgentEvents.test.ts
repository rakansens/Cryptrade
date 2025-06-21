import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { useChartControlAgentEvents } from '@/components/chart/hooks/useChartControlAgentEvents';

describe('useChartControlAgentEvents', () => {
  const mockHandlers = {
    fitContent: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    resetView: jest.fn(),
  };

  it('should register event listeners on mount', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    
    renderHook(() => useChartControlAgentEvents(mockHandlers));
    
    // Check that event listeners were registered
    expect(addEventListenerSpy).toHaveBeenCalledWith('chart:fitContent', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('chart:zoomIn', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('chart:zoomOut', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('chart:resetView', expect.any(Function));
    
    addEventListenerSpy.mockRestore();
  });

  it('should call handlers when events are dispatched', async () => {
    renderHook(() => useChartControlAgentEvents(mockHandlers));
    
    // Dispatch fitContent event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chart:fitContent'));
    });
    
    expect(mockHandlers.fitContent).toHaveBeenCalled();
    
    // Reset mock and test zoomIn with factor
    mockHandlers.zoomIn.mockClear();
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chart:zoomIn', { detail: { factor: 1.5 } }));
    });
    
    expect(mockHandlers.zoomIn).toHaveBeenCalledWith(1.5);
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderHook(() => useChartControlAgentEvents(mockHandlers));
    
    unmount();
    
    // Check that event listeners were removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:fitContent', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:zoomIn', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:zoomOut', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:resetView', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });
});
