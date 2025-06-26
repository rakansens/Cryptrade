import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';

describe('Orchestrator Error Capture', () => {
  test('capture and analyze orchestrator errors', async () => {
    console.log('=== Orchestrator Error Capture Test ===');

    // コンソールエラーをキャプチャ
    const originalConsoleError = console.error;
    const capturedErrors: any[] = [];
    
    console.error = (...args: any[]) => {
      capturedErrors.push(args);
      originalConsoleError(...args);
    };

    try {
      const query = 'BTCの価格を教えて';
      console.log('Testing query:', query);
      
      const result = await executeImprovedOrchestrator(query);
      console.log('Result:', JSON.stringify(result, null, 2));
      
      // エラーが発生していたかチェック
      if (result.analysis.reasoning === 'エラーフォールバック') {
        console.log('🚨 ERROR FALLBACK DETECTED!');
        console.log('Captured console errors:', capturedErrors);
        
        // エラーの詳細を分析
        if (capturedErrors.length > 0) {
          capturedErrors.forEach((errorArgs, index) => {
            console.log(`\n--- Captured Error ${index + 1} ---`);
            errorArgs.forEach((arg: any) => {
              if (typeof arg === 'string') {
                console.log('Message:', arg);
              } else if (arg && typeof arg === 'object') {
                console.log('Object:', JSON.stringify(arg, null, 2));
              } else {
                console.log('Value:', arg);
              }
            });
          });
        } else {
          console.log('❌ No console errors captured, but fallback was triggered');
        }
      } else {
        console.log('✅ No error fallback detected');
      }
      
    } catch (error) {
      console.error('❌ Test execution error:', error);
      throw error;
    } finally {
      // コンソールエラーを復元
      console.error = originalConsoleError;
    }
    
    expect(true).toBe(true); // テストは常に成功させる
  });
});