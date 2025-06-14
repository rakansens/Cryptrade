import { Tool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';
import { enhancedLineDetectorV2, type EnhancedLineV2 } from '@/lib/analysis/enhanced-line-detector-v2';

// Type definitions for enhanced line analysis
interface MultiTimeframeData {
  timeframes: Record<string, {
    data: Array<{
      close: number;
      [key: string]: unknown;
    }>;
  }>;
}

interface DetectionResult {
  horizontalLines: EnhancedLineV2[];
  trendlines: EnhancedLineV2[];
}

interface DrawingRecommendation {
  action: string;
  type: string;
  priority: number;
  coordinates: {
    startPrice: number;
    endPrice: number;
    startTime: number;
    endTime: number;
  };
  style: {
    color: string;
    lineWidth: number;
    lineStyle: string;
  };
  description: string;
}

interface TouchPoint {
  volumeRatio: number;
  [key: string]: unknown;
}

interface LineWithTouchAnalysis extends EnhancedLineV2 {
  touchAnalysis: {
    touchPoints: TouchPoint[];
    wickTouchCount: number;
    bodyTouchCount: number;
    exactTouchCount: number;
    touchQualityScore: number;
    strongBounceCount: number;
  };
  qualityMetrics: {
    overallQuality: number;
  };
}

interface UserConfig {
  [key: string]: unknown;
}

/**
 * Enhanced Line Analysis Tool V2
 * 
 * Phase 2 implementation with advanced touch point detection.
 * Provides significantly improved line detection with wick/body analysis,
 * volume confirmation, and bounce pattern recognition.
 */

const enhancedLineAnalysisV2Schema = z.object({
  symbol: z.string().describe('Trading pair symbol (e.g., BTCUSDT)'),
  analysisType: z.enum(['quick', 'standard', 'comprehensive']).default('standard').describe('Analysis depth level'),
  config: z.object({
    minTimeframes: z.number().min(1).max(4).default(2).describe('Minimum timeframes for line validation'),
    minTouchCount: z.number().min(2).max(20).default(3).describe('Minimum touch points required'),
    minConfidence: z.number().min(0).max(1).default(0.6).describe('Minimum confidence threshold'),
    minQualityScore: z.number().min(0).max(100).default(60).describe('Minimum quality score threshold'),
    requireVolumeConfirmation: z.boolean().default(false).describe('Require volume confirmation for touches'),
    requireBounceConfirmation: z.boolean().default(false).describe('Require bounce confirmation for touches'),
    priceTolerancePercent: z.number().min(0.1).max(2.0).default(0.5).describe('Price tolerance percentage'),
    touchConfig: z.object({
      wickWeight: z.number().min(0).max(2).default(0.7).describe('Weight for wick touches'),
      bodyWeight: z.number().min(0).max(2).default(1.0).describe('Weight for body touches'),
      exactWeight: z.number().min(0).max(3).default(1.2).describe('Weight for exact touches'),
      volumeThresholdMultiplier: z.number().min(1).max(5).default(1.3).describe('Volume threshold multiplier'),
      bounceThresholdPercent: z.number().min(0.1).max(5).default(0.4).describe('Minimum bounce percentage'),
      lookforwardBars: z.number().min(1).max(20).default(6).describe('Bars to look forward for bounce')
    }).optional().describe('Advanced touch detection configuration')
  }).optional().describe('Analysis configuration parameters')
});

export const enhancedLineAnalysisV2Tool = new Tool({
  id: 'enhanced-line-analysis-v2',
  description: `
Advanced multi-timeframe line detection with sophisticated touch point analysis.

Phase 2 Features:
- Wick vs Body touch analysis with different weights
- Volume confirmation for touch points
- Price bounce detection and validation
- Enhanced quality scoring system
- Cross-timeframe validation improvements
- Detailed touch statistics and confidence metrics

Perfect for high-accuracy support/resistance and trendline detection.
  `,
  inputSchema: enhancedLineAnalysisV2Schema,
  execute: async ({ context }) => {
    const startTime = Date.now();
    const { symbol, analysisType = 'standard', config = {} } = context;

    logger.info('[EnhancedLineAnalysisV2Tool] Starting analysis', {
      symbol,
      analysisType,
      config
    });

    try {
      // Fetch multi-timeframe data
      const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
      
      // Configure detector based on analysis type
      const detectorConfig = getConfigForAnalysisType(analysisType, config);
      const detector = new enhancedLineDetectorV2.constructor(detectorConfig);
      
      // Perform enhanced line detection
      const detectionResult = await detector.detectEnhancedLines(multiTimeframeData);
      
      // Generate comprehensive analysis
      const analysis = generateComprehensiveAnalysis(
        detectionResult.horizontalLines,
        detectionResult.trendlines,
        multiTimeframeData,
        detectionResult.detectionStats
      );
      
      // Calculate market structure
      const marketStructure = calculateMarketStructure(
        detectionResult.horizontalLines,
        detectionResult.trendlines,
        multiTimeframeData
      );
      
      // Generate drawing recommendations
      const recommendations = generateDrawingRecommendations(
        detectionResult.horizontalLines,
        detectionResult.trendlines,
        analysis
      );
      
      const detectionTime = Date.now() - startTime;
      
      const result = {
        symbol,
        timestamp: new Date().toISOString(),
        analysisType,
        config: detectorConfig,
        
        // Enhanced lines with advanced touch analysis
        horizontalLines: detectionResult.horizontalLines.map(formatEnhancedLine),
        trendlines: detectionResult.trendlines.map(formatEnhancedLine),
        
        // Advanced analysis metrics
        touchAnalytics: generateTouchAnalytics(detectionResult),
        qualityMetrics: generateQualityMetrics(detectionResult),
        
        // Market structure analysis
        marketStructure,
        
        // Confluence zones and key levels
        confluenceZones: identifyConfluenceZones(detectionResult.horizontalLines),
        keyLevels: identifyKeyLevels(detectionResult.horizontalLines, detectionResult.trendlines),
        
        // Drawing recommendations
        recommendations,
        
        // Performance and reliability metrics
        detectionStats: {
          ...detectionResult.detectionStats,
          detectionTime,
          dataQuality: calculateDataQuality(multiTimeframeData),
          reliability: calculateReliabilityScore(detectionResult)
        },
        
        // Summary for quick reference
        summary: {
          totalLines: detectionResult.horizontalLines.length + detectionResult.trendlines.length,
          highConfidenceLines: [...detectionResult.horizontalLines, ...detectionResult.trendlines]
            .filter(line => line.confidence >= 0.8).length,
          multiTimeframeLines: [...detectionResult.horizontalLines, ...detectionResult.trendlines]
            .filter(line => line.supportingTimeframes.length >= 2).length,
          averageQuality: calculateAverageQuality(detectionResult),
          averageConfidence: calculateAverageConfidence(detectionResult),
          detectionTime
        }
      };

      logger.info('[EnhancedLineAnalysisV2Tool] Analysis completed', {
        symbol,
        horizontalLines: result.horizontalLines.length,
        trendlines: result.trendlines.length,
        averageQuality: result.summary.averageQuality,
        detectionTime
      });

      return result;

    } catch (error) {
      logger.error('[EnhancedLineAnalysisV2Tool] Analysis failed', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        symbol,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Analysis failed',
        horizontalLines: [],
        trendlines: [],
        detectionStats: {
          totalCandidates: 0,
          qualityFiltered: 0,
          touchFiltered: 0,
          finalLines: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }
});

/**
 * Get detector configuration based on analysis type
 */
function getConfigForAnalysisType(analysisType: string, userConfig: UserConfig) {
  const baseConfigs = {
    quick: {
      minTimeframes: 1,
      minTouchCount: 2,
      minConfidence: 0.5,
      minQualityScore: 40,
      requireVolumeConfirmation: false,
      requireBounceConfirmation: false,
      touchConfig: {
        lookforwardBars: 3,
        bounceThresholdPercent: 0.3
      }
    },
    standard: {
      minTimeframes: 2,
      minTouchCount: 3,
      minConfidence: 0.6,
      minQualityScore: 60,
      requireVolumeConfirmation: false,
      requireBounceConfirmation: false,
      touchConfig: {
        wickWeight: 0.7,
        bodyWeight: 1.0,
        exactWeight: 1.2,
        volumeThresholdMultiplier: 1.3,
        bounceThresholdPercent: 0.4,
        lookforwardBars: 6
      }
    },
    comprehensive: {
      minTimeframes: 3,
      minTouchCount: 4,
      minConfidence: 0.7,
      minQualityScore: 70,
      requireVolumeConfirmation: true,
      requireBounceConfirmation: true,
      volumeConfirmationThreshold: 0.4,
      bounceConfirmationThreshold: 0.3,
      touchConfig: {
        wickWeight: 0.7,
        bodyWeight: 1.0,
        exactWeight: 1.5,
        volumeThresholdMultiplier: 1.5,
        bounceThresholdPercent: 0.5,
        lookforwardBars: 8
      }
    }
  };

  const baseConfig = baseConfigs[analysisType as keyof typeof baseConfigs] || baseConfigs.standard;
  
  // Merge with user configuration
  return {
    ...baseConfig,
    ...userConfig,
    touchConfig: {
      ...baseConfig.touchConfig,
      ...(userConfig.touchConfig || {})
    }
  };
}

/**
 * Format enhanced line for output
 */
function formatEnhancedLine(line: EnhancedLineV2) {
  return {
    id: line.id,
    price: line.price,
    type: line.type,
    confidence: line.confidence,
    strength: line.strength,
    touchCount: line.touchCount,
    supportingTimeframes: line.supportingTimeframes,
    description: line.description,
    
    // Advanced touch analysis
    touchAnalysis: {
      touchTypes: {
        wick: line.touchAnalysis.wickTouchCount,
        body: line.touchAnalysis.bodyTouchCount,
        exact: line.touchAnalysis.exactTouchCount
      },
      qualityScore: line.touchAnalysis.touchQualityScore,
      strongBounces: line.touchAnalysis.strongBounceCount,
      volumeWeightedStrength: line.touchAnalysis.volumeWeightedStrength,
      averageVolume: line.touchAnalysis.averageVolume
    },
    
    // Quality metrics
    qualityMetrics: line.qualityMetrics,
    
    // Coordinates for trendlines
    ...(line.coordinates && { coordinates: line.coordinates })
  };
}

/**
 * Generate touch analytics summary
 */
function generateTouchAnalytics(detectionResult: DetectionResult) {
  const allLines = [...detectionResult.horizontalLines, ...detectionResult.trendlines];
  
  if (allLines.length === 0) {
    return {
      totalTouchPoints: 0,
      touchTypeDistribution: { wick: 0, body: 0, exact: 0 },
      averageQualityScore: 0,
      volumeConfirmedTouches: 0,
      bounceConfirmedTouches: 0
    };
  }
  
  const totalTouchPoints = allLines.reduce((sum, line) => sum + line.touchCount, 0);
  const totalWickTouches = allLines.reduce((sum, line) => sum + line.touchAnalysis.wickTouchCount, 0);
  const totalBodyTouches = allLines.reduce((sum, line) => sum + line.touchAnalysis.bodyTouchCount, 0);
  const totalExactTouches = allLines.reduce((sum, line) => sum + line.touchAnalysis.exactTouchCount, 0);
  const avgQualityScore = allLines.reduce((sum, line) => sum + line.touchAnalysis.touchQualityScore, 0) / allLines.length;
  
  return {
    totalTouchPoints,
    touchTypeDistribution: {
      wick: totalWickTouches,
      body: totalBodyTouches,
      exact: totalExactTouches
    },
    averageQualityScore: avgQualityScore,
    volumeConfirmedTouches: allLines.reduce((sum, line) => 
      sum + line.touchAnalysis.touchPoints.filter((tp: TouchPoint) => tp.volumeRatio > 1.3).length, 0
    ),
    bounceConfirmedTouches: allLines.reduce((sum, line) => sum + line.touchAnalysis.strongBounceCount, 0)
  };
}

/**
 * Generate quality metrics summary
 */
function generateQualityMetrics(detectionResult: DetectionResult) {
  const allLines = [...detectionResult.horizontalLines, ...detectionResult.trendlines];
  
  if (allLines.length === 0) {
    return {
      averageWickBodyRatio: 0,
      averageVolumeConfirmation: 0,
      averageBounceConfirmation: 0,
      averageOverallQuality: 0,
      qualityDistribution: { excellent: 0, good: 0, acceptable: 0, poor: 0 }
    };
  }
  
  const avgWickBodyRatio = allLines.reduce((sum, line) => sum + line.qualityMetrics.wickBodyRatio, 0) / allLines.length;
  const avgVolumeConfirmation = allLines.reduce((sum, line) => sum + line.qualityMetrics.volumeConfirmation, 0) / allLines.length;
  const avgBounceConfirmation = allLines.reduce((sum, line) => sum + line.qualityMetrics.bounceConfirmation, 0) / allLines.length;
  const avgOverallQuality = allLines.reduce((sum, line) => sum + line.qualityMetrics.overallQuality, 0) / allLines.length;
  
  const qualityDistribution = {
    excellent: allLines.filter(line => line.qualityMetrics.overallQuality >= 90).length,
    good: allLines.filter(line => line.qualityMetrics.overallQuality >= 70 && line.qualityMetrics.overallQuality < 90).length,
    acceptable: allLines.filter(line => line.qualityMetrics.overallQuality >= 50 && line.qualityMetrics.overallQuality < 70).length,
    poor: allLines.filter(line => line.qualityMetrics.overallQuality < 50).length
  };
  
  return {
    averageWickBodyRatio: avgWickBodyRatio,
    averageVolumeConfirmation: avgVolumeConfirmation,
    averageBounceConfirmation: avgBounceConfirmation,
    averageOverallQuality: avgOverallQuality,
    qualityDistribution
  };
}

/**
 * Calculate market structure based on detected lines
 */
function calculateMarketStructure(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[], multiTimeframeData: MultiTimeframeData) {
  const latestPrice = getCurrentPrice(multiTimeframeData);
  
  const supportLevels = horizontalLines.filter(line => line.type === 'support').sort((a, b) => b.price - a.price);
  const resistanceLevels = horizontalLines.filter(line => line.type === 'resistance').sort((a, b) => a.price - b.price);
  
  const nearestSupport = supportLevels.find(level => level.price < latestPrice);
  const nearestResistance = resistanceLevels.find(level => level.price > latestPrice);
  
  // Determine trend based on trendlines and price action
  const trendStrength = calculateTrendStrength(trendlines, horizontalLines);
  const currentTrend = determineTrend(trendlines, supportLevels, resistanceLevels, latestPrice);
  
  return {
    currentPrice: latestPrice,
    currentTrend,
    trendStrength,
    nearestSupport: nearestSupport?.price,
    nearestResistance: nearestResistance?.price,
    distanceToSupport: nearestSupport ? ((latestPrice - nearestSupport.price) / latestPrice) * 100 : null,
    distanceToResistance: nearestResistance ? ((nearestResistance.price - latestPrice) / latestPrice) * 100 : null,
    keyLevels: [...supportLevels.slice(0, 3), ...resistanceLevels.slice(0, 3)]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(level => ({
        price: level.price,
        type: level.type,
        confidence: level.confidence,
        importance: level.confidence > 0.8 ? 'high' : level.confidence > 0.6 ? 'medium' : 'low'
      }))
  };
}

/**
 * Identify confluence zones where multiple lines converge
 */
function identifyConfluenceZones(horizontalLines: EnhancedLineV2[]) {
  const zones = [];
  const tolerance = 0.01; // 1% price tolerance
  
  for (let i = 0; i < horizontalLines.length; i++) {
    const line1 = horizontalLines[i];
    const nearbyLines = horizontalLines.filter((line2, j) => 
      j !== i && Math.abs(line1.price - line2.price) / line1.price <= tolerance
    );
    
    if (nearbyLines.length > 0) {
      const allLines = [line1, ...nearbyLines];
      const avgPrice = allLines.reduce((sum, line) => sum + line.price, 0) / allLines.length;
      const totalStrength = allLines.reduce((sum, line) => sum + line.strength, 0);
      const avgConfidence = allLines.reduce((sum, line) => sum + line.confidence, 0) / allLines.length;
      
      zones.push({
        priceRange: {
          min: Math.min(...allLines.map(line => line.price)),
          max: Math.max(...allLines.map(line => line.price)),
          center: avgPrice
        },
        strength: totalStrength,
        confidence: avgConfidence,
        lineCount: allLines.length,
        supportingTimeframes: Array.from(new Set(allLines.flatMap(line => line.supportingTimeframes))),
        type: allLines[0].type,
        description: `Confluence zone with ${allLines.length} ${allLines[0].type} lines`
      });
    }
  }
  
  return zones.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

/**
 * Identify key levels for trading decisions
 */
function identifyKeyLevels(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[]) {
  const allLines = [...horizontalLines, ...trendlines];
  
  return allLines
    .filter(line => line.confidence >= 0.7)
    .sort((a, b) => (b.confidence * b.strength) - (a.confidence * a.strength))
    .slice(0, 10)
    .map(line => ({
      id: line.id,
      price: line.price,
      type: line.type,
      confidence: line.confidence,
      strength: line.strength,
      importance: line.confidence > 0.9 ? 'critical' : 
                 line.confidence > 0.8 ? 'high' : 
                 line.confidence > 0.7 ? 'medium' : 'low',
      description: line.description
    }));
}

/**
 * Generate drawing recommendations with priorities
 */
function generateDrawingRecommendations(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[], analysis: ReturnType<typeof calculateMarketStructure>) {
  const drawingActions = [];
  
  // Add horizontal lines
  horizontalLines.slice(0, 8).forEach((line, index) => {
    drawingActions.push({
      action: 'draw',
      type: line.type === 'support' ? 'horizontal_line' : 'horizontal_line',
      priority: Math.round(line.confidence * 10),
      coordinates: {
        startPrice: line.price,
        endPrice: line.price,
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        endTime: Date.now()
      },
      style: {
        color: line.type === 'support' ? '#00ff00' : '#ff0000',
        lineWidth: Math.max(1, Math.round(line.strength * 3)),
        lineStyle: line.confidence > 0.8 ? 'solid' : 'dashed'
      },
      description: `${line.type} at ${line.price.toFixed(2)} (${(line.confidence * 100).toFixed(1)}% confidence)`
    });
  });
  
  // Add trendlines
  trendlines.slice(0, 5).forEach((line, index) => {
    if (line.coordinates) {
      drawingActions.push({
        action: 'draw',
        type: 'trendline',
        priority: Math.round(line.confidence * 10),
        coordinates: {
          startPrice: line.coordinates.startPrice,
          endPrice: line.coordinates.endPrice,
          startTime: line.coordinates.startTime,
          endTime: line.coordinates.endTime
        },
        style: {
          color: line.coordinates.slope > 0 ? '#00aa00' : '#aa0000',
          lineWidth: Math.max(1, Math.round(line.strength * 3)),
          lineStyle: 'solid'
        },
        description: line.description
      });
    }
  });
  
  return {
    drawingActions: drawingActions.sort((a, b) => b.priority - a.priority),
    analysis: `Detected ${horizontalLines.length} horizontal levels and ${trendlines.length} trendlines with advanced touch point analysis. Quality distribution shows strong confidence in key levels.`
  };
}

// Utility functions
function getCurrentPrice(multiTimeframeData: MultiTimeframeData): number {
  const firstTimeframe = Object.values(multiTimeframeData.timeframes)[0];
  const latestCandle = firstTimeframe.data[firstTimeframe.data.length - 1];
  return latestCandle?.close || 0;
}

function calculateTrendStrength(trendlines: EnhancedLineV2[], horizontalLines: EnhancedLineV2[]): number {
  if (trendlines.length === 0) return 0.5;
  
  const avgTrendlineStrength = trendlines.reduce((sum, line) => sum + line.strength, 0) / trendlines.length;
  const trendlineCount = trendlines.length;
  
  return Math.min(avgTrendlineStrength + (trendlineCount / 10), 1);
}

function determineTrend(trendlines: EnhancedLineV2[], supportLevels: EnhancedLineV2[], resistanceLevels: EnhancedLineV2[], currentPrice: number): string {
  if (trendlines.length > 0) {
    const ascendingTrends = trendlines.filter(line => line.coordinates?.slope && line.coordinates.slope > 0);
    const descendingTrends = trendlines.filter(line => line.coordinates?.slope && line.coordinates.slope < 0);
    
    if (ascendingTrends.length > descendingTrends.length) return 'bullish';
    if (descendingTrends.length > ascendingTrends.length) return 'bearish';
  }
  
  // Fallback to support/resistance analysis
  const strongSupport = supportLevels.filter(level => level.confidence > 0.7).length;
  const strongResistance = resistanceLevels.filter(level => level.confidence > 0.7).length;
  
  if (strongSupport > strongResistance) return 'bullish';
  if (strongResistance > strongSupport) return 'bearish';
  
  return 'neutral';
}

function calculateDataQuality(multiTimeframeData: MultiTimeframeData): number {
  const timeframes = Object.values(multiTimeframeData.timeframes);
  const totalCandles = timeframes.reduce((sum, tf) => sum + tf.data.length, 0);
  const avgCandles = totalCandles / timeframes.length;
  
  // Quality based on data completeness and timeframe coverage
  let quality = 0.5;
  quality += Math.min(timeframes.length / 4, 0.3); // More timeframes = better
  quality += Math.min(avgCandles / 100, 0.2); // More data = better
  
  return Math.min(quality, 1);
}

function calculateReliabilityScore(detectionResult: DetectionResult): number {
  const allLines = [...detectionResult.horizontalLines, ...detectionResult.trendlines];
  if (allLines.length === 0) return 0;
  
  const avgConfidence = allLines.reduce((sum, line) => sum + line.confidence, 0) / allLines.length;
  const multiTimeframeLines = allLines.filter(line => line.supportingTimeframes.length >= 2).length;
  const multiTimeframeRatio = multiTimeframeLines / allLines.length;
  
  return (avgConfidence * 0.6) + (multiTimeframeRatio * 0.4);
}

function calculateAverageQuality(detectionResult: DetectionResult): number {
  const allLines = [...detectionResult.horizontalLines, ...detectionResult.trendlines];
  if (allLines.length === 0) return 0;
  
  return allLines.reduce((sum, line) => sum + line.qualityMetrics.overallQuality, 0) / allLines.length;
}

function calculateAverageConfidence(detectionResult: DetectionResult): number {
  const allLines = [...detectionResult.horizontalLines, ...detectionResult.trendlines];
  if (allLines.length === 0) return 0;
  
  return allLines.reduce((sum, line) => sum + line.confidence, 0) / allLines.length;
}

function generateComprehensiveAnalysis(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[], multiTimeframeData: MultiTimeframeData, detectionStats: Record<string, unknown>) {
  return {
    overview: `Advanced line detection completed with ${horizontalLines.length} horizontal lines and ${trendlines.length} trendlines using sophisticated touch point analysis.`,
    touchAnalysisInsights: generateTouchInsights(horizontalLines, trendlines),
    qualityAssessment: generateQualityAssessment(horizontalLines, trendlines),
    timeframeAnalysis: generateTimeframeAnalysis(horizontalLines, trendlines),
    recommendations: generateAnalysisRecommendations(horizontalLines, trendlines)
  };
}

function generateTouchInsights(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[]): string {
  const allLines = [...horizontalLines, ...trendlines];
  const totalTouches = allLines.reduce((sum, line) => sum + line.touchCount, 0);
  const bodyTouches = allLines.reduce((sum, line) => sum + line.touchAnalysis.bodyTouchCount, 0);
  const bounces = allLines.reduce((sum, line) => sum + line.touchAnalysis.strongBounceCount, 0);
  
  return `Analysis of ${totalTouches} touch points reveals ${bodyTouches} body touches and ${bounces} confirmed bounces, indicating strong level validation.`;
}

function generateQualityAssessment(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[]): string {
  const allLines = [...horizontalLines, ...trendlines];
  const highQuality = allLines.filter(line => line.qualityMetrics.overallQuality >= 80).length;
  const avgQuality = allLines.reduce((sum, line) => sum + line.qualityMetrics.overallQuality, 0) / allLines.length;
  
  return `${highQuality}/${allLines.length} lines meet high quality standards with average quality score of ${avgQuality.toFixed(1)}/100.`;
}

function generateTimeframeAnalysis(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[]): string {
  const allLines = [...horizontalLines, ...trendlines];
  const multiTF = allLines.filter(line => line.supportingTimeframes.length >= 2).length;
  const strongMultiTF = allLines.filter(line => line.supportingTimeframes.length >= 3).length;
  
  return `${multiTF} lines validated across multiple timeframes, with ${strongMultiTF} showing strong cross-timeframe confluence.`;
}

function generateAnalysisRecommendations(horizontalLines: EnhancedLineV2[], trendlines: EnhancedLineV2[]): string {
  const strongSupport = horizontalLines.filter(line => line.type === 'support' && line.confidence > 0.8).length;
  const strongResistance = horizontalLines.filter(line => line.type === 'resistance' && line.confidence > 0.8).length;
  
  return `Focus on ${strongSupport} high-confidence support levels and ${strongResistance} resistance levels for trading decisions. Consider volume confirmation and bounce patterns for entry validation.`;
}