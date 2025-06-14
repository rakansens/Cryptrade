import { useRef, useEffect, useCallback } from 'react'
import { createChart, IChartApi } from 'lightweight-charts'
import { getBaseChartOptions, getIndicatorChartOptions } from './theme'

// Common chart setup hook
export function useChart(
  containerRef: React.RefObject<HTMLDivElement>,
  height?: number,
  isIndicator = false
) {
  const chartInstanceRef = useRef<IChartApi | null>(null)

  const initializeChart = useCallback(() => {
    if (!containerRef.current) return null

    const containerHeight = height || containerRef.current.clientHeight || 150
    const containerWidth = containerRef.current.clientWidth

    const chartOptions = isIndicator 
      ? getIndicatorChartOptions(containerWidth, containerHeight)
      : getBaseChartOptions(containerWidth, containerHeight)

    const chart = createChart(containerRef.current, chartOptions)
    chartInstanceRef.current = chart

    return chart
  }, [containerRef, height, isIndicator])

  const handleResize = useCallback(() => {
    if (chartInstanceRef.current && containerRef.current) {
      const newHeight = height || containerRef.current.clientHeight || 150
      const newWidth = containerRef.current.clientWidth

      chartInstanceRef.current.applyOptions({
        width: newWidth,
        height: newHeight,
      })
    }
  }, [containerRef, height])

  useEffect(() => {
    if (!containerRef.current) return

    // Setup ResizeObserver for responsive resizing
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    resizeObserver.observe(containerRef.current)

    // Setup window resize listener as backup
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove()
        chartInstanceRef.current = null
      }
    }
  }, [handleResize])

  return {
    chartInstance: chartInstanceRef.current,
    initializeChart,
    handleResize,
  }
}

// Chart error boundary hook
export function useChartErrorHandling(componentName: string) {
  const handleChartError = useCallback((error: unknown, context: string) => {
    console.error(`[${componentName}] ${context}:`, error)
    
    // Could integrate with error reporting service here
    // e.g., Sentry.captureException(error, { tags: { component: componentName, context } })
  }, [componentName])

  return { handleChartError }
}

// Chart data preparation hook
export function useChartDataPreparation<T, R>(
  rawData: T[],
  prepareFunction: (data: T[]) => R[],
  dependencies: React.DependencyList = []
) {
  const preparedData = useCallback(() => {
    try {
      if (!rawData || rawData.length === 0) return []
      return prepareFunction(rawData)
    } catch (error) {
      console.error('[ChartDataPreparation] Error preparing data:', error)
      return []
    }
  }, [rawData, prepareFunction, ...dependencies])

  return preparedData()
}

// Chart loading state hook
export function useChartLoadingState(dataLength: number) {
  const isLoading = dataLength === 0
  const isEmpty = !isLoading && dataLength === 0

  return { isLoading, isEmpty }
}

// Chart performance optimization hook
export function useChartPerformance() {
  const performanceMetrics = useRef({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
  })

  const trackRender = useCallback((startTime: number) => {
    const renderTime = performance.now() - startTime
    const metrics = performanceMetrics.current
    
    metrics.renderCount++
    metrics.lastRenderTime = renderTime
    metrics.averageRenderTime = 
      (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) / metrics.renderCount

    // Log slow renders
    if (renderTime > 100) {
      console.warn('[ChartPerformance] Slow render detected:', {
        renderTime: `${renderTime.toFixed(2)}ms`,
        renderCount: metrics.renderCount,
        averageRenderTime: `${metrics.averageRenderTime.toFixed(2)}ms`,
      })
    }
  }, [])

  const startRenderTimer = useCallback(() => {
    return performance.now()
  }, [])

  return {
    trackRender,
    startRenderTimer,
    getMetrics: () => ({ ...performanceMetrics.current }),
  }
}