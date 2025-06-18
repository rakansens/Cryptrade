/**
 * Orchestrator Agent Simple Validator (AGENT-002)
 * Standalone test for intent analysis without full execution
 */

import { analyzeIntent } from '../../lib/mastra/utils/intent';
import fs from 'fs/promises';
import path from 'path';

interface TestQuery {
  query: string;
  expectedIntent: string;
  description: string;
}

interface TestResult {
  query: string;
  expectedIntent: string;
  actualIntent: string;
  confidence: number;
  success: boolean;
  extractedSymbol?: string;
  reasoning: string;
  proposalType?: string;
  isProposalMode?: boolean;
  conversationMode?: string;
  emotionalTone?: string;
}

interface ValidationReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  accuracy: number;
  averageConfidence: number;
  testResults: TestResult[];
  intentDistribution: Record<string, number>;
  timestamp: string;
}

// Test queries
const testQueries: TestQuery[] = [
  {
    query: "BTCの価格は？",
    expectedIntent: "price_inquiry",
    description: "Simple price inquiry in Japanese"
  },
  {
    query: "ETHのチャートを1時間足に変更して",
    expectedIntent: "ui_control",
    description: "Chart UI control request"
  },
  {
    query: "ビットコインの投資判断を分析して",
    expectedIntent: "trading_analysis",
    description: "Trading analysis request"
  },
  {
    query: "トレンドラインを提案して",
    expectedIntent: "proposal_request",
    description: "Proposal request for trend lines"
  },
  {
    query: "エントリーポイントを教えて",
    expectedIntent: "proposal_request",
    description: "Entry point proposal request"
  },
  {
    query: "こんにちは",
    expectedIntent: "greeting",
    description: "Simple greeting"
  },
  {
    query: "今日の市場はどう？",
    expectedIntent: "market_chat",
    description: "Market chat/conversation"
  }
];

async function runValidation(): Promise<void> {
  console.log('🔍 Starting Orchestrator Intent Analysis Validation (AGENT-002)');
  console.log('='.repeat(60));
  
  const testResults: TestResult[] = [];
  
  for (const testQuery of testQueries) {
    console.log(`\n📝 Testing: "${testQuery.query}"`);
    
    try {
      // Test intent analysis
      const analysisResult = analyzeIntent(testQuery.query);
      
      const success = analysisResult.intent === testQuery.expectedIntent;
      
      const result: TestResult = {
        query: testQuery.query,
        expectedIntent: testQuery.expectedIntent,
        actualIntent: analysisResult.intent,
        confidence: analysisResult.confidence,
        success,
        extractedSymbol: analysisResult.extractedSymbol,
        reasoning: analysisResult.reasoning,
        proposalType: analysisResult.proposalType,
        isProposalMode: analysisResult.isProposalMode,
        conversationMode: analysisResult.conversationMode,
        emotionalTone: analysisResult.emotionalTone
      };
      
      testResults.push(result);
      
      const statusIcon = success ? '✅' : '❌';
      console.log(`${statusIcon} Intent: ${analysisResult.intent} (expected: ${testQuery.expectedIntent})`);
      console.log(`   Confidence: ${(analysisResult.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${analysisResult.reasoning}`);
      console.log(`   Analysis Depth: ${analysisResult.analysisDepth}`);
      
      if (analysisResult.extractedSymbol) {
        console.log(`   Symbol: ${analysisResult.extractedSymbol}`);
      }
      if (analysisResult.isProposalMode) {
        console.log(`   Proposal Mode: Yes (${analysisResult.proposalType})`);
      }
      if (analysisResult.conversationMode) {
        console.log(`   Conversation Mode: ${analysisResult.conversationMode}`);
      }
      if (analysisResult.emotionalTone) {
        console.log(`   Emotional Tone: ${analysisResult.emotionalTone}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${testQuery.query}":`, error);
      testResults.push({
        query: testQuery.query,
        expectedIntent: testQuery.expectedIntent,
        actualIntent: 'error',
        confidence: 0,
        success: false,
        reasoning: 'Error during testing'
      });
    }
  }
  
  // Calculate statistics
  const passedTests = testResults.filter(r => r.success).length;
  const totalConfidence = testResults.reduce((sum, r) => sum + r.confidence, 0);
  
  // Calculate intent distribution
  const intentDistribution: Record<string, number> = {};
  testResults.forEach(result => {
    intentDistribution[result.actualIntent] = (intentDistribution[result.actualIntent] || 0) + 1;
  });
  
  const report: ValidationReport = {
    totalTests: testResults.length,
    passedTests,
    failedTests: testResults.length - passedTests,
    accuracy: (passedTests / testResults.length) * 100,
    averageConfidence: totalConfidence / testResults.length,
    testResults,
    intentDistribution,
    timestamp: new Date().toISOString()
  };
  
  // Save report
  const reportPath = path.join(process.cwd(), 'orchestrator_test.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passedTests} (${report.accuracy.toFixed(1)}%)`);
  console.log(`Failed: ${report.failedTests}`);
  console.log(`Average Confidence: ${(report.averageConfidence * 100).toFixed(1)}%`);
  console.log('\nIntent Distribution:');
  Object.entries(report.intentDistribution).forEach(([intent, count]) => {
    console.log(`  ${intent}: ${count}`);
  });
  
  // Additional routing logic simulation
  console.log('\n🔄 Agent Routing Simulation:');
  testResults.forEach(result => {
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
  
  // Generate Japanese summary
  const summary = generateJapaneseSummary(report);
  console.log('\n📝 Japanese Summary:');
  console.log(summary);
  
  console.log(`\n✅ Report saved to: ${reportPath}`);
}

function generateJapaneseSummary(report: ValidationReport): string {
  const accuracy = report.accuracy.toFixed(1);
  const avgConfidence = (report.averageConfidence * 100).toFixed(1);
  
  const failedTests = report.testResults.filter(r => !r.success);
  let failureDetails = '';
  if (failedTests.length > 0) {
    failureDetails = `失敗: ${failedTests.map(t => `「${t.query}」`).join(', ')}。`;
  }
  
  return `Orchestratorエージェントの意図分析精度は${accuracy}%。7つのテストクエリで、平均信頼度${avgConfidence}%。価格照会、UI操作、取引分析、会話の振り分けが機能。${failureDetails}`;
}

// Run validation
if (require.main === module) {
  runValidation().catch(console.error);
}

export { runValidation };
export type { ValidationReport };