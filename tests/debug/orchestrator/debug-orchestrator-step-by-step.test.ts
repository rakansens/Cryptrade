import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import * as fs from 'fs';
import * as path from 'path';

describe('debug orchestrator step by step', () => {
  it('should trace exact failure point in orchestrator', async () => {
    const query = 'BTCの価格';
    
    // Mock console.error to capture detailed error output
    const originalConsoleError = console.error;
    const capturedErrors: any[] = [];
    console.error = (...args: any[]) => {
      capturedErrors.push(args);
      originalConsoleError(...args);
    };
    
    let result;
    let caughtError: any = null;
    
    try {
      result = await executeImprovedOrchestrator(query, 'test-session-debug');
    } catch (error) {
      caughtError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      };
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
    
    const debugOutput = {
      query,
      result: {
        success: result?.success,
        executionTime: result?.executionTime,
        analysis: result?.analysis,
        hasExecutionResult: !!result?.executionResult,
        memoryContext: result?.memoryContext?.substring(0, 100)
      },
      caughtError,
      capturedErrors: capturedErrors.map(err => ({
        args: err.map((arg: any) => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString()
      })),
      testEnvironment: {
        nodeEnv: process.env.NODE_ENV,
        jestWorkerPresent: !!process.env.JEST_WORKER_ID,
        availableModules: {
          hasLogger: !!require.cache[require.resolve('../../lib/utils/logger')],
          hasMemoryStore: !!require.cache[require.resolve('../../lib/store/enhanced-conversation-memory.store')],
        }
      }
    };
    
    // Write detailed debug output
    const outputPath = path.join(__dirname, '../../debug-orchestrator-step-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(debugOutput, null, 2));
    
    // Test assertions
    expect(result).toBeDefined();
    
    // If it's a fallback, fail the test with detailed info
    if (result?.analysis?.reasoning === 'エラーフォールバック') {
      const errorDetails = capturedErrors.length > 0 
        ? `Captured errors: ${JSON.stringify(capturedErrors, null, 2)}`
        : 'No errors captured in console.error';
      
      throw new Error(`Orchestrator fell back to error handling. ${errorDetails}. Check debug-orchestrator-step-output.json for full details.`);
    }
  });
});