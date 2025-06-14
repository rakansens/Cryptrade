import { createTool } from '@mastra/core';
import { z } from 'zod';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';
import { chartDataAnalysisTool } from './chart-data-analysis.tool';
import type {
  ChartState,
  ChartAnalysis,
  Operation,
  AIAnalysisResult,
  DrawingPoint,
  ChartDataPoint,
  OperationParameters,
  ConversationMessage,
  ClientEvent,
  ChartOperationEvent,
  DrawingOperationEvent,
} from '@/types/chart-control.types';

// Re-export types for backward compatibility
export type { ChartState, ChartAnalysis, Operation, AIAnalysisResult, DrawingPoint } from '@/types/chart-control.types';

/**
 * AI-Powered Unified Chart Control Tool
 * 
 * 完全AI駆動の統合チャート制御ツール
 * - chart-control.tool + chart-drawing.tool の統合
 * - 自然言語理解による操作解析
 * - 動的レスポンス生成
 * - 文脈に応じた操作実行
 */

const AIChartControlInput = z.object({
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
  }).optional().describe('Current chart state'),
});

const AIChartControlOutput = z.object({
  success: z.boolean(),
  operations: z.array(z.object({
    type: z.enum([
      'symbol_change', 'timeframe_change', 'chart_operation', 
      'indicator_control', 'drawing_operation', 'analysis_operation'
    ]),
    action: z.string(),
    parameters: z.record(z.unknown()),
    description: z.string(),
    clientEvent: z.object({
      event: z.string(),
      data: z.record(z.unknown()),
    }).optional(),
    executionMode: z.enum(['immediate', 'deferred']).default('deferred'),
  })),
  response: z.string().describe('Natural AI-generated response'),
  reasoning: z.string().describe('AI reasoning for operations'),
  metadata: z.object({
    confidence: z.number().min(0).max(1),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    aiEnhanced: z.boolean().default(true),
  }),
  error: z.string().optional(),
});

