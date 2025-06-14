import { ColorType, CrosshairMode } from 'lightweight-charts'
import {
  CHART_THEME,
  CHART_COLORS,
  getBaseChartOptions,
  getIndicatorChartOptions,
  SERIES_STYLES
} from '../theme'

describe('Chart Theme Configuration', () => {
  describe('CHART_THEME', () => {
    it('has correct layout configuration', () => {
      expect(CHART_THEME.layout).toEqual({
        background: {
          type: ColorType.Solid,
          color: 'hsl(221, 39%, 5%)'
        },
        textColor: 'hsl(0, 0%, 85%)',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 12
      })
    })

    it('has correct grid configuration', () => {
      expect(CHART_THEME.grid).toEqual({
        vertLines: {
          color: 'rgba(255, 255, 255, 0.03)',
          visible: true
        },
        horzLines: {
          color: 'rgba(255, 255, 255, 0.03)',
          visible: true
        }
      })
    })

    it('has correct crosshair configuration', () => {
      expect(CHART_THEME.crosshair).toEqual({
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'hsl(165, 100%, 42%)',
          labelVisible: true,
          width: 1,
          style: 4,
          labelBackgroundColor: 'hsl(221, 28%, 13%)'
        },
        horzLine: {
          color: 'hsl(165, 100%, 42%)',
          labelVisible: true,
          width: 1,
          style: 4,
          labelBackgroundColor: 'hsl(221, 28%, 13%)'
        }
      })
    })

    it('has correct right price scale configuration', () => {
      expect(CHART_THEME.rightPriceScale).toEqual({
        borderColor: 'hsl(221, 28%, 20%)',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15
        },
        mode: 1,
        autoScale: true
      })
    })

    it('has correct time scale configuration', () => {
      expect(CHART_THEME.timeScale).toEqual({
        borderColor: 'hsl(221, 28%, 20%)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
        minBarSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true
      })
    })

    it('is defined as const', () => {
      // Test that the object structure is complete
      expect(CHART_THEME).toBeDefined()
      expect(typeof CHART_THEME).toBe('object')
      
      // Verify all properties exist
      expect(CHART_THEME).toHaveProperty('layout')
      expect(CHART_THEME).toHaveProperty('grid')
      expect(CHART_THEME).toHaveProperty('crosshair')
      expect(CHART_THEME).toHaveProperty('rightPriceScale')
      expect(CHART_THEME).toHaveProperty('timeScale')
    })
  })

  describe('CHART_COLORS', () => {
    it('has correct candlestick colors', () => {
      expect(CHART_COLORS.candlestick).toEqual({
        up: 'hsl(145, 100%, 45%)',
        down: 'hsl(4, 100%, 66%)'
      })
    })

    it('has correct moving average colors', () => {
      expect(CHART_COLORS.movingAverages).toEqual({
        ma7: 'hsl(36, 100%, 50%)',
        ma25: 'hsl(340, 75%, 65%)',
        ma99: 'hsl(217, 100%, 64%)'
      })
    })

    it('has correct indicator colors', () => {
      expect(CHART_COLORS.indicators).toMatchObject({
        rsi: 'hsl(280, 65%, 60%)',
        rsiOverbought: 'hsl(4, 100%, 66%)',
        rsiOversold: 'hsl(145, 100%, 45%)',
        macd: 'hsl(217, 100%, 64%)',
        macdSignal: 'hsl(36, 100%, 50%)',
        macdHistogramBull: 'hsl(145, 100%, 45%)',
        macdHistogramBear: 'hsl(4, 100%, 66%)',
        zero: 'hsl(0, 0%, 40%)'
      })
    })

    it('has correct UI colors', () => {
      expect(CHART_COLORS.ui).toEqual({
        panelBackground: 'hsl(221, 28%, 13%)',
        panelBackgroundHover: 'hsl(221, 28%, 18%)',
        border: 'hsl(221, 28%, 20%)',
        borderHover: 'hsl(165, 100%, 42%)'
      })
    })

    it('is defined as const', () => {
      // Test that the object structure is complete
      expect(CHART_COLORS).toBeDefined()
      expect(typeof CHART_COLORS).toBe('object')
      
      // Verify all properties exist
      expect(CHART_COLORS).toHaveProperty('candlestick')
      expect(CHART_COLORS).toHaveProperty('movingAverages')
      expect(CHART_COLORS).toHaveProperty('indicators')
      expect(CHART_COLORS).toHaveProperty('ui')
    })
  })

  describe('getBaseChartOptions', () => {
    it('returns chart options with correct dimensions', () => {
      const width = 800
      const height = 600
      const options = getBaseChartOptions(width, height)

      expect(options).toEqual({
        ...CHART_THEME,
        width,
        height
      })
    })

    it('includes all theme properties', () => {
      const options = getBaseChartOptions(1200, 800)

      expect(options.layout).toBeDefined()
      expect(options.grid).toBeDefined()
      expect(options.crosshair).toBeDefined()
      expect(options.rightPriceScale).toBeDefined()
      expect(options.timeScale).toBeDefined()
    })

    it('returns a new object instance', () => {
      const options1 = getBaseChartOptions(800, 600)
      const options2 = getBaseChartOptions(800, 600)
      
      // Should return different object instances
      expect(options1).not.toBe(options2)
      
      // But with same values
      expect(options1).toEqual(options2)
    })

    it('handles different aspect ratios', () => {
      const wideOptions = getBaseChartOptions(1920, 400)
      const tallOptions = getBaseChartOptions(400, 1080)
      const squareOptions = getBaseChartOptions(600, 600)

      expect(wideOptions.width).toBe(1920)
      expect(wideOptions.height).toBe(400)
      expect(tallOptions.width).toBe(400)
      expect(tallOptions.height).toBe(1080)
      expect(squareOptions.width).toBe(600)
      expect(squareOptions.height).toBe(600)
    })

    it('handles zero and negative dimensions', () => {
      const zeroOptions = getBaseChartOptions(0, 0)
      const negativeOptions = getBaseChartOptions(-100, -200)

      expect(zeroOptions.width).toBe(0)
      expect(zeroOptions.height).toBe(0)
      expect(negativeOptions.width).toBe(-100)
      expect(negativeOptions.height).toBe(-200)
    })
  })

  describe('getIndicatorChartOptions', () => {
    it('returns indicator-specific options', () => {
      const width = 800
      const height = 200
      const options = getIndicatorChartOptions(width, height)

      expect(options).toMatchObject({
        ...CHART_THEME,
        timeScale: {
          ...CHART_THEME.timeScale,
          timeVisible: false,
          visible: false
        },
        width,
        height
      })
    })

    it('hides time scale for indicators', () => {
      const options = getIndicatorChartOptions(800, 200)

      expect(options.timeScale.timeVisible).toBe(false)
      expect(options.timeScale.visible).toBe(false)
    })

    it('preserves other time scale properties', () => {
      const options = getIndicatorChartOptions(800, 200)

      expect(options.timeScale.borderColor).toBe(CHART_THEME.timeScale.borderColor)
      expect(options.timeScale.barSpacing).toBe(CHART_THEME.timeScale.barSpacing)
      expect(options.timeScale.fixLeftEdge).toBe(CHART_THEME.timeScale.fixLeftEdge)
    })

    it('includes all other theme properties', () => {
      const options = getIndicatorChartOptions(800, 200)

      expect(options.layout).toEqual(CHART_THEME.layout)
      expect(options.grid).toEqual(CHART_THEME.grid)
      expect(options.crosshair).toEqual(CHART_THEME.crosshair)
      expect(options.rightPriceScale).toEqual(CHART_THEME.rightPriceScale)
    })
  })

  describe('SERIES_STYLES', () => {
    describe('candlestick styles', () => {
      it('has correct up/down colors', () => {
        expect(SERIES_STYLES.candlestick).toEqual({
          upColor: 'hsl(145, 100%, 45%)',
          downColor: 'hsl(4, 100%, 66%)',
          borderDownColor: 'hsl(4, 100%, 66%)',
          borderUpColor: 'hsl(145, 100%, 45%)',
          wickDownColor: 'hsl(4, 100%, 66%)',
          wickUpColor: 'hsl(145, 100%, 45%)'
        })
      })

      it('uses consistent colors for all components', () => {
        const { candlestick } = SERIES_STYLES
        
        expect(candlestick.upColor).toBe(candlestick.borderUpColor)
        expect(candlestick.upColor).toBe(candlestick.wickUpColor)
        expect(candlestick.downColor).toBe(candlestick.borderDownColor)
        expect(candlestick.downColor).toBe(candlestick.wickDownColor)
      })
    })

    describe('moving average styles', () => {
      it('has styles for all MA periods', () => {
        expect(SERIES_STYLES.movingAverage).toHaveProperty('ma7')
        expect(SERIES_STYLES.movingAverage).toHaveProperty('ma25')
        expect(SERIES_STYLES.movingAverage).toHaveProperty('ma99')
      })

      it('has correct MA7 style', () => {
        expect(SERIES_STYLES.movingAverage.ma7).toEqual({
          color: CHART_COLORS.movingAverages.ma7,
          lineWidth: 2,
          title: 'MA(7)'
        })
      })

      it('has correct MA25 style', () => {
        expect(SERIES_STYLES.movingAverage.ma25).toEqual({
          color: CHART_COLORS.movingAverages.ma25,
          lineWidth: 2,
          title: 'MA(25)'
        })
      })

      it('has correct MA99 style', () => {
        expect(SERIES_STYLES.movingAverage.ma99).toEqual({
          color: CHART_COLORS.movingAverages.ma99,
          lineWidth: 2,
          title: 'MA(99)'
        })
      })

      it('uses consistent line width for all MAs', () => {
        const { movingAverage } = SERIES_STYLES
        
        expect(movingAverage.ma7.lineWidth).toBe(2)
        expect(movingAverage.ma25.lineWidth).toBe(2)
        expect(movingAverage.ma99.lineWidth).toBe(2)
      })
    })

    describe('RSI styles', () => {
      it('has main RSI line style', () => {
        expect(SERIES_STYLES.rsi.main).toEqual({
          color: CHART_COLORS.indicators.rsi,
          lineWidth: 2,
          title: 'RSI(14)'
        })
      })

      it('has overbought line style', () => {
        expect(SERIES_STYLES.rsi.overbought).toEqual({
          color: CHART_COLORS.indicators.rsiOverbought,
          lineWidth: 1,
          lineStyle: 2,
          title: 'Overbought (70)'
        })
      })

      it('has oversold line style', () => {
        expect(SERIES_STYLES.rsi.oversold).toEqual({
          color: CHART_COLORS.indicators.rsiOversold,
          lineWidth: 1,
          lineStyle: 2,
          title: 'Oversold (30)'
        })
      })

      it('uses dashed lines for levels', () => {
        expect(SERIES_STYLES.rsi.overbought.lineStyle).toBe(2)
        expect(SERIES_STYLES.rsi.oversold.lineStyle).toBe(2)
      })
    })

    describe('MACD styles', () => {
      it('has MACD line style', () => {
        expect(SERIES_STYLES.macd.macd).toEqual({
          color: CHART_COLORS.indicators.macd,
          lineWidth: 2,
          title: 'MACD'
        })
      })

      it('has signal line style', () => {
        expect(SERIES_STYLES.macd.signal).toEqual({
          color: CHART_COLORS.indicators.macdSignal,
          lineWidth: 2,
          title: 'Signal'
        })
      })

      it('has zero line style', () => {
        expect(SERIES_STYLES.macd.zero).toEqual({
          color: CHART_COLORS.indicators.zero,
          lineWidth: 1,
          lineStyle: 2,
          title: 'Zero'
        })
      })

      it('has histogram style with price format', () => {
        expect(SERIES_STYLES.macd.histogram).toEqual({
          color: CHART_COLORS.indicators.macdHistogramBull,
          priceFormat: {
            type: 'price',
            precision: 4,
            minMove: 0.0001
          }
        })
      })

      it('has correct price format configuration', () => {
        const { priceFormat } = SERIES_STYLES.macd.histogram
        
        expect(priceFormat.type).toBe('price')
        expect(priceFormat.precision).toBe(4)
        expect(priceFormat.minMove).toBe(0.0001)
      })
    })

    it('is defined as const', () => {
      // Test that the object structure is complete
      expect(SERIES_STYLES).toBeDefined()
      expect(typeof SERIES_STYLES).toBe('object')
      
      // Verify all properties exist
      expect(SERIES_STYLES).toHaveProperty('candlestick')
      expect(SERIES_STYLES).toHaveProperty('movingAverage')
      expect(SERIES_STYLES).toHaveProperty('rsi')
      expect(SERIES_STYLES).toHaveProperty('macd')
    })
  })

  describe('Color Consistency', () => {
    it('reuses profit color correctly', () => {
      const profitColor = 'hsl(145, 100%, 45%)'
      
      expect(CHART_COLORS.candlestick.up).toBe(profitColor)
      expect(CHART_COLORS.indicators.rsiOversold).toBe(profitColor)
      expect(CHART_COLORS.indicators.macdHistogramBull).toBe(profitColor)
      expect(SERIES_STYLES.candlestick.upColor).toBe(profitColor)
    })

    it('reuses loss color correctly', () => {
      const lossColor = 'hsl(4, 100%, 66%)'
      
      expect(CHART_COLORS.candlestick.down).toBe(lossColor)
      expect(CHART_COLORS.indicators.rsiOverbought).toBe(lossColor)
      expect(CHART_COLORS.indicators.macdHistogramBear).toBe(lossColor)
      expect(SERIES_STYLES.candlestick.downColor).toBe(lossColor)
    })

    it('reuses accent color correctly', () => {
      const accentColor = 'hsl(165, 100%, 42%)'
      
      expect(CHART_THEME.crosshair.vertLine.color).toBe(accentColor)
      expect(CHART_THEME.crosshair.horzLine.color).toBe(accentColor)
      expect(CHART_COLORS.ui.borderHover).toBe(accentColor)
    })

    it('uses consistent grid opacity', () => {
      const gridColor = 'rgba(255, 255, 255, 0.03)'
      
      expect(CHART_THEME.grid.vertLines.color).toBe(gridColor)
      expect(CHART_THEME.grid.horzLines.color).toBe(gridColor)
    })
  })

  describe('Type Safety', () => {
    it('exports correct types for theme objects', () => {
      // This test ensures TypeScript compilation works correctly
      const theme: typeof CHART_THEME = CHART_THEME
      const colors: typeof CHART_COLORS = CHART_COLORS
      const styles: typeof SERIES_STYLES = SERIES_STYLES

      expect(theme).toBeDefined()
      expect(colors).toBeDefined()
      expect(styles).toBeDefined()
    })

    it('function return types are correctly inferred', () => {
      const baseOptions = getBaseChartOptions(800, 600)
      const indicatorOptions = getIndicatorChartOptions(800, 200)

      // TypeScript should infer these have layout, grid, etc properties
      expect(baseOptions.layout).toBeDefined()
      expect(indicatorOptions.layout).toBeDefined()
    })
  })
})