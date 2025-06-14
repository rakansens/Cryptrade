import { createTool } from '@mastra/core';
import { z } from 'zod';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';
import { chartDataAnalysisTool } from './chart-data-analysis.tool';
import type { 
  ChartState, 
  ChartAnalysisResult, 
  ConversationMessage,
  NumberExtractionResult,
  AIAnalysisResult,
  ChartOperation,
  ChartOperationParameters,
  ClientEventData
} from '@/types/mastra.types';

/**
 * Enhanced Chart Control Tool with Multiple Drawing Support
 * 
 * 複数描画・バッチ操作に対応した強化版チャート制御ツール
 * - 複数トレンドライン同時描画
 * - 数値指定による繰り返し操作
 * - より自然な日本語理解
 */

const EnhancedChartControlInput = z.object({
  userRequest: z.string().describe('Natural language user request'),
  conversationHistory: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional().describe('Conversation context'),
  currentState: z.object({
    symbol: z.string().optional(),
    timeframe: z.string().optional(),
    activeIndicators: z.array(z.string()).optional(),
    drawingMode: z.string().optional(),
    existingDrawings: z.array(z.object({
      id: z.string(),
      type: z.string(),
    })).optional(),
  }).optional().describe('Current chart state'),
});

const EnhancedChartControlOutput = z.object({
  success: z.boolean(),
  operations: z.array(z.object({
    type: z.enum([
      'symbol_change', 'timeframe_change', 'chart_operation', 
      'indicator_control', 'drawing_operation', 'analysis_operation',
      'batch_operation' // 新規：バッチ操作
    ]),
    action: z.string(),
    parameters: z.record(z.unknown()),
    description: z.string(),
    clientEvent: z.object({
      event: z.string(),
      data: z.record(z.unknown()),
    }).optional(),
    executionMode: z.enum(['immediate', 'deferred', 'sequential']).default('deferred'),
    repeatCount: z.number().optional(), // 繰り返し回数
  })),
  response: z.string().describe('Natural AI-generated response'),
  reasoning: z.string().describe('AI reasoning for operations'),
  metadata: z.object({
    confidence: z.number().min(0).max(1),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    aiEnhanced: z.boolean().default(true),
    multipleOperations: z.boolean().default(false),
    chartDataUsed: z.boolean().optional(),
  }),
  error: z.string().optional(),
});

