#!/usr/bin/env tsx

/**
 * Proposal Generation Debug Test Script
 * 
 * 提案生成でsymbolがundefinedになる問題をデバッグするためのスクリプト
 */

import { logger } from '../lib/utils/logger';
import { proposalGenerationTool } from '../lib/mastra/tools/proposal-generation.tool';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { agentNetwork } from '../lib/mastra/network/agent-network';
import { registerAllAgents } from '../lib/mastra/network/agent-registry';

// Set debug environment
process.env.NODE_ENV = 'development';
process.env.DEBUG = 'true';

async function testDirectProposalGeneration() {
  console.log('\n=== Test 1: Direct Proposal Generation Tool ===');
  
  try {
    const result = await proposalGenerationTool.execute({
      symbol: 'BTCUSDT',
      interval: '1h',
      analysisType: 'trendline',
      maxProposals: 3,
    });
    
    console.log('✅ Direct tool execution successful');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Direct tool execution failed:', error);
  }
}

async function testOrchestratorProposal() {
  console.log('\n=== Test 2: Orchestrator Proposal Request ===');
  
  try {
    const result = await executeImprovedOrchestrator('BTCのトレンドラインを提案して');
    
    console.log('✅ Orchestrator execution successful');
    console.log('Analysis:', result.analysis);
    console.log('Execution Result:', JSON.stringify(result.executionResult, null, 2));
  } catch (error) {
    console.error('❌ Orchestrator execution failed:', error);
  }
}

async function testA2ACommunication() {
  console.log('\n=== Test 3: A2A Communication Test ===');
  
  // Register agents first
  registerAllAgents();
  
  try {
    // Test direct A2A message
    const message = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'tradingAnalysisAgent',
      'process_query',
      {
        query: 'トレンドラインを提案して',
        context: {
          isProposalMode: true,
          proposalType: 'trendline',
          extractedSymbol: 'BTCUSDT',
          interval: '1h',
        },
      },
      'test-correlation-id'
    );
    
    console.log('✅ A2A communication successful');
    console.log('Message:', JSON.stringify(message, null, 2));
  } catch (error) {
    console.error('❌ A2A communication failed:', error);
  }
}

async function testProposalGenerationWithUndefined() {
  console.log('\n=== Test 4: Proposal Generation with Undefined Symbol ===');
  
  try {
    // Test with undefined symbol
    const result1 = await proposalGenerationTool.execute({
      symbol: undefined as unknown as string,
      interval: '1h',
      analysisType: 'trendline',
    });
    
    console.log('✅ Undefined symbol handled gracefully');
    console.log('Result:', JSON.stringify(result1, null, 2));
    
    // Test with null symbol
    const result2 = await proposalGenerationTool.execute({
      symbol: null as unknown as string,
      interval: '1h',
      analysisType: 'trendline',
    });
    
    console.log('✅ Null symbol handled gracefully');
    console.log('Result:', JSON.stringify(result2, null, 2));
    
  } catch (error) {
    console.error('❌ Undefined symbol test failed:', error);
  }
}

async function main() {
  console.log('Starting Proposal Generation Debug Tests...\n');
  
  // Test each scenario
  await testDirectProposalGeneration();
  await testOrchestratorProposal();
  await testA2ACommunication();
  await testProposalGenerationWithUndefined();
  
  console.log('\n=== All tests completed ===');
  process.exit(0);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});