import { useEffect, useMemo, useCallback } from 'react';
import type { UTCTimestamp } from 'lightweight-charts';
import type { ProcessedKline, IndicatorOptions } from '@/types/market';
import { prepareLightweightChartsData } from '@/lib/utils/chart-data';
import { calculateMultipleMovingAverages, getMovingAverageConfigs } from '@/lib/indicators/moving-average';
import { calculateBollingerBands, getBollingerBandsConfig } from '@/lib/indicators/bollinger-bands';
import type { ChartSeriesRefs } from './useChartInstance';
import { useChartDataBase } from '@/hooks/shared/useChartDataBase';

export interface UseChartDataProps {
  priceData: ProcessedKline[];
  indicators: IndicatorOptions;
  bollingerSettings?: { period: number; stdDev: number };
  getSeries: () => ChartSeriesRefs;
  fitContent: () => void;
  autoFit?: boolean;
}

export function useChartData({ 
  priceData, 
  bollingerSettings = { period: 20, stdDev: 2 },
  getSeries, 
  fitContent,
  autoFit = true
}: UseChartDataProps) {
  
  // 共通基盤初期化
  const chartDataBase = useChartDataBase<ProcessedKline[]>({
    hookName: 'useChartData',
    enableAutoCleanup: true,
    logLevel: 'info'
  });
  
  // Prepare candlestick data
  const formattedData = useMemo(() => {
    if (priceData.length === 0) return [];

    const rawFormattedData = priceData.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const prepared = prepareLightweightChartsData(rawFormattedData);
    return chartDataBase.formatChartData(prepared).map(d => ({
      ...d,
      time: d.time as UTCTimestamp
    }));
  }, [priceData, chartDataBase.formatChartData]);

  // Calculate moving averages
  const movingAverageData = useMemo(() => {
    if (formattedData.length === 0) return {};

    const maConfigs = getMovingAverageConfigs([7, 25, 99]);
    const periods = maConfigs.map(config => config.period);
    
    return calculateMultipleMovingAverages(formattedData, periods, 'SMA');
  }, [formattedData]);

  // Calculate Bollinger Bands
  const bollingerBandsData = useMemo(() => {
    if (formattedData.length === 0) return null;

    const bollingerData = calculateBollingerBands(
      formattedData, 
      bollingerSettings.period, 
      bollingerSettings.stdDev
    );

    return {
      data: bollingerData,
      config: getBollingerBandsConfig(bollingerSettings),
    };
  }, [formattedData, bollingerSettings]);

  // Update only candlestick data - indicators are managed separately
  useEffect(() => {
    if (formattedData.length === 0 || !chartDataBase.isMounted()) return;

    const hasDataChanged = chartDataBase.detectDataChange(formattedData, (data) => data.length);
    if (!hasDataChanged) return;

    chartDataBase.executeSafely(
      'Update candlestick data',
      async () => {
        const series = getSeries();
        
        // Update only candlestick data
        if (series.candlestick) {
          series.candlestick.setData(formattedData);
        }

        // Auto-fit on initial load only
        const shouldAutoFit = autoFit && !chartDataBase.hasAutoProcessed();
        if (shouldAutoFit) {
          setTimeout(() => fitContent(), 100);
          chartDataBase.setAutoProcessed();
        }
      },
      {
        data: { 
          dataLength: formattedData.length,
          hasCandelstickSeries: !!getSeries().candlestick,
          dataSample: formattedData.slice(-5)
        }
      }
    );
  }, [formattedData, getSeries, fitContent, autoFit, chartDataBase]);

  // Separate effect for updating existing indicator series with new data
  useEffect(() => {
    if (formattedData.length === 0 || !chartDataBase.isMounted()) return;
    
    chartDataBase.executeSafely(
      'Update indicator data',
      async () => {
        const series = getSeries();
        
        // Update existing MA series (only if they exist)
        Object.entries(movingAverageData).forEach(([period, data]) => {
          const periodNum = parseInt(period);
          const maSeries = series.movingAverages[periodNum];
          if (maSeries && data.length > 0) {
            maSeries.setData(data);
          }
        });

        // Update existing Bollinger Bands series (only if they exist)
        if (bollingerBandsData && series.bollingerBands.upper) {
          const { data } = bollingerBandsData;

          if (data.length > 0) {
            const upperBandData = data.map(point => ({
              time: point.time,
              value: point.upper,
            }));

            const middleBandData = data.map(point => ({
              time: point.time,
              value: point.middle,
            }));

            const lowerBandData = data.map(point => ({
              time: point.time,
              value: point.lower,
            }));

            if (series.bollingerBands.upper) {
              series.bollingerBands.upper.setData(upperBandData);
            }
            if (series.bollingerBands.middle) {
              series.bollingerBands.middle.setData(middleBandData);
            }
            if (series.bollingerBands.lower) {
              series.bollingerBands.lower.setData(lowerBandData);
            }
          }
        }
      },
      {
        data: {
          hasMAData: Object.keys(movingAverageData).length > 0,
          hasBBData: !!bollingerBandsData,
          dataLength: formattedData.length
        }
      }
    );
  }, [movingAverageData, bollingerBandsData, getSeries, formattedData.length, chartDataBase]);

  // Function to update specific indicator data when newly enabled
  const updateIndicatorData = useCallback((indicatorType: keyof IndicatorOptions) => {
    const series = getSeries();
    
    if (indicatorType === 'ma' && Object.keys(movingAverageData).length > 0) {
      Object.entries(movingAverageData).forEach(([period, data]) => {
        const periodNum = parseInt(period);
        const maSeries = series.movingAverages[periodNum];
        if (maSeries && data.length > 0) {
          maSeries.setData(data);
        }
      });
    }
    
    if (indicatorType === 'boll' && bollingerBandsData && series.bollingerBands.upper) {
      const { data } = bollingerBandsData;
      
      if (data.length > 0) {
        const upperBandData = data.map(point => ({
          time: point.time,
          value: point.upper,
        }));
        
        const middleBandData = data.map(point => ({
          time: point.time,
          value: point.middle,
        }));
        
        const lowerBandData = data.map(point => ({
          time: point.time,
          value: point.lower,
        }));
        
        if (series.bollingerBands.upper) {
          series.bollingerBands.upper.setData(upperBandData);
        }
        if (series.bollingerBands.middle) {
          series.bollingerBands.middle.setData(middleBandData);
        }
        if (series.bollingerBands.lower) {
          series.bollingerBands.lower.setData(lowerBandData);
        }
      }
    }
  }, [movingAverageData, bollingerBandsData, getSeries]);

  return {
    formattedData,
    movingAverageData,
    bollingerBandsData,
    hasData: formattedData.length > 0,
    updateIndicatorData,
  };
}