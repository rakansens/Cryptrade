/**
 * Integration Test: AI Chat + Market Analysis
 * Tests the complete flow from market data to AI analysis and proposals
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MarketStore } from '@/store/market.store';
import { ChatStore } from '@/store/chat.store';
import { ChartStore } from '@/store/chart.store';
import { ProposalApprovalStore } from '@/store/proposal-approval.store';
import { Mastra } from '@/lib/mastra/mastra';
import { enhancedProposalGenerationTool } from '@/lib/mastra/tools/enhanced-proposal-generation.tool';
import { enhancedLineAnalysisTool } from '@/lib/mastra/tools/enhanced-line-analysis.tool';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/lib/ws/__tests__/websocket-mock';
import type { Proposal } from '@/types/proposal';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock OpenAI for AI responses
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                analysis: 'Bullish trend detected with strong support at 50000',
                proposals: [{
                  type: 'trendline',
                  confidence: 0.85,
                  points: [
                    { time: Date.now() / 1000 - 3600, value: 50000 },
                    { time: Date.now() / 1000, value: 51000 }
                  ]
                }]
              })
            }
          }]
        })
      }
    }
  }))
}));

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('AI Chat + Market Analysis Integration', () => {
  let wsManager: WSManager;
  let marketStore: ReturnType<typeof MarketStore.getState>;
  let chatStore: ReturnType<typeof ChatStore.getState>;
  let chartStore: ReturnType<typeof ChartStore.getState>;
  let proposalStore: ReturnType<typeof ProposalApprovalStore.getState>;
  let mastra: Mastra;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    
    // Initialize components
    wsManager = new WSManager({
      url: 'wss://stream.binance.com:9443/ws/',
      debug: false
    });
    
    marketStore = MarketStore.getState();
    chatStore = ChatStore.getState();
    chartStore = ChartStore.getState();
    proposalStore = ProposalApprovalStore.getState();
    
    // Initialize Mastra with tools
    mastra = new Mastra({
      tools: {
        enhancedProposalGeneration: enhancedProposalGenerationTool,
        enhancedLineAnalysis: enhancedLineAnalysisTool
      }
    });
    
    // Reset stores
    marketStore.reset();
    chatStore.reset();
    chartStore.reset();
    proposalStore.reset();
  });

  afterEach(() => {
    wsManager.destroy();
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });

  describe('Market Analysis Workflow', () => {
    it('should analyze market data and generate proposals', async () => {
      const symbol = 'BTCUSDT';
      
      // Add historical market data
      const klines = Array.from({ length: 50 }, (_, i) => ({
        time: Date.now() / 1000 - (50 - i) * 60,
        open: 50000 + i * 20,
        high: 50100 + i * 20,
        low: 49900 + i * 20,
        close: 50050 + i * 20,
        volume: 100
      }));
      
      klines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // User requests analysis
      const userMessage = 'Analyze the current BTCUSDT trend and suggest trading opportunities';
      chatStore.addMessage({
        id: '1',
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      });
      
      // Trigger AI analysis
      const analysisResult = await mastra.run('tradingAgent', {
        messages: [{ role: 'user', content: userMessage }],
        symbol,
        marketData: marketStore.klines[`${symbol}_1m`]
      });
      
      // Verify analysis was performed
      expect(analysisResult).toBeDefined();
      expect(analysisResult.analysis).toContain('trend');
      
      // Add AI response to chat
      chatStore.addMessage({
        id: '2',
        role: 'assistant',
        content: analysisResult.analysis,
        timestamp: Date.now()
      });
      
      // Verify proposals were generated
      expect(analysisResult.proposals).toBeDefined();
      expect(analysisResult.proposals.length).toBeGreaterThan(0);
      
      // Add proposals to store
      analysisResult.proposals.forEach((proposal: Proposal) => {
        proposalStore.addProposal({
          ...proposal,
          id: `proposal-${Date.now()}-${Math.random()}`,
          status: 'pending',
          createdAt: Date.now()
        });
      });
      
      // Verify proposals in store
      const pendingProposals = proposalStore.getPendingProposals();
      expect(pendingProposals.length).toBeGreaterThan(0);
    });

    it('should update analysis based on real-time data', (done) => {
      const symbol = 'BTCUSDT';
      let analysisCount = 0;
      
      // Add initial data
      const initialKlines = Array.from({ length: 30 }, (_, i) => ({
        time: Date.now() / 1000 - (30 - i) * 60,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 100
      }));
      
      initialKlines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // Subscribe to real-time updates
      const subscription = wsManager.subscribe(`${symbol.toLowerCase()}@kline_1m`).subscribe({
        next: async (data) => {
          // Add new kline
          const kline = {
            time: Math.floor(data.k.t / 1000),
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v)
          };
          
          marketStore.addKline(symbol, kline);
          
          // Trigger analysis if significant price change
          const latestKlines = marketStore.klines[`${symbol}_1m`];
          const priceChange = Math.abs(kline.close - latestKlines[latestKlines.length - 2]?.close || 0);
          
          if (priceChange > 100) {
            analysisCount++;
            
            // Perform new analysis
            const result = await mastra.run('tradingAgent', {
              messages: [{ role: 'system', content: 'Significant price movement detected' }],
              symbol,
              marketData: latestKlines
            });
            
            // Add analysis to chat
            chatStore.addMessage({
              id: `analysis-${analysisCount}`,
              role: 'assistant',
              content: `Price alert: ${result.analysis}`,
              timestamp: Date.now()
            });
            
            if (analysisCount >= 2) {
              subscription.unsubscribe();
              done();
            }
          }
        }
      });
      
      // Simulate price movements
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
        if (ws) {
          // First significant move
          ws.simulateMessage({
            e: 'kline',
            E: Date.now(),
            s: symbol,
            k: {
              t: Date.now() - 60000,
              T: Date.now(),
              s: symbol,
              i: '1m',
              o: '50050',
              c: '50200', // +150 move
              h: '50250',
              l: '50000',
              v: '200',
              x: true
            }
          });
          
          // Second significant move
          setTimeout(() => {
            ws.simulateMessage({
              e: 'kline',
              E: Date.now(),
              s: symbol,
              k: {
                t: Date.now(),
                T: Date.now() + 60000,
                s: symbol,
                i: '1m',
                o: '50200',
                c: '50350', // +150 move
                h: '50400',
                l: '50150',
                v: '250',
                x: true
              }
            });
          }, 100);
        }
      }, 50);
    });
  });

  describe('Proposal Management', () => {
    it('should handle proposal approval workflow', async () => {
      // Generate a proposal
      const proposal: Proposal = {
        id: 'test-proposal-1',
        type: 'trendline',
        confidence: 0.9,
        reasoning: 'Strong uptrend identified',
        drawing: {
          type: 'trendline',
          points: [
            { time: Date.now() / 1000 - 3600, value: 50000 },
            { time: Date.now() / 1000, value: 51000 }
          ],
          style: {
            color: '#2962ff',
            lineWidth: 2,
            lineStyle: 'solid'
          }
        },
        metadata: {
          pattern: 'ascending_triangle',
          timeframe: '1h'
        },
        status: 'pending',
        createdAt: Date.now()
      };
      
      // Add proposal
      proposalStore.addProposal(proposal);
      
      // User approves proposal
      await proposalStore.approveProposal(proposal.id);
      
      // Verify approval
      const approved = proposalStore.proposals.find(p => p.id === proposal.id);
      expect(approved?.status).toBe('approved');
      
      // Verify drawing was added to chart
      const drawings = chartStore.getDrawings();
      expect(drawings.length).toBe(1);
      expect(drawings[0].type).toBe('trendline');
      
      // Add confirmation to chat
      chatStore.addMessage({
        id: 'confirm-1',
        role: 'assistant',
        content: 'Trendline has been added to your chart',
        timestamp: Date.now()
      });
    });

    it('should handle proposal rejection', async () => {
      const proposal: Proposal = {
        id: 'test-proposal-2',
        type: 'horizontal',
        confidence: 0.7,
        reasoning: 'Potential resistance level',
        drawing: {
          type: 'horizontal',
          points: [{ time: Date.now() / 1000, value: 52000 }],
          price: 52000,
          style: {
            color: '#ff5252',
            lineWidth: 2,
            lineStyle: 'dashed'
          }
        },
        status: 'pending',
        createdAt: Date.now()
      };
      
      // Add proposal
      proposalStore.addProposal(proposal);
      
      // User rejects proposal
      await proposalStore.rejectProposal(proposal.id, 'Not relevant to current strategy');
      
      // Verify rejection
      const rejected = proposalStore.proposals.find(p => p.id === proposal.id);
      expect(rejected?.status).toBe('rejected');
      expect(rejected?.rejectionReason).toBe('Not relevant to current strategy');
      
      // Verify no drawing was added
      expect(chartStore.getDrawings().length).toBe(0);
      
      // Add feedback to chat
      chatStore.addMessage({
        id: 'feedback-1',
        role: 'system',
        content: 'Proposal rejected: Not relevant to current strategy',
        timestamp: Date.now()
      });
    });
  });

  describe('Pattern Detection and Alerts', () => {
    it('should detect and alert on pattern formations', async () => {
      const symbol = 'BTCUSDT';
      
      // Create data that forms a pattern (head and shoulders)
      const patternData = [
        // Left shoulder
        ...Array.from({ length: 10 }, (_, i) => ({
          time: Date.now() / 1000 - 3000 + i * 60,
          open: 50000 + i * 50,
          high: 50050 + i * 50,
          low: 49950 + i * 50,
          close: 50000 + i * 50,
          volume: 100
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          time: Date.now() / 1000 - 2400 + i * 60,
          open: 50500 - i * 50,
          high: 50550 - i * 50,
          low: 50450 - i * 50,
          close: 50500 - i * 50,
          volume: 100
        })),
        // Head
        ...Array.from({ length: 10 }, (_, i) => ({
          time: Date.now() / 1000 - 1800 + i * 60,
          open: 50000 + i * 80,
          high: 50050 + i * 80,
          low: 49950 + i * 80,
          close: 50000 + i * 80,
          volume: 150
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          time: Date.now() / 1000 - 1200 + i * 60,
          open: 50800 - i * 80,
          high: 50850 - i * 80,
          low: 50750 - i * 80,
          close: 50800 - i * 80,
          volume: 150
        })),
        // Right shoulder
        ...Array.from({ length: 10 }, (_, i) => ({
          time: Date.now() / 1000 - 600 + i * 60,
          open: 50000 + i * 50,
          high: 50050 + i * 50,
          low: 49950 + i * 50,
          close: 50000 + i * 50,
          volume: 100
        }))
      ];
      
      // Add pattern data
      patternData.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // Run pattern detection
      const result = await mastra.run('tradingAgent', {
        messages: [{ role: 'system', content: 'Detect chart patterns' }],
        symbol,
        marketData: marketStore.klines[`${symbol}_1m`],
        detectPatterns: true
      });
      
      // Verify pattern was detected
      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);
      
      // Create alert for pattern
      const pattern = result.patterns[0];
      chatStore.addMessage({
        id: 'pattern-alert-1',
        role: 'assistant',
        content: `📊 Pattern Alert: ${pattern.type} pattern detected with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
        timestamp: Date.now(),
        metadata: {
          type: 'alert',
          pattern: pattern.type,
          confidence: pattern.confidence
        }
      });
      
      // Generate trading proposal based on pattern
      const patternProposal = await enhancedProposalGenerationTool.execute({
        marketData: marketStore.klines[`${symbol}_1m`],
        pattern,
        generateProposal: true
      });
      
      expect(patternProposal.proposals).toBeDefined();
      expect(patternProposal.proposals.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Agent Collaboration', () => {
    it('should coordinate multiple agents for comprehensive analysis', async () => {
      const symbol = 'BTCUSDT';
      
      // Add market data
      const klines = Array.from({ length: 100 }, (_, i) => ({
        time: Date.now() / 1000 - (100 - i) * 60,
        open: 50000 + Math.sin(i * 0.1) * 500,
        high: 50100 + Math.sin(i * 0.1) * 500,
        low: 49900 + Math.sin(i * 0.1) * 500,
        close: 50000 + Math.sin((i + 1) * 0.1) * 500,
        volume: 100 + Math.random() * 50
      }));
      
      klines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // User requests comprehensive analysis
      chatStore.addMessage({
        id: 'user-request-1',
        role: 'user',
        content: 'Provide comprehensive analysis including trend, support/resistance, and patterns',
        timestamp: Date.now()
      });
      
      // Orchestrator coordinates multiple agents
      const orchestratorResult = await mastra.run('orchestratorAgent', {
        request: 'comprehensive analysis',
        symbol,
        agents: ['tradingAgent', 'patternAgent', 'indicatorAgent']
      });
      
      // Verify multi-agent results
      expect(orchestratorResult.results).toBeDefined();
      expect(orchestratorResult.results.tradingAgent).toBeDefined();
      expect(orchestratorResult.results.patternAgent).toBeDefined();
      expect(orchestratorResult.results.indicatorAgent).toBeDefined();
      
      // Compile comprehensive response
      const comprehensiveAnalysis = `
## Market Analysis for ${symbol}

### Trend Analysis
${orchestratorResult.results.tradingAgent.analysis}

### Pattern Recognition
${orchestratorResult.results.patternAgent.patterns.map((p: any) => 
  `- ${p.type}: ${(p.confidence * 100).toFixed(0)}% confidence`
).join('\\n')}

### Technical Indicators
${orchestratorResult.results.indicatorAgent.indicators.map((i: any) => 
  `- ${i.name}: ${i.value.toFixed(2)} (${i.signal})`
).join('\\n')}

### Trading Proposals
${orchestratorResult.proposals.map((p: any, idx: number) => 
  `${idx + 1}. ${p.type} at ${p.price} (${(p.confidence * 100).toFixed(0)}% confidence)`
).join('\\n')}
      `.trim();
      
      // Add comprehensive analysis to chat
      chatStore.addMessage({
        id: 'analysis-comprehensive-1',
        role: 'assistant',
        content: comprehensiveAnalysis,
        timestamp: Date.now()
      });
      
      // Verify chat history
      const messages = chatStore.messages;
      expect(messages.length).toBeGreaterThan(1);
      expect(messages[messages.length - 1].content).toContain('Market Analysis');
    });
  });
});