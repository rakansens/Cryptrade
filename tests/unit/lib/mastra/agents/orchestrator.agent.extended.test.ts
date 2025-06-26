import { 
  orchestratorAgent, 
  type OrchestratorAgentContext, 
  type IntentAnalysisResult,
  type OrchestratorExecutionResult,
  type OrchestratorExecutionResponse,
  type OrchestratorRuntimeContext,
  executeImprovedOrchestrator,
  analyzeUserIntent
} from '@/lib/mastra/agents/orchestrator.agent';
import { generateCorrelationId } from '@/types/agent-payload';
import { traceManager } from '@/lib/monitoring/trace';
import { logger } from '@/lib/utils/logger';
import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';
import { parallelOrchestrator } from '@/lib/mastra/agents/parallel-orchestrator';
import { Message } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

// Mock dependencies
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

// Use the existing mock from __mocks__ directory
jest.mock('@/lib/store/enhanced-conversation-memory.store');

jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn()
}));

jest.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: jest.fn().mockImplementation(async (userQuery, sessionId, runtimeContext) => {
      // Get mock memory store
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      
      // Generate response
      const responseContent = `「${userQuery}」に対する応答です。`;
      const executionStartTime = Date.now();
      
      // Add user message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'user',
        content: userQuery,
        agentId: 'parallel-orchestrator'
      });
      
      // Add assistant message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'assistant',
        content: responseContent,
        agentId: 'parallel-orchestrator'
      });
      
      const executionEndTime = Date.now();
      
      return {
        analysis: {
          intent: 'conversational',
          confidence: 0.8,
          reasoning: `Analyzed query: "${userQuery}"`,
          analysisDepth: 'basic'
        },
        executionResult: {
          response: responseContent,
          data: {
            queryLength: userQuery.length,
            timestamp: executionEndTime
          }
        },
        executionTime: executionEndTime - executionStartTime,
        success: true
      };
    })
  }
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    id: 'mock-model',
    provider: 'openai'
  }))
}));

jest.mock('@mastra/core', () => ({
  Agent: jest.fn().mockImplementation((config) => ({
    ...config,
    generate: jest.fn().mockResolvedValue({
      text: 'こんにちは！暗号通貨取引についてお手伝いできることはありますか？',
      metadata: {}
    })
  })),
  Message: jest.fn()
}));

// Mock the tools
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/mastra/tools/memory-recall.tool');
jest.mock('@/lib/mastra/tools/market-snapshot.tool');
jest.mock('@/lib/mastra/tools/market-data-resilient.tool');

describe('OrchestratorAgent Extended Tests', () => {
  let mockMemoryStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock memory store from the mocked module
    mockMemoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
    
    // Reset mockMemoryStore functions to their default implementations
    mockMemoryStore.currentSessionId = 'test-session-id';
    mockMemoryStore.createSession = jest.fn().mockResolvedValue('test-session-id');
    mockMemoryStore.addMessage = jest.fn().mockResolvedValue(undefined);
    mockMemoryStore.getProcessedMessages = jest.fn(() => []);
    mockMemoryStore.getSessionContext = jest.fn(() => 'Previous context');
    mockMemoryStore.getMemoryStats = jest.fn(() => ({
      totalMessages: 5,
      processedMessages: 5,
      estimatedTokens: 100,
      processors: ['test-processor']
    }));
    mockMemoryStore.getRecentMessages = jest.fn(() => [
      { role: 'user', content: 'BTCの価格', metadata: {} },
      { role: 'assistant', content: 'BTCは50000ドルです', metadata: {} }
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty or malformed queries', async () => {
      const testCases = ['', '   ', '...', '???', null, undefined];
      
      for (const query of testCases) {
        const result = await executeImprovedOrchestrator(query || '');
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });

    it('should handle very long messages', async () => {
      const longQuery = 'BTC' + '分析'.repeat(500);
      const result = await executeImprovedOrchestrator(longQuery);
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      const result = await executeImprovedOrchestrator('BTC価格');
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000);
      expect(result.executionTime).toBeLessThan(5000);
    });
  });

  describe('Language Support', () => {
    it('should handle Japanese queries properly', async () => {
      const queries = [
        'ビットコインの価格を教えてください',
        'イーサリアムの分析をお願いします',
        'リップルは買い時ですか？'
      ];
      
      for (const query of queries) {
        const result = await executeImprovedOrchestrator(query);
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
      }
    });

    it('should handle English queries', async () => {
      const queries = [
        'What is the current BTC price?',
        'Analyze Ethereum for me',
        'Should I buy Solana?'
      ];
      
      for (const query of queries) {
        const result = await executeImprovedOrchestrator(query);
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
      }
    });
  });
});