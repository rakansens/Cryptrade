// Mock dependencies before imports
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/services/enhanced-market-data.service');
jest.mock('@/lib/analysis/enhanced-line-detector-v2', () => ({
  enhancedLineDetectorV2: jest.fn(),
}));

import { enhancedLineAnalysisV2Tool } from '@/lib/mastra/tools/enhanced-line-analysis-v2.tool';
import { logger } from '@/lib/utils/logger';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';
import { enhancedLineDetectorV2 } from '@/lib/analysis/enhanced-line-detector-v2';
import type { EnhancedLineV2 } from '@/lib/analysis/enhanced-line-detector-v2';

// Type cast the execute function to avoid TypeScript errors
const executeEnhancedLineAnalysisV2 = enhancedLineAnalysisV2Tool.execute as any;

describe('enhancedLineAnalysisV2Tool', () => {
  const mockMultiTimeframeData = {
    timeframes: {
      '1h': {
        data: [
          { close: 100, high: 105, low: 95, open: 98, volume: 1000 },
          { close: 102, high: 106, low: 98, open: 100, volume: 1200 },
          { close: 104, high: 108, low: 100, open: 102, volume: 1500 },
        ],
      },
      '4h': {
        data: [
          { close: 100, high: 110, low: 90, open: 95, volume: 5000 },
          { close: 105, high: 115, low: 95, open: 100, volume: 6000 },
        ],
      },
      '1d': {
        data: [
          { close: 100, high: 120, low: 80, open: 90, volume: 20000 },
        ],
      },
    },
  };

  const mockEnhancedLine: EnhancedLineV2 = {
    id: 'line-1',
    price: 100,
    type: 'support',
    confidence: 0.85,
    strength: 0.9,
    touchCount: 5,
    supportingTimeframes: ['1h', '4h'],
    description: 'Strong support level',
    touchAnalysis: {
      wickTouchCount: 2,
      bodyTouchCount: 2,
      exactTouchCount: 1,
      touchQualityScore: 85,
      strongBounceCount: 3,
      volumeWeightedStrength: 0.92,
      averageVolume: 1200,
      touchPoints: [
        {
          time: 1000,
          price: 100,
          type: 'wick',
          strength: 0.8,
          volumeRatio: 1.5,
        },
      ],
    },
    qualityMetrics: {
      wickBodyRatio: 0.5,
      volumeConfirmation: 0.8,
      bounceConfirmation: 0.75,
      overallQuality: 80,
    },
  };

  const mockTrendline: EnhancedLineV2 = {
    id: 'trend-1',
    price: 105,
    type: 'trendline',
    confidence: 0.75,
    strength: 0.8,
    touchCount: 4,
    supportingTimeframes: ['1h', '4h', '1d'],
    description: 'Ascending trendline',
    touchAnalysis: {
      wickTouchCount: 1,
      bodyTouchCount: 2,
      exactTouchCount: 1,
      touchQualityScore: 75,
      strongBounceCount: 2,
      volumeWeightedStrength: 0.85,
      averageVolume: 1100,
      touchPoints: [],
    },
    qualityMetrics: {
      wickBodyRatio: 0.33,
      volumeConfirmation: 0.7,
      bounceConfirmation: 0.6,
      overallQuality: 70,
    },
    coordinates: {
      startPrice: 100,
      endPrice: 110,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      slope: 0.02,
    },
  };

  const mockDetectionResult = {
    horizontalLines: [mockEnhancedLine],
    trendlines: [mockTrendline],
    detectionStats: {
      totalCandidates: 50,
      qualityFiltered: 20,
      touchFiltered: 10,
      finalLines: 2,
      processingTime: 150,
    },
  };

  const mockDetector = {
    detectEnhancedLines: jest.fn().mockResolvedValue(mockDetectionResult),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValue(mockMultiTimeframeData);
    (enhancedLineDetectorV2 as jest.Mock).mockImplementation(() => mockDetector);
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(enhancedLineAnalysisV2Tool.id).toBe('enhanced-line-analysis-v2');
      expect(enhancedLineAnalysisV2Tool.description).toContain('Advanced multi-timeframe line detection');
      expect(enhancedLineAnalysisV2Tool.description).toContain('Phase 2 Features');
      expect(enhancedLineAnalysisV2Tool.inputSchema).toBeDefined();
    });
  });

  describe('execute - successful analysis', () => {
    it('should perform standard analysis successfully', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(enhancedMarketDataService.fetchMultiTimeframeData).toHaveBeenCalledWith('BTCUSDT');
      expect(enhancedLineDetectorV2).toHaveBeenCalledWith(expect.objectContaining({
        minTimeframes: 2,
        minTouchCount: 3,
        minConfidence: 0.6,
        minQualityScore: 60,
      }));
      expect(mockDetector.detectEnhancedLines).toHaveBeenCalledWith(mockMultiTimeframeData);

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        timestamp: expect.any(String),
        analysisType: 'standard',
        horizontalLines: expect.any(Array),
        trendlines: expect.any(Array),
        touchAnalytics: expect.any(Object),
        qualityMetrics: expect.any(Object),
        marketStructure: expect.any(Object),
        confluenceZones: expect.any(Array),
        keyLevels: expect.any(Array),
        recommendations: expect.any(Object),
        detectionStats: expect.any(Object),
        summary: expect.any(Object),
      });

      expect(result.horizontalLines).toHaveLength(1);
      expect(result.trendlines).toHaveLength(1);
      expect(result.summary.totalLines).toBe(2);
    });

    it('should perform quick analysis with reduced requirements', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'ETHUSDT',
          analysisType: 'quick',
        },
      });

      expect(enhancedLineDetectorV2).toHaveBeenCalledWith(expect.objectContaining({
        minTimeframes: 1,
        minTouchCount: 2,
        minConfidence: 0.5,
        minQualityScore: 40,
        requireVolumeConfirmation: false,
        requireBounceConfirmation: false,
      }));

      expect(result.analysisType).toBe('quick');
    });

    it('should perform comprehensive analysis with strict requirements', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'SOLUSDT',
          analysisType: 'comprehensive',
        },
      });

      expect(enhancedLineDetectorV2).toHaveBeenCalledWith(expect.objectContaining({
        minTimeframes: 3,
        minTouchCount: 4,
        minConfidence: 0.7,
        minQualityScore: 70,
        requireVolumeConfirmation: true,
        requireBounceConfirmation: true,
      }));

      expect(result.analysisType).toBe('comprehensive');
    });

    it('should apply custom configuration', async () => {
      const customConfig = {
        minTouchCount: 5,
        minConfidence: 0.8,
        touchConfig: {
          wickWeight: 0.5,
          bodyWeight: 1.5,
          exactWeight: 2.0,
        },
      };

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
          config: customConfig,
        },
      });

      expect(enhancedLineDetectorV2).toHaveBeenCalledWith(expect.objectContaining({
        minTouchCount: 5,
        minConfidence: 0.8,
        touchConfig: expect.objectContaining({
          wickWeight: 0.5,
          bodyWeight: 1.5,
          exactWeight: 2.0,
        }),
      }));

      expect(result.config).toMatchObject(customConfig);
    });
  });

  describe('execute - line formatting and analysis', () => {
    it('should format enhanced lines correctly', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      const formattedLine = result.horizontalLines[0];
      expect(formattedLine).toMatchObject({
        id: 'line-1',
        price: 100,
        type: 'support',
        confidence: 0.85,
        strength: 0.9,
        touchCount: 5,
        supportingTimeframes: ['1h', '4h'],
        description: 'Strong support level',
        touchAnalysis: {
          touchTypes: {
            wick: 2,
            body: 2,
            exact: 1,
          },
          qualityScore: 85,
          strongBounces: 3,
          volumeWeightedStrength: 0.92,
          averageVolume: 1200,
        },
        qualityMetrics: mockEnhancedLine.qualityMetrics,
      });
    });

    it('should include coordinates for trendlines', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      const formattedTrendline = result.trendlines[0];
      expect(formattedTrendline).toHaveProperty('coordinates');
      expect(formattedTrendline.coordinates).toMatchObject({
        startPrice: 100,
        endPrice: 110,
        slope: 0.02,
      });
    });
  });

  describe('execute - analytics generation', () => {
    it('should generate touch analytics summary', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.touchAnalytics).toMatchObject({
        totalTouchPoints: 9, // 5 + 4
        touchTypeDistribution: {
          wick: 3, // 2 + 1
          body: 4, // 2 + 2
          exact: 2, // 1 + 1
        },
        averageQualityScore: 80, // (85 + 75) / 2
        volumeConfirmedTouches: expect.any(Number),
        bounceConfirmedTouches: 5, // 3 + 2
      });
    });

    it('should generate quality metrics summary', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.qualityMetrics).toMatchObject({
        averageWickBodyRatio: expect.closeTo(0.415, 2), // (0.5 + 0.33) / 2
        averageVolumeConfirmation: 0.75, // (0.8 + 0.7) / 2
        averageBounceConfirmation: expect.closeTo(0.675, 2), // (0.75 + 0.6) / 2
        averageOverallQuality: 75, // (80 + 70) / 2
        qualityDistribution: {
          excellent: 0,
          good: 2, // Both lines have quality 70-80
          acceptable: 0,
          poor: 0,
        },
      });
    });

    it('should handle empty detection results', async () => {
      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: [],
        trendlines: [],
        detectionStats: {
          totalCandidates: 0,
          qualityFiltered: 0,
          touchFiltered: 0,
          finalLines: 0,
          processingTime: 50,
        },
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.touchAnalytics).toMatchObject({
        totalTouchPoints: 0,
        touchTypeDistribution: { wick: 0, body: 0, exact: 0 },
        averageQualityScore: 0,
        volumeConfirmedTouches: 0,
        bounceConfirmedTouches: 0,
      });

      expect(result.qualityMetrics.averageOverallQuality).toBe(0);
    });
  });

  describe('execute - market structure analysis', () => {
    it('should calculate market structure correctly', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.marketStructure).toMatchObject({
        currentPrice: 104, // Last close price from mock data
        currentTrend: expect.any(String),
        trendStrength: expect.any(Number),
        nearestSupport: 100,
        nearestResistance: null, // No resistance above current price in mock
        distanceToSupport: expect.closeTo(3.85, 2), // ((104 - 100) / 104) * 100
        distanceToResistance: null,
        keyLevels: expect.any(Array),
      });
    });

    it('should determine bullish trend from ascending trendlines', async () => {
      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: [],
        trendlines: [
          { ...mockTrendline, coordinates: { ...mockTrendline.coordinates, slope: 0.05 } },
          { ...mockTrendline, id: 'trend-2', coordinates: { ...mockTrendline.coordinates, slope: 0.03 } },
        ],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.marketStructure.currentTrend).toBe('bullish');
    });

    it('should determine bearish trend from descending trendlines', async () => {
      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: [],
        trendlines: [
          { ...mockTrendline, coordinates: { ...mockTrendline.coordinates, slope: -0.05 } },
          { ...mockTrendline, id: 'trend-2', coordinates: { ...mockTrendline.coordinates, slope: -0.03 } },
        ],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.marketStructure.currentTrend).toBe('bearish');
    });
  });

  describe('execute - confluence zones', () => {
    it('should identify confluence zones', async () => {
      const closeLines = [
        { ...mockEnhancedLine, id: 'line-1', price: 100 },
        { ...mockEnhancedLine, id: 'line-2', price: 100.5 }, // Within 1% tolerance
        { ...mockEnhancedLine, id: 'line-3', price: 101 }, // Within 1% tolerance
      ];

      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: closeLines,
        trendlines: [],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.confluenceZones).toHaveLength(3); // Each line can form a zone with nearby lines
      expect(result.confluenceZones[0]).toMatchObject({
        priceRange: {
          min: expect.any(Number),
          max: expect.any(Number),
          center: expect.any(Number),
        },
        strength: expect.any(Number),
        confidence: expect.any(Number),
        lineCount: expect.any(Number),
        supportingTimeframes: expect.any(Array),
        type: 'support',
        description: expect.stringContaining('Confluence zone'),
      });
    });

    it('should not create confluence zones for distant lines', async () => {
      const distantLines = [
        { ...mockEnhancedLine, id: 'line-1', price: 100 },
        { ...mockEnhancedLine, id: 'line-2', price: 110 }, // 10% away
        { ...mockEnhancedLine, id: 'line-3', price: 120 }, // 20% away
      ];

      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: distantLines,
        trendlines: [],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.confluenceZones).toHaveLength(0);
    });
  });

  describe('execute - key levels', () => {
    it('should identify key levels based on confidence and strength', async () => {
      const mixedLines = [
        { ...mockEnhancedLine, id: 'high-1', confidence: 0.95, strength: 0.9 },
        { ...mockEnhancedLine, id: 'high-2', confidence: 0.85, strength: 0.8 },
        { ...mockEnhancedLine, id: 'med-1', confidence: 0.75, strength: 0.7 },
        { ...mockEnhancedLine, id: 'low-1', confidence: 0.65, strength: 0.6 },
      ];

      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: mixedLines,
        trendlines: [],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.keyLevels).toHaveLength(3); // Only confidence >= 0.7
      expect(result.keyLevels[0].id).toBe('high-1'); // Highest confidence * strength
      expect(result.keyLevels[0].importance).toBe('critical'); // confidence > 0.9
      expect(result.keyLevels[1].importance).toBe('high'); // confidence > 0.8
      expect(result.keyLevels[2].importance).toBe('medium'); // confidence > 0.7
    });
  });

  describe('execute - drawing recommendations', () => {
    it('should generate drawing recommendations with proper styling', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.recommendations.drawingActions).toHaveLength(2);
      
      const horizontalAction = result.recommendations.drawingActions.find(a => a.type === 'horizontal_line');
      expect(horizontalAction).toMatchObject({
        action: 'draw',
        type: 'horizontal_line',
        priority: 9, // confidence 0.85 * 10 rounded
        coordinates: {
          startPrice: 100,
          endPrice: 100,
        },
        style: {
          color: '#00ff00', // support = green
          lineWidth: 3, // strength 0.9 * 3
          lineStyle: 'solid', // confidence > 0.8
        },
        description: expect.stringContaining('support at 100.00'),
      });

      const trendlineAction = result.recommendations.drawingActions.find(a => a.type === 'trendline');
      expect(trendlineAction).toMatchObject({
        action: 'draw',
        type: 'trendline',
        priority: 8, // confidence 0.75 * 10 rounded
        coordinates: mockTrendline.coordinates,
        style: {
          color: '#00aa00', // ascending = green
          lineWidth: 2, // strength 0.8 * 3 rounded
          lineStyle: 'solid',
        },
      });
    });

    it('should limit recommendations', async () => {
      const manyLines = Array(20).fill(null).map((_, i) => ({
        ...mockEnhancedLine,
        id: `line-${i}`,
        price: 100 + i,
      }));

      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: manyLines,
        trendlines: Array(10).fill(mockTrendline),
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.recommendations.drawingActions.filter(a => a.type === 'horizontal_line')).toHaveLength(8);
      expect(result.recommendations.drawingActions.filter(a => a.type === 'trendline')).toHaveLength(5);
    });
  });

  describe('execute - error handling', () => {
    it('should handle market data fetch failure', async () => {
      (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockRejectedValueOnce(
        new Error('API error')
      );

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[EnhancedLineAnalysisV2Tool] Analysis failed',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          error: 'API error',
        })
      );

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        error: 'API error',
        horizontalLines: [],
        trendlines: [],
        detectionStats: expect.any(Object),
      });
    });

    it('should handle detection failure', async () => {
      mockDetector.detectEnhancedLines.mockRejectedValueOnce(new Error('Detection failed'));

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.error).toBe('Detection failed');
      expect(result.horizontalLines).toEqual([]);
      expect(result.trendlines).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      mockDetector.detectEnhancedLines.mockRejectedValueOnce('String error');

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.error).toBe('Analysis failed');
    });
  });

  describe('execute - performance metrics', () => {
    it('should calculate performance and reliability metrics', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.detectionStats).toMatchObject({
        totalCandidates: 50,
        qualityFiltered: 20,
        touchFiltered: 10,
        finalLines: 2,
        processingTime: 150,
        detectionTime: expect.any(Number),
        dataQuality: expect.any(Number),
        reliability: expect.any(Number),
      });

      expect(result.detectionStats.dataQuality).toBeGreaterThan(0);
      expect(result.detectionStats.dataQuality).toBeLessThanOrEqual(1);
      expect(result.detectionStats.reliability).toBeGreaterThan(0);
      expect(result.detectionStats.reliability).toBeLessThanOrEqual(1);
    });

    it('should include comprehensive summary', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.summary).toMatchObject({
        totalLines: 2,
        highConfidenceLines: 1, // Only mockEnhancedLine has confidence >= 0.8
        multiTimeframeLines: 2, // Both have 2+ timeframes
        averageQuality: 75,
        averageConfidence: 0.8,
        detectionTime: expect.any(Number),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty timeframe data', async () => {
      (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValueOnce({
        timeframes: {},
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.marketStructure.currentPrice).toBe(0);
      expect(result.detectionStats.dataQuality).toBe(0.5); // Base quality
    });

    it('should handle invalid analysis type with fallback', async () => {
      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'invalid' as any,
        },
      });

      // Should fall back to standard config
      expect(enhancedLineDetectorV2).toHaveBeenCalledWith(expect.objectContaining({
        minTimeframes: 2,
        minTouchCount: 3,
        minConfidence: 0.6,
      }));
    });

    it('should handle concurrent executions', async () => {
      const promises = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(symbol =>
        executeEnhancedLineAnalysisV2({
          context: { symbol, analysisType: 'standard' },
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.symbol).toBe(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][index]);
        expect(result.horizontalLines).toBeDefined();
        expect(result.trendlines).toBeDefined();
      });
    });

    it('should handle lines without coordinates gracefully', async () => {
      const lineWithoutCoords = { ...mockTrendline };
      delete lineWithoutCoords.coordinates;

      mockDetector.detectEnhancedLines.mockResolvedValueOnce({
        horizontalLines: [],
        trendlines: [lineWithoutCoords],
        detectionStats: mockDetectionResult.detectionStats,
      });

      const result = await executeEnhancedLineAnalysisV2({
        context: {
          symbol: 'BTCUSDT',
          analysisType: 'standard',
        },
      });

      expect(result.trendlines[0]).not.toHaveProperty('coordinates');
      expect(result.recommendations.drawingActions).toHaveLength(0); // No trendline drawing without coordinates
    });
  });
});