import { useRef, useEffect, useCallback, useState } from 'react';
import { createChart, IChartApi, ColorType, CrosshairMode, ISeriesApi } from 'lightweight-charts';
import type { IndicatorOptions } from '@/types/market';
import { useChartSync } from './useChartSync';
import { ChartDrawingManager } from '@/lib/chart/drawing-primitives';
import { DrawingRenderer, isDrawingRendererEnabled } from '@/lib/chart/drawing-renderer';
import { PatternRendererAdapter, createPatternRendererWithAutoSelection } from '@/lib/chart/PatternRendererAdapter';

export interface ChartTheme {
  background: string;
  textColor: string;
  gridColor: string;
  crosshairColor: string;
  borderColor: string;
}

export interface ChartSeriesRefs {
  candlestick: ISeriesApi<'Candlestick'> | null;
  movingAverages: Record<number, ISeriesApi<'Line'>>;
  bollingerBands: {
    upper: ISeriesApi<'Line'> | null;
    middle: ISeriesApi<'Line'> | null;
    lower: ISeriesApi<'Line'> | null;
  };
}

interface UseChartInstanceProps {
  height?: number;
  theme?: ChartTheme;
  indicators: IndicatorOptions;
}

const DEFAULT_THEME: ChartTheme = {
  background: '#050f13',
  textColor: '#C8D6E5', 
  gridColor: '#0e1a24',
  crosshairColor: '#8fa0aa',
  borderColor: '#0e1a24',
};

