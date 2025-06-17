#!/usr/bin/env node

/**
 * Intent Analysis Test
 * Tests the intent analysis for trendline drawing requests
 */

// Mock environment
process.env.NODE_ENV = 'test';

async function testIntentAnalysis() {
  console.log('🧪 Testing Intent Analysis for Trendline Drawing');
  console.log('===============================================\n');
  
  try {
    // Import the intent analysis function
    const intentModule = await import('../lib/mastra/utils/intent.ts');
    const analyzeIntent = intentModule.analyzeIntent || intentModule.default?.analyzeIntent;
    
    if (!analyzeIntent) {
      console.log('Available exports:', Object.keys(intentModule));
      throw new Error('analyzeIntent function not found in module');
    }
    
    const testQueries = [
      'チャートにトレンドラインを描いて',
      'トレンドライン引いて',
      'トレンドラインを描画',
      'BTCにトレンドラインを引いて',
      'サポートラインを描いて',
      'フィボナッチを引いて',
      'トレンドライン提案して',
      '移動平均を表示', // これは通常のUI操作であるべき
    ];
    
    console.log('📝 Testing Query Analysis:');
    console.log('===========================\n');
    
    for (const query of testQueries) {
      console.log(`Query: "${query}"`);
      
      const result = analyzeIntent(query);
      
      console.log(`   Intent: ${result.intent}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Is Proposal Mode: ${result.isProposalMode || false}`);
      console.log(`   Proposal Type: ${result.proposalType || 'none'}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      
      // Check if trendline queries are correctly classified as proposal_request
      if (query.includes('トレンドライン') || query.includes('trend')) {
        const isCorrect = result.intent === 'proposal_request' && result.isProposalMode === true;
        console.log(`   ✅ ${isCorrect ? 'CORRECT' : 'INCORRECT'} - Expected proposal_request with isProposalMode: true`);
      }
      
      console.log('');
    }
    
    // Test specific case from the logs
    console.log('🎯 Testing Specific Case from Logs:');
    console.log('===================================\n');
    
    const specificQuery = 'チャートにトレンドラインを描いて';
    const specificResult = analyzeIntent(specificQuery);
    
    console.log(`Query: "${specificQuery}"`);
    console.log(`Result:`, JSON.stringify(specificResult, null, 2));
    
    const expectedIntent = 'proposal_request';
    const expectedProposalMode = true;
    const expectedProposalType = 'trendline';
    
    console.log('\n📊 Validation:');
    console.log(`   Intent: ${specificResult.intent} (Expected: ${expectedIntent}) ${specificResult.intent === expectedIntent ? '✅' : '❌'}`);
    console.log(`   Proposal Mode: ${specificResult.isProposalMode} (Expected: ${expectedProposalMode}) ${specificResult.isProposalMode === expectedProposalMode ? '✅' : '❌'}`);
    console.log(`   Proposal Type: ${specificResult.proposalType} (Expected: ${expectedProposalType}) ${specificResult.proposalType === expectedProposalType ? '✅' : '❌'}`);
    
    // Test keyword detection
    console.log('\n🔍 Keyword Detection Analysis:');
    console.log('==============================\n');
    
    const queryLower = specificQuery.toLowerCase().trim();
    
    const drawingSpecificKeywords = [
      'トレンドライン', '引いて', '描いて', '描画',
      'フィボナッチ', 'サポート', 'レジスタンス', 'サポレジ',
      'trend', 'draw', 'fibonacci', 'support', 'resistance'
    ];
    
    const detectedKeywords = drawingSpecificKeywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );
    
    console.log(`Query (lowercase): "${queryLower}"`);
    console.log(`Detected drawing keywords: [${detectedKeywords.join(', ')}]`);
    console.log(`Has specific drawing keyword: ${detectedKeywords.length > 0 ? '✅ YES' : '❌ NO'}`);
    
    // Test logic flow
    const hasSpecificDrawingKeyword = drawingSpecificKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
    console.log(`Should trigger proposal mode: ${hasSpecificDrawingKeyword ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n✅ Intent analysis test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testIntentAnalysis().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});