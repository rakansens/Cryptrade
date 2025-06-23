// Minimal test to reproduce the issue
const { analyzeIntent } = require('./lib/mastra/utils/intent');

async function testOrchestrator() {
  const query = 'こんにちは！';
  console.log('Testing query:', query);
  
  // Step 1: Call analyzeIntent (same as orchestrator line 361)
  const unifiedAnalysis = analyzeIntent(query);
  console.log('Unified analysis:', JSON.stringify(unifiedAnalysis, null, 2));
  
  // Step 2: No context adjustment for greeting
  let adjustedIntent = unifiedAnalysis.intent;
  console.log('Adjusted intent:', adjustedIntent);
  
  // Step 3: Create analysis object (same as orchestrator line 392)
  const analysis = {
    intent: adjustedIntent,
    confidence: unifiedAnalysis.confidence,
    reasoning: unifiedAnalysis.reasoning,
    analysisDepth: unifiedAnalysis.analysisDepth,
  };
  
  console.log('Final analysis:', JSON.stringify(analysis, null, 2));
}

testOrchestrator().catch(console.error);