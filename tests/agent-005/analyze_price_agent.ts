/**
 * Price Inquiry Agent Analysis
 * Analyzes the implementation and generates a comprehensive report
 */

import { detectPriceInquiry, extractSymbol } from '@/lib/mastra/utils/intent';

// Test cases for comprehensive analysis
const testQueries = [
  // Basic price queries
  { query: 'BTCの価格', expectedSymbol: 'BTCUSDT' },
  { query: 'ETHいくら', expectedSymbol: 'ETHUSDT' },
  { query: '現在価格', expectedSymbol: undefined },
  
  // Japanese currency names
  { query: 'ビットコインの価格', expectedSymbol: 'BTCUSDT' },
  { query: 'イーサリアムの値段', expectedSymbol: 'ETHUSDT' },
  { query: 'リップルの相場', expectedSymbol: 'XRPUSDT' },
  { query: 'ソラナの現在値', expectedSymbol: 'SOLUSDT' },
  
  // Multiple currencies
  { query: 'BTCとETHの価格', expectedSymbol: 'BTCUSDT' },
  { query: 'ビットコインとイーサリアムの価格を教えて', expectedSymbol: 'BTCUSDT' },
  
  // English queries
  { query: 'BTC price', expectedSymbol: 'BTCUSDT' },
  { query: 'How much is ETH', expectedSymbol: 'ETHUSDT' },
  { query: 'Current price of SOL', expectedSymbol: 'SOLUSDT' },
  
  // Edge cases
  { query: 'XYZの価格', expectedSymbol: undefined },
  { query: '価格', expectedSymbol: undefined },
  { query: 'いくら？', expectedSymbol: undefined },
  
  // Should NOT be price inquiries
  { query: 'BTCの分析をして', expectedSymbol: 'BTCUSDT', shouldNotBePriceInquiry: true },
  { query: 'ETHのチャートを表示', expectedSymbol: 'ETHUSDT', shouldNotBePriceInquiry: true },
  { query: 'ビットコインを買うべき？', expectedSymbol: 'BTCUSDT', shouldNotBePriceInquiry: true },
];

function analyzeImplementation() {
  const results = testQueries.map(test => {
    const queryLower = test.query.toLowerCase();
    const intentResult = detectPriceInquiry(test.query, queryLower);
    const extractedSymbol = extractSymbol(test.query);
    
    return {
      query: test.query,
      expectedSymbol: test.expectedSymbol,
      extractedSymbol,
      symbolCorrect: test.expectedSymbol ? extractedSymbol === test.expectedSymbol : extractedSymbol === undefined,
      isPriceInquiry: intentResult !== null,
      shouldBePriceInquiry: !test.shouldNotBePriceInquiry,
      intentCorrect: (intentResult !== null) === !test.shouldNotBePriceInquiry,
      confidence: intentResult?.confidence || 0
    };
  });
  
  // Calculate metrics
  const metrics = {
    totalTests: results.length,
    priceInquiryTests: results.filter(r => r.shouldBePriceInquiry).length,
    nonPriceInquiryTests: results.filter(r => !r.shouldBePriceInquiry).length,
    
    // Intent detection accuracy
    intentDetectionCorrect: results.filter(r => r.intentCorrect).length,
    intentDetectionAccuracy: (results.filter(r => r.intentCorrect).length / results.length * 100).toFixed(1),
    
    // Symbol extraction accuracy (only for price inquiries)
    symbolExtractionTests: results.filter(r => r.shouldBePriceInquiry && r.expectedSymbol !== undefined).length,
    symbolExtractionCorrect: results.filter(r => r.shouldBePriceInquiry && r.symbolCorrect).length,
    symbolExtractionAccuracy: (
      results.filter(r => r.shouldBePriceInquiry && r.symbolCorrect).length / 
      results.filter(r => r.shouldBePriceInquiry && r.expectedSymbol !== undefined).length * 100
    ).toFixed(1),
    
    // Average confidence
    averageConfidence: (
      results.filter(r => r.isPriceInquiry).reduce((sum, r) => sum + r.confidence, 0) / 
      results.filter(r => r.isPriceInquiry).length
    ).toFixed(2)
  };
  
  // Identify issues
  const issues = results.filter(r => !r.intentCorrect || !r.symbolCorrect);
  
  return {
    metrics,
    results,
    issues
  };
}

