// Mock for MultiTimeframeLineDetector
import type { 
  DetectionResult, 
  DetectionConfig, 
  HorizontalLine, 
  Trendline 
} from '@/lib/analysis/multi-timeframe-line-detector';

const mockHorizontalLines: HorizontalLine[] = [
  {
    id: 'horizontal-1',
    type: 'resistance',
    price: 50000,
    strength: 0.8,
    confidence: 0.9,
    touchCount: 5,
    supportingTimeframes: ['1h', '4h'],
    points: [
      { x: Date.now() - 86400000, y: 50000 },
      { x: Date.now() - 43200000, y: 49950 },
      { x: Date.now(), y: 50020 }
    ],
    metadata: {
      algorithm: 'multi-timeframe',
      detectedAt: Date.now()
    }
  },
  {
    id: 'horizontal-2',
    type: 'support',
    price: 49000,
    strength: 0.7,
    confidence: 0.85,
    touchCount: 4,
    supportingTimeframes: ['15m', '1h', '4h'],
    points: [
      { x: Date.now() - 172800000, y: 49000 },
      { x: Date.now() - 86400000, y: 48980 },
      { x: Date.now(), y: 49010 }
    ],
    metadata: {
      algorithm: 'multi-timeframe',
      detectedAt: Date.now()
    }
  }
];

const mockTrendlines: Trendline[] = [
  {
    id: 'trendline-1',
    type: 'trendline',
    price: 49500, // Current price on the line
    strength: 0.75,
    confidence: 0.8,
    touchCount: 3,
    supportingTimeframes: ['1h', '4h'],
    points: [
      { x: Date.now() - 172800000, y: 48500 },
      { x: Date.now() - 86400000, y: 49000 },
      { x: Date.now(), y: 49500 }
    ],
    slope: 0.0057,
    intercept: 48500,
    metadata: {
      algorithm: 'multi-timeframe',
      detectedAt: Date.now(),
      direction: 'ascending'
    }
  }
];

export class MultiTimeframeLineDetector {
  private config: DetectionConfig = {
    minTimeframes: 2,
    priceTolerancePercent: 0.5,
    minTouchCount: 3,
    confluenceZoneWidth: 1.0,
    strengthThreshold: 0.6,
    recencyWeight: 0.3
  };

  async detectLines(symbol: string, customConfig?: Partial<DetectionConfig>): Promise<DetectionResult> {
    const config = { ...this.config, ...customConfig };
    
    // Filter lines based on config
    const horizontalLines = mockHorizontalLines.filter(line => 
      line.strength >= config.strengthThreshold &&
      line.touchCount >= config.minTouchCount &&
      line.supportingTimeframes.length >= config.minTimeframes
    );

    const trendlines = mockTrendlines.filter(line =>
      line.strength >= config.strengthThreshold &&
      line.touchCount >= config.minTouchCount &&
      line.supportingTimeframes.length >= config.minTimeframes
    );

    const allLines = [...horizontalLines, ...trendlines];
    const avgStrength = allLines.length > 0 
      ? allLines.reduce((sum, line) => sum + line.strength, 0) / allLines.length 
      : 0;

    return {
      symbol,
      horizontalLines: customConfig?.analysisType === 'trendlines_only' ? [] : horizontalLines,
      trendlines: customConfig?.analysisType === 'horizontal_only' ? [] : trendlines,
      confluenceZones: [
        {
          priceRange: { min: 49800, max: 50200, center: 50000 },
          strength: 0.8,
          timeframeCount: 3,
          supportingTimeframes: ['15m', '1h', '4h'],
          type: 'resistance' as const
        }
      ],
      summary: {
        totalLines: allLines.length,
        highConfidenceLines: allLines.filter(line => line.confidence >= 0.8).length,
        multiTimeframeLines: allLines.filter(line => line.supportingTimeframes.length >= 2).length,
        averageStrength: avgStrength,
        detectionTime: 150
      },
      config
    };
  }

  updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): DetectionConfig {
    return { ...this.config };
  }
}

export const multiTimeframeLineDetector = new MultiTimeframeLineDetector();

// Export types for compatibility
export type { DetectionResult, DetectionConfig, HorizontalLine, Trendline };