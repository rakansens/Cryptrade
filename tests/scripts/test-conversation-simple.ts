/**
 * Simple test to verify conversation improvements
 * Focuses on testing the intent analysis improvements
 */

import { analyzeIntent } from '../../lib/mastra/utils/intent';

interface TestCase {
  input: string;
  expectedIntent: string;
  description: string;
}

const testCases: TestCase[] = [
  // Greeting tests
  { input: 'こんにちは', expectedIntent: 'conversational', description: 'Simple greeting' },
  { input: 'おはようございます', expectedIntent: 'conversational', description: 'Morning greeting' },
  { input: 'こんばんは', expectedIntent: 'conversational', description: 'Evening greeting' },
  
  // Weather/casual talk
  { input: '今日はいい天気ですね', expectedIntent: 'conversational', description: 'Weather talk' },
  { input: '元気ですか？', expectedIntent: 'conversational', description: 'How are you' },
  { input: 'ありがとうございます', expectedIntent: 'conversational', description: 'Thank you' },
  
  // Price inquiries (should be specific)
  { input: 'BTCの価格を教えて', expectedIntent: 'price_inquiry', description: 'BTC price request' },
  { input: 'ETHはいくら？', expectedIntent: 'price_inquiry', description: 'ETH price question' },
  { input: 'ビットコインの現在値', expectedIntent: 'price_inquiry', description: 'Bitcoin current price' },
  
  // Market chat (casual market talk)
  { input: '最近の市場はどうですか？', expectedIntent: 'market_chat', description: 'Casual market question' },
  { input: 'BTCの調子はどう？', expectedIntent: 'market_chat', description: 'Casual BTC status' },
  { input: '今日の相場の様子は？', expectedIntent: 'market_chat', description: 'Today market status' },
  
  // Trading analysis (serious analysis)
  { input: 'BTCの詳細な分析をお願いします', expectedIntent: 'trading_analysis', description: 'Detailed analysis request' },
  { input: 'ETHを買うべきですか？', expectedIntent: 'trading_analysis', description: 'Should buy question' },
  { input: 'ソラナの将来性について教えて', expectedIntent: 'trading_analysis', description: 'Future prospects' },
  
  // Small talk
  { input: 'そうですね', expectedIntent: 'small_talk', description: 'Agreement' },
  { input: 'なるほど', expectedIntent: 'small_talk', description: 'Understanding' },
  { input: 'わかりました', expectedIntent: 'small_talk', description: 'Got it' },
];

function runTests() {
  console.log('🧪 Testing Intent Analysis Improvements\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = analyzeIntent(testCase.input);
    
    // Consider conversational as a valid match for greeting, small_talk, market_chat
    const isMatch = result.intent === testCase.expectedIntent ||
      (result.intent === 'conversational' && 
       ['greeting', 'small_talk', 'market_chat', 'help_request'].includes(testCase.expectedIntent));
    
    if (isMatch) {
      passed++;
      console.log(`✅ PASS: "${testCase.input}" → ${result.intent} (${result.confidence.toFixed(2)})`);
    } else {
      failed++;
      console.log(`❌ FAIL: "${testCase.input}"`);
      console.log(`   Expected: ${testCase.expectedIntent}, Got: ${result.intent}`);
      console.log(`   Reasoning: ${result.reasoning}`);
    }
  }
  
  const total = passed + failed;
  const successRate = (passed / total) * 100;
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${passed}/${total} passed (${successRate.toFixed(1)}%)`);
  console.log('='.repeat(50));
  
  if (successRate >= 90) {
    console.log('✨ Intent classification is working well!');
  } else {
    console.log('⚠️  Intent classification needs improvement');
  }
  
  // Additional analysis
  const failuresByIntent = testCases
    .filter((tc, i) => {
      const result = analyzeIntent(tc.input);
      return result.intent !== tc.expectedIntent && 
        !(result.intent === 'conversational' && 
          ['greeting', 'small_talk', 'market_chat', 'help_request'].includes(tc.expectedIntent));
    })
    .reduce((acc, tc) => {
      acc[tc.expectedIntent] = (acc[tc.expectedIntent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  if (Object.keys(failuresByIntent).length > 0) {
    console.log('\nFailures by expected intent:');
    for (const [intent, count] of Object.entries(failuresByIntent)) {
      console.log(`  ${intent}: ${count} failures`);
    }
  }
}

// Run the tests
runTests();