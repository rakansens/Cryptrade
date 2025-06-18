import { A2AMessage, AgentNetworkConfig } from '@/types';

interface TestScenario {
  name: string;
  description: string;
  sourceAgent: string;
  targetAgent: string;
  method: string;
  params?: Record<string, unknown>;
  expectedResponse: Partial<A2AMessage>;
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
 * Mock A2A Communication Tester
 * Tests agent-to-agent communication patterns without requiring actual API calls
 */
class MockA2ACommunicationTester {
  private results: TestResult[] = [];
  private mockResponses: Map<string, any> = new Map();
  
  constructor() {
    this.setupMockResponses();
  }

  /**
   * Setup mock responses for different agent types
   */
  private setupMockResponses(): void {
    // Price Inquiry Agent mock responses
    this.mockResponses.set('priceInquiryAgent:process_query', {
      type: 'response',
      result: 'BTCの現在価格は $105,372.23 です。24時間変化率は 0.17% です。',
      toolResults: [{
        toolName: 'marketDataResilientTool',
        result: {
          symbol: 'BTCUSDT',
          currentPrice: 105372.23,
          priceChangePercent24h: 0.17,
        }
      }],
    });

    // Trading Analysis Agent mock responses
    this.mockResponses.set('tradingAnalysisAgent:process_query', {
      type: 'response',
      result: 'BTCの技術分析を実施しました。現在上昇トレンドにあり、RSIは65を示しています。',
      metadata: {
        analysisType: 'technical',
        indicators: { rsi: 65, macd: 'bullish', trend: 'upward' },
      },
    });

    // UI Control Agent mock responses
    this.mockResponses.set('uiControlAgent:process_query', {
      type: 'response',
      result: 'チャートを1時間足に変更しました。',
      toolResults: [{
        toolName: 'chartControlTool',
        result: { action: 'changeTimeframe', timeframe: '1h', success: true },
      }],
    });

    // Proposal generation mock
    this.mockResponses.set('tradingAnalysisAgent:proposal', {
      type: 'response',
      result: '3個の提案を生成しました。',
      proposalGroup: {
        id: 'pg-123',
        proposals: [
          { type: 'trendline', points: [[100, 50000], [200, 52000]] },
          { type: 'support', level: 48000 },
          { type: 'resistance', level: 55000 },
        ],
      },
    });

    // Error response mock
    this.mockResponses.set('error:invalid_target', {
      type: 'error',
      error: {
        code: -32603,
        message: 'Target agent not found or inactive',
        data: { targetId: 'nonExistentAgent' },
      },
    });
  }

  /**
   * Simulate message routing
   */
  private async simulateMessageRouting(
    sourceId: string,
    targetId: string,
    method: string,
    params?: Record<string, unknown>,
    correlationId?: string
  ): Promise<A2AMessage> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const corrId = correlationId || `corr-${Date.now()}`;

    // Check for error scenarios
    if (targetId === 'nonExistentAgent') {
      return {
        id: `err-${messageId}`,
        type: 'error',
        source: targetId,
        target: sourceId,
        error: {
          code: -32603,
          message: 'Target agent not found or inactive',
          data: { targetId },
        },
        timestamp: Date.now(),
        correlationId: corrId,
      };
    }

    // Get mock response based on target and method
    let mockKey = `${targetId}:${method}`;
    if (params?.context && (params.context as any).isProposalMode) {
      mockKey = `${targetId}:proposal`;
    }

    const mockResponse = this.mockResponses.get(mockKey) || {
      type: 'response',
      result: `Mock response from ${targetId}`,
    };

    return {
      id: `resp-${messageId}`,
      type: mockResponse.type,
      source: targetId,
      target: sourceId,
      result: mockResponse.result,
      timestamp: Date.now(),
      correlationId: corrId,
      ...(mockResponse.toolResults && { toolResults: mockResponse.toolResults }),
      ...(mockResponse.proposalGroup && { proposalGroup: mockResponse.proposalGroup }),
      ...(mockResponse.metadata && { metadata: mockResponse.metadata }),
      ...(mockResponse.error && { error: mockResponse.error }),
    };
  }

