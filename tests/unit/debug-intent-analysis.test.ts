import * as orchModule from '@/lib/mastra/agents/orchestrator.agent';
const { executeImprovedOrchestrator } = orchModule;

import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

// Mock dependencies
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/store/enhanced-conversation-memory.store');
jest.mock('@/lib/mastra/network/agent-registry');
jest.mock('@/lib/monitoring/trace');
jest.mock('@/lib/utils/logger');

describe('Debug Intent Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debug intent analysis for price inquiry', async () => {
    // Mock the tool with proper A2A response structure
    const mockResponse = {
      success: true,
      selectedAgent: 'priceInquiryAgent',
      executionResult: {
        response: 'Current BTC price is $50,000',
        metadata: { model: 'a2a-communication', processedBy: 'trading-agent' }
      },
      message: 'Price inquiry successful'
    };
    
    jest.spyOn(agentSelectionTool, 'execute').mockResolvedValue(mockResponse);
    
    const result = await executeImprovedOrchestrator('BTCの価格を教えて', 'test-session');
    
    // Debug orchestrator execution result
    console.log('🔍 Orchestrator Result:', {
      success: result.success,
      executionTime: result.executionTime,
      memoryContext: result.memoryContext ? 'present' : 'missing',
      analysis: result.analysis ? 'present' : 'missing'
    });
    
    // Debug intent analysis if available
    if (result.analysis) {
      console.log('🔍 Debug Intent Analysis:', {
        intent: result.analysis.intent,
        confidence: result.analysis.confidence,
        reasoning: result.analysis.reasoning,
        extractedSymbol: result.analysis.extractedSymbol
      });
    }
    
    // Debug execution result if available
    if (result.executionResult) {
      console.log('🔍 Execution Result:', {
        response: result.executionResult.response ? 'present' : 'missing',
        metadata: result.executionResult.metadata ? 'present' : 'missing',
        error: result.executionResult.error || 'none'
      });
    }
    
    console.log('🔍 Mock calls:', (agentSelectionTool.execute as jest.Mock).mock.calls.length);
    
    // Check if the orchestrator executed successfully - now showing the error if it fails
    if (!result.success) {
      console.error('❌ Orchestrator failed:', result);
    }
    expect(result.success).toBe(true);
    
    // Log the full analysis for debugging
    console.log('🔍 Full Analysis:', JSON.stringify(result.analysis, null, 2));
    
    // If intent is price_inquiry, agentSelectionTool should be called
    if (result.analysis.intent === 'price_inquiry') {
      expect((agentSelectionTool.execute as jest.Mock).mock.calls.length).toBeGreaterThan(0);
      console.log('✅ agentSelectionTool was called as expected for price_inquiry');
    } else {
      console.log(`🔍 Intent was "${result.analysis.intent}", not price_inquiry`);
      console.log('🔍 This is why agentSelectionTool was not called');
    }
  });

  test('debug intent analysis for conversational query', async () => {
    const result = await executeImprovedOrchestrator('こんにちは', 'test-session');
    
    console.log('🔍 Conversational Intent Analysis:', {
      intent: result.analysis.intent,
      confidence: result.analysis.confidence,
      reasoning: result.analysis.reasoning
    });
    
    expect(result.success).toBe(true);
    
    // For conversational intents, agentSelectionTool should NOT be called
    if (['market_chat', 'small_talk', 'greeting', 'help_request', 'conversational'].includes(result.analysis.intent)) {
      expect((agentSelectionTool.execute as jest.Mock).mock.calls.length).toBe(0);
      console.log('✅ agentSelectionTool was NOT called for conversational intent (expected)');
    }
  });
});