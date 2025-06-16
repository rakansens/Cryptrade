# Chart Analysis Guide

This guide explains how to use the `ChartAnalyzer` class for detecting trend lines and support/resistance levels.

## Usage

```
tsx
import { ChartAnalyzer } from '@/lib/chart/analyzer'

const analyzer = new ChartAnalyzer(candleData)

const trends = analyzer.detectTrendLines({
  lookbackPeriod: 50,
  minTouchPoints: 3,
  confidenceThreshold: 0.7
})

const levels = analyzer.detectSupportResistance({
  lookbackPeriod: 50,
  minTouches: 3,
  priceThreshold: 100,
  strengthThreshold: 0.5
})
```

Each returned drawing includes metadata with direction, confidence or strength that can be used to rank the results.
