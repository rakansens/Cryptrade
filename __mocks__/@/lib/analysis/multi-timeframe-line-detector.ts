// Mock for Multi-timeframe Line Detector
const mockDetectionResult = {
  horizontalLines: [
    {
      id: 'line-1',
      type: 'support' as const,
      price: 45000,
      strength: 0.85,
      confidence: 0.9,
      touchCount: 5,
      supportingTimeframes: ['1h', '4h', '1d'],
      firstDetected: Date.now() - 86400000,
      lastTouched: Date.now() - 3600000,
      points: [
        { time: Date.now() - 86400000, price: 45000, timeframe: '1h' },
        { time: Date.now() - 57600000, price: 45050, timeframe: '4h' },
        { time: Date.now() - 28800000, price: 44980, timeframe: '1d' },
        { time: Date.now() - 3600000, price: 45020, timeframe: '1h' }
      ],
      description: 'サポートライン - 5回タッチ、3つの時間足で確認',
      tradingImplication: 'bullish' as const,
      targetLevels: [45900, 47250],
      stopLossLevel: 44100
    },
    {
      id: 'line-2',
      type: 'resistance' as const,
      price: 48000,
      strength: 0.75,
      confidence: 0.85,
      touchCount: 4,
      supportingTimeframes: ['1h', '4h'],
      firstDetected: Date.now() - 57600000,
      lastTouched: Date.now() - 7200000,
      points: [
        { time: Date.now() - 57600000, price: 48000, timeframe: '1h' },
        { time: Date.now() - 7200000, price: 48020, timeframe: '4h' }
      ],
      description: 'レジスタンスライン - 4回タッチ、2つの時間足で確認',
      tradingImplication: 'bearish' as const,
      targetLevels: [47040, 45600],
      stopLossLevel: 48960
    }
  ],
  trendlines: [],
  confluenceZones: [
    {
      priceRange: {
        min: 44950,
        max: 45050,
        center: 45000
      },
      strength: 0.85,
      timeframeCount: 3,
      supportingTimeframes: ['1h', '4h', '1d'],
      type: 'support' as const,
      description: 'Strong support confluence zone'
    }
  ],
  summary: {
    totalLines: 2,
    highConfidenceLines: 2,
    multiTimeframeLines: 2,
    averageStrength: 0.8,
    detectionTime: 150
  }
};

// Mock class constructor
export class MultiTimeframeLineDetector {
  private config = {
    minTouchCount: 3,
    priceTolerancePercent: 0.5,
    strengthThreshold: 0.7,
    minTimeframes: 2,
    confluenceZoneWidth: 1.0,
    recencyWeight: 0.3
  };

  constructor() {}
  
  detectLines = jest.fn().mockImplementation(async (symbol: string, customConfig?: any) => {
    // Merge default config with custom config
    const finalConfig = { ...this.config, ...customConfig };
    
    // Apply custom config to filter results
    const filteredHorizontalLines = (mockDetectionResult.horizontalLines || [])
      .filter((line: any) => line && line.strength >= (finalConfig.strengthThreshold || 0.7))
      .filter((line: any) => line && line.touchCount >= (finalConfig.minTouchCount || 3))
      .map((line: any) => ({
        ...line,
        metadata: { algorithm: 'multi-timeframe' } // Required metadata field
      }));
    
    const filteredTrendlines = (mockDetectionResult.trendlines || []).map((line: any) => ({
      ...line,
      metadata: { algorithm: 'multi-timeframe' }
    }));
    
    return {
      symbol, // Required symbol field
      horizontalLines: filteredHorizontalLines,
      trendlines: filteredTrendlines,
      confluenceZones: mockDetectionResult.confluenceZones,
      summary: {
        ...mockDetectionResult.summary,
        totalLines: filteredHorizontalLines.length + filteredTrendlines.length,
        highConfidenceLines: [...filteredHorizontalLines, ...filteredTrendlines]
          .filter(line => line.confidence >= 0.8).length,
        multiTimeframeLines: [...filteredHorizontalLines, ...filteredTrendlines]
          .filter(line => line.supportingTimeframes.length >= 2).length,
        averageStrength: [...filteredHorizontalLines, ...filteredTrendlines].length > 0
          ? [...filteredHorizontalLines, ...filteredTrendlines]
            .reduce((sum, line) => sum + line.strength, 0) /
            [...filteredHorizontalLines, ...filteredTrendlines].length
          : 0
      },
      config: finalConfig // Required config field
    };
  });
  
  updateConfig = jest.fn().mockImplementation((newConfig: any) => {
    this.config = { ...this.config, ...newConfig };
  });
  
  getConfig = jest.fn().mockImplementation(() => {
    return { ...this.config };
  });
}

// Legacy exports for backward compatibility
export const detectLines = jest.fn().mockResolvedValue(mockDetectionResult);
export const updateConfig = jest.fn();

export const multiTimeframeLineDetector = new MultiTimeframeLineDetector();

// Export types for compatibility
export interface DetectedLine {
  id: string;
  type: 'support' | 'resistance' | 'trendline';
  price: number;
  strength: number;
  confidence: number;
  touchCount: number;
  supportingTimeframes: string[];
  firstDetected: number;
  lastTouched: number;
  points: Array<{
    time: number;
    price: number;
    timeframe: string;
  }>;
  description?: string;
  tradingImplication?: 'bullish' | 'bearish' | 'neutral';
  targetLevels?: number[];
  stopLossLevel?: number;
}

export interface LineDetectionResult {
  horizontalLines: DetectedLine[];
  trendlines: DetectedLine[];
  confluenceZones: Array<{
    priceRange: {
      min: number;
      max: number;
      center: number;
    };
    strength: number;
    timeframeCount: number;
    supportingTimeframes: string[];
    type: 'support' | 'resistance' | 'pivot';
    description?: string;
  }>;
  summary: {
    totalLines: number;
    highConfidenceLines: number;
    multiTimeframeLines: number;
    averageStrength: number;
    detectionTime: number;
  };
}