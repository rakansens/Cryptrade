import { useEffect, useCallback } from 'react';
import type { ProcessedKline } from '@/types/market';
import { prepareLightweightChartsData } from '@/lib/utils/chart-data';
import { logger } from '@/lib/utils/logger';
import type { IndicatorSeriesRefs } from './useIndicatorChartInit';
import type {
  PriceDataPoint,
  IndicatorDataPoint,
  MACDDataPoint,
  RSIDataPoint,
  IndicatorCalculator,
  SeriesDataFormatter
} from '@/types/indicator.types';

interface UseIndicatorChartDataProps {
  chartId: string;
  priceData: ProcessedKline[];
  seriesRefs: IndicatorSeriesRefs;
  isInitialized: boolean;
  calculateIndicator: IndicatorCalculator<PriceDataPoint, unknown>;
  formatSeriesData: SeriesDataFormatter<unknown, Record<string, IndicatorDataPoint[]>>;
}

export function useIndicatorChartData({
  chartId,
  priceData,
  seriesRefs,
  isInitialized,
  calculateIndicator,
  formatSeriesData,
}: UseIndicatorChartDataProps) {

  // Memoized data preparation
  const prepareChartData = useCallback(() => {
    if (priceData.length === 0) return null;

    try {
      // Prepare price data for indicator calculation
      const rawPriceData = priceData.map(candle => ({
        time: candle.time,
        close: candle.close,
        high: candle.high,
        low: candle.low,
        volume: candle.volume,
      }));

      const cleanedPriceData = prepareLightweightChartsData(rawPriceData);
      
      // Calculate indicator
      const indicatorData = calculateIndicator(cleanedPriceData);
      
      if (indicatorData.length === 0) return null;

      // Format for chart series
      return formatSeriesData(indicatorData);
    } catch (error) {
      logger.error(`[${chartId}] Data preparation failed`, error);
      return null;
    }
  }, [chartId, priceData, calculateIndicator, formatSeriesData]);

  // Fast data update using setData() only
  const updateChartData = useCallback(() => {
    if (!isInitialized || priceData.length === 0) return;

    const formattedData = prepareChartData();
    if (!formattedData) return;

    try {
      // Update all series with new data (fast path)
      Object.entries(formattedData).forEach(([seriesKey, data]) => {
        const series = seriesRefs[seriesKey];
        if (series && Array.isArray(data) && data.length > 0) {
          series.setData(data);
        }
      });

      logger.debug(`[${chartId}] Data updated`, { 
        seriesCount: Object.keys(formattedData).length,
        dataLength: priceData.length 
      });
    } catch (error) {
      logger.error(`[${chartId}] Data update failed`, error);
    }
  }, [chartId, isInitialized, priceData, seriesRefs, prepareChartData]);

  // Update data when price data changes
  useEffect(() => {
    if (isInitialized && priceData.length > 0) {
      // Small delay to ensure chart is fully ready
      const timeoutId = setTimeout(updateChartData, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [updateChartData, isInitialized, priceData]);

  return {
    updateChartData,
    hasData: priceData.length > 0,
  };
}

// MACD-specific helper
export function useMacdChartData({
  chartId,
  priceData,
  seriesRefs,
  isInitialized,
  calculateMACD,
  getMACDColor,
}: {
  chartId: string;
  priceData: ProcessedKline[];
  seriesRefs: IndicatorSeriesRefs;
  isInitialized: boolean;
  calculateMACD: (data: PriceDataPoint[], short: number, long: number, signal: number) => MACDDataPoint[];
  getMACDColor: (value: number) => string;
}) {
  return useIndicatorChartData({
    chartId,
    priceData,
    seriesRefs,
    isInitialized,
    calculateIndicator: (cleanedData) => calculateMACD(cleanedData, 12, 26, 9),
    formatSeriesData: (macdData) => {
      const macdSeries = prepareLightweightChartsData(macdData.map(d => ({
        time: d.time,
        value: d.macd,
      })));

      const signalSeries = prepareLightweightChartsData(macdData.map(d => ({
        time: d.time,
        value: d.signal,
      })));

      const zeroSeries = macdSeries.map((d: IndicatorDataPoint) => ({
        time: d.time,
        value: 0,
      }));

      const histogramSeries = prepareLightweightChartsData(macdData.map(d => ({
        time: d.time,
        value: d.histogram,
        color: getMACDColor(d.histogram),
      })));

      return {
        macd: macdSeries,
        signal: signalSeries,
        zero: zeroSeries,
        histogram: histogramSeries,
      };
    },
  });
}

// RSI-specific helper
export function useRsiChartData({
  chartId,
  priceData,
  seriesRefs,
  isInitialized,
  calculateRSI,
}: {
  chartId: string;
  priceData: ProcessedKline[];
  seriesRefs: IndicatorSeriesRefs;
  isInitialized: boolean;
  calculateRSI: (data: PriceDataPoint[], period: number) => RSIDataPoint[];
}) {
  return useIndicatorChartData({
    chartId,
    priceData,
    seriesRefs,
    isInitialized,
    calculateIndicator: (cleanedData) => calculateRSI(cleanedData, 14),
    formatSeriesData: (rsiData) => {
      const rsiSeries = prepareLightweightChartsData(rsiData.map(d => ({
        time: d.time,
        value: d.rsi,
      })));

      const overboughtSeries = rsiSeries.map((d: IndicatorDataPoint) => ({
        time: d.time,
        value: 70,
      }));

      const oversoldSeries = rsiSeries.map((d: IndicatorDataPoint) => ({
        time: d.time,
        value: 30,
      }));

      return {
        rsi: rsiSeries,
        overbought: overboughtSeries,
        oversold: oversoldSeries,
      };
    },
  });
}