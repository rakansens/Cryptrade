// Test orchestrator directly
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
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

// Set up environment
require('dotenv').config();

// Import the function
const { executeImprovedOrchestrator } = require('./lib/mastra/agents/orchestrator.agent');

async function test() {
  console.log('Testing orchestrator agent with greeting queries...\n');
  
  const queries = [
    'こんにちは！',
    'おはようございます！今日も頑張りましょう',
    'ありがとう、助かりました',
    '疲れたなあ...',
  ];
  
  const context = {
    userLevel: 'intermediate',
    marketStatus: 'open',
  };
  
  for (const query of queries) {
    console.log(`\n=== Testing: "${query}" ===`);
    try {
      const result = await executeImprovedOrchestrator(query, `test-${Date.now()}`, context);
      console.log(`Intent: ${result.analysis.intent}`);
      console.log(`Confidence: ${result.analysis.confidence}`);
      console.log(`Reasoning: ${result.analysis.reasoning}`);
      console.log(`Response: ${result.executionResult?.response || 'No response'}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

test().catch(console.error);