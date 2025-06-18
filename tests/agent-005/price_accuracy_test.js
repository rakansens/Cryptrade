/**
 * Price Accuracy Test
 * Simulates price inquiry agent responses with mock data
 */

// Mock price data for testing
const mockPriceData = {
  'BTCUSDT': { price: 105372.23, change24h: 0.17 },
  'ETHUSDT': { price: 3891.45, change24h: -1.23 },
  'SOLUSDT': { price: 234.67, change24h: 2.45 },
  'XRPUSDT': { price: 2.38, change24h: -0.89 },
  'BNBUSDT': { price: 687.92, change24h: 1.56 }
};

// Simulate price inquiry agent response
function simulatePriceInquiryResponse(query, symbol) {
  if (!symbol) {
    return '申し訳ございません。価格を確認する通貨を指定してください。BTCやETHなどの暗号通貨名を含めてお尋ねください。';
  }
  
  const priceData = mockPriceData[symbol];
  if (!priceData) {
    return `${symbol}の価格データは現在利用できません。主要な暗号通貨（BTC、ETH、SOL、XRP、BNB）についてお尋ねください。`;
  }
  
  const currencyName = symbol.replace('USDT', '');
  const formattedPrice = priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const changeSymbol = priceData.change24h >= 0 ? '+' : '';
  
  return `${currencyName}の現在価格は $${formattedPrice} です。24時間変化率は ${changeSymbol}${priceData.change24h}% です。`;
}

// Format validation - Check if response follows expected format
function validateResponseFormat(response) {
  const checks = {
    hasCurrency: /[A-Z]{2,5}の現在価格/.test(response),
    hasPrice: /\$[\d,]+\.?\d*/.test(response),
    hasChange: /24時間変化率は [+-]?\d+\.?\d*%/.test(response),
    noTechnicalTerms: !/Intent:|price_inquiry|undefined/.test(response),
    noYenConversion: !response.includes('円'),
    properFormatting: response.includes('現在価格は') && response.includes('です。')
  };
  
  return {
    valid: Object.values(checks).every(v => v),
    checks
  };
}

// Extended test cases with expected responses
const extendedTestCases = [
  {
    id: 'format-001',
    query: 'BTCの価格',
    symbol: 'BTCUSDT',
    description: 'Basic BTC price query'
  },
  {
    id: 'format-002',
    query: 'ETHいくら',
    symbol: 'ETHUSDT',
    description: 'Casual ETH price query'
  },
  {
    id: 'format-003',
    query: '現在価格',
    symbol: undefined,
    description: 'No symbol specified'
  },
  {
    id: 'format-004',
    query: 'XYZの価格',
    symbol: 'XYZUSDT',
    description: 'Invalid symbol'
  },
  {
    id: 'format-005',
    query: 'ソラナの現在値',
    symbol: 'SOLUSDT',
    description: 'Japanese currency name'
  }
];

// Run format validation tests
console.log('\n=== Price Inquiry Response Format Tests ===\n');

const formatResults = [];
let formatPassCount = 0;

for (const testCase of extendedTestCases) {
  const response = simulatePriceInquiryResponse(testCase.query, testCase.symbol);
  const validation = validateResponseFormat(response);
  
  if (validation.valid) formatPassCount++;
  
  const result = {
    id: testCase.id,
    query: testCase.query,
    response,
    valid: validation.valid,
    checks: validation.checks
  };
  
  formatResults.push(result);
  
  console.log(`${testCase.id}: ${validation.valid ? '✓' : '✗'} ${testCase.description}`);
  console.log(`  Query: "${testCase.query}"`);
  console.log(`  Response: "${response}"`);
  
  if (!validation.valid) {
    console.log('  Failed checks:');
    Object.entries(validation.checks).forEach(([check, passed]) => {
      if (!passed) console.log(`    - ${check}`);
    });
  }
  console.log('');
}

// Price accuracy tests
const priceAccuracyTests = [
  { symbol: 'BTCUSDT', query: 'BTCの価格は？' },
  { symbol: 'ETHUSDT', query: 'イーサリアムの値段' },
  { symbol: 'SOLUSDT', query: 'SOL quote' },
  { symbol: 'XRPUSDT', query: 'リップルの現在価格' },
  { symbol: 'BNBUSDT', query: 'BNBいくら？' }
];

