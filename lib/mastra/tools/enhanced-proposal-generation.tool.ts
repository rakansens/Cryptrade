// Enhanced proposal generation tool with ML validation

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import { StreamingMLAnalyzer } from '@/lib/ml/streaming-ml-analyzer';
import type { PriceData } from '@/types/market';
import type { DetectedLine } from '@/lib/analysis/types';
import type { MLPrediction } from '@/types/shared/ml';

// Type definitions for proposal generation
interface Proposal {
  id: string;
  type: string;
  description: string;
  confidence: number;
  mlPrediction?: {
    successProbability: number;
    expectedBounces: number;
    reasoning: string;
  };
  drawingData: {
    type: string;
    points: Array<{ time: number; value: number }>;
    price?: number;
    slope?: number;
    intercept?: number;
    metadata?: Record<string, unknown>;
  };
}

interface SupportResistanceLevel {
  type: 'support' | 'resistance';
  price: number;
  touchPoints: Array<{ time: number; value: number }>;
  confidence: number;
}

interface TrendlineData {
  direction: '上昇' | '下降';
  touchPoints: Array<{ time: number; value: number }>;
  confidence: number;
  slope: number;
  intercept: number;
}

interface TouchPoint {
  index: number;
  time: number;
  value: number;
}

// Tool input schema
export const enhancedProposalGenerationInputSchema = z.object({
  symbol: z.string().describe('Trading symbol (e.g., BTCUSDT)'),
  interval: z.string().describe('Time interval (e.g., 1h, 4h)'),
  analysisType: z.enum(['trendline', 'support-resistance', 'fibonacci', 'pattern', 'all']),
  priceData: z.array(z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number()
  })).describe('Historical price data'),
  maxProposals: z.number().optional().default(5),
  useMLValidation: z.boolean().optional().default(true)
});

export type EnhancedProposalGenerationInput = z.infer<typeof enhancedProposalGenerationInputSchema>;

// Tool output schema
export const enhancedProposalGenerationOutputSchema = z.object({
  proposalGroupId: z.string(),
  proposals: z.array(z.object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    confidence: z.number(),
    mlPrediction: z.object({
      successProbability: z.number(),
      expectedBounces: z.number(),
      reasoning: z.array(z.object({
        factor: z.string(),
        impact: z.enum(['positive', 'negative', 'neutral']),
        weight: z.number(),
        description: z.string()
      }))
    }).optional(),
    drawingData: z.object({
      type: z.string(),
      points: z.array(z.object({
        time: z.number(),
        value: z.number()
      })),
      price: z.number().optional(),
      slope: z.number().optional(),
      intercept: z.number().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  })),
  summary: z.string(),
  totalAnalysisTime: z.number()
});

export type EnhancedProposalGenerationOutput = z.infer<typeof enhancedProposalGenerationOutputSchema>;

