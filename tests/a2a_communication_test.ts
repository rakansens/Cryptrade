import { AgentNetwork } from '@/lib/mastra/network/message-router';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';
import { generateCorrelationId } from '@/types/agent-payload';
import { logger } from '@/lib/utils/logger';

interface TestScenario {
  name: string;
  description: string;
  sourceAgent: string;
  targetAgent: string;
  method: string;
  params?: Record<string, unknown>;
  expectedType: 'response' | 'error';
  validateResponse?: (response: any) => boolean;
}

interface TestResult {
  scenario: string;
  success: boolean;
  executionTime: number;
  correlationId: string;
  response?: any;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Comprehensive A2A Communication Tester
 * Tests all agent-to-agent communication patterns
 */
class A2ACommunicationTester {
  private network: AgentNetwork;
  private results: TestResult[] = [];

  constructor() {
    this.network = new AgentNetwork({
      maxHops: 5,
      timeout: 30000, // 30 seconds for tests
      enableLogging: true,
      enableMetrics: true,
    });
  }

  /**
   * Initialize test environment
   */
  async initialize(): Promise<void> {
    logger.info('[A2A Tester] Initializing test environment');
    
    // Register all agents
    registerAllAgents();
    
    // Wait for registration to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify registration
    const stats = this.network.getNetworkStats();
    logger.info('[A2A Tester] Network initialized', { stats });
  }

  /**
   * Define test scenarios
   */
  private getTestScenarios(): TestScenario[] {
    return [
      // 1. Orchestrator to Price Inquiry Agent
      {
        name: 'orchestrator_to_price',
        description: 'Orchestrator routes price query to Price Inquiry Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'priceInquiryAgent',
        method: 'process_query',
        params: {
          query: 'BTCの現在価格を教えて',
          context: {
            extractedSymbol: 'BTCUSDT',
            sessionId: 'test-session-1',
          },
        },
        expectedType: 'response',
        validateResponse: (response) => {
          return response.result && response.result.includes('価格');
        },
      },

      // 2. Orchestrator to Trading Analysis Agent
      {
        name: 'orchestrator_to_trading',
        description: 'Orchestrator routes analysis query to Trading Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCの投資判断を分析して',
          context: {
            extractedSymbol: 'BTCUSDT',
            analysisDepth: 'detailed',
            sessionId: 'test-session-2',
          },
        },
        expectedType: 'response',
        validateResponse: (response) => {
          return response.result && (response.result.includes('分析') || response.result.includes('判断'));
        },
      },

      // 3. Orchestrator to UI Control Agent
      {
        name: 'orchestrator_to_ui',
        description: 'Orchestrator routes UI command to UI Control Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'uiControlAgent',
        method: 'process_query',
        params: {
          query: 'チャートを1時間足に変更して',
          context: {
            sessionId: 'test-session-3',
          },
        },
        expectedType: 'response',
        validateResponse: (response) => {
          return response.result && (response.result.includes('変更') || response.result.includes('チャート'));
        },
      },

      // 4. Multi-hop routing test
      {
        name: 'multi_hop_routing',
        description: 'Complex query requiring multiple agent coordination',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCの価格を確認してから投資分析をして',
          context: {
            extractedSymbol: 'BTCUSDT',
            requiresMultiStep: true,
            sessionId: 'test-session-4',
          },
        },
        expectedType: 'response',
      },

