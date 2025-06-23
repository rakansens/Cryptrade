// Direct test of analyzeIntent function
const path = require('path');

// Add TypeScript path aliases
require('tsconfig-paths').register({
  baseUrl: './',
  paths: {
    '@/*': ['*']
  }
});

// Enable TypeScript compilation
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

// Import the function
const { analyzeIntent } = require('./lib/mastra/utils/intent');

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