import { renderHook } from '@testing-library/react';
import { useAgentEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';

// Mock the delegation hook
jest.mock('@/hooks/chart/useAgentEventBridge');

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
    const { useAgentEventBridge } = require('@/hooks/chart/useAgentEventBridge');
    
    renderHook(() => useAgentEventHandlers(mockHandlers));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith(mockHandlers);
  });

  it('should handle empty handlers object', () => {
    const { useAgentEventBridge } = require('@/hooks/chart/useAgentEventBridge');
    
    renderHook(() => useAgentEventHandlers({}));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith({});
  });

  it('should handle partial handlers', () => {
    const { useAgentEventBridge } = require('@/hooks/chart/useAgentEventBridge');
    const partialHandlers = {
      fitContent: jest.fn(),
      chartData: []
    };
    
    renderHook(() => useAgentEventHandlers(partialHandlers));
    
    expect(useAgentEventBridge).toHaveBeenCalledWith(partialHandlers);
  });
});
