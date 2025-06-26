import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import { analyzeIntent } from '../../lib/mastra/utils/intent';

describe('Debug Orchestrator Intent Flow', () => {
  test('test orchestrator intent analysis flow step by step', async () => {
    console.log('🔍 Step 1: Testing intent analysis directly...');
    
    // Step 1: Test intent analysis directly
    const directIntentResult = analyzeIntent('BTCの価格を教えて');
    console.log('🎯 Direct Intent Analysis Result:', {
      intent: directIntentResult.intent,
      confidence: directIntentResult.confidence,
      reasoning: directIntentResult.reasoning,
      extractedSymbol: directIntentResult.extractedSymbol
    });
    
    console.log('🔍 Step 2: Testing orchestrator execution...');
    
    // Step 2: Test orchestrator execution
    const orchestratorResult = await executeImprovedOrchestrator('BTCの価格を教えて', 'test-session');
    console.log('🎯 Orchestrator Result:', {
      success: orchestratorResult.success,
      intent: orchestratorResult.analysis.intent,
      confidence: orchestratorResult.analysis.confidence,
      reasoning: orchestratorResult.analysis.reasoning,
      analysisDepth: orchestratorResult.analysis.analysisDepth,
      executionTime: orchestratorResult.executionTime
    });
    
    console.log('🔍 Step 3: Comparison...');
    console.log('🎯 Intent Analysis Comparison:', {
      direct_intent: directIntentResult.intent,
      orchestrator_intent: orchestratorResult.analysis.intent,
      match: directIntentResult.intent === orchestratorResult.analysis.intent
    });
    
    // The key insight: Check if orchestrator returns the same intent as direct analysis
    if (directIntentResult.intent === 'price_inquiry') {
      if (orchestratorResult.analysis.intent !== 'price_inquiry') {
        console.log('❌ PROBLEM FOUND: Direct analysis returns price_inquiry but orchestrator returns:', orchestratorResult.analysis.intent);
        console.log('🔍 This suggests something in the orchestrator is changing the intent classification');
      } else {
        console.log('✅ Intent classification is consistent');
      }
    }
    
    // Check if the query gets processed as conversational
    const conversationalIntents = ['market_chat', 'small_talk', 'greeting', 'help_request', 'conversational'];
    if (conversationalIntents.includes(orchestratorResult.analysis.intent)) {
      console.log('🔍 Query processed as conversational intent:', orchestratorResult.analysis.intent);
      console.log('🔍 This explains why agentSelectionTool.execute is not called');
    }
  });
});