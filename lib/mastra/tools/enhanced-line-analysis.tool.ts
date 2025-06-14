import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { multiTimeframeLineDetector, type LineDetectionConfig, type DetectedLine, type LineDetectionResult } from '@/lib/analysis/multi-timeframe-line-detector';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

// Type definitions for enhanced line analysis
interface TimeframeDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TimeframeData {
  data: TimeframeDataPoint[];
  timeframe: string;
  lastUpdate: number;
}

interface MultiTimeframeData {
  timeframes: Record<string, TimeframeData>;
  symbol: string;
  timestamp: number;
}

interface ConfluenceZone {
  type: 'support' | 'resistance' | 'pivot';
  priceRange: {
    min: number;
    max: number;
    center: number;
  };
  timeframeCount: number;
  strength: number;
  description?: string;
}

interface MarketStructure {
  currentTrend: 'bullish' | 'bearish' | 'sideways';
  trendStrength: number;
  keyLevels: Array<{
    price: number;
    type: 'support' | 'resistance';
    importance: 'critical' | 'major' | 'minor';
  }>;
  priceAction: {
    currentPrice: number;
    nearestSupport?: number;
    nearestResistance?: number;
    distanceToSupport?: number;
    distanceToResistance?: number;
  };
}

interface EnhancedLine extends DetectedLine {
  description: string;
  tradingImplication: string;
}

interface DrawingAction {
  action: 'draw_line' | 'draw_zone' | 'highlight_confluence';
  type: 'support' | 'resistance' | 'trendline' | 'zone';
  coordinates: {
    startTime: number;
    startPrice: number;
    endTime?: number;
    endPrice?: number;
  };
  style: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
  };
  priority: number;
  description: string;
}

/**
 * Enhanced Line Analysis Tool
 * 
 * Uses multi-timeframe analysis to detect high-accuracy support/resistance lines
 * and trendlines with cross-timeframe validation and confluence zone identification.
 */

const LineDetectionConfigSchema = z.object({
  minTimeframes: z.number().min(1).max(4).default(2).describe('Minimum number of timeframes that must support a line'),
  priceTolerancePercent: z.number().min(0.1).max(2.0).default(0.5).describe('Price tolerance percentage for level grouping'),
  minTouchCount: z.number().min(2).max(10).default(3).describe('Minimum number of price touches required'),
  confluenceZoneWidth: z.number().min(0.5).max(3.0).default(1.0).describe('Width of confluence zones as percentage'),
  strengthThreshold: z.number().min(0.1).max(1.0).default(0.6).describe('Minimum strength threshold for line detection'),
  recencyWeight: z.number().min(0.0).max(1.0).default(0.3).describe('Weight given to recent price touches')
});

const EnhancedLineAnalysisInput = z.object({
  symbol: z.string().default('BTCUSDT').describe('Trading symbol to analyze'),
  analysisType: z.enum(['full', 'horizontal_only', 'trendlines_only', 'confluence_zones']).default('full').describe('Type of analysis to perform'),
  config: LineDetectionConfigSchema.optional().describe('Custom configuration for line detection'),
  returnRawData: z.boolean().default(false).describe('Whether to include raw market data in response'),
  focusTimeframes: z.array(z.string()).optional().describe('Specific timeframes to focus on (e.g., ["1h", "4h"])'),
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional().describe('Price range to focus analysis on')
});

const DetectedLineSchema = z.object({
  id: z.string(),
  type: z.enum(['support', 'resistance', 'trendline']),
  price: z.number(),
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  touchCount: z.number(),
  supportingTimeframes: z.array(z.string()),
  firstDetected: z.number(),
  lastTouched: z.number(),
  points: z.array(z.object({
    time: z.number(),
    price: z.number(),
    timeframe: z.string()
  })),
  description: z.string().optional(),
  tradingImplication: z.enum(['bullish', 'bearish', 'neutral']).optional(),
  targetLevels: z.array(z.number()).optional(),
  stopLossLevel: z.number().optional()
});

