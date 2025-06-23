// Test to see if orchestrator is throwing an error
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

// Mock OpenAI if needed
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Import the function
const { executeImprovedOrchestrator } = require('./lib/mastra/agents/orchestrator.agent');

async function test() {
  console.log('Testing orchestrator with error handling...\n');
  
  const query = 'こんにちは！';
  const context = {
    userLevel: 'intermediate',
    marketStatus: 'open',
  };
  
  try {
    const result = await executeImprovedOrchestrator(query, `test-${Date.now()}`, context);
    console.log('SUCCESS - Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('ERROR caught:', error.message);
    console.log('Stack:', error.stack);
  }
}

test().catch(console.error);