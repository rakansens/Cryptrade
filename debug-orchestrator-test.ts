// Debug script to test orchestrator
import { analyzeIntent } from './lib/mastra/utils/intent';

// Patch the analyzeIntent function to add logging
const originalAnalyzeIntent = analyzeIntent;
(global as any).analyzeIntentCalls = [];

jest.mock('./lib/mastra/utils/intent', () => ({
  ...jest.requireActual('./lib/mastra/utils/intent'),
  analyzeIntent: jest.fn((query: string) => {
    const result = originalAnalyzeIntent(query);
    console.log(`[DEBUG analyzeIntent] Query: "${query}", Result: ${result.intent}`);
    (global as any).analyzeIntentCalls.push({ query, result });
    return result;
  })
}));

// Now run the test
import { executeImprovedOrchestrator } from './lib/mastra/agents/orchestrator.agent';

async function test() {
  const result = await executeImprovedOrchestrator('こんにちは！', 'test-session', {
    userLevel: 'intermediate',
    marketStatus: 'open'
  });
  
  console.log('\n=== Test Result ===');
  console.log('Intent:', result.analysis.intent);
  console.log('Confidence:', result.analysis.confidence);
  console.log('\n=== analyzeIntent calls ===');
  console.log((global as any).analyzeIntentCalls);
}

test().catch(console.error);