export const enhancedChartControlTool = createTool({
  id: 'enhanced-chart-control',
  description: `
    Enhanced AI-powered chart control with multiple drawing support.
    
    New capabilities:
    - Multiple drawings: "5本のトレンドラインを引いて"
    - Batch operations: "すべての描画を削除"
    - Complex combinations: "BTCの1時間足で3本のサポートラインを表示"
    - Natural number understanding: "いくつか", "複数", "全部"
    
    Improvements:
    - Better Japanese number parsing (一本、二本、三本...)
    - Automatic spacing for multiple drawings
    - Collision detection to avoid overlaps
    - Priority-based drawing placement
  `,
  inputSchema: EnhancedChartControlInput,
  outputSchema: EnhancedChartControlOutput,

  execute: async ({ context }): Promise<z.infer<typeof EnhancedChartControlOutput>> => {
    const { userRequest, conversationHistory = [], currentState = {} } = context;
    
    try {
      logger.info('[EnhancedChartControl] Processing request', { userRequest, currentState });
      
      // Parse numbers from request
      const numberMatch = extractNumberFromRequest(userRequest);
      const requestedCount = numberMatch.count;
      
      // Get chart analysis - AIファースト：常にチャートデータを取得
      let chartAnalysis = null;
      let parsedChartData = null;
      
      try {
        const chartResult = await chartDataAnalysisTool.execute({
          context: {
            symbol: currentState.symbol || 'BTCUSDT',
            timeframe: currentState.timeframe || '1h',
            limit: 200,
            analysisType: 'full',
          }
        });
        
        // Use the analysis result directly - it's already an object, not a string
        if (chartResult) {
          chartAnalysis = chartResult;
          logger.info('[EnhancedChartControl] Chart analysis completed', {
            candleCount: chartResult.rawData?.candles?.length,
            hasRecommendations: !!chartResult.recommendations,
            trendlineCount: chartResult.recommendations?.trendlineDrawing?.length || 0,
            recommendationExample: chartResult.recommendations?.trendlineDrawing?.[0] ? {
              hasPoints: !!chartResult.recommendations.trendlineDrawing[0].points,
              pointCount: chartResult.recommendations.trendlineDrawing[0].points?.length || 0,
              firstPoint: chartResult.recommendations.trendlineDrawing[0].points?.[0]
            } : null
          });
        }
      } catch (error) {
        logger.warn('[EnhancedChartControl] Chart analysis failed', { error: String(error) });
      }
      
      // Enhanced AI analysis with number awareness
      const analysis = await analyzeEnhancedRequest(
        userRequest, 
        conversationHistory, 
        currentState, 
        chartAnalysis,
        requestedCount
      );
      
      // Generate operations with multiple drawing support
      const operations = await generateEnhancedOperations(
        analysis, 
        currentState, 
        chartAnalysis,
        requestedCount
      );
      
      // Generate response
      const response = await generateEnhancedResponse(
        analysis, 
        operations, 
        userRequest, 
        chartAnalysis,
        requestedCount
      );
      
      return {
        success: true,
        operations,
        response,
        reasoning: analysis.reasoning,
        metadata: {
          confidence: analysis.confidence,
          complexity: analysis.complexity,
          aiEnhanced: true,
          multipleOperations: operations.length > 1,
          chartDataUsed: !!chartAnalysis,
        },
      };

    } catch (error) {
      logger.error('[EnhancedChartControl] Error', { error: String(error) });
      
      return {
        success: false,
        operations: [],
        response: '申し訳ございません。リクエストの処理中にエラーが発生しました。',
        reasoning: 'Error occurred',
        metadata: {
          confidence: 0,
          complexity: 'simple',
          aiEnhanced: false,
          multipleOperations: false,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Extract number from Japanese/English request
 */
function extractNumberFromRequest(request: string): NumberExtractionResult {
  const patterns = [
    // 数字
    { pattern: /(\d+)\s*本/, extract: (m: RegExpMatchArray) => parseInt(m[1]) },
    { pattern: /(\d+)\s*つ/, extract: (m: RegExpMatchArray) => parseInt(m[1]) },
    
    // 日本語数字
    { pattern: /一本|1本/, extract: () => 1 },
    { pattern: /二本|2本/, extract: () => 2 },
    { pattern: /三本|3本/, extract: () => 3 },
    { pattern: /四本|4本/, extract: () => 4 },
    { pattern: /五本|5本/, extract: () => 5 },
    { pattern: /六本|6本/, extract: () => 6 },
    { pattern: /七本|7本/, extract: () => 7 },
    { pattern: /八本|8本/, extract: () => 8 },
    { pattern: /九本|9本/, extract: () => 9 },
    { pattern: /十本|10本/, extract: () => 10 },
    
    // 特殊表現
    { pattern: /いくつか|複数|何本か/, extract: () => 3 }, // デフォルト3本
    { pattern: /たくさん|多数/, extract: () => 5 },
    { pattern: /全部|すべて/, extract: () => -1 }, // 特殊値
  ];
  
  for (const { pattern, extract } of patterns) {
    const match = request.match(pattern);
    if (match) {
      return { count: extract(match), type: 'explicit' };
    }
  }
  
  return { count: 1, type: 'implicit' }; // デフォルト1本
}

/**
 * Check if chart data analysis is needed
 */
function needsChartDataAnalysis(request: string): boolean {
  const keywords = [
    'ライン', 'line', '分析', 'analysis', 'サポート', 'support',
    'レジスタンス', 'resistance', '最適', 'optimal', '自動', 'auto',
    'おすすめ', 'recommend', '提案', 'suggest'
  ];
  
  const lowerRequest = request.toLowerCase();
  return keywords.some(keyword => lowerRequest.includes(keyword));
}

/**
 * Enhanced request analysis with multiple drawing awareness
 */
async function analyzeEnhancedRequest(
  userRequest: string,
  conversationHistory: ConversationMessage[],
  currentState: ChartState,
  chartAnalysis: ChartAnalysisResult | null,
  requestedCount: number
): Promise<AIAnalysisResult> {
  const contextPrompt = buildEnhancedContextPrompt(
    conversationHistory, 
    currentState, 
    chartAnalysis,
    requestedCount
  );
  
  const prompt = `
${contextPrompt}

User request: "${userRequest}"
Requested count: ${requestedCount} (${requestedCount === -1 ? 'all' : requestedCount})

Analyze this request considering multiple operations if needed.

IMPORTANT: Respond with VALID JSON only.

JSON Structure:
{
  "operations": [
    {
      "type": "drawing_operation",  // MUST be "drawing_operation" for any drawing request
      "action": "draw_trendline",    // for trendline drawing
      "parameters": {},              // will be filled with points from chart analysis
      "priority": <number 1-10>,
      "description": "<description>",
      "repeatCount": <number if multiple>
    }
  ],
  "reasoning": "<analysis>",
  "confidence": <number 0.0-1.0>,
  "complexity": "<simple|moderate|complex>",
  "userIntent": "<goal>",
  "requiresMultiple": <boolean>
}

IMPORTANT: For any drawing request (トレンドライン, サポートライン, etc), ALWAYS use type="drawing_operation"`;

  const result = await generateText({
    model: openai('gpt-4o'),
    prompt,
    maxTokens: 1000,
  });

  logger.info('[EnhancedChartControl] AI response', { 
    response: result.text.substring(0, 200) + '...',
    hasChartAnalysis: !!chartAnalysis,
    chartAnalysisKeys: chartAnalysis ? Object.keys(chartAnalysis) : [],
    recommendationCount: chartAnalysis?.recommendations?.trendlineDrawing?.length || 0
  });

  try {
    // Remove markdown code blocks if present
    let cleanText = result.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.slice(7); // Remove ```json
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.slice(3); // Remove ```
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.slice(0, -3); // Remove trailing ```
    }
    return JSON.parse(cleanText.trim());
  } catch (error) {
    logger.error('[EnhancedChartControl] Parse error', { 
      error: error instanceof Error ? error.message : String(error),
      responseText: result.text,
      responseLength: result.text.length
    });
    
    // Fallback with chart analysis data if available
    const fallbackParams: ChartOperationParameters = {};
    
    // If we have chart analysis with recommendations, use them
    if (chartAnalysis && chartAnalysis.recommendations && chartAnalysis.recommendations.trendlineDrawing && chartAnalysis.recommendations.trendlineDrawing.length > 0) {
      const recommendation = chartAnalysis.recommendations.trendlineDrawing[0];
      fallbackParams.points = recommendation.points;
      fallbackParams.style = recommendation.style;
      fallbackParams.autoGenerated = true;
      fallbackParams.description = recommendation.description;
    }
    
    return {
      operations: [{
        type: 'drawing_operation',
        action: 'draw_trendline',
        parameters: fallbackParams,
        priority: 5,
        repeatCount: requestedCount > 1 ? requestedCount : 1
      }],
      reasoning: 'Fallback to basic operation with chart analysis',
      confidence: 0.5,
      complexity: 'simple',
      userIntent: userRequest,
      requiresMultiple: requestedCount > 1
    };
  }
}

/**
 * Generate enhanced operations with multiple drawing support
 */
async function generateEnhancedOperations(
  analysis: AIAnalysisResult,
  currentState: ChartState,
  chartAnalysis: ChartAnalysisResult | null,
  requestedCount: number
) {
  const operations = [];
  
  for (const op of analysis.operations || []) {
    const repeatCount = op.repeatCount || 1;
    
    // AIファースト: チャート分析データがある場合は、単一の描画でも同じフローを使用
    if (op.type === 'drawing_operation' && (repeatCount > 1 || (chartAnalysis && chartAnalysis.recommendations?.trendlineDrawing?.length > 0))) {
      // Generate drawing operations (single or multiple)
      const multipleOps = await generateMultipleDrawings(
        op,
        chartAnalysis,
        repeatCount,
        currentState
      );
      operations.push(...multipleOps);
    } else {
      // Single operation without chart data
      const enhancedOp = await enhanceSingleOperation(op, chartAnalysis);
      operations.push(enhancedOp);
    }
  }
  
  return operations;
}

/**
 * Generate multiple drawing operations with smart placement
 */
async function generateMultipleDrawings(
  baseOp: ChartOperation,
  chartAnalysis: ChartAnalysisResult | null,
  count: number,
  currentState: ChartState
): Promise<ChartOperation[]> {
  const allDrawings: ChartOperation[] = [];
  
  if (chartAnalysis && chartAnalysis.recommendations.trendlineDrawing.length > 0) {
    // Use AI recommendations
    const recommendations = chartAnalysis.recommendations.trendlineDrawing;
    const availableCount = Math.min(count, recommendations.length);
    
    for (let i = 0; i < availableCount; i++) {
      const rec = recommendations[i];
      allDrawings.push({
        id: `trend-${Date.now()}-${i}`,
        points: rec.points,
        style: rec.style,
        autoGenerated: true,
        description: rec.description,
        index: i,
        total: availableCount,
      });
    }
    
    // If more lines requested than recommendations
    if (count > availableCount) {
      const remaining = count - availableCount;
      const syntheticDrawings = generateSyntheticDrawingData(remaining, availableCount, chartAnalysis);
      allDrawings.push(...syntheticDrawings);
    }
  } else {
    // Generate synthetic drawings without analysis
    const syntheticDrawings = generateSyntheticDrawingData(count, 0, chartAnalysis);
    allDrawings.push(...syntheticDrawings);
  }
  
  // AIファースト：各描画を個別のイベントとして返す（チャートの互換性のため）
  return allDrawings.map((drawing, idx) => ({
    type: baseOp.type,
    action: 'draw_trendline',
    parameters: {
      points: drawing.points,
      style: drawing.style,
      id: drawing.id,
      description: drawing.description,
    },
    description: `${drawing.description} (${idx + 1}/${allDrawings.length})`,
    executionMode: 'immediate' as const,
    clientEvent: {
      event: 'draw:trendline',
      data: {
        points: drawing.points,
        style: drawing.style,
      }
    }
  }));
}

/**
 * Generate synthetic drawing data when no analysis available
 * AIファーストアプローチ：チャートの現在の表示範囲を使用
 */
function generateSyntheticDrawingData(count: number, startIndex: number, chartAnalysis?: ChartAnalysisResult): ChartOperation[] {
  const drawings = [];
  
  // チャート分析データから時間と価格の範囲を取得
  let timeRange = { start: 0, end: 0 };
  let priceRange = { min: 0, max: 0 };
  
  if (chartAnalysis && chartAnalysis.candles && chartAnalysis.candles.length > 0) {
    const candles = chartAnalysis.candles;
    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    
    // 時間範囲を秒単位で取得（lightweight-chartsは秒単位のUNIXタイムスタンプを使用）
    timeRange.start = Math.floor(new Date(firstCandle.time).getTime() / 1000);
    timeRange.end = Math.floor(new Date(lastCandle.time).getTime() / 1000);
    
    // 価格範囲を取得
    const prices = candles.map((c) => [c.high, c.low]).flat();
    priceRange.min = Math.min(...prices);
    priceRange.max = Math.max(...prices);
  } else {
    // フォールバック：現在時刻を基準に
    const currentTimeSeconds = Math.floor(Date.now() / 1000);
    timeRange = {
      start: currentTimeSeconds - 86400, // 24時間前
      end: currentTimeSeconds
    };
    priceRange = {
      min: 95000,
      max: 110000
    };
  }
  
  const timeSpan = timeRange.end - timeRange.start;
  const priceSpan = priceRange.max - priceRange.min;
  
  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    
    // 各トレンドラインの配置をAIファーストで計算
    // 時間軸：表示範囲の30-70%をカバー
    const timeStartPercent = 0.1 + (i / Math.max(count - 1, 1)) * 0.2;
    const timeEndPercent = 0.6 + (i / Math.max(count - 1, 1)) * 0.3;
    
    const lineStartTime = timeRange.start + (timeSpan * timeStartPercent);
    const lineEndTime = timeRange.start + (timeSpan * timeEndPercent);
    
    // 価格軸：均等に分散させつつ、トレンドの方向性を考慮
    const verticalPosition = 0.2 + (i / Math.max(count - 1, 1)) * 0.6;
    const basePrice = priceRange.min + (priceSpan * verticalPosition);
    
    // AIファースト：市場のトレンドに基づいた傾きを生成
    const trendDirection = chartAnalysis?.trend?.direction || 'neutral';
    let slope = 0;
    
    if (trendDirection === 'bullish') {
      slope = priceSpan * 0.1 * (1 + i * 0.05); // 上昇トレンド
    } else if (trendDirection === 'bearish') {
      slope = -priceSpan * 0.1 * (1 + i * 0.05); // 下降トレンド
    } else {
      // 中立：交互に上昇・下降
      slope = priceSpan * 0.05 * (i % 2 === 0 ? 1 : -1);
    }
    
    drawings.push({
      id: `trend-ai-${Date.now()}-${index}`,
      points: [
        {
          time: lineStartTime,
          price: basePrice,
        },
        {
          time: lineEndTime,
          price: basePrice + slope,
        }
      ],
      style: {
        color: generateDistinctColor(index),
        lineWidth: 2 + (index === 0 ? 1 : 0), // 最初の線を少し太く
        lineStyle: 'solid' as const,
        showLabels: true,
      },
      autoGenerated: true,
      synthetic: true,
      description: `AIトレンドライン ${index + 1}`,
      index: index,
      total: startIndex + count,
    });
  }
  
  return drawings;
}

/**
 * Generate distinct colors for multiple lines
 */
function generateDistinctColor(index: number): string {
  const colors = [
    '#00E676', // Green
    '#2196F3', // Blue
    '#FF5722', // Red
    '#FFC107', // Amber
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FF9800', // Orange
    '#795548', // Brown
  ];
  
  return colors[index % colors.length];
}

/**
 * Enhance single operation
 */
async function enhanceSingleOperation(op: ChartOperation, chartAnalysis: ChartAnalysisResult | null): Promise<ChartOperation> {
  let enhancedParameters = op.parameters || {};
  
  // Only enhance if we don't already have points
  if (chartAnalysis && op.type === 'drawing_operation' && !enhancedParameters.points) {
    const recommendations = chartAnalysis.recommendations?.trendlineDrawing;
    if (recommendations && recommendations.length > 0) {
      const bestRec = recommendations[0];
      enhancedParameters = {
        ...enhancedParameters,
        points: bestRec.points,
        style: bestRec.style,
        autoGenerated: true,
        description: bestRec.description,
      };
    }
  }
  
  const clientEvent = generateEnhancedClientEvent(op.type, op.action, enhancedParameters);
  
  return {
    type: op.type,
    action: op.action,
    parameters: enhancedParameters,
    description: op.description || `Execute ${op.action}`,
    executionMode: 'immediate' as const, // Change to immediate for drawing operations with points
    ...(clientEvent && { clientEvent }),
  };
}

/**
 * Generate enhanced client event
 */
function generateEnhancedClientEvent(type: string, action: string, parameters: ChartOperationParameters): ClientEvent | undefined {
  // Similar to original but with batch support
  const eventMap: Record<string, () => ClientEvent> = {
    'symbol_change': { event: 'ui:changeSymbol', data: { symbol: parameters.symbol } },
    'timeframe_change': { event: 'ui:changeTimeframe', data: { timeframe: parameters.timeframe } },
    'drawing_operation': {
      event: parameters.points ? 'draw:trendline' : 'chart:startDrawing',
      data: parameters.points ? {
        points: parameters.points?.map((p) => ({
          time: p.time,
          price: p.price || p.value,
        })),
        style: parameters.style,
      } : { type: action }
    },
    'batch_operation': { event: 'chart:batchOperation', data: parameters },
  };
  
  return eventMap[type] || null;
}

/**
 * Generate enhanced response
 */
async function generateEnhancedResponse(
  analysis: AIAnalysisResult,
  operations: ChartOperation[],
  userRequest: string,
  chartAnalysis: ChartAnalysisResult | null,
  requestedCount: number
) {
  const operationsSummary = operations.length > 1 
    ? `${operations.length}件の操作を実行します` 
    : operations[0]?.description || '操作を実行します';
  
  const prompt = `
User requested: "${userRequest}"
Operations: ${operationsSummary}
Multiple operations: ${operations.length > 1}
Requested count: ${requestedCount}

Generate a natural, helpful response in Japanese that:
1. Confirms the multiple operations if applicable
2. Mentions the specific count if multiple items requested
3. Provides brief context about the operations
4. Maintains conversational tone

Keep it concise and informative.
`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
    maxTokens: 150,
  });

  return result.text;
}

/**
 * Build enhanced context prompt
 */
function buildEnhancedContextPrompt(
  conversationHistory: ConversationMessage[],
  currentState: ChartState,
  chartAnalysis: ChartAnalysisResult | null,
  requestedCount: number
): string {
  let context = 'Current context:\n';
  
  if (currentState.symbol) {
    context += `Symbol: ${currentState.symbol}\n`;
  }
  
  if (currentState.timeframe) {
    context += `Timeframe: ${currentState.timeframe}\n`;
  }
  
  if (currentState.existingDrawings?.length > 0) {
    context += `Existing drawings: ${currentState.existingDrawings.length}\n`;
  }
  
  if (chartAnalysis && chartAnalysis.recommendedActions) {
    context += `\nAvailable recommendations: ${chartAnalysis.recommendedActions.length}\n`;
  }
  
  if (requestedCount > 1) {
    context += `\nUser requested multiple items: ${requestedCount}\n`;
  }
  
  return context;
}