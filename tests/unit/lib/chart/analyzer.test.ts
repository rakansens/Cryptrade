import { ChartAnalyzer } from '@/lib/chart/analyzer'
import type { CandlestickData, Time } from 'lightweight-charts'

describe('ChartAnalyzer', () => {
  const mockData: CandlestickData[] = [
    { time: 1704067200 as Time, open: 44800, high: 45200, low: 44600, close: 45000 },
    { time: 1704070800 as Time, open: 45000, high: 45500, low: 44900, close: 45300 },
    { time: 1704074400 as Time, open: 45300, high: 45600, low: 45100, close: 45400 },
    { time: 1704078000 as Time, open: 45400, high: 45800, low: 45200, close: 45600 },
    { time: 1704081600 as Time, open: 45600, high: 46000, low: 45500, close: 45900 },
    { time: 1704085200 as Time, open: 45900, high: 46200, low: 45700, close: 46100 },
    { time: 1704088800 as Time, open: 46100, high: 46300, low: 45800, close: 45900 },
    { time: 1704092400 as Time, open: 45900, high: 46100, low: 45600, close: 45800 },
    { time: 1704096000 as Time, open: 45800, high: 46000, low: 45500, close: 45700 },
    { time: 1704099600 as Time, open: 45700, high: 45900, low: 45400, close: 45600 }
  ]

  let analyzer: ChartAnalyzer

  beforeEach(() => {
    analyzer = new ChartAnalyzer(mockData)
  })

  describe('Initialization', () => {
    it('should create analyzer instance with candlestick data', () => {
      expect(analyzer).toBeDefined()
      expect(analyzer).toBeInstanceOf(ChartAnalyzer)
    })

    it('should store data internally and allow method calls', () => {
      // The analyzer should have access to the data
      // This is verified by the fact that methods can be called
      expect(() => analyzer.detectTrendLines({
        lookbackPeriod: 5,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })).not.toThrow()
    })
  })

  describe('detectTrendLines', () => {
    it('should detect trend lines in sample data', () => {
      const result = analyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 3,
        confidenceThreshold: 0.7
      })

      expect(result.length).toBeGreaterThan(0)
    })

    it('should accept and validate configuration parameters', () => {
      const config = {
        lookbackPeriod: 20,
        minTouchPoints: 4,
        confidenceThreshold: 0.9
      }
      
      // Should not throw with valid config
      expect(() => analyzer.detectTrendLines(config)).not.toThrow()
    })

    it('should detect upward trend lines', () => {
      const result = analyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })

      expect(result.some(r => r.metadata?.direction === 'up')).toBe(true)
    })

    it('should detect downward trend lines', () => {
      const downwardData = mockData.map((d, i) => ({
        ...d,
        open: 46000 - i * 100,
        high: 46200 - i * 100,
        low: 45800 - i * 100,
        close: 46000 - i * 100
      }))
      
      const downAnalyzer = new ChartAnalyzer(downwardData)
      const result = downAnalyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })

      expect(result.some(r => r.metadata?.direction === 'down')).toBe(true)
    })

    it('TODO: should respect minimum touch points', () => {
      const result = analyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 5,
        confidenceThreshold: 0.5
      })
      
      // Should filter out lines with fewer touch points
      expect(result).toEqual([])
    })

    it('TODO: should respect confidence threshold', () => {
      const result = analyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.95
      })
      
      // Should filter out lines below threshold
      expect(result).toEqual([])
    })
  })

  describe('detectSupportResistance', () => {
    it('should detect levels for sample data', () => {
      const result = analyzer.detectSupportResistance({
        lookbackPeriod: 20,
        minTouches: 2,
        priceThreshold: 0.02,
        strengthThreshold: 0.5
      })

      expect(result.length).toBeGreaterThan(0)
    })

    it('should accept and validate configuration object', () => {
      const config = {
        lookbackPeriod: 50,
        minTouches: 3,
        priceThreshold: 0.01,
        strengthThreshold: 0.5
      }
      
      expect(() => analyzer.detectSupportResistance(config)).not.toThrow()
    })

    it('should detect support levels', () => {
      const result = analyzer.detectSupportResistance({
        lookbackPeriod: 10,
        minTouches: 2,
        priceThreshold: 0.02,
        strengthThreshold: 0.5
      })

      expect(result.some(r => r.metadata?.type === 'support')).toBe(true)
    })

    it('should detect resistance levels', () => {
      const result = analyzer.detectSupportResistance({
        lookbackPeriod: 10,
        minTouches: 2,
        priceThreshold: 0.02,
        strengthThreshold: 0.5
      })

      expect(result.some(r => r.metadata?.type === 'resistance')).toBe(true)
    })

    it('should merge nearby levels', () => {
      // Test data with multiple touches at similar price levels
      const clusteredData = [
        ...mockData.slice(0, 5),
        { time: 1704103200 as Time, open: 45500, high: 45600, low: 45490, close: 45550 },
        { time: 1704106800 as Time, open: 45550, high: 45650, low: 45510, close: 45600 },
        ...mockData.slice(7)
      ]
      
      const clusteredAnalyzer = new ChartAnalyzer(clusteredData)
      const result = clusteredAnalyzer.detectSupportResistance({
        lookbackPeriod: 20,
        minTouches: 2,
        priceThreshold: 0.01,
        strengthThreshold: 0.5
      })

      const prices = result.map(r => r.points[0].value)
      const unique = new Set(prices.map(p => Math.round(p / 0.01)))
      expect(unique.size).toBeLessThan(prices.length)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data array without throwing errors', () => {
      const emptyAnalyzer = new ChartAnalyzer([])
      
      expect(() => emptyAnalyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })).not.toThrow()
      
      expect(() => emptyAnalyzer.detectSupportResistance({
        lookbackPeriod: 10,
        minTouches: 2,
        priceThreshold: 0.02,
        strengthThreshold: 0.5
      })).not.toThrow()
    })

    it('should handle single data point gracefully', () => {
      const singleAnalyzer = new ChartAnalyzer([mockData[0] as CandlestickData<Time>])
      
      const trendResult = singleAnalyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })
      
      const srResult = singleAnalyzer.detectSupportResistance({
        lookbackPeriod: 10,
        minTouches: 2,
        priceThreshold: 0.02,
        strengthThreshold: 0.5
      })
      
      expect(trendResult).toEqual([])
      expect(srResult).toEqual([])
    })

    it('should handle invalid configuration values gracefully', () => {
      // Negative values
      expect(() => analyzer.detectTrendLines({
        lookbackPeriod: -10,
        minTouchPoints: -2,
        confidenceThreshold: -0.5
      })).not.toThrow()
      
      // Zero values
      expect(() => analyzer.detectTrendLines({
        lookbackPeriod: 0,
        minTouchPoints: 0,
        confidenceThreshold: 0
      })).not.toThrow()
      
      // Very large values
      expect(() => analyzer.detectTrendLines({
        lookbackPeriod: 10000,
        minTouchPoints: 1000,
        confidenceThreshold: 10
      })).not.toThrow()
    })
  })

  describe('Future Methods', () => {
    it('TODO: detectPatterns method', () => {
      // Future implementation for pattern detection
      // expect(analyzer.detectPatterns).toBeDefined()
    })

    it('TODO: detectFibonacciLevels method', () => {
      // Future implementation for Fibonacci level detection
      // expect(analyzer.detectFibonacciLevels).toBeDefined()
    })

    it('TODO: detectVolumeAnomalies method', () => {
      // Future implementation for volume analysis
      // expect(analyzer.detectVolumeAnomalies).toBeDefined()
    })

    it('TODO: calculateIndicators method', () => {
      // Future implementation for technical indicators
      // expect(analyzer.calculateIndicators).toBeDefined()
    })
  })

  describe('Data Validation', () => {
    it('should handle malformed data with null values gracefully', () => {
      const malformedData = [
        { time: null, open: 100, high: 110, low: 90, close: 105 },
        { time: 1704067200, open: null, high: 110, low: 90, close: 105 },
        { time: 1704070800, open: 100, high: null, low: 90, close: 105 },
        { time: 1704074400, open: 100, high: 110, low: null, close: 105 },
        { time: 1704078000, open: 100, high: 110, low: 90, close: null }
      ] as unknown as CandlestickData[]
      
      const malformedAnalyzer = new ChartAnalyzer(malformedData)
      
      expect(() => malformedAnalyzer.detectTrendLines({
        lookbackPeriod: 5,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })).not.toThrow()
    })

    it('should handle non-chronological (shuffled) data', () => {
      const shuffledData = [...mockData].sort(() => Math.random() - 0.5)
      const shuffledAnalyzer = new ChartAnalyzer(shuffledData)
      
      expect(() => shuffledAnalyzer.detectTrendLines({
        lookbackPeriod: 10,
        minTouchPoints: 2,
        confidenceThreshold: 0.7
      })).not.toThrow()
    })
  })
})