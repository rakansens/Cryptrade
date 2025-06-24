// Debug test for intent analysis
import { analyzeIntent } from '@/lib/mastra/utils/intent';

describe('Debug Intent Analysis', () => {
  test('Debug greeting detection', () => {
    const testCases = [
      'こんにちは！',
      'おはようございます！今日も頑張りましょう',
      'ありがとう、助かりました',
      '疲れたなあ...',
    ];

    testCases.forEach(query => {
    // console.log(`\nTesting: "${query}"`); // Removed by test quality fix
      const result = analyzeIntent(query);
    // console.log(`Result: intent="${result.intent}", confidence=${result.confidence}`); // Removed by test quality fix
    // console.log(`Reasoning: ${result.reasoning}`); // Removed by test quality fix
    });
  });
});