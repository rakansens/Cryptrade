/**
 * Simple test runner for Price Inquiry Agent
 */

import { analyzeIntent, extractSymbol } from '@/lib/mastra/utils/intent';

interface TestCase {
  id: string;
  query: string;
  expectedIntent: string;
  expectedSymbol?: string;
}

interface TestResult {
  id: string;
  query: string;
  passed: boolean;
  intent: {
    detected: string;
    expected: string;
    confidence: number;
    correct: boolean;
  };
  symbol: {
    extracted?: string;
    expected?: string;
    correct: boolean;
  };
}

const testCases: TestCase[] = [
  {
    id: 'test-001',
    query: 'BTCの価格',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'BTCUSDT'
  },
  {
    id: 'test-002',
    query: 'ETHいくら',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'ETHUSDT'
  },
  {
    id: 'test-003',
    query: '現在価格',
    expectedIntent: 'price_inquiry',
    expectedSymbol: undefined
  },
  {
    id: 'test-004',
    query: 'ビットコインとイーサリアムの価格を教えて',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'BTCUSDT'
  },
  {
    id: 'test-005',
    query: 'XYZの価格',
    expectedIntent: 'price_inquiry',
    expectedSymbol: undefined
  },
  {
    id: 'test-006',
    query: 'SOLの現在値はいくらですか？',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'SOLUSDT'
  },
  {
    id: 'test-007',
    query: 'リップルの相場',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'XRPUSDT'
  },
  {
    id: 'test-008',
    query: 'BNB quote',
    expectedIntent: 'price_inquiry',
    expectedSymbol: 'BNBUSDT'
  }
];

function runTests(): TestResult[] {
  const results: TestResult[] = [];
  
  for (const testCase of testCases) {
    // Analyze intent
    const intentResult = analyzeIntent(testCase.query);
    
    // Extract symbol
    const extractedSymbol = extractSymbol(testCase.query);
    
    const result: TestResult = {
      id: testCase.id,
      query: testCase.query,
      passed: false,
      intent: {
        detected: intentResult.intent,
        expected: testCase.expectedIntent,
        confidence: intentResult.confidence,
        correct: intentResult.intent === testCase.expectedIntent
      },
      symbol: {
        extracted: extractedSymbol,
        expected: testCase.expectedSymbol,
        correct: testCase.expectedSymbol ? extractedSymbol === testCase.expectedSymbol : true
      }
    };
    
    result.passed = result.intent.correct && result.symbol.correct;
    results.push(result);
  }
  
  return results;
}

// Run tests and generate report
const results = runTests();

// Calculate summary statistics
const summary = {
  totalTests: results.length,
  passed: results.filter(r => r.passed).length,
  failed: results.filter(r => !r.passed).length,
  intentAccuracy: (results.filter(r => r.intent.correct).length / results.length * 100).toFixed(1),
  symbolAccuracy: (results.filter(r => r.symbol.correct).length / results.length * 100).toFixed(1),
  timestamp: new Date().toISOString()
};

// Generate Japanese summary
const japaneseSummary = `価格照会エージェントテスト完了。${summary.totalTests}件中${summary.passed}件成功。意図検出精度${summary.intentAccuracy}%、シンボル抽出精度${summary.symbolAccuracy}%。${summary.failed > 0 ? '一部機能の改善必要。' : '全機能正常動作。'}`;

// Save results to JSON
import * as fs from 'fs';
import * as path from 'path';

const outputData = {
  summary,
  japaneseSummary,
  results,
  testDetails: results.map(r => ({
    id: r.id,
    query: r.query,
    passed: r.passed,
    intentDetected: r.intent.detected,
    intentConfidence: r.intent.confidence,
    symbolExtracted: r.symbol.extracted || 'none',
    errors: !r.passed ? {
      intent: !r.intent.correct ? `Expected ${r.intent.expected}, got ${r.intent.detected}` : null,
      symbol: !r.symbol.correct ? `Expected ${r.symbol.expected}, got ${r.symbol.extracted}` : null
    } : null
  }))
};

const outputPath = path.join(__dirname, 'price_inquiry_test.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

// Console output
console.log('\n=== Price Inquiry Agent Test Results ===');
console.log(japaneseSummary);
console.log('\nDetailed Results:');
console.log(`Total Tests: ${summary.totalTests}`);
console.log(`Passed: ${summary.passed}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Intent Detection Accuracy: ${summary.intentAccuracy}%`);
console.log(`Symbol Extraction Accuracy: ${summary.symbolAccuracy}%`);

console.log('\nFailed Tests:');
results.filter(r => !r.passed).forEach(r => {
  console.log(`- ${r.id}: "${r.query}"`);
  if (!r.intent.correct) {
    console.log(`  Intent: Expected ${r.intent.expected}, got ${r.intent.detected}`);
  }
  if (!r.symbol.correct) {
    console.log(`  Symbol: Expected ${r.symbol.expected}, got ${r.symbol.extracted}`);
  }
});

console.log(`\nResults saved to: ${outputPath}`);

export { summary, results };