export function useChartInstance({ 
  height, 
  theme = DEFAULT_THEME, 
  indicators 
}: UseChartInstanceProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const drawingManagerRef = useRef<ChartDrawingManager | null>(null);
  const [drawingManager, setDrawingManager] = useState<ChartDrawingManager | null>(null);
  const drawingRendererRef = useRef<DrawingRenderer | null>(null);
  const patternRendererRef = useRef<PatternRendererAdapter | null>(null);
  
  const seriesRefs = useRef<ChartSeriesRefs>({
    candlestick: null,
    movingAverages: {},
    bollingerBands: {
      upper: null,
      middle: null,
      lower: null,
    },
  });

  // Chart sync functionality
  const { registerChart, unregisterChart } = useChartSync('main-chart', true);

  const createChartInstance = useCallback(() => {
    if (!chartContainerRef.current) return null;

    const containerHeight = height || chartContainerRef.current.clientHeight || 500;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.textColor,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', 'Trebuchet MS', sans-serif",
      },
      grid: {
        vertLines: { color: theme.gridColor, visible: true },
        horzLines: { color: theme.gridColor, visible: true },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.crosshairColor, labelVisible: true },
        horzLine: { color: theme.crosshairColor, labelVisible: true },
      },
      rightPriceScale: {
        borderColor: theme.borderColor,
      },
      timeScale: {
        borderColor: theme.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: containerHeight,
    });

    chartInstanceRef.current = chart;
    
    // Register with sync manager
    registerChart(chart);
    
    return chart;
  }, [height, theme]);

  const createCandlestickSeries = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return null;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ddfba',
      downColor: '#ff4d4d',
      borderDownColor: '#ff4d4d',
      borderUpColor: '#0ddfba',
      wickDownColor: '#ff4d4d',
      wickUpColor: '#0ddfba',
    });

    seriesRefs.current.candlestick = candlestickSeries;
    
    // Initialize drawing manager when we have both chart and main series
    if (chart && candlestickSeries && !drawingManagerRef.current) {
      const manager = new ChartDrawingManager(chart, candlestickSeries);
      drawingManagerRef.current = manager;
      setDrawingManager(manager);
    }
    
    // Initialize drawing renderer if feature flag is enabled
    if (chart && candlestickSeries && isDrawingRendererEnabled() && !drawingRendererRef.current) {
      console.log('[ChartInstance] Initializing DrawingRenderer - feature flag enabled');
      drawingRendererRef.current = new DrawingRenderer(chart, candlestickSeries);
      console.log('[ChartInstance] DrawingRenderer initialized:', !!drawingRendererRef.current);
    } else {
      console.log('[ChartInstance] DrawingRenderer check:', {
        chart: !!chart,
        featureEnabled: isDrawingRendererEnabled(),
        alreadyExists: !!drawingRendererRef.current
      });
    }
    
    // Initialize pattern renderer adapter (ensure it's only created once)
    if (chart && candlestickSeries && !patternRendererRef.current) {
      console.log('[ChartInstance] Initializing PatternRendererAdapter');
      patternRendererRef.current = createPatternRendererWithAutoSelection(chart, candlestickSeries);
      
      // Store reference globally for debugging
      if (typeof window !== 'undefined') {
        interface WindowWithPatternRenderer extends Window {
          __chartPatternRenderer?: PatternRendererAdapter;
        }
        (window as WindowWithPatternRenderer).__chartPatternRenderer = patternRendererRef.current;
      }
    }
    
    return candlestickSeries;
  }, []);

  const createMovingAverageSeries = useCallback((period: number, color: string, title: string) => {
    const chart = chartInstanceRef.current;
    if (!chart) return null;

    const maSeries = chart.addLineSeries({
      color,
      lineWidth: 2,
      title,
    });

    seriesRefs.current.movingAverages[period] = maSeries;
    return maSeries;
  }, []);

  const createBollingerBandsSeries = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return null;

    const upperSeries = chart.addLineSeries({
      color: '#2962ff',
      lineWidth: 1,
      title: 'BB Upper',
      lineStyle: 2, // Dashed line
    });

    const middleSeries = chart.addLineSeries({
      color: '#ff9800',
      lineWidth: 1,
      title: 'BB Middle',
    });

    const lowerSeries = chart.addLineSeries({
      color: '#2962ff',
      lineWidth: 1,
      title: 'BB Lower',
      lineStyle: 2, // Dashed line
    });

    seriesRefs.current.bollingerBands = {
      upper: upperSeries,
      middle: middleSeries,
      lower: lowerSeries,
    };

    return { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
  }, []);

  // Separate indicator management from chart creation
  const addIndicatorSeries = useCallback((type: keyof IndicatorOptions, enabled: boolean) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    if (type === 'ma') {
      if (enabled && Object.keys(seriesRefs.current.movingAverages).length === 0) {
        const maConfigs = [
          { period: 7, color: '#ffcc33', title: 'MA(7)' },
          { period: 25, color: '#ff4d8c', title: 'MA(25)' },
          { period: 99, color: '#5db3ff', title: 'MA(99)' },
        ];

        maConfigs.forEach(({ period, color, title }) => {
          createMovingAverageSeries(period, color, title);
        });
      } else if (!enabled) {
        // Remove MA series
        Object.values(seriesRefs.current.movingAverages).forEach(series => {
          if (series) chart.removeSeries(series);
        });
        seriesRefs.current.movingAverages = {};
      }
    }

    if (type === 'boll') {
      if (enabled && !seriesRefs.current.bollingerBands.upper) {
        createBollingerBandsSeries();
      } else if (!enabled) {
        // Remove Bollinger Bands series
        const { upper, middle, lower } = seriesRefs.current.bollingerBands;
        if (upper) chart.removeSeries(upper);
        if (middle) chart.removeSeries(middle);
        if (lower) chart.removeSeries(lower);
        seriesRefs.current.bollingerBands = {
          upper: null,
          middle: null,
          lower: null,
        };
      }
    }
  }, [createMovingAverageSeries, createBollingerBandsSeries]);

  // setupInitialIndicators removed - indicators are now managed in CandlestickChart.tsx

  const handleResize = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !chartContainerRef.current) return;

    const newHeight = height || chartContainerRef.current.clientHeight || 500;
    chart.applyOptions({ 
      width: chartContainerRef.current.clientWidth,
      height: newHeight
    });
  }, [height]);

  const initializeChart = useCallback(() => {
    const chart = createChartInstance();
    if (!chart) return;

    createCandlestickSeries();
    // Don't setup indicators here - they will be managed separately

    // Setup resize observer for responsive chart sizing
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      unregisterChart(); // Unregister from sync manager
      
      // Clean up drawing manager
      if (drawingManagerRef.current) {
        drawingManagerRef.current.clearAll();
        drawingManagerRef.current = null;
        setDrawingManager(null);
      }
      
      // Clean up drawing renderer
      if (drawingRendererRef.current) {
        drawingRendererRef.current.cleanup();
        drawingRendererRef.current = null;
      }
      
      // Clean up pattern renderer adapter
      if (patternRendererRef.current) {
        patternRendererRef.current.dispose();
        patternRendererRef.current = null;
      }
      
      chart.remove();
      chartInstanceRef.current = null;
      seriesRefs.current = {
        candlestick: null,
        movingAverages: {},
        bollingerBands: {
          upper: null,
          middle: null,
          lower: null,
        },
      };
    };
  }, [createChartInstance, createCandlestickSeries, handleResize]);

  const fitContent = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (chart) {
      chart.timeScale().fitContent();
    }
  }, []);

  const getSeries = useCallback(() => seriesRefs.current, []);
  
  const getPatternRenderer = useCallback(() => patternRendererRef.current, []);

  return {
    chartContainerRef,
    chartInstance: chartInstanceRef.current,
    drawingManager,
    patternRenderer: patternRendererRef.current,
    initializeChart,
    addIndicatorSeries,
    getSeries,
    getPatternRenderer,
    fitContent,
    handleResize,
  };
}