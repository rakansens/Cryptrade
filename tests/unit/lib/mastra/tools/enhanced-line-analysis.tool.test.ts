import { jest } from '@jest/globals';
import { z } from 'zod';
import { enhancedLineAnalysisTool } from '@/lib/mastra/tools/enhanced-line-analysis.tool';
import type { DetectedLine, LineDetectionResult } from '@/lib/analysis/multi-timeframe-line-detector';
import type { MultiTimeframeData } from '@/lib/services/enhanced-market-data.service';
import type { ConfluenceZone, EnhancedLine, MarketStructure } from '@/lib/mastra/tools/enhanced-line-analysis.tool';

// Mock dependencies
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/analysis/multi-timeframe-line-detector');
jest.mock('@/lib/services/enhanced-market-data.service');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const fixedNow = new Date('2024-01-15T12:00:00.000Z').getTime();

const mockDetectedLine: DetectedLine = {
  id: 'line-1',
  type: 'support',
  price: 45000,
  strength: 0.85,
  confidence: 0.9,
  touchCount: 5,
  supportingTimeframes: ['1h', '4h', '1d'],
  firstDetected: fixedNow - 7 * 24 * 60 * 60 * 1000,
  lastTouched: fixedNow - 1 * 24 * 60 * 60 * 1000,
  points: [
    { time: fixedNow - 7 * 24 * 60 * 60 * 1000, price: 45000, timeframe: '1h' },
    { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 45050, timeframe: '4h' },
    { time: fixedNow - 3 * 24 * 60 * 60 * 1000, price: 44980, timeframe: '1d' },
    { time: fixedNow - 1 * 24 * 60 * 60 * 1000, price: 45020, timeframe: '1h' }
  ]
};

const mockConfluenceZone: ConfluenceZone = {
  type: 'support',
  priceRange: {
    min: 44900,
    max: 45100,
    center: 45000
  },
  timeframeCount: 3,
  strength: 0.88,
  supportingTimeframes: ['1h', '4h', '1d'],
  description: 'Strong support confluence zone'
};

const mockLineDetectionResult: LineDetectionResult = {
  symbol: 'BTCUSDT',
  horizontalLines: [
    mockDetectedLine,
    { ...mockDetectedLine, id: 'line-2', type: 'resistance', price: 48000, strength: 0.75 }
  ],
  trendlines: [
    {
      ...mockDetectedLine,
      id: 'trendline-1',
      type: 'trendline',
      price: 46000,
      points: [
        { time: fixedNow - 10 * 24 * 60 * 60 * 1000, price: 44000, timeframe: '1d' },
        { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 45000, timeframe: '1d' },
        { time: fixedNow, price: 46000, timeframe: '1d' }
      ]
    }
  ],
  confluenceZones: [mockConfluenceZone],
  summary: {
    totalLines: 3,
    highConfidenceLines: 2,
    multiTimeframeLines: 3,
    averageStrength: 0.83,
    detectionTime: 150
  },
  config: {
    minTimeframes: 2,
    priceTolerancePercent: 0.5,
    minTouchCount: 3,
    confluenceZoneWidth: 1.0,
    strengthThreshold: 0.6,
    recencyWeight: 0.3
  }
};

const mockMultiTimeframeData: MultiTimeframeData = {
  symbol: 'BTCUSDT',
  timeframes: {
    '1h': {
      data: [
        { time: fixedNow - 60 * 60 * 1000, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 },
        { time: fixedNow, open: 46200, high: 46400, low: 46000, close: 46300, volume: 1200 }
      ],
      weight: 0.3,
      dataPoints: 2
    },
    '4h': {
      data: [
        { time: fixedNow - 4 * 60 * 60 * 1000, open: 45500, high: 46500, low: 45500, close: 46200, volume: 5000 },
        { time: fixedNow, open: 46200, high: 46400, low: 46000, close: 46300, volume: 5500 }
      ],
      weight: 0.5,
      dataPoints: 2
    },
    '1d': {
      data: [
        { time: fixedNow - 24 * 60 * 60 * 1000, open: 45000, high: 46500, low: 45000, close: 46200, volume: 20000 },
        { time: fixedNow, open: 46200, high: 46500, low: 46000, close: 46300, volume: 22000 }
      ],
      weight: 1.0,
      dataPoints: 2
    }
  },
  fetchedAt: fixedNow
};

