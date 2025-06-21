import { renderHook } from '@testing-library/react';
import { useChartData } from '@/components/chart/hooks/useChartData';
import { prepareLightweightChartsData } from '@/lib/utils/chart-data';
import { calculateMultipleMovingAverages } from '@/lib/indicators/moving-average';
import { calculateBollingerBands } from '@/lib/indicators/bollinger-bands';
import type { ProcessedKline, IndicatorOptions } from '@/types/market';
import type { ChartSeriesRefs } from '@/components/chart/hooks/useChartInstance';

// Mock dependencies
jest.mock('@/lib/utils/chart-data');
jest.mock('@/lib/indicators/moving-average');
jest.mock('@/lib/indicators/bollinger-bands');

describe('useChartData', () => {
  const mockPriceData: ProcessedKline[] = [
    { time: 1735830000, open: 100000, high: 101000, low: 99000, close: 100500, volume: 1000 },
    { time: 1735833600, open: 100500, high: 102000, low: 100000, close: 101500, volume: 1200 },
    { time: 1735837200, open: 101500, high: 103000, low: 101000, close: 102500, volume: 1500 },
  ];

  const mockGetSeries = jest.fn<ChartSeriesRefs, []>();
  const mockFitContent = jest.fn();
  const mockSetData = jest.fn();

  const mockSeriesRefs: ChartSeriesRefs = {
    candlestick: { setData: mockSetData },
    movingAverages: {
      7: { setData: mockSetData },
      25: { setData: mockSetData },
      99: { setData: mockSetData },
    },
    bollingerBands: {
      upper: { setData: mockSetData },
      middle: { setData: mockSetData },
      lower: { setData: mockSetData },
    },
  } as any;

  const defaultProps = {
    priceData: mockPriceData,
    indicators: { ma: true, boll: true } as IndicatorOptions,
    getSeries: mockGetSeries,
    fitContent: mockFitContent,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSeries.mockReturnValue(mockSeriesRefs);
    
    // Mock chart data preparation
    (prepareLightweightChartsData as jest.Mock).mockImplementation((data) => 
      data.map((d: any) => ({ ...d, time: d.time }))
    );
    
    // Mock MA calculation
    (calculateMultipleMovingAverages as jest.Mock).mockReturnValue({
      7: [{ time: 1735837200, value: 101166.67 }],
      25: [{ time: 1735837200, value: 101166.67 }],
      99: [{ time: 1735837200, value: 101166.67 }],
    });
    
    // Mock Bollinger Bands calculation
    (calculateBollingerBands as jest.Mock).mockReturnValue([
      { time: 1735837200, upper: 103000, middle: 101500, lower: 100000 },
    ]);
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useChartData(defaultProps));
    
    expect(result.current.hasData).toBe(true);
    expect(result.current.formattedData).toHaveLength(3);
    expect(result.current.movingAverageData).toBeDefined();
    expect(result.current.bollingerBandsData).toBeDefined();
  });

  it('should handle empty price data', () => {
    const { result } = renderHook(() => useChartData({
      ...defaultProps,
      priceData: [],
    }));
    
    expect(result.current.hasData).toBe(false);
    expect(result.current.formattedData).toEqual([]);
    expect(result.current.movingAverageData).toEqual({});
    expect(result.current.bollingerBandsData).toBeNull();
  });

  it('should update candlestick data', () => {
    renderHook(() => useChartData(defaultProps));
    
    expect(mockSetData).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ time: 1735830000, open: 100000 }),
    ]));
  });

  it('should calculate moving averages', () => {
    renderHook(() => useChartData(defaultProps));
    
    expect(calculateMultipleMovingAverages).toHaveBeenCalledWith(
      expect.any(Array),
      [7, 25, 99],
      'SMA'
    );
  });

  it('should calculate Bollinger Bands', () => {
    renderHook(() => useChartData(defaultProps));
    
    expect(calculateBollingerBands).toHaveBeenCalledWith(
      expect.any(Array),
      20,
      2
    );
  });

  it('should use custom Bollinger settings', () => {
    renderHook(() => useChartData({
      ...defaultProps,
      bollingerSettings: { period: 30, stdDev: 3 },
    }));
    
    expect(calculateBollingerBands).toHaveBeenCalledWith(
      expect.any(Array),
      30,
      3
    );
  });

  it('should auto-fit content on initial load', () => {
    jest.useFakeTimers();
    
    renderHook(() => useChartData(defaultProps));
    
    jest.advanceTimersByTime(100);
    
    expect(mockFitContent).toHaveBeenCalled();
    
    jest.useRealTimers();
  });

  it('should not auto-fit when autoFit is false', () => {
    jest.useFakeTimers();
    
    renderHook(() => useChartData({
      ...defaultProps,
      autoFit: false,
    }));
    
    jest.advanceTimersByTime(100);
    
    expect(mockFitContent).not.toHaveBeenCalled();
    
    jest.useRealTimers();
  });

  it('should update indicator data for existing series', () => {
    const { result } = renderHook(() => useChartData(defaultProps));
    
    // Check that MA series were updated
    expect(mockSetData).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ time: 1735837200, value: 101166.67 }),
    ]));
    
    // Check that Bollinger Bands were updated
    expect(mockSetData).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ time: 1735837200, value: 103000 }), // upper
    ]));
  });

  it('should handle updateIndicatorData function', () => {
    const { result } = renderHook(() => useChartData(defaultProps));
    
    jest.clearAllMocks();
    
    // Update MA indicators
    result.current.updateIndicatorData('ma');
    
    expect(mockSetData).toHaveBeenCalledTimes(3); // 3 MA periods
    
    jest.clearAllMocks();
    
    // Update Bollinger Bands
    result.current.updateIndicatorData('boll');
    
    expect(mockSetData).toHaveBeenCalledTimes(3); // upper, middle, lower
  });

  it('should handle errors gracefully', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSetData.mockImplementationOnce(() => {
      throw new Error('Failed to set data');
    });
    
    renderHook(() => useChartData(defaultProps));
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ChartData] Error setting chart data:',
      expect.any(Error),
      expect.objectContaining({
        dataLength: 3,
        hasCandelstickSeries: true,
      })
    );
    
    consoleErrorSpy.mockRestore();
  });

  it('should not update indicators when series do not exist', () => {
    const emptySeriesRefs: ChartSeriesRefs = {
      candlestick: null,
      movingAverages: {},
      bollingerBands: {
        upper: null,
        middle: null,
        lower: null,
      },
    };
    
    mockGetSeries.mockReturnValue(emptySeriesRefs);
    
    renderHook(() => useChartData(defaultProps));
    
    // Should only attempt to set data on candlestick (which is null)
    expect(mockSetData).not.toHaveBeenCalled();
  });
});
