import { useRef, useCallback, useState } from 'react';
import { createChart, IChartApi, ColorType, LineStyle, ISeriesApi } from 'lightweight-charts';
import { useChartSync } from './useChartSync';
import { logger } from '@/lib/utils/logger';

export interface IndicatorChartTheme {
  background: string;
  textColor: string;
  gridColor: string;
  borderColor: string;
}

export interface IndicatorSeriesRefs {
  [key: string]: ISeriesApi<'Line' | 'Histogram'> | null;
}

interface UseIndicatorChartInitProps {
  chartId: string;
  height?: number;
  theme?: IndicatorChartTheme;
  showTimeScale?: boolean;
}

const DEFAULT_THEME: IndicatorChartTheme = {
  background: '#050f13',
  textColor: '#C8D6E5',
  gridColor: '#0e1a24',
  borderColor: '#0e1a24',
};

export function useIndicatorChartInit({
  chartId,
  height,
  theme = DEFAULT_THEME,
  showTimeScale = false,
}: UseIndicatorChartInitProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<IndicatorSeriesRefs>({});
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { registerChart, unregisterChart } = useChartSync(chartId, false); // false = not main chart

  // Initialize chart instance (only called when symbol changes)
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current || chartInstanceRef.current) {
      return null;
    }

    const containerHeight = height || chartContainerRef.current.clientHeight || 150;

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: theme.background },
          textColor: theme.textColor,
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', 'Trebuchet MS', sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: theme.gridColor, visible: true },
          horzLines: { color: theme.gridColor, visible: true },
        },
        rightPriceScale: {
          borderColor: theme.borderColor,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: theme.borderColor,
          timeVisible: showTimeScale,
          visible: showTimeScale,
        },
        width: chartContainerRef.current.clientWidth,
        height: containerHeight,
      });

      chartInstanceRef.current = chart;
      
      // Register with chart sync system
      registerChart(chart);

      setIsInitialized(true);
      
      logger.info(`[${chartId}] Chart initialized`, { 
        width: chartContainerRef.current.clientWidth,
        height: containerHeight 
      });

      return chart;
    } catch (error) {
      logger.error(`[${chartId}] Chart initialization failed`, error);
      return null;
    }
  }, [chartId, height, theme, showTimeScale, registerChart]);

  // Add series helper
  const addLineSeries = useCallback((
    seriesKey: string, 
    options: Parameters<IChartApi['addLineSeries']>[0]
  ) => {
    const chart = chartInstanceRef.current;
    if (!chart) return null;

    try {
      const series = chart.addLineSeries(options);
      seriesRefs.current[seriesKey] = series;
      
      logger.debug(`[${chartId}] Line series added`, { seriesKey, color: options?.color });
      return series;
    } catch (error) {
      logger.error(`[${chartId}] Failed to add line series`, { seriesKey }, error);
      return null;
    }
  }, [chartId]);

  // Add histogram series helper
  const addHistogramSeries = useCallback((
    seriesKey: string,
    options: Parameters<IChartApi['addHistogramSeries']>[0]
  ) => {
    const chart = chartInstanceRef.current;
    if (!chart) return null;

    try {
      const series = chart.addHistogramSeries(options);
      seriesRefs.current[seriesKey] = series;
      
      logger.debug(`[${chartId}] Histogram series added`, { seriesKey });
      return series;
    } catch (error) {
      logger.error(`[${chartId}] Failed to add histogram series`, { seriesKey }, error);
      return null;
    }
  }, [chartId]);

  // Resize handler
  const handleResize = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !chartContainerRef.current) return;

    const newHeight = height || chartContainerRef.current.clientHeight || 150;
    chart.applyOptions({ 
      width: chartContainerRef.current.clientWidth,
      height: newHeight
    });
  }, [height]);

  // Cleanup function
  const cleanupChart = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    try {
      unregisterChart();
      chart.remove();
      
      chartInstanceRef.current = null;
      seriesRefs.current = {};
      setIsInitialized(false);
      
      logger.info(`[${chartId}] Chart cleaned up`);
    } catch (error) {
      logger.error(`[${chartId}] Chart cleanup failed`, error);
    }
  }, [chartId, unregisterChart]);

  // Setup resize observer
  const setupResizeObserver = useCallback(() => {
    if (!chartContainerRef.current) return () => {};

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  return {
    chartContainerRef,
    chartInstance: chartInstanceRef.current,
    seriesRefs: seriesRefs.current,
    isInitialized,
    initializeChart,
    addLineSeries,
    addHistogramSeries,
    handleResize,
    setupResizeObserver,
    cleanupChart,
  };
}