export const chartControlTool = createTool({
  id: 'ai-unified-chart-control',
  description: `
    AI-powered unified chart control tool for Cryptrade platform.
    Handles all chart operations through natural language understanding:
    
    Chart Operations:
    - Symbol changes (BTC, ETH, ADA, SOL, etc.)
    - Timeframe adjustments (1m, 5m, 15m, 1h, 4h, 1d, 1w)
    - View controls (fit, zoom, reset)
    
    Drawing Operations:
    - Trend lines, Fibonacci retracements
    - Support/resistance lines  
    - Automatic technical analysis
    
    Indicator Controls:
    - Moving averages, RSI, MACD, Bollinger Bands
    - Custom indicator settings
    
    Features:
    - Natural language understanding
    - Context-aware operations
    - Intelligent error handling
    - Multi-step operation support
  `,
  inputSchema: AIChartControlInput,
  outputSchema: AIChartControlOutput,

  execute: async ({ context }): Promise<z.infer<typeof AIChartControlOutput>> => {
    const { userRequest, conversationHistory = [], currentState = {} } = context;
    
    try {
      logger.info('[ChartControl] Processing request', { userRequest, currentState });
      
      // Get detailed chart analysis if needed for technical operations
      let chartAnalysis = null;
      const needsChartData = userRequest.toLowerCase().includes('ライン') || 
                            userRequest.toLowerCase().includes('line') ||
                            userRequest.toLowerCase().includes('分析') ||
                            userRequest.toLowerCase().includes('analysis') ||
                            userRequest.toLowerCase().includes('サポート') ||
                            userRequest.toLowerCase().includes('support') ||
                            userRequest.toLowerCase().includes('レジスタンス') ||
                            userRequest.toLowerCase().includes('resistance');
      
      if (needsChartData) {
        try {
          logger.info('[ChartControl] Fetching chart analysis for enhanced drawing recommendations');
          chartAnalysis = await chartDataAnalysisTool.execute({
            context: {
              symbol: currentState.symbol || 'BTCUSDT',
              timeframe: currentState.timeframe || '1h',
              limit: 200,
              analysisType: 'full',
            }
          }) as ChartAnalysis;
          logger.info('[ChartControl] Chart analysis completed', {
            recommendationCount: chartAnalysis.recommendations.trendlineDrawing.length
          });
        } catch (chartError) {
          logger.warn('[ChartControl] Chart analysis failed, proceeding without', {
            error: String(chartError)
          });
        }
      }
      
      // AI-powered request analysis (enhanced with chart data)
      const analysis = await analyzeChartRequest(userRequest, conversationHistory, currentState, chartAnalysis);
      
      // Generate operations based on AI analysis
      const operations = await generateChartOperations(analysis, currentState, chartAnalysis);
      
      // Generate natural language response
      const response = await generateUserResponse(analysis, operations, userRequest, chartAnalysis);
      
      return {
        success: true,
        operations,
        response,
        reasoning: analysis.reasoning,
        metadata: {
          confidence: analysis.confidence,
          complexity: analysis.complexity,
          aiEnhanced: true,
          chartDataUsed: !!chartAnalysis,
        },
      };

    } catch (error) {
      const fallbackResponse = await generateErrorResponse(userRequest, error);
      
      return {
        success: false,
        operations: [],
        response: fallbackResponse,
        reasoning: `Error occurred: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          confidence: 0,
          complexity: 'simple',
          aiEnhanced: false,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * AI-powered chart request analysis
 */
async function analyzeChartRequest(
  userRequest: string,
  conversationHistory: ConversationMessage[],
  currentState: ChartState,
  chartAnalysis: ChartAnalysis | null = null
): Promise<AIAnalysisResult> {
  const contextPrompt = buildContextPrompt(conversationHistory, currentState, chartAnalysis);
  
  const prompt = `
${contextPrompt}

User request: "${userRequest}"

Analyze this chart operation request and determine what the user wants to do.
Consider the context, current state, and available chart analysis data.

IMPORTANT: Respond with VALID JSON only. No additional text before or after.

JSON Structure:
{
  "operations": [
    {
      "type": "<operation_type>",
      "action": "<specific_action>",
      "parameters": {},
      "priority": <number 1-10>,
      "description": "<description>"
    }
  ],
  "reasoning": "<analysis>",
  "confidence": <number 0.0-1.0>,
  "complexity": "<simple|moderate|complex>",
  "userIntent": "<goal>"
}

Valid operation types:
- symbol_change: Change crypto symbol (BTC→BTCUSDT, ETH→ETHUSDT)
- timeframe_change: Change timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
- chart_operation: fit_content, zoom_in, zoom_out, reset_view, clear_all_drawings
- indicator_control: Toggle MA, RSI, MACD, Bollinger Bands
- drawing_operation: draw_trendline, draw_fibonacci, draw_horizontal, auto_analysis
  IMPORTANT: For draw_trendline and draw_fibonacci, ALWAYS include "points" array with at least 2 points
  Example points: [{"x": 100, "y": 200, "price": 105000, "time": 1735830000000}, {"x": 300, "y": 150, "price": 106000, "time": 1735833600000}]
- analysis_operation: auto_support_resistance, detect_patterns
- undo_redo: undo, redo, undo_last_drawing
- style_update: update_color, update_line_width, update_drawing_style

Examples:
- "BTCに変更" → type: "symbol_change", action: "change_symbol", parameters: {"symbol": "BTCUSDT"}
- "トレンドラインを引いて" → type: "drawing_operation", action: "draw_trendline", parameters: {"points": [{"x": 100, "y": 200, "price": 105000, "time": 1735830000000}, {"x": 300, "y": 150, "price": 106000, "time": 1735833600000}]}
- "トレンドラインを描画" → ALWAYS include points in parameters for automatic drawing
- "青色に変更" → type: "style_update", action: "update_color", parameters: {"color": "#2196F3"}
- "元に戻す" → type: "undo_redo", action: "undo"

Remember: Output ONLY valid JSON, no markdown code blocks.`;

  const result = await generateText({
    model: openai('gpt-4o'),
    prompt,
    maxTokens: 800,
  });

  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = result.text.trim();
    
    // Remove markdown code blocks
    cleanedText = cleanedText.replace(/```json\s*/gi, '');
    cleanedText = cleanedText.replace(/```\s*/gi, '');
    
    // Remove any non-JSON prefix/suffix
    const jsonStart = cleanedText.indexOf('{');
    const jsonEnd = cleanedText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleanedText);
    
    // Log successful parse for monitoring
    logger.info('[ChartControl] Successfully parsed AI response', {
      operationCount: parsed.operations?.length || 0,
      confidence: parsed.confidence
    });
    
    return parsed;
  } catch (parseError) {
    // Log parse error for monitoring
    logger.error('[ChartControl] Failed to parse AI response', {
      error: parseError,
      rawResponse: result.text?.substring(0, 200)
    });
    
    // Increment parse error metric
    incrementMetric('chart_control_parse_error_total');
    
    // Enhanced fallback with basic intent detection
    const lowerRequest = userRequest.toLowerCase();
    let fallbackType = 'chart_operation';
    let fallbackAction = 'general_request';
    
    if (lowerRequest.includes('btc') || lowerRequest.includes('eth')) {
      fallbackType = 'symbol_change';
      fallbackAction = 'change_symbol';
    } else if (lowerRequest.includes('undo') || lowerRequest.includes('戻')) {
      fallbackType = 'undo_redo';
      fallbackAction = 'undo';
    } else if (lowerRequest.includes('line') || lowerRequest.includes('ライン')) {
      fallbackType = 'drawing_operation';
      fallbackAction = 'draw_trendline';
    }
    
    return {
      operations: [{
        type: fallbackType,
        action: fallbackAction,
        parameters: { request: userRequest },
        priority: 5,
        description: 'Fallback: ' + userRequest
      }],
      reasoning: 'Failed to parse AI analysis, using enhanced fallback',
      confidence: 0.3,
      complexity: 'simple',
      userIntent: userRequest
    };
  }
}

/**
 * Generate chart operations from AI analysis
 */
async function generateChartOperations(analysis: AIAnalysisResult, currentState: ChartState, chartAnalysis: ChartAnalysis | null = null): Promise<Array<{
  type: string;
  action: string;
  parameters: OperationParameters;
  description: string;
  executionMode: 'immediate' | 'deferred';
  clientEvent?: ClientEvent;
}>> {
  const operations: Array<{
    type: string;
    action: string;
    parameters: OperationParameters;
    description: string;
    executionMode: 'immediate' | 'deferred';
    clientEvent?: ClientEvent;
  }> = [];
  
  for (const op of analysis.operations || []) {
    // Enhance operations with chart analysis data if available
    let enhancedParameters: OperationParameters = op.parameters || {};
    
    if (chartAnalysis && op.type === 'drawing_operation' && op.action === 'draw_trendline') {
      // Use recommended trendlines from chart analysis
      const recommendations = chartAnalysis.recommendations.trendlineDrawing;
      if (recommendations && recommendations.length > 0) {
        const bestRecommendation = recommendations[0]; // Highest priority
        enhancedParameters = {
          ...enhancedParameters,
          points: bestRecommendation.points,
          style: bestRecommendation.style,
          autoGenerated: true,
          description: bestRecommendation.description,
        };
        logger.info('[ChartControl] Enhanced trendline with chart analysis', {
          description: bestRecommendation.description,
          pointCount: bestRecommendation.points.length
        });
      }
    }
    
    // Generate appropriate client events
    const clientEvent = generateClientEvent(op.type, op.action, enhancedParameters);
    
    const operation = {
      type: op.type,
      action: op.action,
      parameters: enhancedParameters,
      description: op.description || `Execute ${op.action}`,
      executionMode: 'deferred' as const,
      ...(clientEvent && { clientEvent }),
    };

    operations.push(operation);
  }
  
  return operations;
}

/**
 * Generate client-side events for operations
 */
function generateClientEvent(type: string, action: string, parameters: OperationParameters): ClientEvent | null {
  const eventMap: Record<string, ClientEvent | null> = {
    'symbol_change': { event: 'ui:changeSymbol', data: { symbol: parameters.symbol } },
    'timeframe_change': { event: 'ui:changeTimeframe', data: { timeframe: parameters.timeframe } },
    'chart_operation': getChartOperationEvent(action, parameters) as ClientEvent,
    'indicator_control': { event: 'ui:toggleIndicator', data: parameters },
    'drawing_operation': getDrawingOperationEvent(action, parameters) as ClientEvent,
    'analysis_operation': { event: 'chart:autoAnalysis', data: parameters },
    'undo_redo': getUndoRedoEvent(action, parameters) as ClientEvent,
    'style_update': getStyleUpdateEvent(action, parameters) as ClientEvent,
  };

  return eventMap[type] || null;
}

/**
 * Get undo/redo operation events
 */
function getUndoRedoEvent(action: string, parameters: OperationParameters): ClientEvent {
  const eventMap: Record<string, ClientEvent> = {
    'undo': { event: 'chart:undo', data: { steps: parameters.steps || 1 } },
    'redo': { event: 'chart:redo', data: { steps: parameters.steps || 1 } },
    'undo_last_drawing': { event: 'chart:undoLastDrawing', data: {} },
    'redo_last_drawing': { event: 'chart:redoLastDrawing', data: {} },
  };
  
  return eventMap[action] || { event: `chart:${action}`, data: parameters };
}

/**
 * Get style update events
 */
function getStyleUpdateEvent(action: string, parameters: OperationParameters): ClientEvent {
  const eventMap: Record<string, ClientEvent> = {
    'update_drawing_style': { 
      event: 'chart:updateDrawingStyle', 
      data: {
        id: parameters.drawingId,
        style: parameters.style || {},
      }
    },
    'update_all_styles': {
      event: 'chart:updateAllStyles',
      data: {
        type: parameters.drawingType,
        style: parameters.style || {},
      }
    },
    'update_color': {
      event: 'chart:updateDrawingColor',
      data: {
        id: parameters.drawingId,
        color: parameters.color,
      }
    },
    'update_line_width': {
      event: 'chart:updateDrawingLineWidth',
      data: {
        id: parameters.drawingId,
        lineWidth: parameters.lineWidth,
      }
    },
  };
  
  return eventMap[action] || { event: `chart:${action}`, data: parameters };
}

/**
 * Get chart operation specific events
 */
function getChartOperationEvent(action: string, parameters: OperationParameters): ChartOperationEvent {
  const eventMap: Record<string, ChartOperationEvent> = {
    'fit_content': { event: 'chart:fitContent', data: {} },
    'zoom_in': { event: 'chart:zoomIn', data: { factor: parameters.factor || 1.2 } },
    'zoom_out': { event: 'chart:zoomOut', data: { factor: parameters.factor || 0.8 } },
    'reset_view': { event: 'chart:resetView', data: {} },
    'clear_all_drawings': { event: 'chart:clearAllDrawings', data: {} },
    'toggle_drawing_mode': { event: 'chart:setDrawingMode', data: { mode: parameters.mode || 'none' } },
  };

  return eventMap[action] || { event: `chart:${action}`, data: parameters };
}

/**
 * Get drawing operation specific events
 */
function getDrawingOperationEvent(action: string, parameters: OperationParameters): DrawingOperationEvent {
  const eventMap: Record<string, DrawingOperationEvent> = {
    'draw_trendline': { 
      event: parameters.points ? 'draw:trendline' : (parameters.startPoint && parameters.endPoint ? 'chart:addDrawing' : 'chart:startDrawing'), 
      data: parameters.points ? {
        // AIが計算したポイントで自動描画
        points: (parameters.points as ChartDataPoint[]).map((p: ChartDataPoint) => ({
          time: p.time,
          price: p.price || p.value, // Handle both formats
        })),
        style: parameters.style || { color: '#00e676', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      } : (parameters.startPoint && parameters.endPoint ? {
        id: `trendline_${Date.now()}`,
        type: 'trendline',
        points: [parameters.startPoint, parameters.endPoint],
        style: parameters.style || { color: '#2196F3', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      } : {
        type: 'trendline',
        style: parameters.style || { color: '#2196F3', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      })
    },
    'draw_fibonacci': { 
      event: parameters.points ? 'draw:fibonacci' : (parameters.startPoint && parameters.endPoint ? 'chart:addDrawing' : 'chart:startDrawing'),
      data: parameters.points ? {
        // AIが計算したポイントで自動描画
        points: (parameters.points as ChartDataPoint[]).map((p: ChartDataPoint) => ({
          time: p.time,
          price: p.price || p.value, // Handle both formats
        })),
        levels: parameters.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
        style: parameters.style || { color: '#FF9800', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
      } : (parameters.startPoint && parameters.endPoint ? {
        id: `fibonacci_${Date.now()}`,
        type: 'fibonacci',
        points: [parameters.startPoint, parameters.endPoint],
        levels: parameters.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
        style: parameters.style || { color: '#FF9800', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
      } : {
        type: 'fibonacci',
        levels: parameters.fibonacciLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
        style: parameters.style || { color: '#FF9800', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
      })
    },
    'draw_horizontal': { 
      event: 'chart:addDrawing', 
      data: { 
        id: `horizontal_${Date.now()}`,
        type: 'horizontal', 
        price: parameters.price,
        style: parameters.style || { color: '#4CAF50', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      } 
    },
    'draw_vertical': { 
      event: 'chart:addDrawing', 
      data: { 
        id: `vertical_${Date.now()}`,
        type: 'vertical', 
        time: parameters.time,
        style: parameters.style || { color: '#9C27B0', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      } 
    },
    'auto_analysis': { 
      event: 'chart:autoAnalysis', 
      data: { 
        type: parameters.analysisType || 'trend',
        config: parameters.config || {
          lookbackPeriod: 100,
          minTouchPoints: 3,
          confidenceThreshold: 0.7
        }
      } 
    },
    'auto_support_resistance': { 
      event: 'chart:autoAnalysis', 
      data: { 
        type: 'support_resistance',
        config: parameters.config || {
          lookbackPeriod: 200,
          minTouchPoints: 2,
          confidenceThreshold: 0.6
        }
      } 
    },
  };

  return eventMap[action] || { event: 'chart:startDrawing', data: { type: action, ...parameters } };
}

/**
 * Generate natural language response
 */
async function generateUserResponse(analysis: AIAnalysisResult, operations: Array<{
  type: string;
  action: string;
  parameters: OperationParameters;
  description: string;
  executionMode: 'immediate' | 'deferred';
  clientEvent?: ClientEvent;
}>, userRequest: string, chartAnalysis: ChartAnalysis | null = null): Promise<string> {
  const operationsDesc = operations.map(op => op.description).join(', ');
  
  let chartContext = '';
  if (chartAnalysis) {
    chartContext = `\n\nChart Analysis Context:
- Current Price: ${chartAnalysis.currentPrice.price.toFixed(2)}
- Trend: ${chartAnalysis.technicalAnalysis.trend.direction} (${Math.round(chartAnalysis.technicalAnalysis.trend.strength * 100)}% strength)
- RSI: ${chartAnalysis.technicalAnalysis.momentum.rsi.toFixed(1)}
- Volatility: ${chartAnalysis.technicalAnalysis.volatility.volatilityLevel}
- Recommendations: ${chartAnalysis.recommendations.trendlineDrawing.length} drawing suggestions available`;
  }
  
  const prompt = `
User requested: "${userRequest}"
Operations to execute: ${operationsDesc}${chartContext}

Generate a natural, helpful response that:
1. Acknowledges what the user asked for
2. Confirms what operations will be performed
3. Provides brief technical context if chart analysis is available
4. Maintains a conversational tone in Japanese

Keep it concise but informative.
`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
    maxTokens: 150,
  });

  return result.text;
}

/**
 * Generate error response
 */
async function generateErrorResponse(userRequest: string, error: unknown): Promise<string> {
  try {
    const result = await generateText({
      model: openai('gpt-3.5-turbo'),
      prompt: `
User requested: "${userRequest}"
Error occurred: ${error instanceof Error ? error.message : String(error)}

Generate a helpful, apologetic response that:
1. Acknowledges the issue
2. Suggests alternatives if possible
3. Remains positive and helpful

Keep it brief and constructive.
`,
      maxTokens: 100,
    });

    return result.text;
  } catch (fallbackError) {
    return '申し訳ございません。リクエストの処理中に問題が発生しました。しばらく時間をおいて再度お試しください。';
  }
}

/**
 * Build context prompt
 */
function buildContextPrompt(
  conversationHistory: ConversationMessage[],
  currentState: ChartState,
  chartAnalysis: ChartAnalysis | null = null
): string {
  let context = 'Current chart context:\n';
  
  if (currentState.symbol) {
    context += `Symbol: ${currentState.symbol}\n`;
  }
  
  if (currentState.timeframe) {
    context += `Timeframe: ${currentState.timeframe}\n`;
  }
  
  if (currentState.activeIndicators && currentState.activeIndicators.length > 0) {
    context += `Active indicators: ${currentState.activeIndicators.join(', ')}\n`;
  }
  
  if (conversationHistory.length > 0) {
    context += `\nRecent conversation:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n`;
  }
  
  if (chartAnalysis) {
    context += `\nTechnical Analysis Data:
- Current Price: ${chartAnalysis.currentPrice.price.toFixed(2)}
- Trend: ${chartAnalysis.technicalAnalysis.trend.direction} (strength: ${Math.round(chartAnalysis.technicalAnalysis.trend.strength * 100)}%)
- RSI: ${chartAnalysis.technicalAnalysis.momentum.rsi.toFixed(1)}
- Support Levels: ${chartAnalysis.technicalAnalysis.supportResistance.supports.map((s: { price: number; strength: number }) => s.price.toFixed(2)).join(', ')}
- Resistance Levels: ${chartAnalysis.technicalAnalysis.supportResistance.resistances.map((r: { price: number; strength: number }) => r.price.toFixed(2)).join(', ')}
- Drawing Recommendations: ${chartAnalysis.recommendations.trendlineDrawing.length} available
- Analysis: ${chartAnalysis.recommendations.analysis}
`;
  }
  
  return context + '\n';
}

