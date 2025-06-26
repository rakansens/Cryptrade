import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import { analyzeIntent } from '../../lib/mastra/utils/intent';

// Mock dependencies properly to avoid interference
jest.mock('@/lib/store/enhanced-conversation-memory.store', () => {
  const mockStore = {
    currentSessionId: 'test-session-id',
    createSession: jest.fn().mockResolvedValue('test-session-id'),
    addMessage: jest.fn().mockResolvedValue(undefined),
    getProcessedMessages: jest.fn(() => []),
    getSessionContext: jest.fn(() => 'Previous context'),
    getMemoryStats: jest.fn(() => ({
      totalMessages: 5,
      processedMessages: 5,
      estimatedTokens: 100,
      processors: ['test-processor']
    })),
    getRecentMessages: jest.fn(() => [
      { role: 'user', content: 'BTCの価格', metadata: {} },
      { role: 'assistant', content: 'BTCは50000ドルです', metadata: {} }
    ])
  };

  return {
    useEnhancedConversationMemory: {
      getState: jest.fn(() => mockStore)
    },
    createEnhancedSession: jest.fn().mockResolvedValue('test-session-id')
  };
});

jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn()
}));

jest.mock('@/types/agent-payload', () => ({
  generateCorrelationId: jest.fn(() => 'test-correlation-id')
}));

jest.mock('@/lib/monitoring/trace', () => ({
  traceManager: {
    startTrace: jest.fn(),
    endTrace: jest.fn(),
    addEvent: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Debug Orchestrator with Assertions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('compare intent analysis results', async () => {
    // Step 1: Direct intent analysis
    const directIntentResult = analyzeIntent('BTCの価格を教えて');
    
    // Step 2: Orchestrator execution
    const orchestratorResult = await executeImprovedOrchestrator('BTCの価格を教えて', 'test-session');
    
    // Step 3: Assertions to force output
    expect(directIntentResult.intent).toBe('price_inquiry'); // This should pass based on standalone test
    
    // Step 4: Check orchestrator intent - this is the key assertion
    if (orchestratorResult.analysis.intent !== 'price_inquiry') {
      // Force test failure with detailed info if intents don't match
      throw new Error(`
🚨 INTENT MISMATCH DETECTED:
- Direct intent analysis: ${directIntentResult.intent}
- Orchestrator intent analysis: ${orchestratorResult.analysis.intent}
- Orchestrator reasoning: ${orchestratorResult.analysis.reasoning}
- Orchestrator success: ${orchestratorResult.success}
- Orchestrator execution time: ${orchestratorResult.executionTime}ms

🔍 This mismatch explains why agentSelectionTool.execute is not called!
      `);
    }
    
    // If we reach here, both intents match
    expect(orchestratorResult.analysis.intent).toBe('price_inquiry');
  });
  
  test('verify orchestrator conversation handling logic', async () => {
    const orchestratorResult = await executeImprovedOrchestrator('BTCの価格を教えて', 'test-session');
    
    // Check if it's being processed as conversational
    const conversationalIntents = ['market_chat', 'small_talk', 'greeting', 'help_request', 'conversational'];
    const isConversational = conversationalIntents.includes(orchestratorResult.analysis.intent);
    
    if (isConversational) {
      throw new Error(`
🎯 ROOT CAUSE IDENTIFIED:
Query "BTCの価格を教えて" is being classified as "${orchestratorResult.analysis.intent}"
This means it goes through handleConversation() instead of agentSelectionTool.execute()

🔍 Analysis Details:
- Intent: ${orchestratorResult.analysis.intent}
- Confidence: ${orchestratorResult.analysis.confidence}
- Reasoning: ${orchestratorResult.analysis.reasoning}
- Success: ${orchestratorResult.success}

This explains why agentSelectionTool.execute call count is 0!
      `);
    }
    
    // This should not be reached if the issue is confirmed
    expect(isConversational).toBe(false);
  });
});