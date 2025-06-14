'use client'

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { useChart, useIsChartReady } from '@/store/chart.store'
import { useCandlestickData } from '@/hooks/market/use-candlestick-data'
import type { IndicatorOptions } from '@/types/market'
import { useChartInstance } from '../hooks/useChartInstance'
import { useChartData } from '../hooks/useChartData'
import { useAgentEventHandlers } from '../hooks/useAgentEventHandlers'
import { usePatternRestore } from '../hooks/usePatternRestore'
import { usePatternDebug } from '../hooks/usePatternDebug'
import { useDrawingRestore } from '../hooks/useDrawingRestore'

interface CandlestickChartProps {
  height?: number
}

export interface CandlestickChartRef {
  fitContent: () => void;
}

const CandlestickChart = forwardRef<CandlestickChartRef, CandlestickChartProps>(
function CandlestickChart({ height }, ref) {
  const { symbol, timeframe, indicators, settings, setChartReady } = useChart()
  const isChartReady = useIsChartReady()
  const typedIndicators = indicators as IndicatorOptions
  const prevIndicators = useRef(typedIndicators)
  const isChartInitialized = useRef(false)
  const hasInitialDataLoaded = useRef(false)
  
  // Load real Binance data
  const { priceData, isLoading } = useCandlestickData({
    symbol,
    interval: timeframe,
    limit: 1000
  })

  // Chart instance management
  const { 
    chartContainerRef, 
    initializeChart, 
    addIndicatorSeries,
    getSeries, 
    fitContent,
    drawingManager,
    patternRenderer,
    getPatternRenderer
  } = useChartInstance({ 
    height, 
    indicators: typedIndicators 
  })

  // Chart data management
  const { updateIndicatorData } = useChartData({
    priceData,
    indicators: typedIndicators,
    bollingerSettings: settings.boll,
    getSeries,
    fitContent,
    autoFit: false // Disable autoFit to prevent unwanted position resets during chat layout changes
  })

  // Chart manipulation handlers for agent events
  const handleZoomIn = useCallback((factor: number = 1.2) => {
    // TODO: Implement zoom in functionality
    console.log('Zoom in with factor:', factor);
  }, []);

  const handleZoomOut = useCallback((factor: number = 0.8) => {
    // TODO: Implement zoom out functionality  
    console.log('Zoom out with factor:', factor);
  }, []);

  const handleResetView = useCallback(() => {
    fitContent();
  }, [fitContent]);

  // Register agent event handlers
  useAgentEventHandlers({
    fitContent,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetView: handleResetView,
    drawingManager,
    chartData: priceData,
    patternRenderer,
    getPatternRenderer,
  });

  // Restore patterns after chart initialization or timeframe change
  usePatternRestore({ 
    patternRenderer, 
    isChartReady: isChartInitialized.current && !!patternRenderer,
    timeframe
  });
  
  // Restore drawings after chart initialization or timeframe change
  useDrawingRestore({
    drawingManager,
    isChartReady: isChartInitialized.current && !!drawingManager,
    timeframe
  });
  
  // Debug pattern renderer
  usePatternDebug(patternRenderer);

  // Track when pattern renderer is ready
  useEffect(() => {
    if (patternRenderer && isChartInitialized.current) {
      setChartReady(true);
    }
    return () => {
      if (!patternRenderer) {
        setChartReady(false);
      }
    };
  }, [patternRenderer, setChartReady]);

  // Expose fitContent function to parent via ref
  useImperativeHandle(ref, () => ({
    fitContent,
  }), [fitContent])

  // Initialize chart only when symbol changes (not timeframe)
  useEffect(() => {
    const cleanup = initializeChart()
    isChartInitialized.current = true
    hasInitialDataLoaded.current = false // Reset for new symbol
    prevIndicators.current = { ma: false, rsi: false, macd: false, boll: false } // Reset to handle initial state
    return cleanup
  }, [symbol, initializeChart]) // Only reinitialize on symbol change

  // Track when initial data has been loaded
  useEffect(() => {
    if (isChartInitialized.current && priceData.length > 0 && !hasInitialDataLoaded.current) {
      hasInitialDataLoaded.current = true
    }
  }, [priceData.length])

  // Handle ALL indicator management (initial setup + changes)
  useEffect(() => {
    if (!isChartInitialized.current) return

    const prev = prevIndicators.current
    const current = typedIndicators

    // Handle MA changes (including initial setup)
    if (prev.ma !== current.ma) {
      addIndicatorSeries('ma', current.ma)
      if (current.ma) {
        setTimeout(() => updateIndicatorData('ma'), 50)
      }
    }
    
    // Handle Bollinger Bands changes (including initial setup)
    if (prev.boll !== current.boll) {
      addIndicatorSeries('boll', current.boll)
      if (current.boll) {
        setTimeout(() => updateIndicatorData('boll'), 50)
      }
    }

    prevIndicators.current = current
  }, [typedIndicators.ma, typedIndicators.boll, addIndicatorSeries, updateIndicatorData])

  if (isLoading && priceData.length === 0) {
    return (
      <div className="w-full h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading chart data for {symbol}...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#050f13]" data-testid="chart-container">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
      />
    </div>
  )
})

export default CandlestickChart