// Import mocked modules
import { logger } from '@/lib/utils/logger';
import { multiTimeframeLineDetector } from '@/lib/analysis/multi-timeframe-line-detector';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

describe('enhancedLineAnalysisTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (logger as any).info = mockLogger.info;
    (logger as any).error = mockLogger.error;
    (logger as any).warn = mockLogger.warn;
    (logger as any).debug = mockLogger.debug;
    
    (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(mockLineDetectionResult);
    (multiTimeframeLineDetector.updateConfig as jest.Mock).mockReturnValue(undefined);
    (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValue(mockMultiTimeframeData);
  });

  describe('tool configuration', () => {
    it('should have correct tool metadata', () => {
      expect(enhancedLineAnalysisTool.id).toBe('enhanced-line-analysis');
      expect(enhancedLineAnalysisTool.description).toContain('multi-timeframe line analysis');
      expect(enhancedLineAnalysisTool.inputSchema).toBeDefined();
      expect(enhancedLineAnalysisTool.outputSchema).toBeDefined();
    });

    it('should validate input schema correctly', () => {
      const validInput = {
        symbol: 'BTCUSDT',
        analysisType: 'full' as const,
        config: {
          minTimeframes: 2,
          priceTolerancePercent: 0.5,
          minTouchCount: 3,
          confluenceZoneWidth: 1.0,
          strengthThreshold: 0.6,
          recencyWeight: 0.3
        },
        returnRawData: false,
        focusTimeframes: ['1h', '4h'],
        priceRange: { min: 40000, max: 50000 }
      };

      const result = enhancedLineAnalysisTool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid analysis types', () => {
      const invalidInput = {
        symbol: 'BTCUSDT',
        analysisType: 'invalid_type' as any
      };

      const result = enhancedLineAnalysisTool.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('execute method', () => {
    it('should perform full analysis successfully', async () => {
      const context = {
        symbol: 'BTCUSDT',
        analysisType: 'full' as const,
        returnRawData: false
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(multiTimeframeLineDetector.detectLines).toHaveBeenCalledWith('BTCUSDT', undefined);
      expect(enhancedMarketDataService.fetchMultiTimeframeData).toHaveBeenCalledWith('BTCUSDT');
      
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.horizontalLines).toHaveLength(2);
      expect(result.trendlines).toHaveLength(1);
      expect(result.confluenceZones).toHaveLength(1);
      expect(result.summary.totalLines).toBe(3);
      expect(result.marketStructure).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should apply custom configuration', async () => {
      const customConfig = {
        minTimeframes: 3,
        priceTolerancePercent: 1.0,
        minTouchCount: 5,
        confluenceZoneWidth: 2.0,
        strengthThreshold: 0.8,
        recencyWeight: 0.5
      };

      const context = {
        symbol: 'BTCUSDT',
        config: customConfig
      };

      await enhancedLineAnalysisTool.execute({ context });

      expect(multiTimeframeLineDetector.updateConfig).toHaveBeenCalledWith(customConfig);
      expect(multiTimeframeLineDetector.detectLines).toHaveBeenCalledWith('BTCUSDT', customConfig);
    });

    it('should filter by analysis type - horizontal_only', async () => {
      const context = {
        symbol: 'BTCUSDT',
        analysisType: 'horizontal_only' as const
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.horizontalLines).toHaveLength(2);
      expect(result.trendlines).toHaveLength(0);
    });

    it('should filter by analysis type - trendlines_only', async () => {
      const context = {
        symbol: 'BTCUSDT',
        analysisType: 'trendlines_only' as const
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(1);
      expect(result.confluenceZones).toHaveLength(0);
    });

    it('should filter by analysis type - confluence_zones', async () => {
      const context = {
        symbol: 'BTCUSDT',
        analysisType: 'confluence_zones' as const
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      // Should only include horizontal lines within confluence zones
      expect(result.horizontalLines.every(line => 
        line.price >= 44900 && line.price <= 45100
      )).toBe(true);
    });

    it('should apply price range filter', async () => {
      const context = {
        symbol: 'BTCUSDT',
        priceRange: { min: 46000, max: 47000 }
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.horizontalLines.every(line => 
        line.price >= 46000 && line.price <= 47000
      )).toBe(true);
      expect(result.trendlines.every(line => 
        line.price >= 46000 && line.price <= 47000
      )).toBe(true);
    });

    it('should include raw data when requested', async () => {
      const context = {
        symbol: 'BTCUSDT',
        returnRawData: true
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.rawData).toBeDefined();
      expect(result.rawData?.multiTimeframeData).toBeDefined();
      expect(result.rawData?.detectionDetails).toBeDefined();
      expect(result.rawData?.multiTimeframeData?.symbol).toBe('BTCUSDT');
    });

    it('should handle errors gracefully', async () => {
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockRejectedValue(
        new Error('Detection failed')
      );

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[EnhancedLineAnalysis] Analysis failed',
        expect.objectContaining({
          error: 'Detection failed'
        })
      );

      // Should return fallback data
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
      expect(result.summary.totalLines).toBe(0);
      expect(result.marketStructure.currentTrend).toBe('sideways');
      expect(result.recommendations.analysis).toContain('データの取得に失敗しました');
    });
  });

  describe('enhanced line generation', () => {
    it('should enhance support lines correctly', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const supportLine = result.horizontalLines.find(line => line.type === 'support');

      expect(supportLine).toBeDefined();
      expect(supportLine?.description).toContain('サポートライン');
      expect(supportLine?.description).toContain('5回タッチ');
      expect(supportLine?.description).toContain('3つの時間足で確認');
      expect(supportLine?.tradingImplication).toBe('bullish');
      expect(supportLine?.targetLevels).toBeDefined();
      expect(supportLine?.stopLossLevel).toBeDefined();
    });

    it('should enhance resistance lines correctly', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const resistanceLine = result.horizontalLines.find(line => line.type === 'resistance');

      expect(resistanceLine).toBeDefined();
      expect(resistanceLine?.description).toContain('レジスタンスライン');
      expect(resistanceLine?.tradingImplication).toBe('bearish');
      expect(resistanceLine?.targetLevels).toBeDefined();
      expect(resistanceLine?.stopLossLevel).toBeDefined();
    });

    it('should enhance trendlines with slope analysis', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const trendline = result.trendlines[0];

      expect(trendline).toBeDefined();
      expect(trendline?.description).toContain('トレンドライン');
      expect(trendline?.tradingImplication).toBeDefined();
    });

    it.skip('should mark lines as approaching when price is near', async () => {
      // Mock current price very close to support
      const closeData = JSON.parse(JSON.stringify(mockMultiTimeframeData));
      closeData.timeframes['1d'].data[1].close = 45100; // Very close to support at 45000
      (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValue(closeData);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const supportLine = result.horizontalLines.find(line => line.type === 'support');

      expect(supportLine?.description).toContain('（価格が接近中）');
    });
  });

  describe('market structure analysis', () => {
    it.skip('should analyze bullish market structure', async () => {
      // Mock bullish trendlines
      const bullishResult = JSON.parse(JSON.stringify(mockLineDetectionResult));
      bullishResult.trendlines = [{
        ...mockDetectedLine,
        id: 'trendline-bullish',
        type: 'trendline',
        lastTouched: fixedNow, // Add lastTouched for recent trendline
        points: [
          { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 44000, timeframe: '1d' },
          { time: fixedNow, price: 48000, timeframe: '1d' } // Upward slope
        ]
      }];
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(bullishResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.marketStructure.currentTrend).toBe('bullish');
      expect(result.marketStructure.trendStrength).toBeGreaterThan(0.5);
    });

    it.skip('should analyze bearish market structure', async () => {
      // Mock bearish trendlines
      const bearishResult = JSON.parse(JSON.stringify(mockLineDetectionResult));
      bearishResult.trendlines = [{
        ...mockDetectedLine,
        id: 'trendline-bearish',
        type: 'trendline',
        lastTouched: fixedNow, // Add lastTouched for recent trendline
        points: [
          { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 48000, timeframe: '1d' },
          { time: fixedNow, price: 44000, timeframe: '1d' } // Downward slope
        ]
      }];
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(bearishResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.marketStructure.currentTrend).toBe('bearish');
      expect(result.marketStructure.trendStrength).toBeGreaterThan(0.5);
    });

    it('should identify key levels correctly', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.marketStructure.keyLevels).toBeDefined();
      expect(result.marketStructure.keyLevels.length).toBeGreaterThan(0);
      
      const keyLevel = result.marketStructure.keyLevels[0];
      expect(keyLevel).toHaveProperty('price');
      expect(keyLevel).toHaveProperty('type');
      expect(keyLevel).toHaveProperty('importance');
      expect(['critical', 'major', 'minor']).toContain(keyLevel.importance);
    });

    it('should calculate price action metrics', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.marketStructure.priceAction.currentPrice).toBe(46300);
      expect(result.marketStructure.priceAction.nearestSupport).toBe(45000);
      expect(result.marketStructure.priceAction.nearestResistance).toBe(48000);
      expect(result.marketStructure.priceAction.distanceToSupport).toBeDefined();
      expect(result.marketStructure.priceAction.distanceToResistance).toBeDefined();
    });
  });

  describe('confluence zone enhancement', () => {
    it('should enhance confluence zones with descriptions', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.confluenceZones[0].description).toContain('サポート集約ゾーン');
      expect(result.confluenceZones[0].description).toContain('3つの時間足が合致');
    });

    it.skip('should mark approaching confluence zones', async () => {
      // Mock current price very close to confluence zone
      const closeData = JSON.parse(JSON.stringify(mockMultiTimeframeData));
      closeData.timeframes['1d'].data[1].close = 45050; // Within confluence zone
      (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValue(closeData);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.confluenceZones[0].description).toContain('（価格が接近中）');
    });
  });

  describe('drawing recommendations', () => {
    it('should generate horizontal line drawing actions', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const horizontalDrawing = result.recommendations.drawingActions.find(
        action => action.type === 'support' || action.type === 'resistance'
      );

      expect(horizontalDrawing).toBeDefined();
      expect(horizontalDrawing?.action).toBe('draw_line');
      expect(horizontalDrawing?.coordinates.startPrice).toBeDefined();
      expect(horizontalDrawing?.coordinates.endPrice).toBeDefined();
      expect(horizontalDrawing?.style.color).toBeDefined();
      expect(horizontalDrawing?.style.lineWidth).toBeGreaterThan(0);
      expect(horizontalDrawing?.priority).toBeGreaterThan(0);
    });

    it('should generate trendline drawing actions', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const trendlineDrawing = result.recommendations.drawingActions.find(
        action => action.type === 'trendline'
      );

      expect(trendlineDrawing).toBeDefined();
      expect(trendlineDrawing?.action).toBe('draw_line');
      expect(trendlineDrawing?.style.color).toMatch(/#00E676|#FF5722/); // Bullish or bearish color
    });

    it('should generate confluence zone highlighting', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const zoneDrawing = result.recommendations.drawingActions.find(
        action => action.action === 'highlight_confluence'
      );

      expect(zoneDrawing).toBeDefined();
      expect(zoneDrawing?.type).toBe('zone');
      expect(zoneDrawing?.style.opacity).toBeLessThan(0.5);
      expect(zoneDrawing?.style.lineStyle).toBe('dotted');
    });

    it('should sort drawing actions by priority', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });
      const priorities = result.recommendations.drawingActions.map(action => action.priority);

      // Check if sorted in descending order
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i - 1]).toBeGreaterThanOrEqual(priorities[i]);
      }
    });
  });

  describe('trading setup generation', () => {
    it.skip('should generate bullish trading setup', async () => {
      // Mock bullish market structure
      const bullishResult = JSON.parse(JSON.stringify(mockLineDetectionResult));
      bullishResult.trendlines = [{
        ...mockDetectedLine,
        id: 'trendline-bullish',
        type: 'trendline',
        lastTouched: fixedNow, // Recent trendline
        points: [
          { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 44000, timeframe: '1d' },
          { time: fixedNow, price: 48000, timeframe: '1d' }
        ]
      }];
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(bullishResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.tradingSetup?.bias).toBe('bullish');
      expect(result.recommendations.tradingSetup?.entryZones.some(zone => zone.type === 'buy')).toBe(true);
      expect(result.recommendations.tradingSetup?.stopLossLevels.length).toBeGreaterThan(0);
      expect(result.recommendations.tradingSetup?.targetLevels.length).toBeGreaterThan(0);
    });

    it.skip('should generate bearish trading setup', async () => {
      // Mock bearish market structure
      const bearishResult = JSON.parse(JSON.stringify(mockLineDetectionResult));
      bearishResult.trendlines = [{
        ...mockDetectedLine,
        id: 'trendline-bearish',
        type: 'trendline',
        lastTouched: fixedNow, // Recent trendline
        points: [
          { time: fixedNow - 5 * 24 * 60 * 60 * 1000, price: 48000, timeframe: '1d' },
          { time: fixedNow, price: 44000, timeframe: '1d' }
        ]
      }];
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(bearishResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.tradingSetup?.bias).toBe('bearish');
      expect(result.recommendations.tradingSetup?.entryZones.some(zone => zone.type === 'sell')).toBe(true);
    });

    it('should calculate risk-reward ratio', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      if (result.recommendations.tradingSetup?.riskRewardRatio) {
        expect(result.recommendations.tradingSetup.riskRewardRatio).toBeGreaterThan(0);
        expect(result.recommendations.tradingSetup.riskRewardRatio).toBeLessThan(10);
      }
    });
  });

  describe('analysis text generation', () => {
    it('should generate comprehensive analysis text', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.analysis).toContain('多時間足分析結果');
      expect(result.recommendations.analysis).toContain('市場構造');
      expect(result.recommendations.analysis).toMatch(/上昇トレンド|下降トレンド|レンジ相場/);
    });

    it('should include nearest support/resistance in analysis', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.analysis).toContain('最寄りサポート');
      expect(result.recommendations.analysis).toContain('最寄りレジスタンス');
    });

    it('should include high confidence lines in analysis', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.analysis).toContain('高信頼度ライン');
    });

    it('should include confluence zones in analysis', async () => {
      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.recommendations.analysis).toContain('集約ゾーン');
    });
  });

  describe('edge cases', () => {
    it('should handle empty detection results', async () => {
      const emptyResult: LineDetectionResult = {
        symbol: 'BTCUSDT',
        horizontalLines: [],
        trendlines: [],
        confluenceZones: [],
        summary: {
          totalLines: 0,
          highConfidenceLines: 0,
          multiTimeframeLines: 0,
          averageStrength: 0,
          detectionTime: 100
        },
        config: mockLineDetectionResult.config
      };
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(emptyResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      expect(result.horizontalLines).toHaveLength(0);
      expect(result.trendlines).toHaveLength(0);
      expect(result.confluenceZones).toHaveLength(0);
      expect(result.summary.totalLines).toBe(0);
    });

    it('should handle missing market data gracefully', async () => {
      const emptyMarketData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {},
        fetchedAt: Date.now()
      };
      (enhancedMarketDataService.fetchMultiTimeframeData as jest.Mock).mockResolvedValue(emptyMarketData);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      // Should use default price
      expect(result.marketStructure.priceAction.currentPrice).toBe(50000);
    });

    it('should handle trendlines with insufficient points', async () => {
      const insufficientResult = { ...mockLineDetectionResult };
      insufficientResult.trendlines = [{
        ...mockDetectedLine,
        id: 'trendline-insufficient',
        type: 'trendline',
        points: [{ time: Date.now(), price: 46000, timeframe: '1d' }] // Only one point
      }];
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(insufficientResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      // Should handle gracefully without errors
      expect(result.trendlines).toBeDefined();
      expect(result.recommendations.drawingActions).toBeDefined();
    });

    it('should limit number of lines in recommendations', async () => {
      // Create many lines
      const manyLines = Array.from({ length: 20 }, (_, i) => ({
        ...mockDetectedLine,
        id: `line-${i}`,
        price: 45000 + i * 100,
        confidence: 0.9 - i * 0.01
      }));

      const manyLinesResult = { ...mockLineDetectionResult, horizontalLines: manyLines };
      (multiTimeframeLineDetector.detectLines as jest.Mock).mockResolvedValue(manyLinesResult);

      const context = {
        symbol: 'BTCUSDT'
      };

      const result = await enhancedLineAnalysisTool.execute({ context });

      // Should limit to top 5 horizontal lines in drawing actions
      const horizontalDrawings = result.recommendations.drawingActions.filter(
        action => action.type === 'support' || action.type === 'resistance'
      );
      expect(horizontalDrawings.length).toBeLessThanOrEqual(5);
    });
  });
});