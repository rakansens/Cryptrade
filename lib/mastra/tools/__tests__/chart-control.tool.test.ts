import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createTool } from '@mastra/core';
import { generateText } from 'ai';
import { chartControlTool } from '../chart-control.tool';
import { chartDataAnalysisTool } from '../chart-data-analysis.tool';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@mastra/core');
jest.mock('ai');
jest.mock('../chart-data-analysis.tool');
jest.mock('@/lib/monitoring/metrics');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('chartControlTool', () => {
  const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
  const mockIncrementMetric = incrementMetric as jest.MockedFunction<typeof incrementMetric>;
  const mockCreateTool = createTool as jest.MockedFunction<typeof createTool>;

  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup createTool mock to capture the execute function
    mockExecute = jest.fn();
    mockCreateTool.mockImplementation((config) => {
      mockExecute = config.execute;
      return {
        id: config.id,
        description: config.description,
        inputSchema: config.inputSchema,
        outputSchema: config.outputSchema,
        execute: mockExecute,
      } as any;
    });

    // Re-import to apply mocks
    jest.isolateModules(() => {
      require('../chart-control.tool');
    });
  });

  describe('Symbol Change Operations', () => {
    it('should handle symbol change requests', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'symbol_change',
          action: 'change_symbol',
          parameters: { symbol: 'BTCUSDT' },
          priority: 8,
          description: 'Change symbol to BTC'
        }],
        reasoning: 'User wants to change to Bitcoin',
        confidence: 0.95,
        complexity: 'simple',
        userIntent: 'Change to BTC'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'BTCに変更します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'BTCに変更して',
          conversationHistory: [],
          currentState: { symbol: 'ETHUSDT' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('symbol_change');
      expect(result.operations[0].clientEvent).toEqual({
        event: 'ui:changeSymbol',
        data: { symbol: 'BTCUSDT' }
      });
      expect(result.response).toBe('BTCに変更します。');
    });

    it('should handle ETH symbol change', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'symbol_change',
          action: 'change_symbol',
          parameters: { symbol: 'ETHUSDT' },
          priority: 8,
          description: 'Change symbol to ETH'
        }],
        reasoning: 'User wants to change to Ethereum',
        confidence: 0.95,
        complexity: 'simple',
        userIntent: 'Change to ETH'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'ETHに変更します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'ETHに切り替え',
          currentState: { symbol: 'BTCUSDT' }
        }
      });

      expect(result.operations[0].parameters.symbol).toBe('ETHUSDT');
    });
  });

  describe('Timeframe Change Operations', () => {
    it('should handle timeframe change requests', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'timeframe_change',
          action: 'change_timeframe',
          parameters: { timeframe: '4h' },
          priority: 7,
          description: 'Change timeframe to 4 hours'
        }],
        reasoning: 'User wants to change to 4-hour timeframe',
        confidence: 0.9,
        complexity: 'simple',
        userIntent: 'Change to 4h timeframe'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '4時間足に変更しました。' });

      const result = await mockExecute({
        context: {
          userRequest: '4時間足にして',
          currentState: { timeframe: '1h' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.operations[0].type).toBe('timeframe_change');
      expect(result.operations[0].clientEvent).toEqual({
        event: 'ui:changeTimeframe',
        data: { timeframe: '4h' }
      });
    });
  });

  describe('Drawing Operations', () => {
    beforeEach(() => {
      // Mock chart data analysis tool
      (chartDataAnalysisTool.execute as jest.Mock) = jest.fn().mockResolvedValue({
        currentPrice: { price: 105000 },
        technicalAnalysis: {
          trend: { direction: 'upward', strength: 0.75 },
          momentum: { rsi: 65.5 },
          volatility: { volatilityLevel: 'medium' },
          supportResistance: {
            supports: [{ price: 100000 }, { price: 98000 }],
            resistances: [{ price: 110000 }, { price: 112000 }]
          }
        },
        recommendations: {
          trendlineDrawing: [{
            points: [
              { time: 1735830000000, value: 100000 },
              { time: 1735837200000, value: 102000 }
            ],
            style: { color: '#00e676', lineWidth: 2, lineStyle: 'solid' },
            description: 'Strong upward trendline',
            priority: 1
          }],
          analysis: 'Bullish trend detected'
        }
      });
    });

    it('should handle trendline drawing with chart analysis', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'drawing_operation',
          action: 'draw_trendline',
          parameters: {},
          priority: 9,
          description: 'Draw trendline'
        }],
        reasoning: 'User wants to draw a trendline',
        confidence: 0.85,
        complexity: 'moderate',
        userIntent: 'Draw trendline'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '上昇トレンドラインを描画します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'トレンドラインを引いて',
          currentState: { symbol: 'BTCUSDT', timeframe: '1h' }
        }
      });

      expect(result.success).toBe(true);
      expect(chartDataAnalysisTool.execute).toHaveBeenCalled();
      expect(result.operations[0].parameters.points).toBeDefined();
      expect(result.operations[0].parameters.autoGenerated).toBe(true);
      expect(result.metadata.chartDataUsed).toBe(true);
    });

    it('should handle fibonacci drawing', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'drawing_operation',
          action: 'draw_fibonacci',
          parameters: {
            points: [
              { x: 100, y: 200, price: 100000, time: 1735830000000 },
              { x: 300, y: 150, price: 105000, time: 1735837200000 }
            ]
          },
          priority: 8,
          description: 'Draw fibonacci retracement'
        }],
        reasoning: 'User wants fibonacci retracement',
        confidence: 0.8,
        complexity: 'moderate',
        userIntent: 'Draw fibonacci'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'フィボナッチリトレースメントを描画します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'フィボナッチを描画',
          currentState: {}
        }
      });

      expect(result.operations[0].type).toBe('drawing_operation');
      expect(result.operations[0].action).toBe('draw_fibonacci');
      expect(result.operations[0].clientEvent.event).toBe('draw:fibonacci');
    });

    it('should handle horizontal line drawing', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'drawing_operation',
          action: 'draw_horizontal',
          parameters: { price: 105000 },
          priority: 7,
          description: 'Draw horizontal line at 105000'
        }],
        reasoning: 'User wants a horizontal support line',
        confidence: 0.85,
        complexity: 'simple',
        userIntent: 'Draw horizontal line'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '水平線を105000に描画します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'サポートラインを引いて',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent.event).toBe('chart:addDrawing');
      expect(result.operations[0].clientEvent.data.type).toBe('horizontal');
      expect(result.operations[0].clientEvent.data.price).toBe(105000);
    });
  });

  describe('Chart Operations', () => {
    it('should handle fit content operation', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'chart_operation',
          action: 'fit_content',
          parameters: {},
          priority: 6,
          description: 'Fit chart content'
        }],
        reasoning: 'User wants to fit chart to screen',
        confidence: 0.9,
        complexity: 'simple',
        userIntent: 'Fit content'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'チャートを画面に合わせます。' });

      const result = await mockExecute({
        context: {
          userRequest: 'チャートを画面に合わせて',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:fitContent',
        data: {}
      });
    });

    it('should handle zoom operations', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'chart_operation',
          action: 'zoom_in',
          parameters: { factor: 1.5 },
          priority: 6,
          description: 'Zoom in'
        }],
        reasoning: 'User wants to zoom in',
        confidence: 0.85,
        complexity: 'simple',
        userIntent: 'Zoom in'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'ズームインします。' });

      const result = await mockExecute({
        context: {
          userRequest: 'ズームイン',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent.event).toBe('chart:zoomIn');
      expect(result.operations[0].clientEvent.data.factor).toBe(1.5);
    });
  });

  describe('Undo/Redo Operations', () => {
    it('should handle undo operation', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'undo_redo',
          action: 'undo',
          parameters: {},
          priority: 8,
          description: 'Undo last action'
        }],
        reasoning: 'User wants to undo',
        confidence: 0.95,
        complexity: 'simple',
        userIntent: 'Undo'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '元に戻しました。' });

      const result = await mockExecute({
        context: {
          userRequest: '元に戻す',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent).toEqual({
        event: 'chart:undo',
        data: { steps: 1 }
      });
    });

    it('should handle redo operation', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'undo_redo',
          action: 'redo',
          parameters: { steps: 2 },
          priority: 8,
          description: 'Redo 2 steps'
        }],
        reasoning: 'User wants to redo',
        confidence: 0.95,
        complexity: 'simple',
        userIntent: 'Redo'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'やり直しました。' });

      const result = await mockExecute({
        context: {
          userRequest: 'やり直し',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent.event).toBe('chart:redo');
      expect(result.operations[0].clientEvent.data.steps).toBe(2);
    });
  });

  describe('Style Update Operations', () => {
    it('should handle color update', async () => {
      const mockAnalysisResponse = {
        operations: [{
          type: 'style_update',
          action: 'update_color',
          parameters: { color: '#2196F3', drawingId: 'line_123' },
          priority: 6,
          description: 'Update color to blue'
        }],
        reasoning: 'User wants to change color',
        confidence: 0.8,
        complexity: 'simple',
        userIntent: 'Change color'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '色を青に変更しました。' });

      const result = await mockExecute({
        context: {
          userRequest: '青色に変更',
          currentState: {}
        }
      });

      expect(result.operations[0].clientEvent.event).toBe('chart:updateDrawingColor');
      expect(result.operations[0].clientEvent.data.color).toBe('#2196F3');
    });
  });

  describe('Error Handling', () => {
    it('should handle AI analysis parsing errors', async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: 'Invalid JSON response' })
        .mockResolvedValueOnce({ text: '申し訳ございません。リクエストを処理できませんでした。' });

      const result = await mockExecute({
        context: {
          userRequest: 'BTCに変更',
          currentState: {}
        }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.metadata.confidence).toBe(0.3);
      expect(mockIncrementMetric).toHaveBeenCalledWith('chart_control_parse_error_total');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle chart analysis failures gracefully', async () => {
      (chartDataAnalysisTool.execute as jest.Mock).mockRejectedValue(new Error('Chart analysis failed'));

      const mockAnalysisResponse = {
        operations: [{
          type: 'drawing_operation',
          action: 'draw_trendline',
          parameters: {},
          priority: 9,
          description: 'Draw trendline'
        }],
        reasoning: 'User wants trendline',
        confidence: 0.85,
        complexity: 'moderate',
        userIntent: 'Draw trendline'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'トレンドラインを描画します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'トレンドラインを引いて',
          currentState: {}
        }
      });

      expect(result.success).toBe(true);
      expect(result.metadata.chartDataUsed).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle complete failures with error response', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await mockExecute({
        context: {
          userRequest: 'BTCに変更',
          currentState: {}
        }
      });

      expect(result.success).toBe(false);
      expect(result.operations).toHaveLength(0);
      expect(result.error).toBe('AI service unavailable');
      expect(result.response).toBe('申し訳ございません。リクエストの処理中に問題が発生しました。しばらく時間をおいて再度お試しください。');
    });
  });

  describe('Context and State Management', () => {
    it('should include conversation history in analysis', async () => {
      const conversationHistory = [
        { role: 'user', content: 'BTCのチャートを見たい' },
        { role: 'assistant', content: 'BTCに変更しました' }
      ];

      const mockAnalysisResponse = {
        operations: [{
          type: 'timeframe_change',
          action: 'change_timeframe',
          parameters: { timeframe: '1d' },
          priority: 7,
          description: 'Change to daily'
        }],
        reasoning: 'Following up on BTC chart request',
        confidence: 0.85,
        complexity: 'simple',
        userIntent: 'View daily chart'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: '日足に変更しました。' });

      const result = await mockExecute({
        context: {
          userRequest: '日足で見たい',
          conversationHistory,
          currentState: { symbol: 'BTCUSDT' }
        }
      });

      expect(result.success).toBe(true);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Recent conversation:')
        })
      );
    });

    it('should use current state in analysis', async () => {
      const currentState = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        activeIndicators: ['MA', 'RSI'],
        drawingMode: 'trendline'
      };

      const mockAnalysisResponse = {
        operations: [{
          type: 'indicator_control',
          action: 'toggle_indicator',
          parameters: { indicator: 'MACD', enabled: true },
          priority: 6,
          description: 'Add MACD indicator'
        }],
        reasoning: 'User wants to add MACD to existing indicators',
        confidence: 0.9,
        complexity: 'simple',
        userIntent: 'Add MACD'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'MACDインジケーターを追加しました。' });

      const result = await mockExecute({
        context: {
          userRequest: 'MACDを追加',
          currentState
        }
      });

      expect(result.success).toBe(true);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Active indicators: MA, RSI')
        })
      );
    });
  });

  describe('Multi-operation Support', () => {
    it('should handle multiple operations in one request', async () => {
      const mockAnalysisResponse = {
        operations: [
          {
            type: 'symbol_change',
            action: 'change_symbol',
            parameters: { symbol: 'ETHUSDT' },
            priority: 9,
            description: 'Change to ETH'
          },
          {
            type: 'timeframe_change',
            action: 'change_timeframe',
            parameters: { timeframe: '4h' },
            priority: 8,
            description: 'Change to 4h'
          },
          {
            type: 'indicator_control',
            action: 'toggle_indicator',
            parameters: { indicator: 'RSI', enabled: true },
            priority: 7,
            description: 'Add RSI'
          }
        ],
        reasoning: 'User wants to analyze ETH on 4h with RSI',
        confidence: 0.85,
        complexity: 'complex',
        userIntent: 'Setup ETH analysis'
      };

      mockGenerateText
        .mockResolvedValueOnce({ text: JSON.stringify(mockAnalysisResponse) })
        .mockResolvedValueOnce({ text: 'ETHの4時間足にRSIを表示します。' });

      const result = await mockExecute({
        context: {
          userRequest: 'ETHの4時間足でRSI表示',
          currentState: {}
        }
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
      expect(result.metadata.complexity).toBe('complex');
    });
  });
});