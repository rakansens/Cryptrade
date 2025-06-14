import { useRef, useCallback, useEffect } from 'react';
import type { IChartApi, Time } from 'lightweight-charts';
import { logger } from '@/lib/utils/logger';

interface ChartSyncManager {
  registerChart: (id: string, chart: IChartApi, isMain?: boolean) => void;
  unregisterChart: (id: string) => void;
  syncTimeScale: (fromChartId: string, timeRange?: { from: Time; to: Time }) => void;
  syncCrosshair: (fromChartId: string, point?: { time: Time; price?: number }) => void;
}

// Global chart sync manager
class GlobalChartSyncManager implements ChartSyncManager {
  private charts = new Map<string, { chart: IChartApi; isMain: boolean }>();
  private isUpdating = false;

  registerChart(id: string, chart: IChartApi, isMain: boolean = false) {
    this.charts.set(id, { chart, isMain });
    
    // Only subscribe for main chart to control sync direction
    if (isMain) {
      // Subscribe to time scale changes from main chart only
      chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
        if (!this.isUpdating && timeRange) {
          this.syncTimeScale(id, timeRange);
        }
      });

      // Subscribe to crosshair moves from main chart only
      chart.subscribeCrosshairMove((param) => {
        if (!this.isUpdating && param.time) {
          this.syncCrosshair(id, { 
            time: param.time,
            price: param.point?.y 
          });
        }
      });
    }

    logger.debug('[ChartSync] Chart registered', { id, isMain });
  }

  unregisterChart(id: string) {
    this.charts.delete(id);
    logger.debug('[ChartSync] Chart unregistered', { id });
  }

  syncTimeScale(fromChartId: string, timeRange?: { from: Time; to: Time }) {
    if (!timeRange || this.isUpdating) return;

    // Only sync if the call is from main chart
    const fromChart = this.charts.get(fromChartId);
    if (!fromChart?.isMain) return;

    this.isUpdating = true;
    
    this.charts.forEach(({ chart }, id) => {
      if (id !== fromChartId) {
        try {
          chart.timeScale().setVisibleRange(timeRange);
        } catch (error) {
          logger.warn('[ChartSync] Failed to sync time scale', { fromChartId, toChartId: id }, error);
        }
      }
    });

    this.isUpdating = false;
  }

  syncCrosshair(fromChartId: string, point?: { time: Time; price?: number }) {
    if (!point || this.isUpdating) return;

    // Only sync if the call is from main chart
    const fromChart = this.charts.get(fromChartId);
    if (!fromChart?.isMain) return;

    this.isUpdating = true;

    this.charts.forEach(({ chart }, id) => {
      if (id !== fromChartId) {
        try {
          // Move crosshair to the same time point
          // Note: setCrosshairPosition may not be available in all versions, 
          // so we'll focus on time scale synchronization for now
          // chart.setCrosshairPosition(point.price || 0, point.time);
        } catch (error) {
          logger.warn('[ChartSync] Failed to sync crosshair', { fromChartId, toChartId: id }, error);
        }
      }
    });

    this.isUpdating = false;
  }

  // Method to fit all charts to content - DISABLED to prevent unwanted resets
  fitAllCharts() {
    // Disabled to preserve user chart positioning
    logger.debug('[ChartSync] fitAllCharts called but disabled to preserve user position');
    // this.charts.forEach(({ chart }, id) => {
    //   try {
    //     chart.timeScale().fitContent();
    //   } catch (error) {
    //     logger.warn('[ChartSync] Failed to fit chart content', { id }, error);
    //   }
    // });
  }

  // Method to get main chart
  getMainChart(): IChartApi | null {
    for (const [, { chart, isMain }] of this.charts) {
      if (isMain) return chart;
    }
    return null;
  }
}

// Global singleton instance
const globalChartSync = new GlobalChartSyncManager();

export function useChartSync(chartId: string, isMainChart: boolean = false) {
  const chartRef = useRef<IChartApi | null>(null);
  const isRegistered = useRef(false);

  const registerChart = useCallback((chart: IChartApi) => {
    if (!isRegistered.current) {
      chartRef.current = chart;
      globalChartSync.registerChart(chartId, chart, isMainChart);
      isRegistered.current = true;
    }
  }, [chartId, isMainChart]);

  const unregisterChart = useCallback(() => {
    if (isRegistered.current) {
      globalChartSync.unregisterChart(chartId);
      chartRef.current = null;
      isRegistered.current = false;
    }
  }, [chartId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterChart();
    };
  }, [unregisterChart]);

  // Sync methods
  const syncTimeScale = useCallback((timeRange?: { from: Time; to: Time }) => {
    if (timeRange) {
      globalChartSync.syncTimeScale(chartId, timeRange);
    }
  }, [chartId]);

  const syncCrosshair = useCallback((point?: { time: Time; price?: number }) => {
    if (point) {
      globalChartSync.syncCrosshair(chartId, point);
    }
  }, [chartId]);

  const fitAllCharts = useCallback(() => {
    globalChartSync.fitAllCharts();
  }, []);

  const getMainChart = useCallback(() => {
    return globalChartSync.getMainChart();
  }, []);

  return {
    registerChart,
    unregisterChart,
    syncTimeScale,
    syncCrosshair,
    fitAllCharts,
    getMainChart,
    isMainChart,
  };
}

// Export the global manager for advanced usage
export { globalChartSync };