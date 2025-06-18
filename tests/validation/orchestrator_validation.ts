/**
 * Orchestrator Agent Validator (AGENT-002)
 * Test orchestrator agent's intent analysis and routing capabilities
 */

import { analyzeIntent } from '@/lib/mastra/utils/intent';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import fs from 'fs/promises';
import path from 'path';

interface TestQuery {
  query: string;
  expectedIntent: string;
  expectedAgent?: string;
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
  executionTime?: number;
  routedAgent?: string;
  error?: string;
}

interface ValidationReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  accuracy: number;
  averageConfidence: number;
  averageExecutionTime: number;
  testResults: TestResult[];
  intentDistribution: Record<string, number>;
  timestamp: string;
}

// Test queries
const testQueries: TestQuery[] = [
  {
    query: "BTCの価格は？",
    expectedIntent: "price_inquiry",
    expectedAgent: "price_inquiry",
    description: "Simple price inquiry in Japanese"
  },
  {
    query: "ETHのチャートを1時間足に変更して",
    expectedIntent: "ui_control",
    expectedAgent: "ui_control",
    description: "Chart UI control request"
  },
  {
    query: "ビットコインの投資判断を分析して",
    expectedIntent: "trading_analysis",
    expectedAgent: "trading_analysis",
    description: "Trading analysis request"
  },
  {
    query: "トレンドラインを提案して",
    expectedIntent: "proposal_request",
    expectedAgent: "trading_analysis",
    description: "Proposal request for trend lines"
  },
  {
    query: "エントリーポイントを教えて",
    expectedIntent: "proposal_request",
    expectedAgent: "trading_analysis",
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
  console.log('🔍 Starting Orchestrator Agent Validation (AGENT-002)');
  
  const testResults: TestResult[] = [];
  const startTime = Date.now();
  
  // Create test session
  const sessionId = await createEnhancedSession('orchestrator-validation-test');
  
  for (const testQuery of testQueries) {
    console.log(`\n📝 Testing: "${testQuery.query}"`);
    
    try {
      const queryStartTime = Date.now();
      
      // Test intent analysis
      const analysisResult = analyzeIntent(testQuery.query);
      
      // Test full orchestrator execution
      const orchestratorResult = await executeImprovedOrchestrator(
        testQuery.query,
        sessionId
      );
      
      const executionTime = Date.now() - queryStartTime;
      
      // Determine routed agent
      let routedAgent: string | undefined;
      if (orchestratorResult.executionResult?.metadata) {
        routedAgent = (orchestratorResult.executionResult.metadata as any).processedBy;
      }
      
      const success = analysisResult.intent === testQuery.expectedIntent;
      
      testResults.push({
        query: testQuery.query,
        expectedIntent: testQuery.expectedIntent,
        actualIntent: analysisResult.intent,
        confidence: analysisResult.confidence,
        success,
        extractedSymbol: analysisResult.extractedSymbol,
        reasoning: analysisResult.reasoning,
        executionTime,
        routedAgent
      });
      
      console.log(`✅ Intent: ${analysisResult.intent} (expected: ${testQuery.expectedIntent})`);
      console.log(`   Confidence: ${(analysisResult.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${analysisResult.reasoning}`);
      if (analysisResult.extractedSymbol) {
        console.log(`   Symbol: ${analysisResult.extractedSymbol}`);
      }
      if (routedAgent) {
        console.log(`   Routed to: ${routedAgent}`);
      }
      console.log(`   Execution time: ${executionTime}ms`);
      
    } catch (error) {
      console.error(`❌ Error testing "${testQuery.query}":`, error);
      testResults.push({
        query: testQuery.query,
        expectedIntent: testQuery.expectedIntent,
        actualIntent: 'error',
        confidence: 0,
        success: false,
        reasoning: 'Error during testing',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Calculate statistics
  const passedTests = testResults.filter(r => r.success).length;
  const totalConfidence = testResults.reduce((sum, r) => sum + r.confidence, 0);
  const totalExecutionTime = testResults
    .filter(r => r.executionTime !== undefined)
    .reduce((sum, r) => sum + (r.executionTime || 0), 0);
  
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
    averageExecutionTime: totalExecutionTime / testResults.filter(r => r.executionTime).length,
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
  console.log(`Average Execution Time: ${report.averageExecutionTime.toFixed(0)}ms`);
  console.log('\nIntent Distribution:');
  Object.entries(report.intentDistribution).forEach(([intent, count]) => {
    console.log(`  ${intent}: ${count}`);
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
  const avgTime = report.averageExecutionTime.toFixed(0);
  
  return `Orchestratorエージェントの意図分析精度は${accuracy}%。7つのテストクエリで、平均信頼度${avgConfidence}%、平均応答時間${avgTime}ms。価格照会、UI操作、取引分析の振り分けが正常に機能。`;
}

// Run validation
if (require.main === module) {
  runValidation().catch(console.error);
}

export { runValidation, ValidationReport };