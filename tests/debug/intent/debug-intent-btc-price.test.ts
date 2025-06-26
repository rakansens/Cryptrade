import { analyzeIntent } from '../../lib/mastra/utils/intent';
import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import * as fs from 'fs';
import * as path from 'path';

describe('debug intent BTC price', () => {
  it('should analyze BTCの価格 intent correctly', async () => {
    const query = 'BTCの価格';
    
    // Direct intent analysis
    const intentResult = analyzeIntent(query);
    
    // Also test orchestrator to see what happens WITH error handling debugging
    let orchestratorResult;
    let orchestratorError: any = null;
    
    try {
      orchestratorResult = await executeImprovedOrchestrator(query, 'session-1');
    } catch (error) {
      orchestratorError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      };
      // Re-throw to see if it was caught
      throw error;
    }
    
    // Create debug output with error details
    const debugOutput = {
      query,
      directIntentAnalysis: {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        reasoning: intentResult.reasoning,
        extractedSymbol: intentResult.extractedSymbol,
        requiresWorkflow: intentResult.requiresWorkflow
      },
      orchestratorResult: {
        analysisIntent: orchestratorResult?.analysis?.intent,
        analysisConfidence: orchestratorResult?.analysis?.confidence,
        analysisReasoning: orchestratorResult?.analysis?.reasoning,
        analysisExtractedSymbol: orchestratorResult?.analysis?.extractedSymbol,
        executionResult: orchestratorResult?.executionResult?.metadata?.processedBy,
        fullAnalysis: orchestratorResult?.analysis,
        hasExecutionResult: !!orchestratorResult?.executionResult,
        success: orchestratorResult?.success,
        executionTime: orchestratorResult?.executionTime
      },
      orchestratorError,
      errorCaught: orchestratorError !== null
    };
    
    // Write to file for inspection
    const outputPath = path.join(__dirname, '../../debug-intent-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(debugOutput, null, 2));
    
    // Assert the expected behavior - but first let's see what we actually get
    expect(intentResult.intent).toBeDefined();
    expect(orchestratorResult?.analysis?.intent).toBeDefined();
    
    // Log the actual results via assertion failure if not price_inquiry
    if (intentResult.intent !== 'price_inquiry') {
      throw new Error(`Expected price_inquiry but got: ${intentResult.intent}. Check debug-intent-output.json for details.`);
    }
    
    // Check if orchestrator had the right intent but fell back due to error
    if (orchestratorResult?.analysis?.reasoning === 'エラーフォールバック') {
      throw new Error(`Orchestrator error fallback triggered. Intent was: ${orchestratorResult.analysis.intent}. Check debug-intent-output.json for error details.`);
    }
  });
});