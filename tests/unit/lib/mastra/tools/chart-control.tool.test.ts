// Mock dependencies before imports
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/metrics');
jest.mock('ai');
jest.mock('@ai-sdk/openai');
jest.mock('@/lib/mastra/tools/chart-data-analysis.tool');

import { chartControlTool } from '@/lib/mastra/tools/chart-control.tool';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';
import { chartDataAnalysisTool } from '@/lib/mastra/tools/chart-data-analysis.tool';
import type { 
  MockGenerateTextResponse, 
  MockAIAnalysisResult, 
  ChartControlContext,
  ChartControlResult,
  MockChartAnalysis,
  MockChartControlExecute
} from './chart-control.tool.test.types';

// Type the execute function properly
const executeChartControlTool = chartControlTool.execute as MockChartControlExecute;

// Helper function to create mock generateText response
function createMockGenerateTextResponse(
  analysisResult: MockAIAnalysisResult | string,
  options: Partial<MockGenerateTextResponse> = {}
): Awaited<ReturnType<typeof generateText>> {
  const text = typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult);
  
  const mockResponse: MockGenerateTextResponse = {
    text,
    usage: { promptTokens: 100, completionTokens: 50 },
    finishReason: 'stop',
    response: {},
    ...options
  };
  
  return mockResponse as Awaited<ReturnType<typeof generateText>>;
}