const ConfluenceZoneSchema = z.object({
  priceRange: z.object({
    min: z.number(),
    max: z.number(),
    center: z.number()
  }),
  strength: z.number().min(0).max(1),
  timeframeCount: z.number(),
  supportingTimeframes: z.array(z.string()),
  type: z.enum(['support', 'resistance', 'pivot']),
  description: z.string().optional()
});

const EnhancedLineAnalysisOutput = z.object({
  symbol: z.string(),
  analysisTimestamp: z.number(),
  
  horizontalLines: z.array(DetectedLineSchema),
  trendlines: z.array(DetectedLineSchema),
  confluenceZones: z.array(ConfluenceZoneSchema),
  
  summary: z.object({
    totalLines: z.number(),
    highConfidenceLines: z.number(),
    multiTimeframeLines: z.number(),
    strongestSupport: z.number().optional(),
    strongestResistance: z.number().optional(),
    averageStrength: z.number(),
    detectionTime: z.number()
  }),
  
  marketStructure: z.object({
    currentTrend: z.enum(['bullish', 'bearish', 'sideways']),
    trendStrength: z.number().min(0).max(1),
    keyLevels: z.array(z.object({
      price: z.number(),
      type: z.enum(['support', 'resistance', 'pivot']),
      importance: z.enum(['critical', 'major', 'minor'])
    })),
    priceAction: z.object({
      currentPrice: z.number(),
      nearestSupport: z.number().optional(),
      nearestResistance: z.number().optional(),
      distanceToSupport: z.number().optional(),
      distanceToResistance: z.number().optional()
    })
  }),
  
  recommendations: z.object({
    drawingActions: z.array(z.object({
      action: z.enum(['draw_line', 'draw_zone', 'highlight_confluence']),
      type: z.enum(['support', 'resistance', 'trendline', 'zone']),
      coordinates: z.object({
        startTime: z.number(),
        startPrice: z.number(),
        endTime: z.number().optional(),
        endPrice: z.number().optional()
      }),
      style: z.object({
        color: z.string(),
        lineWidth: z.number(),
        lineStyle: z.enum(['solid', 'dashed', 'dotted']),
        opacity: z.number().optional()
      }),
      priority: z.number().min(1).max(10),
      description: z.string()
    })),
    analysis: z.string(),
    tradingSetup: z.object({
      bias: z.enum(['bullish', 'bearish', 'neutral']),
      entryZones: z.array(z.object({
        price: z.number(),
        type: z.enum(['buy', 'sell']),
        confidence: z.number().min(0).max(1)
      })),
      stopLossLevels: z.array(z.number()),
      targetLevels: z.array(z.number()),
      riskRewardRatio: z.number().optional()
    }).optional()
  }),
  
  config: LineDetectionConfigSchema,
  
  rawData: z.object({
    multiTimeframeData: z.object({
      timeframes: z.record(z.object({
        data: z.array(z.object({
          time: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number()
        })),
        timeframe: z.string(),
        lastUpdate: z.number()
      })),
      symbol: z.string(),
      timestamp: z.number()
    }).optional(),
    detectionDetails: z.object({
      symbol: z.string(),
      horizontalLines: z.array(DetectedLineSchema),
      trendlines: z.array(DetectedLineSchema),
      confluenceZones: z.array(ConfluenceZoneSchema),
      summary: z.object({
        totalLines: z.number(),
        highConfidenceLines: z.number(),
        multiTimeframeLines: z.number(),
        averageStrength: z.number(),
        detectionTime: z.number()
      }),
      config: LineDetectionConfigSchema
    }).optional()
  }).optional()
});

