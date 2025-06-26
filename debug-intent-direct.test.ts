import { analyzeIntent } from './lib/mastra/utils/intent';

console.log('=== Direct Intent Analysis Test ===');

try {
  const query = 'BTCの価格を教えて';
  console.log('Testing query:', query);
  
  const result = analyzeIntent(query);
  console.log('Result:', JSON.stringify(result, null, 2));
  
  if (result.intent === 'price_inquiry') {
    console.log('✅ Intent correctly detected as price_inquiry');
  } else {
    console.log('❌ Intent incorrectly detected as:', result.intent);
  }
} catch (error) {
  console.error('❌ Error in direct intent analysis:', error);
  console.error('Stack trace:', error.stack);
}