import { useMemo } from 'react';
import { useCandlestickData } from './use-candlestick-data';
import { calculateSMA } from '@/lib/indicators/moving-average';
import { calculateRSI } from '@/lib/indicators/rsi';
import { calculateMACD } from '@/lib/indicators/macd';
import type { UTCTimestamp } from 'lightweight-charts';

interface IndicatorValues {
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
}

export function useIndicatorValues(symbol: string, timeframe: string): IndicatorValues {
  const { priceData } = useCandlestickData({ symbol, interval: timeframe });

  const indicatorValues = useMemo<IndicatorValues>(() => {
    if (!priceData || priceData.length === 0) {
      return {
        ma7: null,
        ma25: null,
        ma99: null,
        rsi: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
      };
    }

    // Convert data for calculations
    const chartData = priceData.map(candle => ({
      time: candle.time as UTCTimestamp,
      close: candle.close,
    }));

    // Calculate Moving Averages - get the last value
    const ma7Data = calculateSMA(chartData, 7);
    const ma25Data = calculateSMA(chartData, 25);
    const ma99Data = calculateSMA(chartData, 99);

    // Calculate RSI - get the last value
    const rsiData = calculateRSI(priceData, 14);
    
    // Calculate MACD - get the last value
    const macdData = calculateMACD(priceData, 12, 26, 9);

    return {
      ma7: ma7Data.length > 0 ? ma7Data[ma7Data.length - 1].value : null,
      ma25: ma25Data.length > 0 ? ma25Data[ma25Data.length - 1].value : null,
      ma99: ma99Data.length > 0 ? ma99Data[ma99Data.length - 1].value : null,
      rsi: rsiData.length > 0 ? rsiData[rsiData.length - 1].rsi : null,
      macd: macdData.length > 0 ? macdData[macdData.length - 1].macd : null,
      macdSignal: macdData.length > 0 ? macdData[macdData.length - 1].signal : null,
      macdHistogram: macdData.length > 0 ? macdData[macdData.length - 1].histogram : null,
    };
  }, [priceData]);

  return indicatorValues;
}