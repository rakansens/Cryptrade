import { executeImprovedOrchestrator, analyzeUserIntent } from '../../lib/mastra/agents/orchestrator.agent';
import { analyzeIntent } from '../../lib/mastra/utils/intent';

describe('Orchestrator Error Trace', () => {
  test('trace error location in orchestrator', async () => {
    console.log('=== Orchestrator Error Trace ===');

    // まず直接インテント分析を確認
    const query = 'BTCの価格を教えて';
    console.log('1. Direct intent analysis...');
    const directIntent = analyzeIntent(query);
    console.log('Direct result:', JSON.stringify(directIntent, null, 2));
    
    // analyzeUserIntentでもテスト
    console.log('\n1.5. AnalyzeUserIntent test...');
    const userIntentResult = analyzeUserIntent(query);
    console.log('AnalyzeUserIntent result:', JSON.stringify(userIntentResult, null, 2));

    // オーケストレーターでのテスト
    console.log('\n2. Orchestrator analysis...');
    
    try {
      // オーケストレーターの実行をトレース
      console.log('Calling executeImprovedOrchestrator...');
      const result = await executeImprovedOrchestrator(query);
      
      console.log('Orchestrator result:', JSON.stringify(result, null, 2));
      
      // インテント情報を取得
      if (result && result.analysis) {
        console.log('Intent from orchestrator:', result.analysis.intent);
        console.log('Reasoning:', result.analysis.reasoning);
        
        if (result.analysis.intent !== 'price_inquiry') {
          console.log('❌ Intent mismatch detected!');
          console.log('Expected: price_inquiry');
          console.log('Got:', result.analysis.intent);
          
          // エラーフォールバックの詳細を確認
          if (result.analysis.reasoning && result.analysis.reasoning.includes('エラーフォールバック')) {
            console.log('🚨 Error fallback detected - this indicates an exception in orchestrator execution');
          }
        } else {
          console.log('✅ Intent correctly identified by orchestrator');
        }
      }
      
    } catch (error) {
      console.error('❌ Error in orchestrator execution:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      throw error;
    }
  });
});