// Analyze supported symbols
function analyzeSupportedSymbols() {
  const testSymbols = [
    'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 
    'LINK', 'UNI', 'AVAX', 'MATIC', 'LTC'
  ];
  
  const japaneseNames = {
    'ビットコイン': 'BTC',
    'イーサリアム': 'ETH',
    'イーサ': 'ETH',
    'バイナンスコイン': 'BNB',
    'エイダ': 'ADA',
    'カルダノ': 'ADA',
    'ソラナ': 'SOL',
    'ドージコイン': 'DOGE',
    'ドージ': 'DOGE',
    'リップル': 'XRP',
    'ポルカドット': 'DOT',
    'チェーンリンク': 'LINK',
    'ユニスワップ': 'UNI',
    'アバランチ': 'AVAX',
    'ポリゴン': 'MATIC',
    'マティック': 'MATIC',
    'ライトコイン': 'LTC'
  };
  
  return {
    supportedSymbols: testSymbols,
    totalSymbols: testSymbols.length,
    japaneseNameMappings: Object.keys(japaneseNames).length,
    examples: Object.entries(japaneseNames).slice(0, 5).map(([ja, en]) => `${ja} → ${en}`)
  };
}

// Run analysis
const analysis = analyzeImplementation();
const symbolSupport = analyzeSupportedSymbols();

// Generate comprehensive report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    japaneseSummary: `価格照会エージェント分析完了。意図検出精度${analysis.metrics.intentDetectionAccuracy}%、シンボル抽出精度${analysis.metrics.symbolExtractionAccuracy}%。${symbolSupport.totalSymbols}通貨対応、日本語名${symbolSupport.japaneseNameMappings}種類サポート。`,
    metrics: analysis.metrics,
    symbolSupport
  },
  detailedResults: analysis.results,
  issues: analysis.issues.map(issue => ({
    query: issue.query,
    problem: !issue.intentCorrect ? 'Intent detection error' : 'Symbol extraction error',
    details: {
      expectedSymbol: issue.expectedSymbol,
      extractedSymbol: issue.extractedSymbol,
      isPriceInquiry: issue.isPriceInquiry,
      shouldBePriceInquiry: issue.shouldBePriceInquiry
    }
  })),
  recommendations: [
    analysis.metrics.intentDetectionAccuracy < '90' ? 'Improve intent detection logic for edge cases' : null,
    analysis.metrics.symbolExtractionAccuracy < '90' ? 'Enhance symbol extraction for complex queries' : null,
    analysis.issues.some(i => i.query.includes('と')) ? 'Add better support for multiple symbol queries' : null,
  ].filter(Boolean)
};

// Save report
import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(__dirname, 'price_inquiry_analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

// Console output
console.log('\n=== Price Inquiry Agent Analysis Report ===');
console.log(report.summary.japaneseSummary);
console.log('\nKey Metrics:');
console.log(`- Intent Detection Accuracy: ${analysis.metrics.intentDetectionAccuracy}%`);
console.log(`- Symbol Extraction Accuracy: ${analysis.metrics.symbolExtractionAccuracy}%`);
console.log(`- Average Confidence: ${analysis.metrics.averageConfidence}`);
console.log(`- Supported Symbols: ${symbolSupport.totalSymbols}`);
console.log(`- Japanese Name Mappings: ${symbolSupport.japaneseNameMappings}`);

if (analysis.issues.length > 0) {
  console.log('\nIssues Found:');
  analysis.issues.forEach(issue => {
    console.log(`- "${issue.query}": ${!issue.intentCorrect ? 'Intent' : 'Symbol'} error`);
  });
}

if (report.recommendations.length > 0) {
  console.log('\nRecommendations:');
  report.recommendations.forEach(rec => console.log(`- ${rec}`));
}

console.log(`\nFull report saved to: ${outputPath}`);

export { report };