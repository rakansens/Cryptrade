// Test to see if orchestrator is throwing an error
import 'dotenv/config';
import { executeImprovedOrchestrator } from './lib/mastra/agents/orchestrator.agent';

// Mock OpenAI if needed
process.env['OPENAI_API_KEY'] = process.env['OPENAI_API_KEY'] || 'test-key';

async function test() {
  console.log('Testing orchestrator with error handling...\n');
  
  const query = 'こんにちは！';
  const context = {
    userLevel: 'intermediate' as const,
    marketStatus: 'open' as const,
  };
  
  try {
    const result = await executeImprovedOrchestrator(query, `test-${Date.now()}`, context);
    console.log('SUCCESS - Result:');
    console.log('- Intent:', result.analysis.intent);
    console.log('- Confidence:', result.analysis.confidence);
    console.log('- Reasoning:', result.analysis.reasoning);
    console.log('- Success:', result.success);
    console.log('- Has execution result:', !!result.executionResult);
  } catch (error: any) {
    console.log('ERROR caught:', error.message);
    console.log('Stack:', error.stack);
  }
}

test().catch(console.error);