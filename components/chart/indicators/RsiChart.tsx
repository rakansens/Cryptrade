'use client'

import { useEffect } from 'react'
import { LineStyle } from 'lightweight-charts'
import { calculateRSI } from '@/lib/indicators/rsi'
import { usePriceData } from '@/store/market.store'
import { useChart } from '@/store/chart.store'
import { useIndicatorChartInit } from '../hooks/useIndicatorChartInit'
import { useRsiChartData } from '../hooks/useIndicatorChartData'

interface RsiChartProps {
  height?: number
}

export default function RsiChart({ height }: RsiChartProps) {
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
    setupResizeObserver,
    cleanupChart,
  } = useIndicatorChartInit({
    chartId: 'rsi-chart',
    height,
    showTimeScale: false,
  })
  
  // Fast data updates using setData()
  const { updateChartData, hasData } = useRsiChartData({
    chartId: 'rsi-chart',
    priceData,
    seriesRefs,
    isInitialized,
    calculateRSI,
  })

  // Ensure RSI data updates whenever new price data arrives
  useEffect(() => {
    if (isInitialized && hasData) {
      updateChartData()
    }
  }, [priceData, isInitialized, hasData, updateChartData])


  // Initialize chart when symbol changes AND when we have sufficient data
  useEffect(() => {
    // Only initialize if we have enough data for RSI calculation (need at least 15 candles for RSI(14))
    const minDataRequired = 15;
    if (priceData.length < minDataRequired) {
      return;
    }

    if (chartInstance) {
      cleanupChart()
    }
    
    const chart = initializeChart()
    if (!chart) return;

    // Setup series for RSI chart
    addLineSeries('rsi', {
      color: '#7b61ff',
      lineWidth: 2,
      title: 'RSI(14)',
    })

    addLineSeries('overbought', {
      color: '#ff4d4d',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Overbought (70)',
    })

    addLineSeries('oversold', {
      color: '#0ddfba',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Oversold (30)',
    })

    // Set price scale range for RSI (0-100)
    chart.priceScale('right').applyOptions({
      autoScale: true,  // Let it auto-scale based on data
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
      visible: true,
    })

    // Setup resize observer
    const cleanupResize = setupResizeObserver()

    return () => {
      cleanupResize()
      cleanupChart()
    }
  }, [symbol, priceData.length >= 15, initializeChart, cleanupChart, chartInstance, addLineSeries, setupResizeObserver]) // Only re-run when we cross the data threshold

  // Loading state
  const minDataRequired = 15;
  const isLoading = priceData.length < minDataRequired;
  
  
  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#050f13] flex items-center justify-center">
        <div className="text-[#C8D6E5] text-sm">
          Loading RSI data... ({priceData.length}/{minDataRequired})
          {priceData.length === 0 && <div className="text-xs mt-1 opacity-60">Fetching from Binance API...</div>}
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