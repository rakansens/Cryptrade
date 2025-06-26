// Test script to check intent analysis
// This file will help debug why agentSelectionTool is not being called

const analyzeIntent = require('./lib/mastra/utils/intent').analyzeIntent;

const testQueries = [
  'BTCの価格',
  'BTCの価格を教えて',
  'フィボナッチのおすすめポイントは？',
  'チャートをETHに変更',
  'BTCを詳しく分析して',
];

console.log('=== Intent Analysis Test ===\n');

testQueries.forEach(query => {
  console.log(`Query: "${query}"`);
  const intent = analyzeIntent(query);
  console.log(`Intent: ${intent.intent}`);
  console.log(`Confidence: ${intent.confidence}`);
  console.log(`ExtractedSymbol: ${intent.extractedSymbol || 'N/A'}`);
  if (intent.isProposalMode) {
    console.log(`IsProposalMode: ${intent.isProposalMode}`);
    console.log(`ProposalType: ${intent.proposalType}`);
  }
  console.log('---');
});

// Note: detectComplexQuery is not exported from orchestrator.agent.ts
console.log('\nNote: detectComplexQuery test skipped as function is not exported');