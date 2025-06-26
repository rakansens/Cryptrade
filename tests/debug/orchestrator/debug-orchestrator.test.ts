import * as orchModule from '@/lib/mastra/agents/orchestrator.agent';
const { executeImprovedOrchestrator } = orchModule;

import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

test('debug orchestrator', async () => {
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
  
  console.log('🔍 Starting orchestrator test with detailed logging...');
  
  const result = await executeImprovedOrchestrator('BTCの価格を教えて', 'test-session');
  
  console.log('🎯 Orchestrator execution result:', {
    success: result.success,
    intent: result.analysis.intent,
    confidence: result.analysis.confidence,
    reasoning: result.analysis.reasoning,
    analysisDepth: result.analysis.analysisDepth,
    agentSelectionToolCallCount: (agentSelectionTool.execute as jest.Mock).mock.calls.length
  });
  
  if ((agentSelectionTool.execute as jest.Mock).mock.calls.length === 0) {
    console.log('❌ agentSelectionTool.execute was NOT called!');
    console.log('🔍 This means the query was processed as conversational intent');
  }
  
  expect((agentSelectionTool.execute as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  expect(result.success).toBe(true);
});