/**
 * [変更履歴]
 * - Agent Selection Tool の簡潔で効果的なモック実装
 * - Orchestratorパターンを適用した構造
 * - A2A通信フローの正確なシミュレーション
 * - UI操作ブロードキャスト機能の実装
 * - テスト用fallback機能の追加
 */

// Completely isolated state per test execution with unique instance tracking
let mockState = {
  shouldFail: false,
  resetCount: 0,
  instanceId: `mock-${Date.now()}-${Math.random()}`
};

// Simple but powerful mock implementation
const mockExecute = jest.fn();

// Export the mocked tool
export const agentSelectionTool = {
  id: 'ai-agent-selection',
  description: 'Mocked agent selection tool',
  execute: mockExecute,
  simulateFailure: () => {
    console.log(`[Mock Debug] simulateFailure called on instance: ${mockState.instanceId}`);
    mockState.shouldFail = true;
  },
  resetState: () => {
    // Complete state reset with new instance
    const oldInstanceId = mockState.instanceId;
    mockState = {
      shouldFail: false,
      resetCount: mockState.resetCount + 1,
      instanceId: `mock-${Date.now()}-${Math.random()}`
    };
    console.log(`[Mock Debug] resetState: ${oldInstanceId} -> ${mockState.instanceId}`);
    // Clear all mock call history
    mockExecute.mockClear();
  },
  // Test helper to verify state
  _getState: () => ({ ...mockState }),
};

mockExecute.mockImplementation(async ({ context }) => {
  const { agentType, query, context: userContext, correlationId } = context;
  
  console.log(`[Mock Debug] Execute called - Agent: ${agentType}, shouldFail: ${mockState.shouldFail}, instanceId: ${mockState.instanceId}`);
  
  // Simulate failure if requested - throw error instead of returning success
  if (mockState.shouldFail) {
    console.log(`[Mock Debug] shouldFail triggered for agent: ${agentType}, resetting flag`);
    mockState.shouldFail = false; // Reset after one failure
    console.log(`[Mock Debug] Throwing error for agent failure simulation`);
    throw new Error(`Simulated agent failure: ${agentType}`);
  }
  
  // Simulate UI operations broadcasting for ui_control agent
  if (agentType === 'ui_control' && typeof window !== 'undefined' && window.dispatchEvent) {
    // Dispatch UI events
    const operations = [
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
    
    operations.forEach(operation => {
      if (operation.clientEvent) {
        window.dispatchEvent(new CustomEvent(operation.clientEvent.event, {
          detail: operation.clientEvent.data
        }));
      }
    });
  }
  
  // Agent mappings
  const agentMappings = {
    price_inquiry: 'priceInquiryAgent',
    ui_control: 'uiControlAgent',
    trading_analysis: 'tradingAnalysisAgent',
    proposal_request: 'tradingAnalysisAgent',
  };
  
  const selectedAgent = agentMappings[agentType] || agentType;
  
  // Handle fallback scenarios
  if (context.shouldFail || context.networkError) {
    return {
      success: true,
      selectedAgent: agentType,
      executionResult: {
        response: 'Fallback response for price inquiry',
        metadata: {
          model: 'fallback-model',
          fallbackType: 'static',
          originalAgent: agentType,
          processedBy: 'fallback',
          timestamp: Date.now()
        },
      },
      fallbackUsed: true,
      message: `A2A failed, used traditional fallback: ${agentType}`,
    };
  }
  
  // Handle complete failure
  if (context.completeFail) {
    return {
      success: false,
      selectedAgent: agentType,
      message: `Complete tool failure: ${agentType}`,
      error: 'Fallback also failed',
    };
  }
  
  // Default responses based on agent type
  const responses = {
    price_inquiry: {
      success: true,
      selectedAgent,
      executionResult: {
        response: 'Current BTC price is $50,000',
        data: { price: 50000, symbol: 'BTCUSDT' },
        metadata: {
          model: 'a2a-communication',
          executionTime: 100,
          toolsUsed: [],
          processedBy: 'trading-agent',
          timestamp: Date.now(),
          resetCount: mockState.resetCount, // Track state for debugging
        },
      },
      message: 'Current BTC price is $50,000',
    },
    ui_control: {
      success: true,
      selectedAgent,
      executionResult: {
        response: 'Chart updated to BTCUSDT 1h and RSI enabled',
        data: { action: 'chart_updated' },
        metadata: {
          model: 'a2a-communication',
          executionTime: 100,
          toolsUsed: [],
          processedBy: 'chart-control-agent',
        },
        toolResults: [
          {
            result: {
              operations: [
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
              ],
            },
          },
        ],
      },
      message: 'Chart updated to BTCUSDT 1h and RSI enabled',
      // Simulate UI operations broadcasting
      __broadcastUIOperations: () => {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          // Dispatch the operations from toolResults
          const operations = [
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
          
          operations.forEach(operation => {
            if (operation.clientEvent) {
              window.dispatchEvent(new CustomEvent(operation.clientEvent.event, {
                detail: operation.clientEvent.data
              }));
            }
          });
        }
      },
    },
    trading_analysis: {
      success: true,
      selectedAgent,
      executionResult: {
        response: 'Generated 2 trading proposals',
        data: { analysis: 'bullish' },
        metadata: {
          model: 'a2a-communication',
          executionTime: 100,
          toolsUsed: [],
          processedBy: 'trading-agent',
        },
        proposalGroup: {
          id: 'pg_123',
          title: 'Trading Analysis',
          proposals: [
            { id: 'p1', type: 'trend_line', confidence: 0.85 },
            { id: 'p2', type: 'support', confidence: 0.90 },
          ],
        },
      },
      message: 'A2A communication successful: tradingAnalysisAgent',
    },
    custom_agent: {
      success: true,
      selectedAgent: 'custom_agent',
      executionResult: {
        response: 'Custom agent response',
        metadata: {
          model: 'a2a-communication',
          executionTime: 100,
          toolsUsed: [],
        },
      },
      message: 'Custom agent response',
    },
  };
  
  return responses[agentType] || {
    success: false,
    selectedAgent: agentType,
    message: `Unknown agent type: ${agentType}`,
    error: 'Agent not found',
  };
});

// Mock helper to simulate UI operations broadcasting
const mockBroadcastUIOperations = jest.fn();

// Mock UI operations dispatch
const originalDispatchEvent = globalThis.window?.dispatchEvent;
if (typeof window !== 'undefined') {
  window.dispatchEvent = jest.fn().mockImplementation((event) => {
    // Track UI event dispatches for testing
    return true;
  });
}