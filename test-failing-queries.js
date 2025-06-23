// Test failing queries
const { analyzeIntent } = require('./lib/mastra/utils/intent');

const testQueries = [
  'ETH quote please',
  'XRPの相場は？',
  'BTC prc?',
];

console.log('Testing failing queries:\n');

testQueries.forEach(query => {
  const result = analyzeIntent(query);
  console.log(`Query: "${query}"`);
  console.log(`Intent: ${result.intent}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Reasoning: ${result.reasoning}`);
  console.log('---');
});