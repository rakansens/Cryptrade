import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { useChartInstance } from '@/components/chart/hooks/useChartInstance';
import { createChart } from 'lightweight-charts';
import { ChartDrawingManager } from '@/lib/chart/drawing-primitives';
import { DrawingRenderer, isDrawingRendererEnabled } from '@/lib/chart/drawing-renderer';
import { createPatternRendererWithAutoSelection } from '@/lib/chart/PatternRendererAdapter';

// Mock dependencies
jest.mock('lightweight-charts');
jest.mock('@/lib/chart/drawing-primitives');
jest.mock('@/lib/chart/drawing-renderer');
jest.mock('@/lib/chart/PatternRendererAdapter');
jest.mock('./useChartSync', () => ({
  useChartSync: () => ({
    registerChart: jest.fn(),
    unregisterChart: jest.fn(),
  }),
}));

describe('useChartInstance', () => {
  const mockChart = {
    addCandlestickSeries: jest.fn(),
    addLineSeries: jest.fn(),
    removeSeries: jest.fn(),
    timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
    applyOptions: jest.fn(),
    remove: jest.fn(),
  };

  const mockCandlestickSeries = {
    setData: jest.fn(),
  };

  const mockDrawingManager = {
    clearAll: jest.fn(),
  };

  const mockDrawingRenderer = {
    cleanup: jest.fn(),
  };

  const mockPatternRenderer = {
    dispose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createChart).mockReturnValue(mockChart);
    (mockChart.addCandlestickSeries as jest.Mock).mockReturnValue(mockCandlestickSeries);
    jest.mocked(ChartDrawingManager).mockImplementation(() => mockDrawingManager);
    jest.mocked(DrawingRenderer).mockImplementation(() => mockDrawingRenderer);
    jest.mocked(createPatternRendererWithAutoSelection).mockReturnValue(mockPatternRenderer);
    jest.mocked(isDrawingRendererEnabled).mockReturnValue(true);
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    expect(result.current.chartContainerRef).toBeDefined();
    expect(result.current.chartInstance).toBeNull();
    expect(result.current.drawingManager).toBeNull();
    expect(result.current.patternRenderer).toBeNull();
  });

  it('should create chart instance when initialized', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    // Create a mock div element
    const mockDiv = document.createElement('div');
    Object.defineProperty(mockDiv, 'clientWidth', { value: 800 });
    Object.defineProperty(mockDiv, 'clientHeight', { value: 600 });
    
    // Set the ref
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    // Initialize chart
    act(() => {
      const cleanup = result.current.initializeChart();
      cleanup?.(); // Cleanup immediately for test
    });
    
    expect(createChart).toHaveBeenCalledWith(mockDiv, expect.objectContaining({
      layout: expect.any(Object),
      grid: expect.any(Object),
      crosshair: expect.any(Object),
      width: 800,
      height: 600,
    }));
  });

  it('should handle custom height', () => {
    const { result } = renderHook(() => useChartInstance({ height: 400 }));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    act(() => {
      const cleanup = result.current.initializeChart();
      cleanup?.();
    });
    
    expect(createChart).toHaveBeenCalledWith(mockDiv, expect.objectContaining({
      height: 400,
    }));
  });

  it('should handle custom theme', () => {
    const customTheme = {
      background: '#ffffff',
      textColor: '#000000',
      gridColor: '#cccccc',
      crosshairColor: '#666666',
      borderColor: '#dddddd',
    };
    
    const { result } = renderHook(() => useChartInstance({ theme: customTheme }));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    act(() => {
      const cleanup = result.current.initializeChart();
      cleanup?.();
    });
    
    expect(createChart).toHaveBeenCalledWith(mockDiv, expect.objectContaining({
      layout: expect.objectContaining({
        background: { type: expect.any(Number), color: '#ffffff' },
        textColor: '#000000',
      }),
    }));
  });

  it('should create candlestick series', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    act(() => {
      result.current.initializeChart();
    });
    
    expect(mockChart.addCandlestickSeries).toHaveBeenCalledWith({
      upColor: '#0ddfba',
      downColor: '#ff4d4d',
      borderDownColor: '#ff4d4d',
      borderUpColor: '#0ddfba',
      wickDownColor: '#ff4d4d',
      wickUpColor: '#0ddfba',
    });
  });

  it('should initialize drawing manager and renderers', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    act(() => {
      result.current.initializeChart();
    });
    
    expect(ChartDrawingManager).toHaveBeenCalledWith(mockChart, mockCandlestickSeries);
    expect(DrawingRenderer).toHaveBeenCalledWith(mockChart, mockCandlestickSeries);
    expect(createPatternRendererWithAutoSelection).toHaveBeenCalledWith(mockChart, mockCandlestickSeries);
    expect(result.current.drawingManager).toBe(mockDrawingManager);
  });

  it('should handle resize events', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    Object.defineProperty(mockDiv, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(mockDiv, 'clientHeight', { value: 600, configurable: true });
    
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
      result.current.initializeChart();
    });
    
    // Change dimensions
    Object.defineProperty(mockDiv, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(mockDiv, 'clientHeight', { value: 700, configurable: true });
    
    act(() => {
      result.current.handleResize();
    });
    
    expect(mockChart.applyOptions).toHaveBeenCalledWith({
      width: 1000,
      height: 700,
    });
  });

  it('should fit content', () => {
    const mockFitContent = jest.fn();
    mockChart.timeScale.mockReturnValue({ fitContent: mockFitContent });
    
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
      result.current.initializeChart();
    });
    
    act(() => {
      result.current.fitContent();
    });
    
    expect(mockFitContent).toHaveBeenCalled();
  });

  it('should add and remove indicator series', () => {
    const mockMaSeries = { setData: jest.fn() };
    const mockBollSeries = { setData: jest.fn() };
    
    mockChart.addLineSeries.mockReturnValue(mockMaSeries);
    
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
      result.current.initializeChart();
    });
    
    // Add MA indicators
    act(() => {
      result.current.addIndicatorSeries('ma', true);
    });
    
    expect(mockChart.addLineSeries).toHaveBeenCalledTimes(3); // MA(7), MA(25), MA(99)
    
    // Remove MA indicators
    act(() => {
      result.current.addIndicatorSeries('ma', false);
    });
    
    expect(mockChart.removeSeries).toHaveBeenCalledTimes(3);
    
    // Add Bollinger Bands
    mockChart.addLineSeries.mockReturnValue(mockBollSeries);
    
    act(() => {
      result.current.addIndicatorSeries('boll', true);
    });
    
    expect(mockChart.addLineSeries).toHaveBeenCalledTimes(6); // 3 MA + 3 Bollinger
  });

  it('should cleanup properly on unmount', () => {
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
    });
    
    let cleanup: (() => void) | undefined;
    act(() => {
      cleanup = result.current.initializeChart();
    });
    
    act(() => {
      cleanup?.();
    });
    
    expect(mockDrawingManager.clearAll).toHaveBeenCalled();
    expect(mockDrawingRenderer.cleanup).toHaveBeenCalled();
    expect(mockPatternRenderer.dispose).toHaveBeenCalled();
    expect(mockChart.remove).toHaveBeenCalled();
  });

  it('should not initialize drawing renderer when feature is disabled', () => {
    jest.mocked(isDrawingRendererEnabled).mockReturnValue(false);
    
    const { result } = renderHook(() => useChartInstance({}));
    
    const mockDiv = document.createElement('div');
    act(() => {
      result.current.chartContainerRef.current = mockDiv;
      result.current.initializeChart();
    });
    
    expect(DrawingRenderer).not.toHaveBeenCalled();
  });
});
