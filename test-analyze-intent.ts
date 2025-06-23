// Direct test of analyzeIntent function in TypeScript
import { analyzeIntent } from './lib/mastra/utils/intent';

const testQueries = [
  'こんにちは！',
  'おはようございます！今日も頑張りましょう',
  'ありがとう、助かりました',
  '疲れたなあ...',
];

console.log('Testing analyzeIntent function directly:\n');

testQueries.forEach(query => {
  const result = analyzeIntent(query);
  console.log(`Query: "${query}"`);
  console.log(`Result: intent="${result.intent}", confidence=${result.confidence}`);
  console.log(`Reasoning: ${result.reasoning}`);
  console.log('---');
});