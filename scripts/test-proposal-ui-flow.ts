/**
 * Integration test for proposal UI flow
 * Tests the complete flow from API request to UI display
 */

// Set test environment - bypass env validation
process.env.NODE_ENV = 'test';
process.env.SKIP_ENV_VALIDATION = 'true';

// Direct imports to avoid env validation
const logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[INFO] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => console.log(`[DEBUG] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
};

import { UIEventDispatcher } from '../lib/utils/ui-event-dispatcher';
const uiEventDispatcher = UIEventDispatcher.getInstance();
import type { ProposalUIEvent, ChartUIEvent } from '../lib/utils/ui-event-dispatcher';
import type { DrawingProposalGroup, EntryProposalGroup } from '../types/proposals';

interface UITestResult {
  step: string;
  success: boolean;
  events: Array<ProposalUIEvent | ChartUIEvent>;
  error?: string;
}

class ProposalUIFlowTester {
  private results: UITestResult[] = [];
  private capturedEvents: Array<ProposalUIEvent | ChartUIEvent> = [];
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Capture all UI events
    const eventTypes = [
      'proposal:generated',
      'proposal:selected',
      'proposal:execute',
      'proposal:clear',
      'proposal:error',
      'chart:drawZone',
      'chart:drawLine',
      'chart:clear'
    ];
    
    eventTypes.forEach(type => {
      uiEventDispatcher.addEventListener(type, (event: ProposalUIEvent | ChartUIEvent) => {
        this.capturedEvents.push(event);
        logger.debug(`[UIFlowTest] Captured event: ${type}`, event.detail);
      });
    });
  }
  
  async testDrawingProposalFlow() {
    logger.info('[UIFlowTest] Testing drawing proposal flow...');
    
    try {
      // Step 1: Generate drawing proposals
      const mockDrawingProposalGroup = {
        id: 'test-drawing-group-1',
        title: 'トレンドライン分析',
        description: 'テクニカル分析に基づく提案',
        proposals: [
          {
            id: 'drawing-1',
            type: 'trendline',
            analysisType: 'trendline',
            coordinates: {
              start: { x: Date.now() - 86400000, y: 50000 },
              end: { x: Date.now(), y: 52000 }
            },
            confidence: 0.85,
            reasoning: '強い上昇トレンド',
            priority: 'high',
            status: 'pending',
            createdAt: Date.now()
          }
        ],
        createdAt: Date.now()
      };
      
      // Dispatch proposal generated event
      this.capturedEvents = [];
      uiEventDispatcher.dispatchProposalGenerated(mockDrawingProposalGroup as unknown);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const generatedEvents = this.capturedEvents.filter(e => e.type === 'proposal:generated');
      this.results.push({
        step: 'Drawing Proposal Generation',
        success: generatedEvents.length > 0,
        events: generatedEvents
      });
      
      // Step 2: Simulate proposal execution (approval)
      this.capturedEvents = [];
      const proposal = mockDrawingProposalGroup.proposals[0];
      uiEventDispatcher.dispatchProposalExecution({
        ...proposal,
        entryZone: {
          start: 51000,
          end: 51500
        },
        riskParameters: {
          stopLoss: 49000,
          takeProfit: [53000, 55000]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const executionEvents = this.capturedEvents.filter(e => 
        e.type === 'proposal:execute' || 
        e.type === 'chart:drawZone' || 
        e.type === 'chart:drawLine'
      );
      
      this.results.push({
        step: 'Drawing Proposal Execution',
        success: executionEvents.length >= 3, // Should have execution + chart events
        events: executionEvents
      });
      
    } catch (error) {
      this.results.push({
        step: 'Drawing Proposal Flow',
        success: false,
        events: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  async testEntryProposalFlow() {
    logger.info('[UIFlowTest] Testing entry proposal flow...');
    
    try {
      // Step 1: Generate entry proposals
      const mockEntryProposalGroup = {
        id: 'test-entry-group-1',
        title: 'エントリー提案',
        description: 'トレード実行の提案',
        groupType: 'entry',
        proposals: [
          {
            id: 'entry-1',
            type: 'entry',
            direction: 'long',
            entryPrice: 51000,
            entryZone: { min: 50800, max: 51200 },
            strategy: 'swingTrading',
            timeframe: '4h',
            symbol: 'BTCUSDT',
            confidence: 0.75,
            priority: 'high',
            riskParameters: {
              stopLoss: 49000,
              stopLossPercent: 3.92,
              takeProfitTargets: [
                { price: 53000, percentage: 50 },
                { price: 55000, percentage: 50 }
              ],
              riskRewardRatio: 2.04,
              positionSizePercent: 2,
              maxRiskPercent: 1
            },
            conditions: {
              trigger: 'limit'
            },
            marketContext: {
              trend: 'uptrend',
              volatility: 'medium',
              momentum: 'strong',
              volume: 'increasing',
              keyLevels: {
                support: [48000, 50000],
                resistance: [52000, 54000]
              }
            },
            reasoning: {
              primary: 'サポートからの反発とボリューム増加',
              technicalFactors: [],
              risks: ['52kでの潜在的な抵抗']
            },
            status: 'pending',
            createdAt: Date.now()
          }
        ],
        summary: {
          marketBias: 'bullish',
          averageConfidence: 0.75,
          totalProposals: 1,
          strategyBreakdown: {
            swingTrading: 1
          }
        },
        createdAt: Date.now()
      };
      
      // Dispatch proposal generated event
      this.capturedEvents = [];
      uiEventDispatcher.dispatchProposalGenerated(mockEntryProposalGroup);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const generatedEvents = this.capturedEvents.filter(e => e.type === 'proposal:generated');
      this.results.push({
        step: 'Entry Proposal Generation',
        success: generatedEvents.length > 0,
        events: generatedEvents
      });
      
      // Step 2: Test entry zone alert
      this.capturedEvents = [];
      uiEventDispatcher.checkPriceInEntryZone(51000, { start: 50800, end: 51200 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const zoneEvents = this.capturedEvents.filter(e => e.type === 'proposal:entryZoneReached');
      this.results.push({
        step: 'Entry Zone Alert',
        success: zoneEvents.length > 0,
        events: zoneEvents
      });
      
    } catch (error) {
      this.results.push({
        step: 'Entry Proposal Flow',
        success: false,
        events: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  async testBatchEventFlow() {
    logger.info('[UIFlowTest] Testing batch event flow...');
    
    try {
      this.capturedEvents = [];
      
      const batchEvents = [
        {
          type: 'chart:clear' as const,
          detail: { reason: 'new analysis' }
        },
        {
          type: 'chart:drawZone' as const,
          detail: {
            type: 'supportZone',
            start: 48000,
            end: 48500,
            color: 'rgba(0, 255, 0, 0.2)',
            label: 'Strong Support'
          }
        },
        {
          type: 'chart:drawLine' as const,
          detail: {
            type: 'horizontalLine',
            price: 52000,
            color: 'red',
            style: 'dashed',
            label: 'Resistance'
          }
        }
      ];
      
      uiEventDispatcher.dispatchBatch(batchEvents);
      
      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.results.push({
        step: 'Batch Event Processing',
        success: this.capturedEvents.length >= 3,
        events: this.capturedEvents
      });
      
    } catch (error) {
      this.results.push({
        step: 'Batch Event Flow',
        success: false,
        events: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  async runAllTests() {
    logger.info('[UIFlowTest] Starting UI flow tests...');
    
    await this.testDrawingProposalFlow();
    await this.testEntryProposalFlow();
    await this.testBatchEventFlow();
    
    // Summary
    logger.info('[UIFlowTest] Test Summary:');
    const passed = this.results.filter(r => r.success).length;
    logger.info(`  Total: ${this.results.length}, Passed: ${passed}, Failed: ${this.results.length - passed}`);
    
    this.results.forEach(result => {
      logger.info(`  ${result.step}: ${result.success ? '✅' : '❌'}`);
      if (result.success) {
        logger.info(`    Events captured: ${result.events.length}`);
      } else if (result.error) {
        logger.error(`    Error: ${result.error}`);
      }
    });
    
    // Cleanup
    uiEventDispatcher.destroy();
    
    return this.results;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ProposalUIFlowTester();
  tester.runAllTests()
    .then(results => {
      const allPassed = results.every(r => r.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      logger.error('[UIFlowTest] Fatal error:', error);
      process.exit(1);
    });
}

export { ProposalUIFlowTester };