// Mock dependencies before imports
jest.mock('../../network/agent-network');
jest.mock('@/lib/utils/logger');
jest.mock('../../utils/fallback-handler');
jest.mock('@/lib/server/uiEventBus');

import { agentSelectionTool } from '../agent-selection.tool';
import { agentNetwork } from '../../network/agent-network';
import { logger } from '@/lib/utils/logger';
import { FallbackHandler } from '../../utils/fallback-handler';
import { emitUIEvent } from '@/lib/server/uiEventBus';

// Type cast the execute function to avoid TypeScript errors
const executeAgentTool = agentSelectionTool.execute as any;

// Mock window for browser environment tests
const mockDispatchEvent = jest.fn();
const originalWindow = global.window;

describe('agentSelectionTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global state
    delete (global as any)._debuggedAgentResult;
  });

  afterEach(() => {
    // Restore window
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete (global as any).window;
    }
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(agentSelectionTool.id).toBe('ai-agent-selection');
      expect(agentSelectionTool.description).toContain('AI-powered agent selection');
      expect(agentSelectionTool.inputSchema).toBeDefined();
      expect(agentSelectionTool.outputSchema).toBeDefined();
    });
  });

  describe('execute function - successful A2A communication', () => {
    it('should execute price inquiry agent successfully', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: 'The current price of BTC is $50,000',
        id: 'msg-123',
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'What is the current price of BTC?',
          correlationId: 'test-123',
        },
      });

      expect(agentNetwork.sendMessage).toHaveBeenCalledWith(
        'orchestratorAgent',
        'priceInquiryAgent',
        'process_query',
        {
          query: 'What is the current price of BTC?',
          context: {},
          timestamp: expect.any(Number),
        },
        'test-123'
      );

      expect(result).toEqual({
        success: true,
        selectedAgent: 'priceInquiryAgent',
        executionResult: {
          response: 'The current price of BTC is $50,000',
          metadata: {
            model: 'a2a-communication',
            executionTime: expect.any(Number),
            toolsUsed: [],
          },
        },
        message: 'The current price of BTC is $50,000',
      });
    });

    it('should handle UI control agent with operations', async () => {
      // Set up browser environment
      global.window = { dispatchEvent: mockDispatchEvent } as any;

      const mockA2AResponse = {
        type: 'response',
        result: 'Chart settings updated',
        id: 'msg-456',
        toolResults: [
          {
            result: {
              operations: [
                {
                  clientEvent: {
                    event: 'chartUpdate',
                    data: { timeframe: '1h' },
                  },
                },
              ],
            },
          },
        ],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Change chart to 1 hour timeframe',
          context: { currentTimeframe: '15m' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe('uiControlAgent');

      // Verify UI event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { timeframe: '1h' },
        })
      );
    });

    it('should handle trading analysis agent', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: 'BTC is showing bullish patterns',
        proposalGroup: {
          proposals: [
            {
              symbol: 'BTCUSDT',
              action: 'BUY',
              entry: 50000,
              targets: [51000],
              stopLoss: 49000,
              confidence: 0.8,
            },
          ],
        },
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'trading_analysis',
          query: 'Analyze BTC trading opportunity',
        },
      });

      expect(result.success).toBe(true);
      expect(result.executionResult).toMatchObject({
        response: 'BTC is showing bullish patterns',
        proposalGroup: mockA2AResponse.proposalGroup,
      });
    });

    it('should handle agent type without mapping', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: 'Custom agent response',
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'custom_agent' as any,
          query: 'Custom query',
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[agentSelectionTool] Using agentType directly as no mapping found',
        expect.objectContaining({
          agentType: 'custom_agent',
          targetAgentId: 'custom_agent',
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('execute function - A2A communication failures', () => {
    it('should handle A2A timeout', async () => {
      (agentNetwork.sendMessage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 11000))
      );

      const mockFallbackResult = {
        response: 'Fallback response',
        data: {},
      };

      (FallbackHandler.handle as jest.Mock).mockResolvedValueOnce(mockFallbackResult);

      const result = await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'Test query',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.message).toContain('A2A failed, used traditional fallback');
    });

    it('should handle A2A error response', async () => {
      const mockA2AError = {
        type: 'error',
        error: {
          message: 'Agent not available',
        },
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AError);
      (FallbackHandler.handle as jest.Mock).mockResolvedValueOnce({
        response: 'Fallback handled',
      });

      const result = await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Test query',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle null A2A response', async () => {
      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(null);
      (FallbackHandler.handle as jest.Mock).mockResolvedValueOnce({
        response: 'Fallback response',
      });

      const result = await executeAgentTool({
        context: {
          agentType: 'trading_analysis',
          query: 'Test query',
        },
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle complete execution failure', async () => {
      const error = new Error('Network error');
      (agentNetwork.sendMessage as jest.Mock).mockRejectedValueOnce(error);
      (FallbackHandler.handle as jest.Mock).mockRejectedValueOnce(error);

      const result = await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'Test query',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.message).toContain('Complete tool failure');
    });
  });

  describe('UI operations broadcasting', () => {
    it('should broadcast operations from various result structures', async () => {
      global.window = { dispatchEvent: mockDispatchEvent } as any;

      const testCases = [
        // Operations at root level
        {
          response: {
            type: 'response',
            result: 'Success',
            operations: [
              {
                clientEvent: {
                  event: 'test1',
                  data: { value: 1 },
                },
              },
            ],
          },
        },
        // Operations in data
        {
          response: {
            type: 'response',
            result: 'Success',
            data: {
              operations: [
                {
                  clientEvent: {
                    event: 'test2',
                    data: { value: 2 },
                  },
                },
              ],
            },
          },
        },
        // Operations in steps->toolResults
        {
          response: {
            type: 'response',
            result: 'Success',
            steps: [
              {
                toolResults: [
                  {
                    result: {
                      operations: [
                        {
                          clientEvent: {
                            event: 'test3',
                            data: { value: 3 },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      ];

      for (const testCase of testCases) {
        mockDispatchEvent.mockClear();
        (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(testCase.response);

        await executeAgentTool({
          context: {
            agentType: 'ui_control',
            query: 'Test query',
          },
        });

        expect(mockDispatchEvent).toHaveBeenCalled();
      }
    });

    it('should skip UI broadcast for non-UI agents', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: 'Price is $50,000',
        operations: [
          {
            clientEvent: {
              event: 'shouldNotDispatch',
              data: {},
            },
          },
        ],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'Get price',
        },
      });

      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });

    it('should skip UI broadcast for proposal mode', async () => {
      global.window = { dispatchEvent: mockDispatchEvent } as any;

      const mockA2AResponse = {
        type: 'response',
        result: 'Analysis complete',
        proposalGroup: {
          proposals: [],
        },
        operations: [
          {
            clientEvent: {
              event: 'shouldNotDispatch',
              data: {},
            },
          },
        ],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Analyze',
        },
      });

      expect(mockDispatchEvent).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[Agent Selection Tool] Skipping UI broadcast for proposal mode',
        expect.any(Object)
      );
    });

    it('should emit UI events in server environment', async () => {
      // Remove window to simulate server environment
      delete (global as any).window;

      const mockA2AResponse = {
        type: 'response',
        result: 'Success',
        operations: [
          {
            clientEvent: {
              event: 'serverEvent',
              data: { server: true },
            },
          },
        ],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Server test',
        },
      });

      expect(emitUIEvent).toHaveBeenCalledWith({
        event: 'serverEvent',
        data: { server: true },
      });
    });

    it('should handle UI broadcast errors gracefully', async () => {
      global.window = { 
        dispatchEvent: jest.fn().mockImplementation(() => {
          throw new Error('Dispatch failed');
        }),
      } as any;

      const mockA2AResponse = {
        type: 'response',
        result: 'Success',
        operations: [
          {
            clientEvent: {
              event: 'errorEvent',
              data: {},
            },
          },
        ],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Error test',
        },
      });

      // Should still return success even if broadcast fails
      expect(result.success).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Selection Tool] Failed to broadcast UI operations',
        expect.objectContaining({
          error: 'Error: Dispatch failed',
        })
      );
    });
  });

  describe('context and correlation handling', () => {
    it('should pass context correctly to A2A communication', async () => {
      const userContext = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        customData: { nested: true },
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce({
        type: 'response',
        result: 'Context received',
      });

      await executeAgentTool({
        context: {
          agentType: 'trading_analysis',
          query: 'Analyze',
          context: userContext,
        },
      });

      expect(agentNetwork.sendMessage).toHaveBeenCalledWith(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'Analyze',
          context: userContext,
          timestamp: expect.any(Number),
        },
        expect.stringMatching(/^tool-\d+$/)
      );
    });

    it('should generate correlation ID if not provided', async () => {
      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce({
        type: 'response',
        result: 'Success',
      });

      await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'Test',
        },
      });

      const correlationId = (agentNetwork.sendMessage as jest.Mock).mock.calls[0][4];
      expect(correlationId).toMatch(/^tool-\d+$/);
    });
  });

  describe('response processing', () => {
    it('should handle non-string results', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: { data: 'complex object', value: 123 },
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'price_inquiry',
          query: 'Test',
        },
      });

      expect(result.executionResult?.response).toBe('[object Object]');
    });

    it('should preserve additional A2A message properties', async () => {
      const mockA2AResponse = {
        type: 'response',
        result: 'Success',
        steps: [{ step: 1 }],
        toolResults: [{ tool: 'test' }],
        customProperty: 'preserved',
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      const result = await executeAgentTool({
        context: {
          agentType: 'trading_analysis',
          query: 'Test',
        },
      });

      expect(result.executionResult).toMatchObject({
        steps: [{ step: 1 }],
        toolResults: [{ tool: 'test' }],
      });
    });
  });

  describe('logging', () => {
    it('should log debug information for first UI control call', async () => {
      global.window = { dispatchEvent: mockDispatchEvent } as any;

      const mockA2AResponse = {
        type: 'response',
        result: 'Success',
        operations: [],
      };

      (agentNetwork.sendMessage as jest.Mock).mockResolvedValueOnce(mockA2AResponse);

      // First call
      await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'First',
        },
      });

      // Second call
      await executeAgentTool({
        context: {
          agentType: 'ui_control',
          query: 'Second',
        },
      });

      // Should log full structure only once
      const fullStructureLogs = (logger.info as jest.Mock).mock.calls.filter(
        (call) => call[0].includes('Full agent result structure')
      );
      expect(fullStructureLogs).toHaveLength(1);
    });
  });
});