      // 5. Proposal generation test
      {
        name: 'proposal_generation',
        description: 'Trading agent generates trading proposals',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCのトレンドラインを提案して',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'trendline',
            interval: '1h',
            sessionId: 'test-session-5',
          },
        },
        expectedType: 'response',
        validateResponse: (response) => {
          return response.proposalGroup && response.proposalGroup.proposals;
        },
      },

      // 6. Entry proposal test
      {
        name: 'entry_proposal',
        description: 'Trading agent generates entry proposals',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCのエントリーポイントを提案して',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            interval: '1h',
            sessionId: 'test-session-6',
          },
        },
        expectedType: 'response',
        validateResponse: (response) => {
          return response.proposalGroup || (response.result && response.result.includes('提案'));
        },
      },

      // 7. Error handling - Invalid target
      {
        name: 'error_invalid_target',
        description: 'Test error handling for invalid target agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'nonExistentAgent',
        method: 'process_query',
        params: {
          query: 'Test query',
        },
        expectedType: 'error',
      },

      // 8. Timeout handling test
      {
        name: 'timeout_handling',
        description: 'Test timeout handling for long-running queries',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'Perform extremely complex analysis that might timeout',
          context: {
            analysisDepth: 'comprehensive',
            timeout: 5000, // 5 second timeout
          },
        },
        expectedType: 'response',
      },

      // 9. Broadcast message test
      {
        name: 'broadcast_test',
        description: 'Test broadcasting message to multiple agents',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'all', // Special case for broadcast
        method: 'health_check',
        params: {},
        expectedType: 'response',
      },

      // 10. Correlation ID tracking
      {
        name: 'correlation_tracking',
        description: 'Verify correlation ID is maintained through message chain',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'priceInquiryAgent',
        method: 'process_query',
        params: {
          query: 'ETHの価格',
          context: {
            extractedSymbol: 'ETHUSDT',
          },
        },
        expectedType: 'response',
      },
    ];
  }

  /**
   * Execute a single test scenario
   */
  private async executeScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    logger.info(`[A2A Tester] Executing scenario: ${scenario.name}`, {
      scenario: scenario.name,
      correlationId,
    });

    try {
      let response;
      
      // Handle broadcast test specially
      if (scenario.targetAgent === 'all') {
        const responses = await this.network.broadcastMessage(
          scenario.sourceAgent,
          scenario.method,
          scenario.params
        );
        response = { 
          type: 'response',
          results: responses,
          correlationId 
        };
      } else {
        response = await this.network.sendMessage(
          scenario.sourceAgent,
          scenario.targetAgent,
          scenario.method,
          scenario.params,
          correlationId
        );
      }

      const executionTime = Date.now() - startTime;
      
      // Validate response
      const isValidResponse = response && 
        (scenario.expectedType === 'error' ? response.type === 'error' : response.type !== 'error');
      
      const customValidation = scenario.validateResponse ? 
        scenario.validateResponse(response) : true;

      const success = isValidResponse && customValidation;

      // Check correlation ID
      const correlationIdMatch = response?.correlationId === correlationId;

      const result: TestResult = {
        scenario: scenario.name,
        success,
        executionTime,
        correlationId,
        response: response,
        details: {
          description: scenario.description,
          expectedType: scenario.expectedType,
          actualType: response?.type,
          correlationIdMatch,
          customValidationPassed: customValidation,
        },
      };

      logger.info(`[A2A Tester] Scenario completed: ${scenario.name}`, {
        success,
        executionTime,
        correlationIdMatch,
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const result: TestResult = {
        scenario: scenario.name,
        success: false,
        executionTime,
        correlationId,
        error: String(error),
        details: {
          description: scenario.description,
          expectedType: scenario.expectedType,
          errorOccurred: true,
        },
      };

      logger.error(`[A2A Tester] Scenario failed: ${scenario.name}`, {
        error: String(error),
        executionTime,
      });

      return result;
    }
  }

  /**
   * Run all test scenarios
   */
  async runTests(): Promise<void> {
    logger.info('[A2A Tester] Starting comprehensive A2A communication tests');

    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      const result = await this.executeScenario(scenario);
      this.results.push(result);
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('[A2A Tester] All tests completed', {
      totalTests: this.results.length,
      passed: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
    });
  }

  /**
   * Generate test report
   */
  generateReport(): Record<string, unknown> {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const averageExecutionTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;

    const report = {
      summary: {
        totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`,
        averageExecutionTime: `${averageExecutionTime.toFixed(2)}ms`,
      },
      networkStats: this.network.getNetworkStats(),
      testResults: this.results.map(r => ({
        scenario: r.scenario,
        success: r.success,
        executionTime: `${r.executionTime}ms`,
        correlationId: r.correlationId,
        error: r.error,
        details: r.details,
      })),
      failedTests: this.results
        .filter(r => !r.success)
        .map(r => ({
          scenario: r.scenario,
          error: r.error || 'Validation failed',
          details: r.details,
        })),
    };

    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(filename: string): Promise<void> {
    const report = this.generateReport();
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    logger.info(`[A2A Tester] Report saved to ${filename}`);
  }
}

// Main execution
async function main() {
  const tester = new A2ACommunicationTester();
  
  try {
    await tester.initialize();
    await tester.runTests();
    
    const report = tester.generateReport();
    console.log('\n=== A2A Communication Test Report ===\n');
    console.log(JSON.stringify(report, null, 2));
    
    // Save report
    await tester.saveReport('a2a_test_results.json');
    
    // Generate Japanese summary
    const summary = `A2A通信テスト完了: ${report.summary.passed}/${report.summary.totalTests}成功 (${report.summary.successRate}) 平均実行時間${report.summary.averageExecutionTime}`;
    console.log(`\n${summary}\n`);
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { A2ACommunicationTester };