export async function enhancedProposalGeneration(
  input: EnhancedProposalGenerationInput
): Promise<EnhancedProposalGenerationOutput> {
  const startTime = Date.now();
  logger.info('[EnhancedProposalGeneration] Starting analysis', { 
    symbol: input.symbol, 
    interval: input.interval,
    analysisType: input.analysisType,
    dataPoints: input.priceData.length,
    useMLValidation: input.useMLValidation
  });

  try {
    const proposals: Proposal[] = [];
    const currentPrice = input.priceData[input.priceData.length - 1].close;
    
    // Initialize ML analyzer if enabled
    const mlAnalyzer = input.useMLValidation ? new StreamingMLAnalyzer() : null;

    // Pattern detection
    if (input.analysisType === 'pattern' || input.analysisType === 'all') {
      const detector = new PatternDetector(input.priceData);
      const patterns = detector.detectPatterns({
        lookbackPeriod: 100,
        minConfidence: 0.6,
        includePartialPatterns: false
      });

      for (const pattern of patterns.slice(0, 2)) {
        proposals.push({
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'pattern',
          description: pattern.description,
          confidence: pattern.confidence,
          drawingData: {
            type: 'pattern',
            points: pattern.visualization.keyPoints.map(kp => ({
              time: kp.time,
              value: kp.value
            })),
            metadata: {
              patternType: pattern.type,
              visualization: pattern.visualization,
              metrics: pattern.metrics,
              tradingImplication: pattern.trading_implication
            }
          }
        });
      }
    }

    // Support/Resistance detection with ML
    if (input.analysisType === 'support-resistance' || input.analysisType === 'all') {
      const levels = detectSupportResistanceLevels(input.priceData);
      
      for (const level of levels.slice(0, 3)) {
        let mlPrediction: MLPrediction | undefined;
        
        // Run ML validation if enabled
        if (mlAnalyzer && level.touchPoints.length >= 3) {
          const line: DetectedLine = {
            type: level.type as 'support' | 'resistance',
            price: level.price,
            touchPoints: level.touchPoints,
            confidence: level.confidence,
            timeframe: input.interval
          };

          // Run ML analysis (simplified for sync execution)
          const generator = mlAnalyzer.analyzeLineWithProgress(
            line,
            input.priceData,
            input.symbol,
            currentPrice
          );

          // Consume the generator to get the final prediction
          let finalPrediction: MLPrediction | undefined;
          for await (const update of generator) {
            if (update.stage === 'complete') {
              // The prediction is returned at the end
              const result = await generator.return(undefined);
              if (result.value) {
                finalPrediction = result.value;
              }
            }
          }

          if (finalPrediction) {
            mlPrediction = finalPrediction;
            // Adjust confidence based on ML prediction
            level.confidence = level.confidence * 0.4 + finalPrediction.successProbability * 0.6;
          }
        }

        proposals.push({
          id: `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'horizontalLine',
          description: `${level.type === 'support' ? 'サポート' : 'レジスタンス'}ライン: $${level.price.toFixed(2)}`,
          confidence: level.confidence,
          mlPrediction: mlPrediction ? {
            successProbability: mlPrediction.successProbability,
            expectedBounces: mlPrediction.expectedBounces,
            reasoning: mlPrediction.reasoning
          } : undefined,
          drawingData: {
            type: 'horizontalLine',
            points: level.touchPoints,
            price: level.price,
            style: {
              color: level.type === 'support' ? '#22c55e' : '#ef4444',
              lineWidth: 2,
              lineStyle: 'solid'
            }
          }
        });
      }
    }

    // Trendline detection with ML
    if (input.analysisType === 'trendline' || input.analysisType === 'all') {
      const trendlines = detectTrendlines(input.priceData);
      
      for (const trendline of trendlines.slice(0, 2)) {
        let mlPrediction: MLPrediction | undefined;
        
        // Run ML validation if enabled
        if (mlAnalyzer && trendline.touchPoints.length >= 3) {
          const line: DetectedLine = {
            type: 'trendline',
            touchPoints: trendline.touchPoints,
            confidence: trendline.confidence,
            timeframe: input.interval,
            slope: trendline.slope,
            intercept: trendline.intercept
          };

          // Run ML analysis
          const generator = mlAnalyzer.analyzeLineWithProgress(
            line,
            input.priceData,
            input.symbol,
            currentPrice
          );

          let finalPrediction: MLPrediction | undefined;
          for await (const update of generator) {
            if (update.stage === 'complete') {
              const result = await generator.return(undefined);
              if (result.value) {
                finalPrediction = result.value;
              }
            }
          }

          if (finalPrediction) {
            mlPrediction = finalPrediction;
            trendline.confidence = trendline.confidence * 0.4 + finalPrediction.successProbability * 0.6;
          }
        }

        proposals.push({
          id: `tl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'trendline',
          description: `${trendline.direction}トレンドライン`,
          confidence: trendline.confidence,
          mlPrediction: mlPrediction ? {
            successProbability: mlPrediction.successProbability,
            expectedBounces: mlPrediction.expectedBounces,
            reasoning: mlPrediction.reasoning
          } : undefined,
          drawingData: {
            type: 'trendline',
            points: trendline.touchPoints,
            style: {
              color: trendline.direction === '上昇' ? '#22c55e' : '#ef4444',
              lineWidth: 2,
              lineStyle: 'solid'
            }
          }
        });
      }
    }

    // Sort proposals by confidence (including ML-adjusted confidence)
    proposals.sort((a, b) => b.confidence - a.confidence);
    const finalProposals = proposals.slice(0, input.maxProposals);

    return {
      proposalGroupId: `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      proposals: finalProposals,
      summary: generateSummary(finalProposals, input.useMLValidation),
      totalAnalysisTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('[EnhancedProposalGeneration] Error', error);
    throw error;
  }
}

function detectSupportResistanceLevels(priceData: PriceData[]): Array<{
  type: 'support' | 'resistance';
  price: number;
  touchPoints: Array<{ time: number; value: number }>;
  confidence: number;
}> {
  const levels: SupportResistanceLevel[] = [];
  const priceRange = Math.max(...priceData.map(d => d.high)) - Math.min(...priceData.map(d => d.low));
  const tolerance = priceRange * 0.002; // 0.2% tolerance

  // Find local extremes
  for (let i = 5; i < priceData.length - 5; i++) {
    const current = priceData[i];
    
    // Check for local high (resistance)
    let isLocalHigh = true;
    for (let j = i - 5; j <= i + 5; j++) {
      if (j !== i && priceData[j].high > current.high) {
        isLocalHigh = false;
        break;
      }
    }
    
    if (isLocalHigh) {
      // Find similar highs
      const touchPoints: Array<{ time: number; value: number }> = [
        { time: current.time, value: current.high }
      ];
      
      for (let j = 0; j < priceData.length; j++) {
        if (j !== i && Math.abs(priceData[j].high - current.high) < tolerance) {
          touchPoints.push({ time: priceData[j].time, value: priceData[j].high });
        }
      }
      
      if (touchPoints.length >= 2) {
        levels.push({
          type: 'resistance',
          price: current.high,
          touchPoints,
          confidence: Math.min(0.95, 0.5 + touchPoints.length * 0.1)
        });
      }
    }
    
    // Check for local low (support)
    let isLocalLow = true;
    for (let j = i - 5; j <= i + 5; j++) {
      if (j !== i && priceData[j].low < current.low) {
        isLocalLow = false;
        break;
      }
    }
    
    if (isLocalLow) {
      // Find similar lows
      const touchPoints: Array<{ time: number; value: number }> = [
        { time: current.time, value: current.low }
      ];
      
      for (let j = 0; j < priceData.length; j++) {
        if (j !== i && Math.abs(priceData[j].low - current.low) < tolerance) {
          touchPoints.push({ time: priceData[j].time, value: priceData[j].low });
        }
      }
      
      if (touchPoints.length >= 2) {
        levels.push({
          type: 'support',
          price: current.low,
          touchPoints,
          confidence: Math.min(0.95, 0.5 + touchPoints.length * 0.1)
        });
      }
    }
  }
  
  // Remove duplicates and sort by touch count
  const uniqueLevels = consolidateLevels(levels, tolerance);
  return uniqueLevels.sort((a, b) => b.touchPoints.length - a.touchPoints.length);
}

function detectTrendlines(priceData: PriceData[]): Array<{
  direction: '上昇' | '下降';
  touchPoints: Array<{ time: number; value: number }>;
  confidence: number;
  slope: number;
  intercept: number;
}> {
  const trendlines: TrendlineData[] = [];
  
  // Find swing highs and lows
  const swingHighs: Array<{ index: number; time: number; value: number }> = [];
  const swingLows: Array<{ index: number; time: number; value: number }> = [];
  
  for (let i = 2; i < priceData.length - 2; i++) {
    const current = priceData[i];
    
    // Swing high
    if (current.high > priceData[i-1].high && 
        current.high > priceData[i-2].high &&
        current.high > priceData[i+1].high && 
        current.high > priceData[i+2].high) {
      swingHighs.push({ index: i, time: current.time, value: current.high });
    }
    
    // Swing low
    if (current.low < priceData[i-1].low && 
        current.low < priceData[i-2].low &&
        current.low < priceData[i+1].low && 
        current.low < priceData[i+2].low) {
      swingLows.push({ index: i, time: current.time, value: current.low });
    }
  }
  
  // Connect swing points to form trendlines
  // Uptrend: connect swing lows
  if (swingLows.length >= 2) {
    for (let i = 0; i < swingLows.length - 1; i++) {
      for (let j = i + 1; j < swingLows.length; j++) {
        const points = [swingLows[i], swingLows[j]];
        const { slope, intercept, touchPoints } = fitTrendline(points, priceData, 'low');
        
        if (touchPoints.length >= 3 && slope > 0) {
          trendlines.push({
            direction: '上昇',
            touchPoints: touchPoints.map(p => ({ time: p.time, value: p.value })),
            confidence: calculateTrendlineConfidence(touchPoints, slope),
            slope,
            intercept
          });
        }
      }
    }
  }
  
  // Downtrend: connect swing highs
  if (swingHighs.length >= 2) {
    for (let i = 0; i < swingHighs.length - 1; i++) {
      for (let j = i + 1; j < swingHighs.length; j++) {
        const points = [swingHighs[i], swingHighs[j]];
        const { slope, intercept, touchPoints } = fitTrendline(points, priceData, 'high');
        
        if (touchPoints.length >= 3 && slope < 0) {
          trendlines.push({
            direction: '下降',
            touchPoints: touchPoints.map(p => ({ time: p.time, value: p.value })),
            confidence: calculateTrendlineConfidence(touchPoints, slope),
            slope,
            intercept
          });
        }
      }
    }
  }
  
  return trendlines.sort((a, b) => b.confidence - a.confidence);
}

function fitTrendline(
  points: Array<{ index: number; time: number; value: number }>,
  priceData: PriceData[],
  field: 'high' | 'low'
): { slope: number; intercept: number; touchPoints: TouchPoint[] } {
  // Calculate slope and intercept
  const x1 = points[0].index;
  const y1 = points[0].value;
  const x2 = points[1].index;
  const y2 = points[1].value;
  
  const slope = (y2 - y1) / (x2 - x1);
  const intercept = y1 - slope * x1;
  
  // Find all touch points
  const touchPoints = [];
  const tolerance = Math.abs(y2 - y1) * 0.02; // 2% tolerance
  
  for (let i = 0; i < priceData.length; i++) {
    const expectedValue = slope * i + intercept;
    const actualValue = priceData[i][field];
    
    if (Math.abs(actualValue - expectedValue) < tolerance) {
      touchPoints.push({
        index: i,
        time: priceData[i].time,
        value: actualValue
      });
    }
  }
  
  return { slope, intercept, touchPoints };
}

function calculateTrendlineConfidence(touchPoints: TouchPoint[], slope: number): number {
  let confidence = 0.5;
  
  // More touch points = higher confidence
  confidence += Math.min(0.3, touchPoints.length * 0.05);
  
  // Recent touches = higher confidence
  const recentTouches = touchPoints.filter(p => 
    p.index > touchPoints[touchPoints.length - 1].index - 20
  ).length;
  confidence += recentTouches * 0.05;
  
  // Consistent slope = higher confidence
  if (Math.abs(slope) > 0.0001 && Math.abs(slope) < 0.01) {
    confidence += 0.1;
  }
  
  return Math.min(0.95, confidence);
}

function consolidateLevels(levels: SupportResistanceLevel[], tolerance: number): SupportResistanceLevel[] {
  const consolidated: SupportResistanceLevel[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < levels.length; i++) {
    if (used.has(i)) continue;
    
    const group = [levels[i]];
    used.add(i);
    
    for (let j = i + 1; j < levels.length; j++) {
      if (used.has(j)) continue;
      
      if (levels[i].type === levels[j].type && 
          Math.abs(levels[i].price - levels[j].price) < tolerance) {
        group.push(levels[j]);
        used.add(j);
      }
    }
    
    // Merge group
    if (group.length > 0) {
      const avgPrice = group.reduce((sum, l) => sum + l.price, 0) / group.length;
      const allTouchPoints = group.flatMap(l => l.touchPoints);
      const uniqueTouchPoints = Array.from(
        new Map(allTouchPoints.map(tp => [tp.time, tp])).values()
      );
      
      consolidated.push({
        type: group[0].type,
        price: avgPrice,
        touchPoints: uniqueTouchPoints,
        confidence: Math.min(0.95, 0.5 + uniqueTouchPoints.length * 0.1)
      });
    }
  }
  
  return consolidated;
}

function generateSummary(proposals: Proposal[], useMLValidation: boolean): string {
  if (proposals.length === 0) {
    return '有効な提案が見つかりませんでした。';
  }
  
  const patternCount = proposals.filter(p => p.type === 'pattern').length;
  const lineCount = proposals.filter(p => p.type !== 'pattern').length;
  const avgConfidence = proposals.reduce((sum, p) => sum + p.confidence, 0) / proposals.length;
  
  let summary = `${proposals.length}個の提案を生成しました`;
  
  if (patternCount > 0) {
    summary += `（パターン: ${patternCount}個`;
  }
  if (lineCount > 0) {
    summary += `${patternCount > 0 ? '、' : '（'}ライン: ${lineCount}個`;
  }
  summary += '）。';
  
  summary += `平均信頼度: ${Math.round(avgConfidence * 100)}%`;
  
  if (useMLValidation) {
    const mlValidatedCount = proposals.filter(p => p.mlPrediction).length;
    if (mlValidatedCount > 0) {
      summary += `。${mlValidatedCount}個の提案がML検証済み`;
    }
  }
  
  return summary;
}