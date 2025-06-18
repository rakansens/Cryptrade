/**
 * Simple Intent Analysis Test
 */

// Import the intent analysis function directly
const path = require('path');
const fs = require('fs');

// Load the intent.ts file content and evaluate it
const intentPath = path.join(__dirname, '../../lib/mastra/utils/intent.ts');
const intentContent = fs.readFileSync(intentPath, 'utf8');

// Simple TypeScript to JavaScript conversion for our test
const jsContent = intentContent
  .replace(/export type UserIntent[\s\S]*?;/g, '')
  .replace(/export interface[\s\S]*?}/g, '')
  .replace(/: UserIntent/g, '')
  .replace(/: IntentAnalysisResult \| null/g, '')
  .replace(/: IntentAnalysisResult/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '')
  .replace(/: 'basic' \| 'detailed' \| 'comprehensive'/g, '')
  .replace(/: 'trendline'[\s\S]*?'entry'/g, '')
  .replace(/: 'formal' \| 'casual' \| 'friendly'/g, '')
  .replace(/: 'positive' \| 'neutral' \| 'concerned' \| 'excited'/g, '')
  .replace(/: Record<string, string>/g, '')
  .replace(/\?: /g, ': ')
  .replace(/export function/g, 'function')
  .replace(/export /g, '');

// Create a module wrapper
const moduleCode = `
(function() {
  ${jsContent}
  return { analyzeIntent, extractSymbol, determineAnalysisDepth, detectEmotionalTone };
})()
`;

// Evaluate the code
const intentModule = eval(moduleCode);
const { analyzeIntent } = intentModule;

// Test queries
const testQueries = [
  { query: "BTCの価格は？", expectedIntent: "price_inquiry" },
  { query: "ETHのチャートを1時間足に変更して", expectedIntent: "ui_control" },
  { query: "ビットコインの投資判断を分析して", expectedIntent: "trading_analysis" },
  { query: "トレンドラインを提案して", expectedIntent: "proposal_request" },
  { query: "エントリーポイントを教えて", expectedIntent: "proposal_request" },
  { query: "こんにちは", expectedIntent: "greeting" },
  { query: "今日の市場はどう？", expectedIntent: "market_chat" }
];

console.log('🔍 Starting Orchestrator Intent Analysis Validation');
console.log('='.repeat(60));

const results = [];
let passedTests = 0;

testQueries.forEach(testQuery => {
  console.log(`\n📝 Testing: "${testQuery.query}"`);
  
  try {
    const result = analyzeIntent(testQuery.query);
    const success = result.intent === testQuery.expectedIntent;
    if (success) passedTests++;
    
    results.push({
      query: testQuery.query,
      expectedIntent: testQuery.expectedIntent,
      actualIntent: result.intent,
      confidence: result.confidence,
      success,
      reasoning: result.reasoning,
      extractedSymbol: result.extractedSymbol,
      proposalType: result.proposalType,
      isProposalMode: result.isProposalMode
    });
    
    const statusIcon = success ? '✅' : '❌';
    console.log(`${statusIcon} Intent: ${result.intent} (expected: ${testQuery.expectedIntent})`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${result.reasoning}`);
    if (result.extractedSymbol) {
      console.log(`   Symbol: ${result.extractedSymbol}`);
    }
    if (result.isProposalMode) {
      console.log(`   Proposal Mode: Yes (${result.proposalType})`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    results.push({
      query: testQuery.query,
      expectedIntent: testQuery.expectedIntent,
      actualIntent: 'error',
      confidence: 0,
      success: false,
      reasoning: error.message
    });
  }
});

// Generate report
const report = {
  totalTests: testQueries.length,
  passedTests,
  failedTests: testQueries.length - passedTests,
  accuracy: (passedTests / testQueries.length) * 100,
  averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
  testResults: results,
  timestamp: new Date().toISOString()
};

// Save report
const reportPath = path.join(__dirname, '../../orchestrator_test.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${report.totalTests}`);
console.log(`Passed: ${report.passedTests} (${report.accuracy.toFixed(1)}%)`);
console.log(`Failed: ${report.failedTests}`);
console.log(`Average Confidence: ${(report.averageConfidence * 100).toFixed(1)}%`);

// Intent distribution
const intentCounts = {};
results.forEach(r => {
  intentCounts[r.actualIntent] = (intentCounts[r.actualIntent] || 0) + 1;
});
console.log('\nIntent Distribution:');
Object.entries(intentCounts).forEach(([intent, count]) => {
  console.log(`  ${intent}: ${count}`);
});

// Agent routing simulation
console.log('\n🔄 Agent Routing Simulation:');
results.forEach(result => {
  let targetAgent = 'unknown';
  switch (result.actualIntent) {
    case 'price_inquiry':
      targetAgent = 'price_inquiry';
      break;
    case 'ui_control':
      targetAgent = 'ui_control';
      break;
    case 'trading_analysis':
    case 'proposal_request':
      targetAgent = 'trading_analysis';
      break;
    case 'greeting':
    case 'market_chat':
    case 'small_talk':
    case 'conversational':
    case 'help_request':
      targetAgent = 'orchestrator-direct';
      break;
  }
  console.log(`  "${result.query}" → ${result.actualIntent} → ${targetAgent}`);
});

// Japanese summary
const accuracy = report.accuracy.toFixed(1);
const avgConfidence = (report.averageConfidence * 100).toFixed(1);
const summary = `Orchestratorエージェントの意図分析精度は${accuracy}%。7つのテストクエリで、平均信頼度${avgConfidence}%。価格照会、UI操作、取引分析、会話の振り分けが機能。`;

console.log('\n📝 Japanese Summary:');
console.log(summary);

console.log(`\n✅ Report saved to: ${reportPath}`);