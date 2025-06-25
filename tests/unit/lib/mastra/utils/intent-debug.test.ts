// Debug test for intent analysis
import { analyzeIntent, detectGreeting } from '@/lib/mastra/utils/intent';

describe('Intent Analysis Debug', () => {
  test('detectGreeting function directly', () => {
    const testCases = [
      { query: 'こんにちは！', queryLower: 'こんにちは！' },
      { query: 'おはようございます！今日も頑張りましょう', queryLower: 'おはようございます！今日も頑張りましょう' },
    ];

    testCases.forEach(({ query, queryLower }) => {
    // console.log(`\nTesting detectGreeting: "${query}"`); // Removed by test quality fix
      const result = detectGreeting(query, queryLower);
    // console.log(`Result:`, result); // Removed by test quality fix
    });
  });

  test('analyzeIntent function should correctly identify intents', () => {
    const testCases = [
      { query: 'こんにちは！', expectedIntent: 'greeting' },
      { query: 'おはようございます！今日も頑張りましょう', expectedIntent: 'greeting' },
      { query: 'ありがとう、助かりました', expectedIntent: 'small_talk' },
      { query: '疲れたなあ...', expectedIntent: 'small_talk' },
    ];

    testCases.forEach(({ query, expectedIntent }) => {
      const result = analyzeIntent(query);
      
      // Check that the intent is correctly identified
      expect(result.intent).toBe(expectedIntent);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeTruthy();
    });
  });

  test('regex patterns should match expected greetings', () => {
    const greetingPatterns = [
      /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?\.?$/i,
      /^(よろしく)\.?$/i,
      /^hi\s+there$/i,
      /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?[、。\s]/i,
    ];

    const shouldMatch = [
      'こんにちは！',
      'こんにちは',
      'hello',
      'hi',
      'よろしく',
      'hi there',
      'おはようございます！',
    ];

    const shouldNotMatch = [
      'さようなら',
      'ビットコインの価格は？',
      'thank you',
    ];

    // Test patterns that should match
    shouldMatch.forEach(str => {
      const strLower = str.toLowerCase();
      const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
      expect(matchesAny).toBe(true);
    });

    // Test patterns that should not match
    shouldNotMatch.forEach(str => {
      const strLower = str.toLowerCase();
      const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
      expect(matchesAny).toBe(false);
    });
  });
});