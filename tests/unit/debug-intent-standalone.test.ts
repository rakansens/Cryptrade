import { analyzeIntent } from '../../lib/mastra/utils/intent';

describe('Debug Intent Analysis Standalone', () => {
  test('test intent analysis without orchestrator', () => {
    // Test the intent analysis function directly, without orchestrator
    const result1 = analyzeIntent('BTCの価格を教えて');
    
    console.log('🔍 Direct Intent Analysis Result:', {
      query: 'BTCの価格を教えて',
      intent: result1.intent,
      confidence: result1.confidence,
      reasoning: result1.reasoning,
      extractedSymbol: result1.extractedSymbol
    });
    
    const result2 = analyzeIntent('こんにちは');
    
    console.log('🔍 Direct Intent Analysis Result:', {
      query: 'こんにちは', 
      intent: result2.intent,
      confidence: result2.confidence,
      reasoning: result2.reasoning
    });
    
    // Check if intent analysis itself is working correctly
    expect(result1.intent).toBe('price_inquiry');
    expect(result2.intent).toBe('greeting');
  });
});