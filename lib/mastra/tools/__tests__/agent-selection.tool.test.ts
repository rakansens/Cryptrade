import { agentSelectionTool } from '../agent-selection.tool';
import { agentNetwork } from '../../network/agent-network';
import { FallbackHandler } from '../../utils/fallback-handler';
import { emitUIEvent } from '@/lib/server/uiEventBus';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('../../network/agent-network');
jest.mock('../../utils/fallback-handler');
jest.mock('@/lib/server/uiEventBus');
jest.mock('@/lib/utils/logger');

const mockAgentNetwork = agentNetwork as jest.Mocked<typeof agentNetwork>;
const mockFallbackHandler = FallbackHandler as jest.Mocked<typeof FallbackHandler>;
const mockEmitUIEvent = emitUIEvent as jest.MockedFunction<typeof emitUIEvent>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock chart control tool
jest.mock('../chart-control.tool', () => ({
  chartControlTool: {
    execute: jest.fn(),
  },
}));

describe('agentSelectionTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.info.mockImplementation(() => {});
    mockLogger.debug.mockImplementation(() => {});
    mockLogger.warn.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
  });

  describe('successful A2A communication', () => {
    it('should execute price inquiry agent successfully', async () => {
      const mockA2AResponse = {
        id: 'msg-123',
        type: 'success',
        result: 'Current BTC price is $50,000',
        metadata: {
          model: 'claude-3',
          tokensUsed: 150,
        },
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockA2AResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'price_inquiry',
          query: 'What is the current BTC price?',
          correlationId: 'test-123',
        },
      });

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe('priceInquiryAgent');
      expect(result.executionResult?.response).toBe('Current BTC price is $50,000');
      expect(result.executionResult?.metadata?.model).toBe('a2a-communication');
      
      expect(mockAgentNetwork.sendMessage).toHaveBeenCalledWith(
        'orchestratorAgent',
        'priceInquiryAgent',
        'process_query',
        {
          query: 'What is the current BTC price?',
          context: undefined,
          timestamp: expect.any(Number),
        },
        'test-123'
      );
    });

    it('should execute UI control agent with operations', async () => {
      const mockOperations = [
        {
          clientEvent: {
            event: 'chart:update',
            data: { symbol: 'BTCUSDT', interval: '1h' },
          },
        },
        {
          clientEvent: {
            event: 'indicator:toggle',
            data: { indicator: 'rsi', enabled: true },
          },
        },
      ];

      const mockA2AResponse = {
        id: 'msg-456',
        type: 'success',
        result: 'Chart updated to BTCUSDT 1h and RSI enabled',
        toolResults: [
          {
            result: {
              operations: mockOperations,
            },
          },
        ],
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockA2AResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Show me BTCUSDT 1h chart with RSI',
          context: { currentState: { symbol: 'ETHUSDT' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe('uiControlAgent');
      expect(result.executionResult?.response).toBe('Chart updated to BTCUSDT 1h and RSI enabled');
      
      // Verify UI events were emitted
      expect(mockEmitUIEvent).toHaveBeenCalledTimes(2);
      expect(mockEmitUIEvent).toHaveBeenCalledWith({
        event: 'chart:update',
        data: { symbol: 'BTCUSDT', interval: '1h' },
      });
      expect(mockEmitUIEvent).toHaveBeenCalledWith({
        event: 'indicator:toggle',
        data: { indicator: 'rsi', enabled: true },
      });
    });

    it('should execute trading analysis agent with proposal group', async () => {
      const mockProposalGroup = {
        id: 'pg_123',
        title: 'Trading Analysis',
        proposals: [
          { id: 'p1', type: 'trend_line', confidence: 0.85 },
          { id: 'p2', type: 'support', confidence: 0.90 },
        ],
      };

      const mockA2AResponse = {
        id: 'msg-789',
        type: 'success',
        result: 'Generated 2 trading proposals',
        proposalGroup: mockProposalGroup,
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockA2AResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'trading_analysis',
          query: 'Analyze BTC chart patterns',
        },
      });

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe('tradingAnalysisAgent');
      expect(result.executionResult?.proposalGroup).toEqual(mockProposalGroup);
      
      // Should not emit UI events for proposal mode
      expect(mockEmitUIEvent).not.toHaveBeenCalled();
    });

    it('should handle agent type without mapping', async () => {
      const mockA2AResponse = {
        id: 'msg-999',
        type: 'success',
        result: 'Custom agent response',
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockA2AResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'custom_agent' as any,
          query: 'Custom query',
        },
      });

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe('custom_agent');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[agentSelectionTool] Using agentType directly as no mapping found',
        expect.objectContaining({
          agentType: 'custom_agent',
          targetAgentId: 'custom_agent',
        })
      );
    });
  });

  describe('A2A communication failures', () => {
    it('should use fallback when A2A communication fails', async () => {
      mockAgentNetwork.sendMessage.mockRejectedValue(new Error('Network error'));
      
      const mockFallbackResult = {
        response: 'Fallback response for price inquiry',
        data: { fallback: true },
        metadata: { model: 'fallback-model' },
      };
      
      mockFallbackHandler.handle.mockResolvedValue(mockFallbackResult);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'price_inquiry',
          query: 'What is BTC price?',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.executionResult).toEqual(mockFallbackResult);
      expect(result.message).toBe('A2A failed, used traditional fallback: price_inquiry');
      
      expect(mockFallbackHandler.handle).toHaveBeenCalledWith({
        agentType: 'price_inquiry',
        query: 'What is BTC price?',
        context: undefined,
        error: 'Network error',
      });
    });

    it('should handle A2A timeout', async () => {
      // Mock a delayed response that will trigger timeout
      mockAgentNetwork.sendMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ type: 'success' }), 15000))
      );
      
      mockFallbackHandler.handle.mockResolvedValue({
        response: 'Timeout fallback response',
        metadata: {},
      });

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Update chart',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[agentSelectionTool] A2A communication failed, using fallback',
        expect.objectContaining({
          agentType: 'ui_control',
          error: 'A2A communication timeout',
        })
      );
    });

    it('should handle A2A error response', async () => {
      const mockErrorResponse = {
        id: 'msg-err',
        type: 'error',
        error: {
          message: 'Agent not available',
        },
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockErrorResponse);
      mockFallbackHandler.handle.mockResolvedValue({
        response: 'Error fallback response',
        metadata: {},
      });

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'trading_analysis',
          query: 'Analyze patterns',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockFallbackHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Agent not available',
        })
      );
    });

    it('should handle complete tool failure', async () => {
      mockAgentNetwork.sendMessage.mockRejectedValue(new Error('Critical error'));
      mockFallbackHandler.handle.mockRejectedValue(new Error('Fallback also failed'));

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'price_inquiry',
          query: 'Get price',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fallback also failed');
      expect(result.message).toBe('Complete tool failure: price_inquiry');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('UI operations broadcasting', () => {
    it('should broadcast operations from nested structures', async () => {
      const operations = [
        {
          clientEvent: {
            event: 'chart:timeframe',
            data: { interval: '4h' },
          },
        },
      ];

      // Test different response structures
      const responseVariants = [
        // Direct operations
        { type: 'success', result: 'Done', operations },
        // In data
        { type: 'success', result: 'Done', data: { operations } },
        // In result
        { type: 'success', result: 'Done', result: { operations } },
        // In executionResult.data
        { type: 'success', result: 'Done', executionResult: { data: { operations } } },
        // In toolResults
        { type: 'success', result: 'Done', toolResults: [{ result: { operations } }] },
        // In steps->toolResults
        { type: 'success', result: 'Done', steps: [{ toolResults: [{ result: { operations } }] }] },
      ];

      for (const response of responseVariants) {
        jest.clearAllMocks();
        mockAgentNetwork.sendMessage.mockResolvedValue(response);

        await agentSelectionTool.execute({
          context: {
            agentType: 'ui_control',
            query: 'Change timeframe',
          },
        });

        expect(mockEmitUIEvent).toHaveBeenCalledWith({
          event: 'chart:timeframe',
          data: { interval: '4h' },
        });
      }
    });

    it('should not broadcast for non-UI agents', async () => {
      const mockResponse = {
        type: 'success',
        result: 'Price data',
        operations: [
          {
            clientEvent: {
              event: 'should:not:dispatch',
              data: {},
            },
          },
        ],
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockResponse);

      await agentSelectionTool.execute({
        context: {
          agentType: 'price_inquiry',
          query: 'Get price',
        },
      });

      expect(mockEmitUIEvent).not.toHaveBeenCalled();
    });

    it('should not broadcast when proposal group exists', async () => {
      const mockResponse = {
        type: 'success',
        result: 'Proposals generated',
        proposalGroup: { id: 'pg_123' },
        operations: [
          {
            clientEvent: {
              event: 'should:not:dispatch',
              data: {},
            },
          },
        ],
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockResponse);

      await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Generate proposals',
        },
      });

      expect(mockEmitUIEvent).not.toHaveBeenCalled();
    });

    it('should handle operations without clientEvent', async () => {
      const mockResponse = {
        type: 'success',
        result: 'Done',
        operations: [
          { someOtherField: 'value' }, // No clientEvent
          {
            clientEvent: {
              event: 'valid:event',
              data: { test: true },
            },
          },
        ],
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockResponse);

      await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Mixed operations',
        },
      });

      // Should only emit the valid event
      expect(mockEmitUIEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitUIEvent).toHaveBeenCalledWith({
        event: 'valid:event',
        data: { test: true },
      });
    });
  });

  describe('context and correlation handling', () => {
    it('should pass user context to A2A message', async () => {
      const userContext = {
        currentChart: { symbol: 'ETHUSDT', interval: '15m' },
        indicators: { rsi: true, macd: false },
      };

      mockAgentNetwork.sendMessage.mockResolvedValue({
        type: 'success',
        result: 'Context processed',
      });

      await agentSelectionTool.execute({
        context: {
          agentType: 'trading_analysis',
          query: 'Analyze with context',
          context: userContext,
        },
      });

      expect(mockAgentNetwork.sendMessage).toHaveBeenCalledWith(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'Analyze with context',
          context: userContext,
          timestamp: expect.any(Number),
        },
        expect.stringMatching(/^tool-\d+$/)
      );
    });

    it('should use provided correlation ID', async () => {
      mockAgentNetwork.sendMessage.mockResolvedValue({
        type: 'success',
        result: 'Done',
      });

      await agentSelectionTool.execute({
        context: {
          agentType: 'price_inquiry',
          query: 'Get price',
          correlationId: 'user-correlation-123',
        },
      });

      expect(mockAgentNetwork.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        'user-correlation-123'
      );
    });

    it('should generate correlation ID if not provided', async () => {
      mockAgentNetwork.sendMessage.mockResolvedValue({
        type: 'success',
        result: 'Done',
      });

      await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Update UI',
        },
      });

      expect(mockAgentNetwork.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.stringMatching(/^tool-\d+$/)
      );
    });
  });

  describe('metadata and execution time', () => {
    it('should include execution metadata', async () => {
      const mockResponse = {
        id: 'msg-meta',
        type: 'success',
        result: 'Operation complete',
        metadata: {
          model: 'claude-3',
          tokensUsed: 200,
          toolsUsed: ['chart-tool', 'data-tool'],
        },
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'ui_control',
          query: 'Complex operation',
        },
      });

      expect(result.executionResult?.metadata).toMatchObject({
        model: 'a2a-communication',
        executionTime: expect.any(Number),
        toolsUsed: expect.any(Array),
        communicationType: 'agent-to-agent',
        messageId: 'msg-meta',
      });
    });

    it('should preserve original A2A message structure', async () => {
      const mockResponse = {
        id: 'msg-full',
        type: 'success',
        result: 'Complete response',
        steps: [{ action: 'step1' }, { action: 'step2' }],
        toolResults: [{ tool: 'tool1', result: 'result1' }],
        customField: 'preserved',
      };

      mockAgentNetwork.sendMessage.mockResolvedValue(mockResponse);

      const result = await agentSelectionTool.execute({
        context: {
          agentType: 'trading_analysis',
          query: 'Full analysis',
        },
      });

      expect(result.executionResult).toMatchObject({
        response: 'Complete response',
        steps: mockResponse.steps,
        toolResults: mockResponse.toolResults,
        customField: 'preserved',
      });
    });
  });
});