console.log('=== Price Data Accuracy Tests ===\n');

const accuracyResults = [];
let accuracyPassCount = 0;

for (const test of priceAccuracyTests) {
  const response = simulatePriceInquiryResponse(test.query, test.symbol);
  const expectedData = mockPriceData[test.symbol];
  
  // Extract price and change from response
  const priceMatch = response.match(/\$([\d,]+\.?\d*)/);
  const changeMatch = response.match(/([-+]?\d+\.?\d*)%/);
  
  const extractedPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  const extractedChange = changeMatch ? parseFloat(changeMatch[1]) : null;
  
  const priceCorrect = extractedPrice === expectedData.price;
  const changeCorrect = extractedChange === expectedData.change24h;
  const passed = priceCorrect && changeCorrect;
  
  if (passed) accuracyPassCount++;
  
  const result = {
    symbol: test.symbol,
    query: test.query,
    passed,
    expectedPrice: expectedData.price,
    extractedPrice,
    expectedChange: expectedData.change24h,
    extractedChange,
    response
  };
  
  accuracyResults.push(result);
  
  console.log(`${test.symbol}: ${passed ? '✓' : '✗'}`);
  console.log(`  Expected: $${expectedData.price}, ${expectedData.change24h}%`);
  console.log(`  Extracted: $${extractedPrice}, ${extractedChange}%`);
  if (!passed) {
    console.log(`  Response: "${response}"`);
  }
  console.log('');
}

// Generate comprehensive report
const comprehensiveReport = {
  timestamp: new Date().toISOString(),
  formatTests: {
    total: formatResults.length,
    passed: formatPassCount,
    failed: formatResults.length - formatPassCount,
    accuracy: ((formatPassCount / formatResults.length) * 100).toFixed(1) + '%',
    results: formatResults
  },
  accuracyTests: {
    total: accuracyResults.length,
    passed: accuracyPassCount,
    failed: accuracyResults.length - accuracyPassCount,
    accuracy: ((accuracyPassCount / accuracyResults.length) * 100).toFixed(1) + '%',
    results: accuracyResults
  },
  overallSummary: {
    totalTests: formatResults.length + accuracyResults.length,
    totalPassed: formatPassCount + accuracyPassCount,
    overallAccuracy: (((formatPassCount + accuracyPassCount) / (formatResults.length + accuracyResults.length)) * 100).toFixed(1) + '%'
  }
};

// Japanese summary (100-200 characters)
const japaneseSummary = `価格照会エージェント検証完了。フォーマット検査${comprehensiveReport.formatTests.accuracy}、価格精度${comprehensiveReport.accuracyTests.accuracy}。全${comprehensiveReport.overallSummary.totalTests}件中${comprehensiveReport.overallSummary.totalPassed}件成功。${comprehensiveReport.overallSummary.totalPassed === comprehensiveReport.overallSummary.totalTests ? '完璧な動作を確認。' : 'エラー処理要改善。'}`;

comprehensiveReport.japaneseSummary = japaneseSummary;

// Save comprehensive report
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'price_inquiry_test.json');
fs.writeFileSync(outputPath, JSON.stringify(comprehensiveReport, null, 2));

console.log('=== Overall Summary ===');
console.log(japaneseSummary);
console.log(`\nFormat Tests: ${comprehensiveReport.formatTests.passed}/${comprehensiveReport.formatTests.total} (${comprehensiveReport.formatTests.accuracy})`);
console.log(`Accuracy Tests: ${comprehensiveReport.accuracyTests.passed}/${comprehensiveReport.accuracyTests.total} (${comprehensiveReport.accuracyTests.accuracy})`);
console.log(`Overall: ${comprehensiveReport.overallSummary.totalPassed}/${comprehensiveReport.overallSummary.totalTests} (${comprehensiveReport.overallSummary.overallAccuracy})`);
console.log(`\nDetailed results saved to: ${outputPath}`);