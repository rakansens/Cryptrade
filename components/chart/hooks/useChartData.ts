import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { UTCTimestamp } from 'lightweight-charts';
import type { ProcessedKline, IndicatorOptions } from '@/types/market';
import { prepareLightweightChartsData } from '@/lib/utils/chart-data';
import { calculateMultipleMovingAverages, getMovingAverageConfigs } from '@/lib/indicators/moving-average';
import { calculateBollingerBands, getBollingerBandsConfig } from '@/lib/indicators/bollinger-bands';
import type { ChartSeriesRefs } from './useChartInstance';

interface UseChartDataProps {
  priceData: ProcessedKline[];
  indicators: IndicatorOptions;
  bollingerSettings?: { period: number; stdDev: number };
  getSeries: () => ChartSeriesRefs;
  fitContent: () => void;
  autoFit?: boolean;
}

export function useChartData({ 
  priceData, 
  indicators, 
  bollingerSettings = { period: 20, stdDev: 2 },
  getSeries, 
  fitContent,
  autoFit = true
}: UseChartDataProps) {
  
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

    return prepareLightweightChartsData(rawFormattedData).map(d => ({
      ...d,
      time: d.time as UTCTimestamp
    }));
  }, [priceData]);

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

  // Track previous data length to detect major updates vs incremental updates
  const prevDataLength = useRef(0);
  const isInitialUpdate = useRef(true);
  const hasAutoFitted = useRef(false);
  const lastSymbol = useRef('');

  // Update only candlestick data - indicators are managed separately
  useEffect(() => {
    if (formattedData.length === 0) return;

    const series = getSeries();
    const currentDataLength = formattedData.length;
    const currentSymbol = '';
    const isSymbolChange = false;
    const isDataSizeChange = Math.abs(currentDataLength - prevDataLength.current) > 10;
    
    // Only auto-fit on symbol change or initial load, not on timeframe changes
    const shouldAutoFit = autoFit && (isSymbolChange || (!hasAutoFitted.current && isInitialUpdate.current));
    
    try {
      // Update only candlestick data
      if (series.candlestick) {
        series.candlestick.setData(formattedData);
      }

      // Auto-fit only on initial load or symbol changes, not on timeframe changes
      if (shouldAutoFit) {
        setTimeout(() => fitContent(), 100);
        hasAutoFitted.current = true;
      }

      prevDataLength.current = formattedData.length;
      lastSymbol.current = currentSymbol;
      isInitialUpdate.current = false;

    } catch (error) {
      console.error('[ChartData] Error setting chart data:', error);
      console.log('[ChartData] Data sample:', formattedData.slice(-5));
    }
  }, [formattedData, getSeries, fitContent, autoFit]);

  // Separate effect for updating existing indicator series with new data
  useEffect(() => {
    if (formattedData.length === 0) return;
    
    const series = getSeries();
    
    try {
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
    } catch (error) {
      console.error('[ChartData] Error setting indicator data:', error);
    }
  }, [movingAverageData, bollingerBandsData, getSeries]);

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