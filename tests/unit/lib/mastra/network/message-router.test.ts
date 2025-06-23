import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { A2AMessage, RegisteredAgent } from '@/types';

// Mock dependencies
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mocked-model'),
}));
jest.mock('@/lib/utils/logger');
jest.mock('@/types/agent-payload', () => ({
  generateCorrelationId: jest.fn(() => 'test-correlation-123'),
}));

// Mock the Agent class - we'll configure behavior in beforeEach
jest.mock('@mastra/core', () => {
  return {
    Agent: jest.fn(),
  };
});

// Import after mocks are set up
import { AgentNetwork, agentNetwork, sendAgentMessage, routeToAgent } from '@/lib/mastra/network/message-router';
import { Agent } from '@mastra/core';
import { logger } from '@/lib/utils/logger';

// Get the mocked constructor
const MockedAgent = Agent as jest.MockedClass<typeof Agent>;

describe('Agent Network Message Router', () => {
  let network: AgentNetwork;
  let mockAgent: jest.Mocked<Agent>;
  let mockRoutingAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the Agent mock implementation
    MockedAgent.mockImplementation((config: any) => {
      const agent = {
        name: config.name,
        model: config.model,
        generate: jest.fn(),
      };
      
      // Capture routing agent for later use in tests
      if (config.name === 'agent-router') {
        mockRoutingAgent = agent;
      }
      
      return agent as any;
    });
    
    // Create a new network instance for each test
    network = new AgentNetwork({
      maxHops: 5,
      timeout: 1000,
      enableLogging: true,
      enableMetrics: true,
    });

    // Create mock agent
    mockAgent = {
      generate: jest.fn(),
      name: 'test-agent',
      model: 'test-model',
    } as any;
  });

  describe('Agent Registration', () => {
    it('should register agents successfully', () => {
      network.registerAgent('testAgent', mockAgent, ['price', 'analysis'], 'Test agent');
      
      const stats = network.getNetworkStats();
      expect(stats.totalAgents).toBe(1);
      expect(stats.activeAgents).toBe(1);
    });

    it('should unregister agents successfully', () => {
      network.registerAgent('testAgent', mockAgent, ['price'], 'Test agent');
      const removed = network.unregisterAgent('testAgent');
      
      expect(removed).toBe(true);
      const stats = network.getNetworkStats();
      expect(stats.totalAgents).toBe(0);
    });

    it('should handle duplicate registrations', () => {
      network.registerAgent('agent1', mockAgent, ['price'], 'Agent 1');
      network.registerAgent('agent1', mockAgent, ['analysis'], 'Agent 1 Updated');
      
      const stats = network.getNetworkStats();
      expect(stats.totalAgents).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Agent registered'),
        expect.objectContaining({ agentId: 'agent1' })
      );
    });
  });

  describe('Agent Selection', () => {
    beforeEach(() => {
      // Register test agents
      network.registerAgent('priceInquiryAgent', mockAgent, ['price'], 'Price inquiry agent');
      network.registerAgent('tradingAnalysisAgent', mockAgent, ['analysis'], 'Trading analysis agent');
      network.registerAgent('uiControlAgent', mockAgent, ['ui'], 'UI control agent');
      network.registerAgent('orchestratorAgent', mockAgent, ['general'], 'Orchestrator agent');
    });

    it('should select price inquiry agent for price queries', async () => {
      mockRoutingAgent.generate.mockResolvedValue({ text: 'priceInquiryAgent' });
      
      const selected = await network.selectAgent('BTCの価格は？');
      expect(selected).toBe('priceInquiryAgent');
    });

    it('should select UI control agent for chart queries', async () => {
      mockRoutingAgent.generate.mockResolvedValue({ text: 'uiControlAgent' });
      
      const selected = await network.selectAgent('チャートにトレンドラインを描画');
      expect(selected).toBe('uiControlAgent');
    });

    it('should fallback to pattern matching when AI selection fails', async () => {
      mockRoutingAgent.generate.mockResolvedValue({ text: 'invalidAgent' });
      
      const selected = await network.selectAgent('BTCの価格を教えて');
      expect(selected).toBe('priceInquiryAgent');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using pattern-based fallback'),
        expect.any(Object)
      );
    });

    it('should default to orchestrator for unclear queries', async () => {
      mockRoutingAgent.generate.mockRejectedValue(new Error('AI error'));
      
      const selected = await network.selectAgent('こんにちは');
      expect(selected).toBe('orchestratorAgent');
    });

    it('should handle complex context in selection', async () => {
      mockRoutingAgent.generate.mockResolvedValue({ text: 'tradingAnalysisAgent' });
      
      const context = {
        previousIntent: 'price_inquiry',
        symbols: ['BTC', 'ETH'],
        isProposalMode: true,
      };
      
      const selected = await network.selectAgent('詳細な分析をお願いします', context);
      expect(selected).toBe('tradingAnalysisAgent');
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      network.registerAgent('targetAgent', mockAgent, ['test'], 'Target agent');
    });

    it('should send messages successfully', async () => {
      mockAgent.generate.mockResolvedValue({
        text: 'Response from agent',
        steps: [],
      });
      
      const message = await network.sendMessage(
        'sourceAgent',
        'targetAgent',
        'process_query',
        { query: 'Test query' },
        'test-correlation'
      );
      
      expect(message).toBeDefined();
      expect(message?.type).toBe('response');
      expect(message?.result).toBe('Response from agent');
      expect(message?.correlationId).toBe('test-correlation');
    });

    it('should handle tool execution results', async () => {
      // Register priceInquiryAgent for this test
      const priceAgent = {
        generate: jest.fn().mockResolvedValue({
          text: 'Price fetched',
          steps: [{
            toolResults: [{
              toolName: 'marketDataResilientTool',
              result: {
                symbol: 'BTCUSDT',
                currentPrice: 45000,
                priceChangePercent24h: 2.5,
              },
            }],
          }],
        }),
        name: 'priceInquiryAgent',
        model: 'test-model',
      } as any;
      
      network.registerAgent('priceInquiryAgent', priceAgent, ['price'], 'Price agent');
      
      const message = await network.sendMessage(
        'source',
        'priceInquiryAgent',
        'process_query',
        { query: 'BTCの価格' }
      );
      
      expect(message?.result).toContain('BTCの現在価格は $45,000.00 です');
      expect(message?.result).toContain('+2.5%');
    });

    it('should handle proposal generation results', async () => {
      // Register tradingAnalysisAgent for this test
      const tradingAgent = {
        generate: jest.fn().mockResolvedValue({
          text: 'Proposals generated',
          steps: [{
            toolResults: [{
              toolName: 'proposalGenerationTool',
              result: {
                proposalGroup: {
                  id: 'pg-123',
                  proposals: [{ id: '1' }, { id: '2' }],
                },
              },
            }],
          }],
        }),
        name: 'tradingAnalysisAgent',
        model: 'test-model',
      } as any;
      
      network.registerAgent('tradingAnalysisAgent', tradingAgent, ['analysis'], 'Trading agent');
      
      const message = await network.sendMessage(
        'source',
        'tradingAnalysisAgent',
        'process_query',
        { query: '提案を生成' }
      );
      
      expect(message?.proposalGroup).toBeDefined();
      expect((message as any).proposalGroup.id).toBe('pg-123');
    });

    it('should handle agent execution errors', async () => {
      mockAgent.generate.mockRejectedValue(new Error('Agent crashed'));
      
      const message = await network.sendMessage(
        'source',
        'targetAgent',
        'process_query',
        { query: 'Error test' }
      );
      
      expect(message?.type).toBe('error');
      expect(message?.error).toBeDefined();
      expect(message?.error?.message).toBe('Agent execution failed');
    });

    it('should handle missing or inactive agents', async () => {
      const message = await network.sendMessage(
        'source',
        'nonExistentAgent',
        'process_query',
        { query: 'Test' }
      );
      
      expect(message).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Target agent not found'),
        expect.any(Object)
      );
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(() => {
      network.registerAgent('agent1', mockAgent, ['price'], 'Agent 1');
      network.registerAgent('agent2', mockAgent, ['analysis'], 'Agent 2');
      network.registerAgent('agent3', mockAgent, ['ui'], 'Agent 3');
      
      mockAgent.generate.mockResolvedValue({ text: 'Broadcast response' });
    });

    it('should broadcast to all active agents', async () => {
      const responses = await network.broadcastMessage(
        'broadcaster',
        'announce',
        { message: 'System update' }
      );
      
      expect(responses).toHaveLength(3);
      expect(mockAgent.generate).toHaveBeenCalledTimes(3);
    });

    it('should filter broadcast targets', async () => {
      const responses = await network.broadcastMessage(
        'broadcaster',
        'price_update',
        { price: 45000 },
        (agent) => agent.capabilities.includes('price')
      );
      
      expect(responses).toHaveLength(1);
      expect(mockAgent.generate).toHaveBeenCalledTimes(1);
    });

    it('should handle partial broadcast failures', async () => {
      // Create separate agents with different behaviors
      const agent1Mock = {
        generate: jest.fn().mockResolvedValue({ text: 'Response 1' }),
        name: 'agent1',
        model: 'test-model',
      } as any;
      
      const agent2Mock = {
        generate: jest.fn().mockRejectedValue(new Error('Agent 2 failed')),
        name: 'agent2',
        model: 'test-model',
      } as any;
      
      const agent3Mock = {
        generate: jest.fn().mockResolvedValue({ text: 'Response 3' }),
        name: 'agent3', 
        model: 'test-model',
      } as any;
      
      // Re-register agents with specific behaviors
      network.unregisterAgent('agent1');
      network.unregisterAgent('agent2');
      network.unregisterAgent('agent3');
      
      network.registerAgent('agent1', agent1Mock, ['price'], 'Agent 1');
      network.registerAgent('agent2', agent2Mock, ['analysis'], 'Agent 2');
      network.registerAgent('agent3', agent3Mock, ['ui'], 'Agent 3');
      
      const responses = await network.broadcastMessage(
        'broadcaster',
        'test',
        {}
      );
      
      // Check that we have 3 responses total (2 successful, 1 error)
      expect(responses).toHaveLength(3);
      
      // Check that we have 2 successful responses and 1 error response
      const successfulResponses = responses.filter(r => r.type === 'response');
      const errorResponses = responses.filter(r => r.type === 'error');
      
      expect(successfulResponses).toHaveLength(2);
      expect(errorResponses).toHaveLength(1);
      
      // Verify the error response is from agent2
      expect(errorResponses[0]?.source).toBe('agent2');
      expect(errorResponses[0]?.error?.message).toBe('Agent execution failed');
      
      // Verify logger.error was called for the failed agent execution
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[AgentNetwork] Message processing failed'),
        expect.objectContaining({
          targetId: 'agent2',
          method: 'test',
        })
      );
    });
  });

  describe('Message Routing', () => {
    beforeEach(() => {
      network.registerAgent('priceInquiryAgent', mockAgent, ['price'], 'Price agent');
      network.registerAgent('orchestratorAgent', mockAgent, ['general'], 'Orchestrator');
    });

    it('should route messages to appropriate agents', async () => {
      // Mock routing agent to select priceInquiryAgent
      mockRoutingAgent.generate.mockResolvedValue({ text: 'priceInquiryAgent' });
      // Mock the actual agent execution
      mockAgent.generate.mockResolvedValue({ text: 'Price is $45,000' });
      
      const result = await network.routeMessage(
        'router',
        'What is BTC price?',
        { symbols: ['BTC'] }
      );
      
      expect(result).toBeDefined();
      expect(result?.result).toContain('45,000');
    });

    it('should handle routing failures', async () => {
      mockRoutingAgent.generate.mockRejectedValue(new Error('Routing failed'));
      
      const result = await network.routeMessage(
        'router',
        'Test query',
        {}
      );
      
      expect(result?.type).toBe('error');
    });
  });

  describe('Network Statistics', () => {
    it('should track network statistics correctly', async () => {
      network.registerAgent('agent1', mockAgent, ['test'], 'Agent 1');
      network.registerAgent('agent2', mockAgent, ['test'], 'Agent 2');
      
      mockAgent.generate.mockResolvedValue({ text: 'Response' });
      
      await network.sendMessage('source', 'agent1', 'test', {});
      await network.sendMessage('source', 'agent2', 'test', {});
      await network.sendMessage('source', 'agent1', 'test', {});
      
      const stats = network.getNetworkStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.activeAgents).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.averageMessages).toBe(1.5);
    });
  });

  describe('Health Check', () => {
    it('should perform health checks on all agents', async () => {
      // Create separate mock agents for healthy and unhealthy
      const healthyMockAgent = {
        generate: jest.fn().mockResolvedValue({ text: 'OK' }),
        name: 'healthyAgent',
        model: 'test-model',
      } as any;
      
      const unhealthyMockAgent = {
        generate: jest.fn().mockRejectedValue(new Error('Agent unhealthy')),
        name: 'unhealthyAgent',
        model: 'test-model',
      } as any;
      
      network.registerAgent('healthyAgent', healthyMockAgent, ['test'], 'Healthy');
      network.registerAgent('unhealthyAgent', unhealthyMockAgent, ['test'], 'Unhealthy');
      
      const health = await network.healthCheck();
      
      expect(health.healthyAgent).toBe(true);
      expect(health.unhealthyAgent).toBe(false);
    });
  });

  describe('Global Functions', () => {
    it('should use singleton network instance', async () => {
      const mockAgentGlobal = {
        generate: jest.fn().mockResolvedValue({ text: 'Global response' }),
      } as any;
      
      agentNetwork.registerAgent('globalAgent', mockAgentGlobal, ['test'], 'Global');
      
      const message = await sendAgentMessage(
        'source',
        'globalAgent',
        'test',
        { data: 'test' }
      );
      
      expect(message).toBeDefined();
      expect(message?.result).toBe('Global response');
    });

    it('should route through global instance', async () => {
      const mockAgentGlobal = {
        generate: jest.fn().mockImplementation(() => 
          Promise.resolve({ text: 'Routed response' })
        ),
      } as any;
      
      agentNetwork.registerAgent('routeTarget', mockAgentGlobal, ['test'], 'Target');
      
      const message = await routeToAgent(
        'source',
        'Test query',
        { intent: 'test' }
      );
      
      expect(message).toBeDefined();
    });
  });
});