export const enhancedLineAnalysisTool = createTool({
  id: 'enhanced-line-analysis',
  description: `
    Advanced multi-timeframe line analysis tool for high-accuracy support/resistance detection.
    
    Features:
    - Multi-timeframe data integration (15m, 1h, 4h, 1d)
    - Cross-timeframe validation for improved accuracy
    - Confluence zone identification where multiple timeframes agree
    - Weighted importance based on timeframe significance
    - Trendline detection with slope analysis
    - Comprehensive market structure analysis
    - Intelligent drawing recommendations
    
    Use this tool to:
    - Identify high-confidence support/resistance levels
    - Find critical confluence zones
    - Detect valid trendlines with multi-timeframe confirmation
    - Generate precise drawing recommendations for chart analysis
    - Get comprehensive market structure insights
    - Plan trading setups based on technical levels
  `,
  inputSchema: EnhancedLineAnalysisInput,
  outputSchema: EnhancedLineAnalysisOutput,

  execute: async ({ context }): Promise<z.infer<typeof EnhancedLineAnalysisOutput>> => {
    const {
      symbol = 'BTCUSDT',
      analysisType = 'full',
      config,
      returnRawData = false,
      focusTimeframes,
      priceRange
    } = context;

    const startTime = Date.now();

    try {
      logger.info('[EnhancedLineAnalysis] Starting multi-timeframe analysis', {
        symbol,
        analysisType,
        config,
        focusTimeframes
      });

      // Configure the line detector if custom config provided
      if (config) {
        multiTimeframeLineDetector.updateConfig(config);
      }

      // Perform line detection
      const detectionResult: LineDetectionResult = await multiTimeframeLineDetector.detectLines(symbol, config);

      // Filter results based on analysis type
      let horizontalLines = detectionResult.horizontalLines;
      let trendlines = detectionResult.trendlines;
      let confluenceZones = detectionResult.confluenceZones;

      if (analysisType === 'horizontal_only') {
        trendlines = [];
      } else if (analysisType === 'trendlines_only') {
        horizontalLines = [];
        confluenceZones = [];
      } else if (analysisType === 'confluence_zones') {
        horizontalLines = horizontalLines.filter(line => 
          confluenceZones.some(zone => 
            line.price >= zone.priceRange.min && line.price <= zone.priceRange.max
          )
        );
      }

      // Filter by price range if specified
      if (priceRange) {
        if (priceRange.min) {
          horizontalLines = horizontalLines.filter(line => line.price >= priceRange.min!);
          trendlines = trendlines.filter(line => line.price >= priceRange.min!);
        }
        if (priceRange.max) {
          horizontalLines = horizontalLines.filter(line => line.price <= priceRange.max!);
          trendlines = trendlines.filter(line => line.price <= priceRange.max!);
        }
      }

      // Get current market data for analysis
      const currentMarketData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
      const currentPrice = getCurrentPrice(currentMarketData);

      // Analyze market structure
      const marketStructure = analyzeMarketStructure(
        horizontalLines,
        trendlines,
        confluenceZones,
        currentPrice
      );

      // Generate enhanced lines with descriptions
      const enhancedHorizontalLines = enhanceDetectedLines(horizontalLines, currentPrice, 'horizontal');
      const enhancedTrendlines = enhanceDetectedLines(trendlines, currentPrice, 'trendline');
      const enhancedConfluenceZones = enhanceConfluenceZones(confluenceZones, currentPrice);

      // Generate drawing recommendations
      const recommendations = generateAdvancedRecommendations(
        enhancedHorizontalLines,
        enhancedTrendlines,
        enhancedConfluenceZones,
        marketStructure,
        currentPrice
      );

      // Calculate enhanced summary
      const allLines = [...enhancedHorizontalLines, ...enhancedTrendlines];
      const enhancedSummary = {
        ...detectionResult.summary,
        strongestSupport: findStrongestLevel(enhancedHorizontalLines, 'support'),
        strongestResistance: findStrongestLevel(enhancedHorizontalLines, 'resistance')
      };

      const result = {
        symbol,
        analysisTimestamp: Date.now(),
        horizontalLines: enhancedHorizontalLines,
        trendlines: enhancedTrendlines,
        confluenceZones: enhancedConfluenceZones,
        summary: enhancedSummary,
        marketStructure,
        recommendations,
        config: detectionResult.config,
        rawData: returnRawData ? {
          multiTimeframeData: currentMarketData,
          detectionDetails: detectionResult
        } : undefined
      };

      logger.info('[EnhancedLineAnalysis] Analysis completed successfully', {
        symbol,
        duration: Date.now() - startTime,
        totalLines: allLines.length,
        highConfidenceLines: enhancedSummary.highConfidenceLines
      });

      return result;

    } catch (error) {
      logger.error('[EnhancedLineAnalysis] Analysis failed', {
        symbol,
        analysisType,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback data
      const fallbackPrice = 50000; // Default BTC price
      return {
        symbol,
        analysisTimestamp: Date.now(),
        horizontalLines: [],
        trendlines: [],
        confluenceZones: [],
        summary: {
          totalLines: 0,
          highConfidenceLines: 0,
          multiTimeframeLines: 0,
          averageStrength: 0,
          detectionTime: Date.now() - startTime
        },
        marketStructure: {
          currentTrend: 'sideways',
          trendStrength: 0.5,
          keyLevels: [],
          priceAction: {
            currentPrice: fallbackPrice
          }
        },
        recommendations: {
          drawingActions: [],
          analysis: 'データの取得に失敗しました。しばらく時間をおいて再度お試しください。',
          tradingSetup: {
            bias: 'neutral',
            entryZones: [],
            stopLossLevels: [],
            targetLevels: []
          }
        },
        config: config || multiTimeframeLineDetector.getConfig()
      };
    }
  },
});

/**
 * Get current price from multi-timeframe data
 */
function getCurrentPrice(multiTimeframeData: MultiTimeframeData): number {
  // Use the highest timeframe's latest price for accuracy
  const timeframes = Object.keys(multiTimeframeData.timeframes).sort();
  const latestTimeframe = timeframes[timeframes.length - 1];
  const timeframeData = multiTimeframeData.timeframes[latestTimeframe];
  const data = timeframeData.data;
  return data[data.length - 1].close;
}

/**
 * Analyze market structure based on detected lines
 */
function analyzeMarketStructure(
  horizontalLines: DetectedLine[],
  trendlines: DetectedLine[],
  confluenceZones: ConfluenceZone[],
  currentPrice: number
) {
  const supports = horizontalLines.filter(line => line.type === 'support');
  const resistances = horizontalLines.filter(line => line.type === 'resistance');

  // Find nearest levels
  const nearestSupport = supports
    .filter(s => s.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0];

  const nearestResistance = resistances
    .filter(r => r.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0];

  // Determine trend from trendlines
  const recentTrendlines = trendlines.filter(tl => 
    Date.now() - tl.lastTouched < 7 * 24 * 60 * 60 * 1000 // Last 7 days
  );

  let currentTrend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  let trendStrength = 0.5;

  if (recentTrendlines.length > 0) {
    const avgSlope = recentTrendlines.reduce((sum, tl) => {
      const startPoint = tl.points[0];
      const endPoint = tl.points[tl.points.length - 1];
      const slope = (endPoint.price - startPoint.price) / (endPoint.time - startPoint.time);
      return sum + slope;
    }, 0) / recentTrendlines.length;

    if (avgSlope > 0.001) {
      currentTrend = 'bullish';
      trendStrength = Math.min(avgSlope * 1000 + 0.5, 1.0);
    } else if (avgSlope < -0.001) {
      currentTrend = 'bearish';
      trendStrength = Math.min(Math.abs(avgSlope) * 1000 + 0.5, 1.0);
    }
  }

  // Identify key levels
  const keyLevels = [
    ...supports.slice(0, 3).map(s => ({
      price: s.price,
      type: 'support' as const,
      importance: s.confidence > 0.8 ? 'critical' as const : 
                 s.confidence > 0.6 ? 'major' as const : 'minor' as const
    })),
    ...resistances.slice(0, 3).map(r => ({
      price: r.price,
      type: 'resistance' as const,
      importance: r.confidence > 0.8 ? 'critical' as const : 
                 r.confidence > 0.6 ? 'major' as const : 'minor' as const
    }))
  ].sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  return {
    currentTrend,
    trendStrength,
    keyLevels: keyLevels.slice(0, 5),
    priceAction: {
      currentPrice,
      nearestSupport: nearestSupport?.price,
      nearestResistance: nearestResistance?.price,
      distanceToSupport: nearestSupport ? 
        ((currentPrice - nearestSupport.price) / currentPrice) * 100 : undefined,
      distanceToResistance: nearestResistance ? 
        ((nearestResistance.price - currentPrice) / currentPrice) * 100 : undefined
    }
  };
}

/**
 * Enhance detected lines with descriptions and trading implications
 */
function enhanceDetectedLines(
  lines: DetectedLine[],
  currentPrice: number,
  lineType: 'horizontal' | 'trendline'
): EnhancedLine[] {
  return lines.map(line => {
    let description = '';
    let tradingImplication: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let targetLevels: number[] = [];
    let stopLossLevel: number | undefined;

    if (lineType === 'horizontal') {
      const distance = Math.abs(line.price - currentPrice);
      const distancePercent = (distance / currentPrice) * 100;

      if (line.type === 'support') {
        tradingImplication = 'bullish';
        description = `${line.confidence > 0.8 ? '強力な' : ''}サポートライン - `;
        description += `${line.touchCount}回タッチ、`;
        description += `${line.supportingTimeframes.length}つの時間足で確認`;
        
        if (distancePercent < 2) {
          description += '（価格が接近中）';
        }

        targetLevels = [line.price * 1.02, line.price * 1.05]; // 2% and 5% above
        stopLossLevel = line.price * 0.98; // 2% below support
      } else {
        tradingImplication = 'bearish';
        description = `${line.confidence > 0.8 ? '強力な' : ''}レジスタンスライン - `;
        description += `${line.touchCount}回タッチ、`;
        description += `${line.supportingTimeframes.length}つの時間足で確認`;
        
        if (distancePercent < 2) {
          description += '（価格が接近中）';
        }

        targetLevels = [line.price * 0.98, line.price * 0.95]; // 2% and 5% below
        stopLossLevel = line.price * 1.02; // 2% above resistance
      }
    } else {
      // Trendline
      const startPoint = line.points[0];
      const endPoint = line.points[line.points.length - 1];
      const slope = (endPoint.price - startPoint.price) / (endPoint.time - startPoint.time);
      
      if (slope > 0) {
        tradingImplication = 'bullish';
        description = `上昇トレンドライン - ${line.touchCount}回タッチ`;
      } else {
        tradingImplication = 'bearish';
        description = `下降トレンドライン - ${line.touchCount}回タッチ`;
      }
      
      description += `、${line.supportingTimeframes.length}つの時間足で確認`;
    }

    return {
      ...line,
      description,
      tradingImplication,
      targetLevels,
      stopLossLevel
    };
  });
}

/**
 * Enhance confluence zones with descriptions
 */
function enhanceConfluenceZones(zones: ConfluenceZone[], currentPrice: number): ConfluenceZone[] {
  return zones.map(zone => {
    let description = '';
    
    if (zone.type === 'support') {
      description = `サポート集約ゾーン - ${zone.timeframeCount}つの時間足が合致`;
    } else if (zone.type === 'resistance') {
      description = `レジスタンス集約ゾーン - ${zone.timeframeCount}つの時間足が合致`;
    } else {
      description = `ピボット集約ゾーン - ${zone.timeframeCount}つの時間足が合致`;
    }

    const distancePercent = Math.abs(zone.priceRange.center - currentPrice) / currentPrice * 100;
    if (distancePercent < 2) {
      description += '（価格が接近中）';
    }

    return {
      ...zone,
      description
    };
  });
}

/**
 * Find strongest level of a specific type
 */
function findStrongestLevel(lines: DetectedLine[], type: 'support' | 'resistance'): number | undefined {
  const filteredLines = lines.filter(line => line.type === type);
  if (filteredLines.length === 0) return undefined;
  
  const strongest = filteredLines.reduce((prev, current) => 
    current.strength > prev.strength ? current : prev
  );
  
  return strongest.price;
}

/**
 * Generate advanced drawing recommendations
 */
function generateAdvancedRecommendations(
  horizontalLines: EnhancedLine[],
  trendlines: EnhancedLine[],
  confluenceZones: ConfluenceZone[],
  marketStructure: MarketStructure,
  currentPrice: number
) {
  const drawingActions = [];

  // Add horizontal lines
  for (const line of horizontalLines.slice(0, 5)) { // Top 5 lines
    const color = line.type === 'support' ? '#4CAF50' : '#F44336';
    const priority = Math.round(line.confidence * 10);
    
    drawingActions.push({
      action: 'draw_line' as const,
      type: line.type,
      coordinates: {
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        startPrice: line.price,
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days future
        endPrice: line.price
      },
      style: {
        color,
        lineWidth: line.confidence > 0.8 ? 3 : 2,
        lineStyle: 'solid' as const,
        opacity: line.confidence
      },
      priority,
      description: line.description
    });
  }

  // Add trendlines
  for (const trendline of trendlines.slice(0, 3)) { // Top 3 trendlines
    const startPoint = trendline.points[0];
    const endPoint = trendline.points[trendline.points.length - 1];
    
    drawingActions.push({
      action: 'draw_line' as const,
      type: 'trendline' as const,
      coordinates: {
        startTime: startPoint.time,
        startPrice: startPoint.price,
        endTime: endPoint.time,
        endPrice: endPoint.price
      },
      style: {
        color: trendline.tradingImplication === 'bullish' ? '#00E676' : '#FF5722',
        lineWidth: 2,
        lineStyle: 'solid' as const,
        opacity: trendline.confidence
      },
      priority: Math.round(trendline.confidence * 10),
      description: trendline.description
    });
  }

  // Add confluence zones
  for (const zone of confluenceZones.slice(0, 3)) { // Top 3 zones
    drawingActions.push({
      action: 'highlight_confluence' as const,
      type: 'zone' as const,
      coordinates: {
        startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
        startPrice: zone.priceRange.min,
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
        endPrice: zone.priceRange.max
      },
      style: {
        color: zone.type === 'support' ? '#4CAF50' : zone.type === 'resistance' ? '#F44336' : '#FF9800',
        lineWidth: 1,
        lineStyle: 'dotted' as const,
        opacity: 0.3
      },
      priority: Math.round(zone.strength * 10),
      description: zone.description
    });
  }

  // Sort by priority
  drawingActions.sort((a, b) => b.priority - a.priority);

  // Generate analysis text
  const analysis = generateAnalysisText(horizontalLines, trendlines, confluenceZones, marketStructure, currentPrice);

  // Generate trading setup
  const tradingSetup = generateTradingSetup(horizontalLines, marketStructure, currentPrice);

  return {
    drawingActions,
    analysis,
    tradingSetup
  };
}

/**
 * Generate comprehensive analysis text
 */
function generateAnalysisText(
  horizontalLines: EnhancedLine[],
  trendlines: EnhancedLine[],
  confluenceZones: ConfluenceZone[],
  marketStructure: MarketStructure,
  currentPrice: number
): string {
  let analysis = `${marketStructure.priceAction.currentPrice.toFixed(2)}での多時間足分析結果:\n\n`;

  // Market structure
  analysis += `📈 市場構造: ${
    marketStructure.currentTrend === 'bullish' ? '上昇トレンド' :
    marketStructure.currentTrend === 'bearish' ? '下降トレンド' : 'レンジ相場'
  } (強度: ${Math.round(marketStructure.trendStrength * 100)}%)\n\n`;

  // Key levels
  if (marketStructure.priceAction.nearestSupport) {
    analysis += `🟢 最寄りサポート: $${marketStructure.priceAction.nearestSupport.toFixed(2)} `;
    analysis += `(${marketStructure.priceAction.distanceToSupport?.toFixed(2)}%下)\n`;
  }

  if (marketStructure.priceAction.nearestResistance) {
    analysis += `🔴 最寄りレジスタンス: $${marketStructure.priceAction.nearestResistance.toFixed(2)} `;
    analysis += `(${marketStructure.priceAction.distanceToResistance?.toFixed(2)}%上)\n\n`;
  }

  // High confidence lines
  const highConfidenceLines = horizontalLines.filter(line => line.confidence > 0.8);
  if (highConfidenceLines.length > 0) {
    analysis += `💪 高信頼度ライン:\n`;
    highConfidenceLines.slice(0, 3).forEach(line => {
      analysis += `  • ${line.type === 'support' ? 'サポート' : 'レジスタンス'}: $${line.price.toFixed(2)} `;
      analysis += `(信頼度: ${Math.round(line.confidence * 100)}%)\n`;
    });
    analysis += '\n';
  }

  // Confluence zones
  if (confluenceZones.length > 0) {
    analysis += `🎯 集約ゾーン:\n`;
    confluenceZones.slice(0, 2).forEach(zone => {
      analysis += `  • ${zone.priceRange.min.toFixed(2)} - ${zone.priceRange.max.toFixed(2)} `;
      analysis += `(${zone.timeframeCount}つの時間足)\n`;
    });
  }

  return analysis;
}

/**
 * Generate trading setup recommendations
 */
function generateTradingSetup(
  horizontalLines: EnhancedLine[],
  marketStructure: MarketStructure,
  currentPrice: number
) {
  const supports = horizontalLines.filter(line => line.type === 'support').slice(0, 3);
  const resistances = horizontalLines.filter(line => line.type === 'resistance').slice(0, 3);

  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  const entryZones = [];
  const stopLossLevels = [];
  const targetLevels = [];

  if (marketStructure.currentTrend === 'bullish' && supports.length > 0) {
    bias = 'bullish';
    
    // Entry zones near support levels
    supports.forEach(support => {
      if (support.price < currentPrice) {
        entryZones.push({
          price: support.price,
          type: 'buy' as const,
          confidence: support.confidence
        });
        stopLossLevels.push(support.price * 0.98);
      }
    });

    // Target levels at resistance
    resistances.forEach(resistance => {
      if (resistance.price > currentPrice) {
        targetLevels.push(resistance.price);
      }
    });
  } else if (marketStructure.currentTrend === 'bearish' && resistances.length > 0) {
    bias = 'bearish';
    
    // Entry zones near resistance levels
    resistances.forEach(resistance => {
      if (resistance.price > currentPrice) {
        entryZones.push({
          price: resistance.price,
          type: 'sell' as const,
          confidence: resistance.confidence
        });
        stopLossLevels.push(resistance.price * 1.02);
      }
    });

    // Target levels at support
    supports.forEach(support => {
      if (support.price < currentPrice) {
        targetLevels.push(support.price);
      }
    });
  }

  // Calculate risk-reward ratio
  let riskRewardRatio: number | undefined;
  if (entryZones.length > 0 && targetLevels.length > 0 && stopLossLevels.length > 0) {
    const avgEntry = entryZones.reduce((sum, zone) => sum + zone.price, 0) / entryZones.length;
    const avgTarget = targetLevels.reduce((sum, target) => sum + target, 0) / targetLevels.length;
    const avgStop = stopLossLevels.reduce((sum, stop) => sum + stop, 0) / stopLossLevels.length;
    
    const reward = Math.abs(avgTarget - avgEntry);
    const risk = Math.abs(avgEntry - avgStop);
    
    if (risk > 0) {
      riskRewardRatio = reward / risk;
    }
  }

  return {
    bias,
    entryZones: entryZones.slice(0, 3),
    stopLossLevels: stopLossLevels.slice(0, 3),
    targetLevels: targetLevels.slice(0, 3),
    riskRewardRatio
  };
}