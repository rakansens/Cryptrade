import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';

describe('Debug Orchestrator Error Details', () => {
  test('capture detailed error information from orchestrator', async () => {
    console.log('🔍 Testing orchestrator with detailed error logging...');
    
    // Hook into console.error to capture detailed error logs
    const originalConsoleError = console.error;
    const errorLogs: any[] = [];
    
    console.error = (...args: any[]) => {
      errorLogs.push(args);
      originalConsoleError(...args);
    };
    
    try {
      const result = await executeImprovedOrchestrator('BTCの価格を教えて');
      
      console.log('🎯 Orchestrator Result:', {
        success: result.success,
        intent: result.analysis.intent,
        confidence: result.analysis.confidence,
        reasoning: result.analysis.reasoning,
        executionTime: result.executionTime
      });
      
      if (errorLogs.length > 0) {
        console.log('🚨 Captured Error Logs:');
        errorLogs.forEach((logArgs, index) => {
          console.log(`Error Log ${index + 1}:`, logArgs);
        });
      }
      
      if (!result.success) {
        console.log('❌ Orchestrator failed as expected, checking fallback reason');
        expect(result.analysis.reasoning).toBe('エラーフォールバック');
      }
      
    } catch (testError) {
      console.log('🚨 Test execution error:', testError);
    } finally {
      // Restore original console.error
      console.error = originalConsoleError;
    }
  });
});