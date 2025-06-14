#!/usr/bin/env ts-node

// Use require to avoid ESM issues
const { extractProposalGroup } = require('../lib/api/helpers/proposal-extractor');
const { buildChatResponse, processOrchestratorResult } = require('../lib/api/helpers/response-builder');

// Test data
const mockExecutionResult = {
  response: 'Test response',
  toolResults: [
    {
      toolName: 'proposalTool',
      result: {
        proposalGroup: {
          proposals: [
            { id: '1', type: 'trendline' },
            { id: '2', type: 'support' }
          ]
        }
      }
    }
  ]
};

const mockOrchestratorResult = {
  analysis: {
    intent: 'proposal_request',
    confidence: 0.95,
    reasoning: 'User wants proposals',
    analysisDepth: 'detailed',
    isProposalMode: true,
    proposalType: 'trendline',
  },
  executionResult: mockExecutionResult,
  success: true,
  executionTime: 1234,
  memoryContext: 'test-context',
};

console.log('Testing extractProposalGroup...');
const proposalGroup = extractProposalGroup(mockExecutionResult);
console.log('Extracted proposalGroup:', proposalGroup);

console.log('\nTesting processOrchestratorResult...');
const processed = processOrchestratorResult(mockOrchestratorResult);
console.log('Processed result:', processed);

console.log('\nTesting buildChatResponse...');
const response = buildChatResponse({
  message: processed.message,
  orchestratorResult: mockOrchestratorResult,
  proposalGroup,
  sessionId: 'test-session-123',
});
console.log('Built response:', JSON.stringify(response, null, 2));

console.log('\nAll tests completed successfully! ✅');