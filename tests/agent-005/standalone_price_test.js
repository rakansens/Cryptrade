/**
 * Standalone Price Inquiry Agent Test
 * Tests the price inquiry detection logic
 */

// Simplified intent detection logic from the actual implementation
function detectPriceInquiry(query) {
  const queryLower = query.toLowerCase().trim();
  
  // Price keywords
  const priceKeywords = ['価格', 'いくら', '値段', '相場', 'quote', '現在値', 'price'];
  const hasPriceKeyword = priceKeywords.some(keyword => queryLower.includes(keyword));
  
  // Crypto symbols
  const cryptoPattern = /btc|eth|bnb|ada|sol|usdt|xrp|ビットコイン|イーサリアム|リップル/i;
  const hasCrypto = cryptoPattern.test(queryLower);
  
  // Exclusions
  const analysisKeywords = ['分析', '将来性', '見通し', '買い時', '売り時', '投資', 'どう思う'];
  const hasAnalysis = analysisKeywords.some(keyword => queryLower.includes(keyword));
  
  const uiKeywords = ['チャート', '切り替え', '変更', '表示して', '見せて'];
  const hasUI = uiKeywords.some(keyword => queryLower.includes(keyword));
  
  const drawingKeywords = ['引いて', '描いて', 'トレンドライン', 'ライン', 'フィボナッチ'];
  const hasDrawing = drawingKeywords.some(keyword => queryLower.includes(keyword));
  
  if ((hasPriceKeyword || hasCrypto) && !hasAnalysis && !hasUI && !hasDrawing && !queryLower.includes('提案')) {
    return {
      intent: 'price_inquiry',
      confidence: 0.9
    };
  }
  
  return null;
}

// Simplified symbol extraction
function extractSymbol(query) {
  const symbolMap = {
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'BNB': 'BNBUSDT',
    'SOL': 'SOLUSDT',
    'XRP': 'XRPUSDT',
    'ADA': 'ADAUSDT',
    'DOGE': 'DOGEUSDT',
    'MATIC': 'MATICUSDT',
    'LTC': 'LTCUSDT'
  };
  
  const japaneseMap = {
    'ビットコイン': 'BTCUSDT',
    'イーサリアム': 'ETHUSDT',
    'イーサ': 'ETHUSDT',
    'リップル': 'XRPUSDT',
    'ソラナ': 'SOLUSDT',
    'ポリゴン': 'MATICUSDT',
    'ライトコイン': 'LTCUSDT'
  };
  
  // Check Japanese names first
  for (const [jaName, symbol] of Object.entries(japaneseMap)) {
    if (query.includes(jaName)) {
      return symbol;
    }
  }
  
  // Check English symbols
  const queryUpper = query.toUpperCase();
  for (const [symbol, pair] of Object.entries(symbolMap)) {
    if (queryUpper.includes(symbol)) {
      return pair;
    }
  }
  
  return undefined;
}

// Test cases
const testCases = [
  { id: 'test-001', query: 'BTCの価格', expectedIntent: 'price_inquiry', expectedSymbol: 'BTCUSDT' },
  { id: 'test-002', query: 'ETHいくら', expectedIntent: 'price_inquiry', expectedSymbol: 'ETHUSDT' },
  { id: 'test-003', query: '現在価格', expectedIntent: 'price_inquiry', expectedSymbol: undefined },
  { id: 'test-004', query: 'ビットコインとイーサリアムの価格を教えて', expectedIntent: 'price_inquiry', expectedSymbol: 'BTCUSDT' },
  { id: 'test-005', query: 'XYZの価格', expectedIntent: 'price_inquiry', expectedSymbol: undefined },
  { id: 'test-006', query: 'SOLの現在値はいくらですか？', expectedIntent: 'price_inquiry', expectedSymbol: 'SOLUSDT' },
  { id: 'test-007', query: 'リップルの相場', expectedIntent: 'price_inquiry', expectedSymbol: 'XRPUSDT' },
  { id: 'test-008', query: 'BNB quote', expectedIntent: 'price_inquiry', expectedSymbol: 'BNBUSDT' },
  { id: 'test-009', query: 'ビットコインの分析をして', expectedIntent: null, expectedSymbol: 'BTCUSDT' },
  { id: 'test-010', query: 'ETHのチャートを表示', expectedIntent: null, expectedSymbol: 'ETHUSDT' }
];

// Run tests
const results = [];
let passedCount = 0;

console.log('\n=== Running Price Inquiry Agent Tests ===\n');

for (const testCase of testCases) {
  const intentResult = detectPriceInquiry(testCase.query);
  const extractedSymbol = extractSymbol(testCase.query);
  
  const intentCorrect = testCase.expectedIntent === null 
    ? intentResult === null 
    : intentResult !== null && intentResult.intent === testCase.expectedIntent;
    
  const symbolCorrect = extractedSymbol === testCase.expectedSymbol;
  const passed = intentCorrect && symbolCorrect;
  
  if (passed) passedCount++;
  
  const result = {
    id: testCase.id,
    query: testCase.query,
    passed,
    intentDetected: intentResult ? intentResult.intent : 'none',
    intentExpected: testCase.expectedIntent || 'none',
    symbolExtracted: extractedSymbol || 'none',
    symbolExpected: testCase.expectedSymbol || 'none'
  };
  
  results.push(result);
  
  console.log(`${testCase.id}: ${passed ? '✓' : '✗'} "${testCase.query}"`);
  if (!intentCorrect) {
    console.log(`  Intent: Expected ${testCase.expectedIntent || 'none'}, got ${intentResult ? intentResult.intent : 'none'}`);
  }
  if (!symbolCorrect) {
    console.log(`  Symbol: Expected ${testCase.expectedSymbol || 'none'}, got ${extractedSymbol || 'none'}`);
  }
}

// Generate summary
const summary = {
  totalTests: results.length,
  passed: passedCount,
  failed: results.length - passedCount,
  accuracy: ((passedCount / results.length) * 100).toFixed(1) + '%',
  timestamp: new Date().toISOString()
};

// Generate Japanese summary
const japaneseSummary = `価格照会エージェントテスト完了。${summary.totalTests}件中${summary.passed}件成功。精度${summary.accuracy}。${summary.failed > 0 ? '一部機能要改善。' : '全機能正常動作確認。'}`;

// Save results
const fs = require('fs');
const path = require('path');

const outputData = {
  summary,
  japaneseSummary,
  results,
  timestamp: new Date().toISOString()
};

const outputPath = path.join(__dirname, 'price_inquiry_test.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

console.log('\n=== Test Summary ===');
console.log(japaneseSummary);
console.log(`\nTotal Tests: ${summary.totalTests}`);
console.log(`Passed: ${summary.passed}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Accuracy: ${summary.accuracy}`);
console.log(`\nResults saved to: ${outputPath}`);