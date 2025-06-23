// Direct test of intent analysis
const { analyzeIntent } = require('./lib/mastra/utils/intent');

console.log('Testing intent analysis directly:\n');

const testQueries = [
  'こんにちは！',
  'おはようございます！今日も頑張りましょう',
  'ありがとう、助かりました',
  '疲れたなあ...',
];

testQueries.forEach(query => {
  const result = analyzeIntent(query);
  console.log(`Query: "${query}"`);
  console.log(`Intent: ${result.intent}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Reasoning: ${result.reasoning}`);
  console.log('---');
});