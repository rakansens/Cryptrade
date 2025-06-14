'use client'

import { useEffect } from 'react'
import { LineStyle } from 'lightweight-charts'
import { calculateMACD, getMACDColor } from '@/lib/indicators/macd'
import { usePriceData } from '@/store/market.store'
import { useChart } from '@/store/chart.store'
import { useIndicatorChartInit } from '../hooks/useIndicatorChartInit'
import { useMacdChartData } from '../hooks/useIndicatorChartData'

interface MacdChartProps {
  height?: number
}

export default function MacdChart({ height }: MacdChartProps) {
  const { symbol } = useChart()
  const priceData = usePriceData(symbol)
  
  // Initialize chart only when symbol changes
  const {
    chartContainerRef,
    chartInstance,
    seriesRefs,
    isInitialized,
    initializeChart,
    addLineSeries,
    addHistogramSeries,
    setupResizeObserver,
    cleanupChart,
  } = useIndicatorChartInit({
    chartId: 'macd-chart',
    height,
    showTimeScale: false,
  })
  
  // Fast data updates using setData()
  const { updateChartData, hasData } = useMacdChartData({
    chartId: 'macd-chart',
    priceData,
    seriesRefs,
    isInitialized,
    calculateMACD,
    getMACDColor,
  })

  // Initialize chart when symbol changes AND when we have sufficient data
  useEffect(() => {
    // Only initialize if we have enough data for MACD calculation (need at least 35 candles for MACD(12,26,9))
    const minDataRequired = 35;
    if (priceData.length < minDataRequired) {
      return;
    }

    if (chartInstance) {
      cleanupChart()
    }
    
    const chart = initializeChart()
    if (!chart) return;

    // Setup series for MACD chart
    addLineSeries('macd', {
      color: '#2962ff',
      lineWidth: 2,
      title: 'MACD',
    })

    addLineSeries('signal', {
      color: '#ff6d00',
      lineWidth: 2,
      title: 'Signal',
    })

    addLineSeries('zero', {
      color: '#555555',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Zero',
    })

    addHistogramSeries('histogram', {
      color: '#0ddfba',
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    })

    // Setup resize observer
    const cleanupResize = setupResizeObserver()

    return () => {
      cleanupResize()
      cleanupChart()
    }
  }, [symbol, priceData.length]) // Re-initialize when symbol changes OR when we get sufficient data

  // Loading state
  const minDataRequired = 35;
  const isLoading = priceData.length < minDataRequired;
  
  
  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#050f13] flex items-center justify-center">
        <div className="text-[#C8D6E5] text-sm">
          Loading MACD data... ({priceData.length}/{minDataRequired})
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#050f13]">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
      />
    </div>
  )
}