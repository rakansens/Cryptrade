import { renderHook } from '@testing-library/react';
import { useAgentEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';
import { useAgentEventBridge } from '@/hooks/chart/useAgentEventBridge';

// Mock the delegation hook
jest.mock('@/hooks/chart/useAgentEventBridge', () => ({
  useAgentEventBridge: jest.fn()
}));

describe('useAgentEventHandlers', () => {
  const mockHandlers = {
    fitContent: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    resetView: jest.fn(),
    drawingManager: null,
    chartData: [],
    patternRenderer: null,
    getPatternRenderer: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept handlers and delegate to useAgentEventBridge', () => {
    renderHook(() => useAgentEventHandlers(mockHandlers));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith(mockHandlers);
  });

  it('should handle empty handlers object', () => {
    renderHook(() => useAgentEventHandlers({}));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith({});
  });

  it('should handle partial handlers', () => {
    const partialHandlers = {
      fitContent: jest.fn(),
      chartData: []
    };
    
    renderHook(() => useAgentEventHandlers(partialHandlers));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith(partialHandlers);
  });
});