describe('chartControlTool', () => {
  const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
  const mockOpenai = openai as jest.MockedFunction<typeof openai>;
  const mockChartDataAnalysisTool = chartDataAnalysisTool.execute as jest.MockedFunction<
    (params: unknown) => Promise<MockChartAnalysis>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AI model
    mockOpenai.mockReturnValue('gpt-4o' as unknown as ReturnType<typeof openai>);
    
    // Default mock for generateText - valid JSON response
    const mockAnalysisResult: MockAIAnalysisResult = {
      operations: [{
        type: 'symbol_change',
        action: 'change_symbol',
        parameters: { symbol: 'BTCUSDT' },
        priority: 8,
        description: 'Change to BTC'
      }],
      reasoning: 'User wants to view BTC chart',
      confidence: 0.9,
      complexity: 'simple',
      userIntent: 'View BTC chart'
    };
    
    mockGenerateText.mockResolvedValue(createMockGenerateTextResponse(mockAnalysisResult));
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(chartControlTool.id).toBe('ai-unified-chart-control');
      expect(chartControlTool.description).toContain('AI-powered unified chart control tool');
      expect(chartControlTool.inputSchema).toBeDefined();
      expect(chartControlTool.outputSchema).toBeDefined();
    });
  });

  describe('execute - basic operations', () => {
    it('should handle symbol change request', async () => {
      const result = await executeChartControlTool({
        context: {
          userRequest: 'BTCに変更して',
          conversationHistory: [],
          currentState: { symbol: 'ETHUSDT', timeframe: '1h' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        type: 'symbol_change',
        action: 'change_symbol',
        parameters: { symbol: 'BTCUSDT' },
        clientEvent: {
          event: 'ui:changeSymbol',
          data: { symbol: 'BTCUSDT' }
        }
      });
    });

    it('should handle timeframe change request', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
        operations: [{
          type: 'timeframe_change',
          action: 'change_timeframe',
          parameters: { timeframe: '4h' },
          priority: 7,
          description: 'Change to 4 hour timeframe'
        }],
        reasoning: 'User wants 4h timeframe',
        confidence: 0.85,
        complexity: 'simple',
        userIntent: 'Change timeframe'
      }));

      const result = await executeChartControlTool({
        context: {
          userRequest: '4時間足に変更',
          currentState: { timeframe: '1h' }
        }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'ui:changeTimeframe',
        data: { timeframe: '4h' }
      });
    });

    it('should handle chart operations', async () => {
      const chartOps = [
        { action: 'fit_content', event: 'chart:fitContent' },
        { action: 'zoom_in', event: 'chart:zoomIn' },
        { action: 'zoom_out', event: 'chart:zoomOut' },
        { action: 'reset_view', event: 'chart:resetView' },
        { action: 'clear_all_drawings', event: 'chart:clearAllDrawings' }
      ];

      for (const op of chartOps) {
        mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
            operations: [{
              type: 'chart_operation',
              action: op.action,
              parameters: {},
              priority: 5,
              description: `Execute ${op.action}`
            }],
            reasoning: 'Chart operation requested',
            confidence: 0.8,
            complexity: 'simple',
            userIntent: 'Chart control'
          }));

        const result = await executeChartControlTool({
          context: { userRequest: op.action }
        });

        expect(result.operations[0].clientEvent?.event).toBe(op.event);
      }
    });
  });

  describe('execute - drawing operations', () => {
    it('should handle trendline drawing with chart analysis', async () => {
      const mockChartAnalysis = {
        currentPrice: { price: 50000, timestamp: Date.now() },
        technicalAnalysis: {
          trend: { direction: 'bullish', strength: 0.8, confidence: 0.9 },
          momentum: { rsi: 65 },
          volatility: { volatilityLevel: 'medium' },
          supportResistance: { supports: [], resistances: [] }
        },
        recommendations: {
          trendlineDrawing: [{
            type: 'trendline',
            description: 'Uptrend line',
            points: [
              { time: 1000000, price: 48000 },
              { time: 2000000, price: 52000 }
            ],
            style: { color: '#00e676', lineWidth: 2, lineStyle: 'solid' },
            priority: 9
          }],
          analysis: 'Strong uptrend detected',
          nextAction: 'Draw trendline'
        }
      };

      mockChartDataAnalysisTool.mockResolvedValueOnce(mockChartAnalysis);
      
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'drawing_operation',
            action: 'draw_trendline',
            parameters: {},
            priority: 8,
            description: 'Draw trendline'
          }],
          reasoning: 'User wants trendline',
          confidence: 0.9,
          complexity: 'moderate',
          userIntent: 'Draw trend'
        }));

      const result = await executeChartControlTool({
        context: {
          userRequest: 'トレンドラインを引いて',
          currentState: { symbol: 'BTCUSDT' }
        }
      });

      expect(mockChartDataAnalysisTool).toHaveBeenCalled();
      expect(result.operations[0].parameters).toMatchObject({
        points: mockChartAnalysis.recommendations.trendlineDrawing[0].points,
        autoGenerated: true
      });
    });

    it('should handle fibonacci drawing', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'drawing_operation',
            action: 'draw_fibonacci',
            parameters: {
              points: [
                { x: 100, y: 200, price: 45000, time: 1000000 },
                { x: 300, y: 100, price: 55000, time: 2000000 }
              ]
            },
            priority: 7,
            description: 'Draw fibonacci'
          }],
          reasoning: 'Fibonacci analysis requested',
          confidence: 0.85,
          complexity: 'moderate',
          userIntent: 'Fibonacci retracement'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: 'フィボナッチを描画' }
      });

      expect(result.operations[0].clientEvent).toMatchObject({
        event: 'draw:fibonacci',
        data: {
          points: expect.arrayContaining([
            expect.objectContaining({ time: 1000000, price: 45000 })
          ])
        }
      });
    });

    it('should handle horizontal and vertical lines', async () => {
      // Test horizontal line
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'drawing_operation',
            action: 'draw_horizontal',
            parameters: { price: 50000 },
            priority: 6,
            description: 'Draw horizontal line'
          }],
          reasoning: 'Horizontal level requested',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'Support level'
        }));

      const horizontalResult = await executeChartControlTool({
        context: { userRequest: '水平線を引く' }
      });

      expect(horizontalResult.operations[0].clientEvent).toMatchObject({
        event: 'chart:addDrawing',
        data: expect.objectContaining({
          type: 'horizontal',
          price: 50000
        })
      });

      // Test vertical line
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'drawing_operation',
            action: 'draw_vertical',
            parameters: { time: 1640995200000 },
            priority: 6,
            description: 'Draw vertical line'
          }],
          reasoning: 'Vertical marker requested',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'Time marker'
        }));

      const verticalResult = await executeChartControlTool({
        context: { userRequest: '垂直線を引く' }
      });

      expect(verticalResult.operations[0].clientEvent).toMatchObject({
        event: 'chart:addDrawing',
        data: expect.objectContaining({
          type: 'vertical',
          time: 1640995200000
        })
      });
    });
  });

  describe('execute - undo/redo operations', () => {
    it('should handle undo operations', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'undo_redo',
            action: 'undo',
            parameters: { steps: 1 },
            priority: 9,
            description: 'Undo last action'
          }],
          reasoning: 'User wants to undo',
          confidence: 0.95,
          complexity: 'simple',
          userIntent: 'Undo'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: '元に戻す' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:undo',
        data: { steps: 1 }
      });
    });

    it('should handle redo operations', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'undo_redo',
            action: 'redo',
            parameters: {},
            priority: 9,
            description: 'Redo action'
          }],
          reasoning: 'User wants to redo',
          confidence: 0.95,
          complexity: 'simple',
          userIntent: 'Redo'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: 'やり直す' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:redo',
        data: { steps: 1 }
      });
    });
  });

  describe('execute - style updates', () => {
    it('should handle color updates', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'style_update',
            action: 'update_color',
            parameters: { color: '#2196F3', drawingId: 'drawing_123' },
            priority: 5,
            description: 'Change color to blue'
          }],
          reasoning: 'Color change requested',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'Change color'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: '青色に変更' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:updateDrawingColor',
        data: { id: 'drawing_123', color: '#2196F3' }
      });
    });

    it('should handle line width updates', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'style_update',
            action: 'update_line_width',
            parameters: { lineWidth: 3, drawingId: 'drawing_456' },
            priority: 5,
            description: 'Change line width'
          }],
          reasoning: 'Line width change requested',
          confidence: 0.85,
          complexity: 'simple',
          userIntent: 'Change line width'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: '線を太くする' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:updateDrawingLineWidth',
        data: { id: 'drawing_456', lineWidth: 3 }
      });
    });
  });

  describe('execute - indicator controls', () => {
    it('should handle indicator toggle', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'indicator_control',
            action: 'toggle_ma',
            parameters: { indicator: 'MA', enabled: true },
            priority: 6,
            description: 'Enable MA indicator'
          }],
          reasoning: 'MA indicator requested',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'Show MA'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: '移動平均線を表示' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'ui:toggleIndicator',
        data: { indicator: 'MA', enabled: true }
      });
    });
  });

  describe('execute - analysis operations', () => {
    it('should handle auto analysis', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'analysis_operation',
            action: 'auto_analysis',
            parameters: { analysisType: 'trend' },
            priority: 8,
            description: 'Auto analyze trends'
          }],
          reasoning: 'Auto analysis requested',
          confidence: 0.85,
          complexity: 'complex',
          userIntent: 'Analyze chart'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: '自動分析を実行' }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:autoAnalysis',
        data: { analysisType: 'trend' }
      });
    });
  });

  describe('execute - error handling', () => {
    it('should handle AI response parsing errors', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse('Invalid JSON response'));

      const result = await executeChartControlTool({
        context: { userRequest: 'テスト' }
      });

      // When parse error occurs, the tool returns success: true with fallback operations
      expect(result.success).toBe(true);
      expect(result.operations).toBeDefined();
      expect(result.operations).toBeInstanceOf(Array);
      expect(result.operations).toHaveLength(1); // Fallback operation
      expect(result.operations[0]).toMatchObject({
        type: 'chart_operation',
        action: 'general_request',
        parameters: { request: 'テスト' },
        description: 'Fallback: テスト'
      });
      expect(result.metadata.confidence).toBe(0.3);
      expect(result.reasoning).toContain('Failed to parse AI analysis');
      expect(incrementMetric).toHaveBeenCalledWith('chart_control_parse_error_total')
    });

    it('should use fallback for specific request types on parse error', async () => {
      const testCases = [
        { request: 'BTCに変更', expectedType: 'symbol_change', expectedAction: 'change_symbol' },
        { request: '元に戻す', expectedType: 'undo_redo', expectedAction: 'undo' },
        { request: 'ラインを引く', expectedType: 'drawing_operation', expectedAction: 'draw_trendline' }
      ];

      for (const testCase of testCases) {
        mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse('Invalid JSON'));

        const result = await executeChartControlTool({
          context: { userRequest: testCase.request }
        });

        expect(result.success).toBe(true); // Parse error handled with fallback
        expect(result.operations).toBeDefined();
        expect(result.operations).toBeInstanceOf(Array);
        expect(result.operations).toHaveLength(1); // One fallback operation
        expect(result.operations[0].type).toBe(testCase.expectedType);
        expect(result.operations[0].action).toBe(testCase.expectedAction)
      }
    });

    it('should handle complete execution failure', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('AI service error'));

      const result = await executeChartControlTool({
        context: { userRequest: 'テスト' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service error');
      expect(result.operations).toEqual([]);
    });

    it('should generate error response on failure', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockGenerateTextResponse('申し訳ございません。ネットワークエラーが発生しました。'));

      const result = await executeChartControlTool({
        context: { userRequest: 'チャート操作' }
      });

      expect(result.response).toBe('申し訳ございません。ネットワークエラーが発生しました。');
    });

    it('should use fallback error message when error response generation fails', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('Primary error'))
        .mockRejectedValueOnce(new Error('Error response generation failed'));

      const result = await executeChartControlTool({
        context: { userRequest: 'テスト' }
      });

      expect(result.response).toBe('申し訳ございません。リクエストの処理中に問題が発生しました。しばらく時間をおいて再度お試しください。');
    });
  });

  describe('execute - context building', () => {
    it('should include conversation history in context', async () => {
      const conversationHistory = [
        { role: 'user', content: 'BTCのチャートを見せて' },
        { role: 'assistant', content: 'BTCUSDTのチャートを表示しました' },
        { role: 'user', content: '1時間足に変更' }
      ];

      await executeChartControlTool({
        context: {
          userRequest: 'RSIを表示',
          conversationHistory,
          currentState: { symbol: 'BTCUSDT', timeframe: '1h' }
        }
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Recent conversation:')
        })
      );
    });

    it('should include current state in context', async () => {
      const currentState = {
        symbol: 'ETHUSDT',
        timeframe: '4h',
        activeIndicators: ['MA', 'RSI'],
        drawingMode: 'trendline'
      };

      await executeChartControlTool({
        context: {
          userRequest: 'ズームイン',
          currentState
        }
      });

      const promptCall = mockGenerateText.mock.calls[0][0];
      expect(promptCall.prompt).toContain('Symbol: ETHUSDT');
      expect(promptCall.prompt).toContain('Timeframe: 4h');
      expect(promptCall.prompt).toContain('Active indicators: MA, RSI');
    });

    it('should not fetch chart analysis for non-technical requests', async () => {
      await executeChartControlTool({
        context: {
          userRequest: 'BTCに変更',
          currentState: { symbol: 'ETHUSDT' }
        }
      });

      expect(mockChartDataAnalysisTool).not.toHaveBeenCalled();
    });

    it('should handle chart analysis fetch failure gracefully', async () => {
      mockChartDataAnalysisTool.mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await executeChartControlTool({
        context: {
          userRequest: 'サポートラインを引いて',
          currentState: { symbol: 'BTCUSDT' }
        }
      });

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartControl] Chart analysis failed, proceeding without',
        expect.objectContaining({ error: 'Error: Analysis failed' })
      );
    });
  });

  describe('execute - multi-operation support', () => {
    it('should handle multiple operations in single request', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [
            {
              type: 'symbol_change',
              action: 'change_symbol',
              parameters: { symbol: 'BTCUSDT' },
              priority: 9,
              description: 'Change to BTC'
            },
            {
              type: 'timeframe_change',
              action: 'change_timeframe',
              parameters: { timeframe: '1h' },
              priority: 8,
              description: 'Change to 1h'
            },
            {
              type: 'indicator_control',
              action: 'toggle_rsi',
              parameters: { indicator: 'RSI', enabled: true },
              priority: 7,
              description: 'Enable RSI'
            }
          ],
          reasoning: 'Multiple operations requested',
          confidence: 0.85,
          complexity: 'complex',
          userIntent: 'Setup BTC 1h with RSI'
        }));

      const result = await executeChartControlTool({
        context: {
          userRequest: 'BTCの1時間足でRSIを表示して'
        }
      });

      expect(result.operations).toHaveLength(3);
      expect(result.operations[0].type).toBe('symbol_change');
      expect(result.operations[1].type).toBe('timeframe_change');
      expect(result.operations[2].type).toBe('indicator_control');
      expect(result.metadata.complexity).toBe('complex');
    });
  });

  describe('execute - response generation', () => {
    it('should generate natural language response', async () => {
      mockGenerateText
        .mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'symbol_change',
            action: 'change_symbol',
            parameters: { symbol: 'BTCUSDT' },
            priority: 8,
            description: 'Change to BTC'
          }],
          reasoning: 'User wants BTC',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'View BTC'
        }))
        .mockResolvedValueOnce(createMockGenerateTextResponse('BTCUSDTのチャートに切り替えました。現在の価格動向をご確認ください。'));

      const result = await executeChartControlTool({
        context: { userRequest: 'BTCに変更' }
      });

      expect(result.response).toBe('BTCUSDTのチャートに切り替えました。現在の価格動向をご確認ください。');
    });

    it('should include technical context in response when available', async () => {
      const mockChartAnalysis = {
        currentPrice: { price: 50000, timestamp: Date.now() },
        technicalAnalysis: {
          trend: { direction: 'bullish', strength: 0.8, confidence: 0.9 },
          momentum: { rsi: 65 },
          volatility: { volatilityLevel: 'high' },
          supportResistance: { supports: [], resistances: [] }
        },
        recommendations: {
          trendlineDrawing: [{ description: 'Uptrend' }],
          analysis: 'Strong uptrend',
          nextAction: 'Hold position'
        }
      };

      mockChartDataAnalysisTool.mockResolvedValueOnce(mockChartAnalysis);
      mockGenerateText
        .mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'drawing_operation',
            action: 'draw_trendline',
            parameters: {},
            priority: 8,
            description: 'Draw trendline'
          }],
          reasoning: 'Trendline analysis',
          confidence: 0.9,
          complexity: 'moderate',
          userIntent: 'Analyze trend'
        }))
        .mockResolvedValueOnce(createMockGenerateTextResponse('上昇トレンドラインを描画しました。現在の価格は50000で、RSIは65です。'));

      const result = await executeChartControlTool({
        context: { userRequest: 'トレンドラインを引いて' }
      });

      const responsePromptCall = mockGenerateText.mock.calls[1][0];
      expect(responsePromptCall.prompt).toContain('Current Price: 50000');
      expect(responsePromptCall.prompt).toContain('Trend: bullish');
      expect(responsePromptCall.prompt).toContain('RSI: 65');
    });
  });

  describe('execute - edge cases', () => {
    it('should handle empty operations array', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [],
          reasoning: 'No clear operation identified',
          confidence: 0.3,
          complexity: 'simple',
          userIntent: 'Unclear'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: 'よろしく' }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toEqual([]);
    });

    it('should handle operations without client events', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse({
          operations: [{
            type: 'unknown_type',
            action: 'unknown_action',
            parameters: {},
            priority: 5,
            description: 'Unknown operation'
          }],
          reasoning: 'Unknown operation type',
          confidence: 0.5,
          complexity: 'simple',
          userIntent: 'Unknown'
        }));

      const result = await executeChartControlTool({
        context: { userRequest: 'Unknown request' }
      });

      expect(result.operations[0].clientEvent).toBeUndefined();
    });

    it('should handle malformed AI response with partial data', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse('{"operations": [{"type": "symbol_change"}], "reasoning": "test"'));

      const result = await executeChartControlTool({
        context: { userRequest: 'テスト' }
      });

      // When malformed JSON is received, tool returns success: true with fallback operations
      expect(result.success).toBe(true);
      expect(result.operations).toBeDefined();
      expect(result.operations).toBeInstanceOf(Array);
      expect(result.operations).toHaveLength(1); // Fallback operation
      expect(result.operations[0].type).toBe('chart_operation');
    });

    it('should strip markdown code blocks from AI response', async () => {
      mockGenerateText.mockResolvedValueOnce(createMockGenerateTextResponse('```json\n{"operations":[{"type":"symbol_change","action":"change_symbol","parameters":{"symbol":"BTCUSDT"},"priority":8,"description":"Change to BTC"}],"reasoning":"User wants BTC","confidence":0.9,"complexity":"simple","userIntent":"View BTC"}\n```'));

      const result = await executeChartControlTool({
        context: { userRequest: 'BTCに変更' }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('symbol_change');
    });
  });
});