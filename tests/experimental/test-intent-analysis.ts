import { analyzeIntent } from './lib/mastra/utils/intent';

// Test various proposal queries
const testQueries = [
  'トレンドラインの提案をして',
  'サポートレジスタンスの候補を教えて',
  'フィボナッチのおすすめポイントは？',
  'エントリーポイントを推奨して',
  '提案をお願いします',
  '候補を教えて',
  'おすすめして',
  '推奨をお願い',
];

console.log('Testing proposal detection patterns:\n');

testQueries.forEach((query) => {
  const result = analyzeIntent(query);
  console.log(`Query: "${query}"`);
  console.log(`Intent: ${result.intent}`);
  console.log(`Is Proposal: ${result.isProposalMode || false}`);
  console.log(`Proposal Type: ${result.proposalType || 'none'}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log('---');
});