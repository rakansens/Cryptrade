// Debug test for intent analysis
import { analyzeIntent, detectGreeting } from '@/lib/mastra/utils/intent';

describe('Intent Analysis Debug', () => {
  test('detectGreeting function directly', () => {
    const testCases = [
      { query: 'こんにちは！', queryLower: 'こんにちは！' },
      { query: 'おはようございます！今日も頑張りましょう', queryLower: 'おはようございます！今日も頑張りましょう' },
    ];

    testCases.forEach(({ query, queryLower }) => {
      console.log(`\nTesting detectGreeting: "${query}"`);
      const result = detectGreeting(query, queryLower);
      console.log(`Result:`, result);
    });
  });

  test('analyzeIntent function', () => {
    const testCases = [
      { query: 'こんにちは！', expectedIntent: 'greeting' },
      { query: 'おはようございます！今日も頑張りましょう', expectedIntent: 'greeting' },
      { query: 'ありがとう、助かりました', expectedIntent: 'small_talk' },
      { query: '疲れたなあ...', expectedIntent: 'small_talk' },
    ];

    const results: any[] = [];
    testCases.forEach(({ query, expectedIntent }) => {
      const result = analyzeIntent(query);
      results.push({
        query,
        expectedIntent,
        actualIntent: result.intent,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });
    });

    // Force failure to see results
    throw new Error(`Debug results:\n${JSON.stringify(results, null, 2)}`);
  });

  test('regex pattern test', () => {
    const greetingPatterns = [
      /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?\.?$/i,
      /^(よろしく)\.?$/i,
      /^hi\s+there$/i,
      /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?[、。\s]/i,
    ];

    const testStrings = [
      'こんにちは！',
      'こんにちは',
      'おはようございます！今日も頑張りましょう',
      'hello',
      'hi',
    ];

    testStrings.forEach(str => {
      const strLower = str.toLowerCase();
      const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
      console.log(`\n"${str}" matches greeting: ${matchesAny}`);
      greetingPatterns.forEach((pattern, idx) => {
        const matchOriginal = pattern.test(str);
        const matchLower = pattern.test(strLower);
        if (matchOriginal || matchLower) {
          console.log(`  ✓ Pattern ${idx}: original=${matchOriginal}, lower=${matchLower}`);
        }
      });
    });
    
    // Force output
    throw new Error('Forced output for debugging');
  });
});