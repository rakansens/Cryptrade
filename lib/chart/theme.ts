import { ColorType, CrosshairMode } from 'lightweight-charts'

// Premium trading chart theme
export const CHART_THEME = {
  layout: {
    background: { 
      type: ColorType.Solid, 
      color: 'hsl(221, 39%, 5%)' // var(--color-base)
    },
    textColor: 'hsl(0, 0%, 85%)', // Improved contrast
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 12, // Increased for better readability
  },
  grid: {
    vertLines: { 
      color: 'rgba(255, 255, 255, 0.03)', // Subtle grid
      visible: true 
    },
    horzLines: { 
      color: 'rgba(255, 255, 255, 0.03)', // Subtle grid
      visible: true 
    },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { 
      color: 'hsl(165, 100%, 42%)', // var(--color-accent)
      labelVisible: true,
      width: 1,
      style: 4, // Dotted
      labelBackgroundColor: 'hsl(221, 28%, 13%)', // var(--color-secondary)
    },
    horzLine: { 
      color: 'hsl(165, 100%, 42%)', // var(--color-accent)
      labelVisible: true,
      width: 1,
      style: 4, // Dotted
      labelBackgroundColor: 'hsl(221, 28%, 13%)', // var(--color-secondary)
    },
  },
  rightPriceScale: {
    borderColor: 'hsl(221, 28%, 20%)',
    scaleMargins: {
      top: 0.15, // More breathing room
      bottom: 0.15,
    },
    mode: 1, // Normal mode
    autoScale: true,
  },
  timeScale: {
    borderColor: 'hsl(221, 28%, 20%)',
    timeVisible: true,
    secondsVisible: false,
    barSpacing: 12,
    minBarSpacing: 8,
    fixLeftEdge: true,
    fixRightEdge: true,
    lockVisibleTimeRangeOnResize: true,
  },
} as const

// Chart colors - Using CSS variables for consistency
export const CHART_COLORS = {
  // Candlestick colors
  candlestick: {
    up: 'hsl(145, 100%, 45%)',   // var(--color-profit)
    down: 'hsl(4, 100%, 66%)',    // var(--color-loss)
  },
  
  // Moving average colors with better contrast
  movingAverages: {
    ma7: 'hsl(36, 100%, 50%)',    // var(--color-warning) - Yellow/Amber
    ma25: 'hsl(340, 75%, 65%)',   // Pink for medium-term
    ma99: 'hsl(217, 100%, 64%)',  // var(--color-info) - Blue
  },
  
  // Indicator colors
  indicators: {
    rsi: 'hsl(280, 65%, 60%)',    // Purple
    rsiOverbought: 'hsl(4, 100%, 66%)',   // var(--color-loss)
    rsiOversold: 'hsl(145, 100%, 45%)',   // var(--color-profit)
    
    macd: 'hsl(217, 100%, 64%)',      // var(--color-info)
    macdSignal: 'hsl(36, 100%, 50%)', // var(--color-warning)
    macdHistogramBull: 'hsl(145, 100%, 45%)', // var(--color-profit)
    macdHistogramBear: 'hsl(4, 100%, 66%)',   // var(--color-loss)
    
    zero: 'hsl(0, 0%, 40%)',      // Neutral gray
  },
  
  // UI colors matching the theme
  ui: {
    panelBackground: 'hsl(221, 28%, 13%)',    // var(--color-secondary)
    panelBackgroundHover: 'hsl(221, 28%, 18%)',
    border: 'hsl(221, 28%, 20%)',
    borderHover: 'hsl(165, 100%, 42%)',       // var(--color-accent)
  },
} as const

// Default chart options
export function getBaseChartOptions(width: number, height: number) {
  return {
    ...CHART_THEME,
    width,
    height,
  }
}

// Indicator-specific chart options
export function getIndicatorChartOptions(width: number, height: number) {
  return {
    ...CHART_THEME,
    timeScale: {
      ...CHART_THEME.timeScale,
      timeVisible: false,
      visible: false,
    },
    width,
    height,
  }
}

// Series style presets
export const SERIES_STYLES = {
  candlestick: {
    upColor: CHART_COLORS.candlestick.up,
    downColor: CHART_COLORS.candlestick.down,
    borderDownColor: CHART_COLORS.candlestick.down,
    borderUpColor: CHART_COLORS.candlestick.up,
    wickDownColor: CHART_COLORS.candlestick.down,
    wickUpColor: CHART_COLORS.candlestick.up,
  },
  
  movingAverage: {
    ma7: {
      color: CHART_COLORS.movingAverages.ma7,
      lineWidth: 2,
      title: 'MA(7)',
    },
    ma25: {
      color: CHART_COLORS.movingAverages.ma25,
      lineWidth: 2,
      title: 'MA(25)',
    },
    ma99: {
      color: CHART_COLORS.movingAverages.ma99,
      lineWidth: 2,
      title: 'MA(99)',
    },
  },
  
  rsi: {
    main: {
      color: CHART_COLORS.indicators.rsi,
      lineWidth: 2,
      title: 'RSI(14)',
    },
    overbought: {
      color: CHART_COLORS.indicators.rsiOverbought,
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: 'Overbought (70)',
    },
    oversold: {
      color: CHART_COLORS.indicators.rsiOversold,
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: 'Oversold (30)',
    },
  },
  
  macd: {
    macd: {
      color: CHART_COLORS.indicators.macd,
      lineWidth: 2,
      title: 'MACD',
    },
    signal: {
      color: CHART_COLORS.indicators.macdSignal,
      lineWidth: 2,
      title: 'Signal',
    },
    zero: {
      color: CHART_COLORS.indicators.zero,
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: 'Zero',
    },
    histogram: {
      color: CHART_COLORS.indicators.macdHistogramBull,
      priceFormat: {
        type: 'price' as const,
        precision: 4,
        minMove: 0.0001,
      },
    },
  },
} as const