  /**
   * Define test scenarios
   */
  private getTestScenarios(): TestScenario[] {
    return [
      // 1. Orchestrator to Price Inquiry
      {
        name: 'orchestrator_to_price',
        description: 'Orchestrator routes price query to Price Inquiry Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'priceInquiryAgent',
        method: 'process_query',
        params: {
          query: 'BTCの現在価格を教えて',
          context: { extractedSymbol: 'BTCUSDT' },
        },
        expectedResponse: {
          type: 'response',
        },
      },

      // 2. Orchestrator to Trading Analysis
      {
        name: 'orchestrator_to_trading',
        description: 'Orchestrator routes analysis query to Trading Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCの投資判断を分析して',
          context: { extractedSymbol: 'BTCUSDT', analysisDepth: 'detailed' },
        },
        expectedResponse: {
          type: 'response',
        },
      },

      // 3. Orchestrator to UI Control
      {
        name: 'orchestrator_to_ui',
        description: 'Orchestrator routes UI command to UI Control Agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'uiControlAgent',
        method: 'process_query',
        params: {
          query: 'チャートを1時間足に変更して',
        },
        expectedResponse: {
          type: 'response',
        },
      },

      // 4. Proposal generation
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
          },
        },
        expectedResponse: {
          type: 'response',
        },
      },

      // 5. Error handling
      {
        name: 'error_invalid_target',
        description: 'Test error handling for invalid target agent',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'nonExistentAgent',
        method: 'process_query',
        params: { query: 'Test query' },
        expectedResponse: {
          type: 'error',
        },
      },

      // 6. Multi-agent coordination
      {
        name: 'multi_agent_coordination',
        description: 'Complex query requiring multiple agents',
        sourceAgent: 'orchestratorAgent',
        targetAgent: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCの価格を確認してから投資分析をして',
          context: { requiresMultiStep: true },
        },
        expectedResponse: {
          type: 'response',
        },
      },
    ];
  }

  /**
   * Execute a single test scenario
   */
  private async executeScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const correlationId = `test-corr-${Date.now()}`;

    console.log(`[A2A Mock Test] Executing: ${scenario.name}`);

    try {
      const response = await this.simulateMessageRouting(
        scenario.sourceAgent,
        scenario.targetAgent,
        scenario.method,
        scenario.params,
        correlationId
      );

      const executionTime = Date.now() - startTime;
      
      // Validate response
      const typeMatch = response.type === scenario.expectedResponse.type;
      const hasCorrelationId = response.correlationId === correlationId;
      const hasProposalGroup = scenario.params?.context && 
        (scenario.params.context as any).isProposalMode ? 
        !!(response as any).proposalGroup : true;

      const success = typeMatch && hasCorrelationId && hasProposalGroup;

      const result: TestResult = {
        scenario: scenario.name,
        success,
        executionTime,
        correlationId,
        response: {
          type: response.type,
          hasResult: !!response.result,
          hasToolResults: !!(response as any).toolResults,
          hasProposalGroup: !!(response as any).proposalGroup,
          hasError: !!(response as any).error,
        },
        details: {
          description: scenario.description,
          expectedType: scenario.expectedResponse.type,
          actualType: response.type,
          correlationIdMatch: hasCorrelationId,
          proposalGroupCheck: hasProposalGroup,
        },
      };

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        scenario: scenario.name,
        success: false,
        executionTime,
        correlationId,
        error: String(error),
        details: { description: scenario.description },
      };
    }
  }

  /**
   * Run all test scenarios
   */
  async runTests(): Promise<void> {
    console.log('[A2A Mock Test] Starting A2A communication tests\n');

    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      const result = await this.executeScenario(scenario);
      this.results.push(result);
      
      console.log(`✓ ${scenario.name}: ${result.success ? 'PASSED' : 'FAILED'} (${result.executionTime}ms)`);
      if (!result.success) {
        console.log(`  Error: ${result.error || 'Validation failed'}`);
      }
    }

    console.log('\n[A2A Mock Test] All tests completed');
  }

  /**
   * Generate test report
   */
  generateReport(): Record<string, unknown> {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const averageExecutionTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;

    // Simulate network stats
    const mockNetworkStats = {
      totalAgents: 4,
      activeAgents: 4,
      totalMessages: this.results.length * 2, // Request + Response
      queueSize: 0,
      averageMessages: this.results.length * 2 / 4,
      lastActivity: Date.now(),
    };

    // Create communication flow diagram data
    const communicationFlows = this.results.map(r => ({
      source: r.scenario.includes('orchestrator') ? 'Orchestrator' : 'Unknown',
      target: r.scenario.includes('price') ? 'PriceInquiry' :
              r.scenario.includes('trading') ? 'TradingAnalysis' :
              r.scenario.includes('ui') ? 'UIControl' : 'Unknown',
      success: r.success,
      latency: r.executionTime,
    }));

    const report = {
      summary: {
        totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`,
        averageExecutionTime: `${averageExecutionTime.toFixed(2)}ms`,
        testDate: new Date().toISOString(),
      },
      networkStats: mockNetworkStats,
      testResults: this.results.map(r => ({
        scenario: r.scenario,
        success: r.success,
        executionTime: `${r.executionTime}ms`,
        correlationId: r.correlationId,
        response: r.response,
        error: r.error,
        details: r.details,
      })),
      communicationFlows,
      correlationTracking: {
        allCorrelationIdsValid: this.results.every(r => 
          r.details?.correlationIdMatch === true || r.details?.correlationIdMatch === undefined
        ),
        correlationIdFormat: 'test-corr-[timestamp]',
      },
      errorHandling: {
        errorScenariosDetected: this.results.filter(r => 
          r.response?.type === 'error' || r.error
        ).length,
        errorPropagationWorking: this.results.some(r => 
          r.scenario === 'error_invalid_target' && r.success
        ),
      },
      routingAnalysis: {
        orchestratorRouting: this.results.filter(r => 
          r.scenario.includes('orchestrator')
        ).length,
        directRouting: 0,
        multiHopRouting: this.results.filter(r => 
          r.details?.description?.includes('multi')
        ).length,
      },
    };

    return report;
  }

  /**
   * Generate Japanese summary
   */
  generateJapaneseSummary(): string {
    const report = this.generateReport();
    const { summary } = report;
    
    return `A2A通信テスト完了: ${summary.passed}/${summary.totalTests}成功 (${summary.successRate}) 平均実行時間${summary.averageExecutionTime}`;
  }
}

// Main execution
async function main() {
  const tester = new MockA2ACommunicationTester();
  
  try {
    await tester.runTests();
    
    const report = tester.generateReport();
    console.log('\n=== A2A Communication Test Report ===\n');
    console.log(JSON.stringify(report, null, 2));
    
    // Save report
    const fs = await import('fs/promises');
    await fs.writeFile('a2a_test_results.json', JSON.stringify(report, null, 2));
    console.log('\nReport saved to a2a_test_results.json');
    
    // Generate Japanese summary
    const summary = tester.generateJapaneseSummary();
    console.log(`\n${summary}\n`);
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MockA2ACommunicationTester };