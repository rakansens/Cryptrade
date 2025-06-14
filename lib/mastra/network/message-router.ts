import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/utils/logger';
import { generateCorrelationId } from '@/types/agent-payload';
import {
  type A2AMessage,
  type AgentNetworkConfig,
  type RegisteredAgent,
  type ProcessQueryParams,
  type AgentContext,
} from '@/types';
import { formatMessageForAgent } from './message-utils';

/**
 * Agent-to-Agent communication network handling message routing and delivery.
 */
export class AgentNetwork {
  private agents: Map<string, RegisteredAgent> = new Map();
  private messageQueue: A2AMessage[] = [];
  private config: AgentNetworkConfig;
  private routingAgent: Agent<unknown, unknown>;

  constructor(config: Partial<AgentNetworkConfig> = {}) {
    this.config = {
      maxHops: 5,
      timeout: 10000,
      enableLogging: true,
      enableMetrics: true,
      ...config,
    };

    this.routingAgent = new Agent({
      name: 'agent-router',
      model: openai('gpt-4o-mini'),
      instructions: `
You are an intelligent agent router for the Cryptrade AI system.

Your job is to analyze incoming requests and determine which specialized agent should handle them.

Available agent types:
- priceInquiryAgent: Real-time price data, market conditions, price alerts
- tradingAgent: Trading analysis, recommendations, risk assessment
- uiControlAgent: Chart operations, drawing tools, interface control
- orchestratorAgent: Complex multi-step workflows, agent coordination

Respond with ONLY the agent name that best matches the request.
If multiple agents are needed, choose the primary one.
If unclear, default to "orchestratorAgent".
      `,
    });

    logger.info('[AgentNetwork] Network initialized', {
      config: this.config,
    });
  }

  registerAgent(
    id: string,
    agent: Agent<unknown, unknown>,
    capabilities: string[],
    description: string
  ): void {
    const registration: RegisteredAgent = {
      id,
      agent,
      capabilities,
      description,
      isActive: true,
      lastSeen: new Date(),
      messageCount: 0,
    };

    this.agents.set(id, registration);

    logger.info('[AgentNetwork] Agent registered', {
      agentId: id,
      capabilities,
      description,
      totalAgents: this.agents.size,
    });
  }

  unregisterAgent(id: string): boolean {
    const removed = this.agents.delete(id);

    if (removed) {
      logger.info('[AgentNetwork] Agent unregistered', {
        agentId: id,
        remainingAgents: this.agents.size,
      });
    }

    return removed;
  }

  async selectAgent(query: string, context?: AgentContext): Promise<string | null> {
    try {
      const availableAgents = Array.from(this.agents.values())
        .filter(a => a.isActive)
        .map(a => `${a.id}: ${a.description}`)
        .join('\n');

      const prompt = `
You are an intelligent agent router. Analyze the user query and select the EXACT agent ID.

Query: "${query}"
${context ? `Context: ${JSON.stringify(context)}` : ''}

Available agents:
${availableAgents}

RULES:
- If query mentions PRICE, COST, VALUE, RATE → return "priceInquiryAgent"
- If query mentions CHART, DRAW, DISPLAY, UI, SWITCH → return "uiControlAgent"
- If query mentions ANALYSIS, TRADE, INVESTMENT, STRATEGY → return "tradingAnalysisAgent"
- If query is greeting, help, unclear → return "orchestratorAgent"

Respond with ONLY the agent ID, no explanation:`;

      const response = await this.routingAgent.generate(prompt);

      let selectedAgent: string;
      if (typeof response === 'object' && response !== null) {
        selectedAgent = (response as { text?: string }).text || String(response);
      } else {
        selectedAgent = String(response);
      }

      selectedAgent = selectedAgent.trim().replace(/[^\w]/g, '');

      if (this.agents.has(selectedAgent)) {
        logger.debug('[AgentNetwork] Agent selected directly', {
          query,
          selectedAgent,
          responseRaw: String(response),
        });
        return selectedAgent;
      }

      const queryLower = query.toLowerCase();
      let fallbackAgent = 'orchestratorAgent';

      if (
        queryLower.includes('価格') ||
        queryLower.includes('price') ||
        queryLower.includes('btc') ||
        queryLower.includes('eth') ||
        queryLower.includes('cost') ||
        queryLower.includes('value')
      ) {
        fallbackAgent = 'priceInquiryAgent';
      } else if (
        queryLower.includes('チャート') ||
        queryLower.includes('chart') ||
        queryLower.includes('描画') ||
        queryLower.includes('draw') ||
        queryLower.includes('表示') ||
        queryLower.includes('display')
      ) {
        fallbackAgent = 'uiControlAgent';
      } else if (
        queryLower.includes('分析') ||
        queryLower.includes('analysis') ||
        queryLower.includes('取引') ||
        queryLower.includes('trading') ||
        queryLower.includes('投資') ||
        queryLower.includes('investment')
      ) {
        fallbackAgent = 'tradingAnalysisAgent';
      }

      if (this.agents.has(fallbackAgent)) {
        logger.info('[AgentNetwork] Using pattern-based fallback selection', {
          query,
          selectedAgent: fallbackAgent,
          originalResponse: String(response),
          patterns: queryLower.split(' ').slice(0, 3),
        });
        return fallbackAgent;
      }

      logger.warn('[AgentNetwork] Using final fallback to orchestrator', {
        query,
        invalidSelection: selectedAgent,
        responseRaw: String(response),
      });
      return 'orchestratorAgent';
    } catch (error) {
      logger.error('[AgentNetwork] Agent selection failed completely', {
        error: String(error),
        query,
      });

      const queryLower = query.toLowerCase();
      if (queryLower.includes('price') || queryLower.includes('btc')) {
        return 'priceInquiryAgent';
      }
      return 'orchestratorAgent';
    }
  }

  async sendMessage(
    sourceId: string,
    targetId: string,
    method: string,
    params?: Record<string, unknown>,
    correlationId?: string
  ): Promise<A2AMessage | null> {
    const target = this.agents.get(targetId);
    if (!target || !target.isActive) {
      logger.error('[AgentNetwork] Target agent not found or inactive', {
        sourceId,
        targetId,
        method,
      });
      return null;
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const message: A2AMessage = {
      id: messageId,
      type: 'request',
      source: sourceId,
      target: targetId,
      method,
      params,
      timestamp: Date.now(),
      correlationId: correlationId || generateCorrelationId(),
    };

    try {
      const startTime = Date.now();
      const prompt = formatMessageForAgent(message);

      const messages = [
        {
          role: 'user' as const,
          content: prompt,
        },
      ];

      const agentContext = (message.params as ProcessQueryParams | undefined)?.context || {};

      const generateOptions: Record<string, unknown> = {
        maxSteps: 5,
        ...agentContext,
      };

      if (targetId === 'priceInquiryAgent' && message.method === 'process_query') {
        generateOptions.toolChoice = 'required';
      }

      if (targetId === 'tradingAnalysisAgent' && (agentContext as AgentContext).isProposalMode) {
        generateOptions.toolChoice = 'required';
        logger.info('[AgentNetwork] Forcing tool usage for proposal mode', {
          targetId,
          isProposalMode: true,
          proposalType: (agentContext as AgentContext).proposalType,
          isEntryProposal: (agentContext as AgentContext).isEntryProposal,
          extractedSymbol: (agentContext as AgentContext).extractedSymbol,
        });
      }

      const response = await target.agent.generate(messages, generateOptions);

      logger.debug('[AgentNetwork] Agent response structure', {
        targetId,
        hasText: 'text' in response,
        hasToolCalls: 'toolCalls' in response,
        hasToolResults: 'toolResults' in response,
        hasSteps: 'steps' in response,
        responseKeys: Object.keys(response),
      });

      let toolExecutionData: unknown = null;
      let hasToolExecution = false;

      if ('steps' in response && Array.isArray(response.steps)) {
        response.steps.forEach((step: { toolResults?: Array<{ toolName: string; result: unknown }> }, index: number) => {
          if (step.toolResults && step.toolResults.length > 0) {
            hasToolExecution = true;
            logger.info('[AgentNetwork] Tool execution detected', {
              stepIndex: index,
              toolResults: step.toolResults.map((tr: { toolName: string; result: unknown }) => ({
                toolName: tr.toolName,
                result: tr.result,
              })),
            });

            const marketDataResult = step.toolResults.find((tr: { toolName: string; result: unknown }) =>
              tr.toolName === 'marketDataResilientTool' ||
              tr.toolName === 'get-market-data-resilient'
            );

            if (marketDataResult) {
              toolExecutionData = marketDataResult.result;
              logger.info('[AgentNetwork] Market data extracted', {
                symbol: (toolExecutionData as { symbol?: string })?.symbol,
                currentPrice: (toolExecutionData as { currentPrice?: number })?.currentPrice,
                priceChangePercent24h: (toolExecutionData as { priceChangePercent24h?: number })?.priceChangePercent24h,
              });
            }

            const proposalResult = step.toolResults.find((tr: { toolName: string; result: unknown }) =>
              tr.toolName === 'proposalGeneration' ||
              tr.toolName === 'proposalGenerationTool' ||
              tr.toolName === 'proposal-generation'
            );

            if (proposalResult) {
              toolExecutionData = proposalResult.result;
              logger.info('[AgentNetwork] Proposal generation result extracted', {
                success: (toolExecutionData as { success?: boolean })?.success,
                proposalGroup: (toolExecutionData as { proposalGroup?: unknown })?.proposalGroup,
                proposalCount: (toolExecutionData as { proposalGroup?: { proposals?: unknown[] } })?.proposalGroup?.proposals?.length,
              });
            }

            const entryProposalResult = step.toolResults.find((tr: { toolName: string; result: unknown }) =>
              tr.toolName === 'entryProposalGeneration' ||
              tr.toolName === 'entryProposalGenerationTool' ||
              tr.toolName === 'entry-proposal-generation'
            );

            if (entryProposalResult) {
              toolExecutionData = entryProposalResult.result;
              logger.info('[AgentNetwork] Entry proposal generation result extracted', {
                success: (toolExecutionData as { success?: boolean })?.success,
                proposalGroup: (toolExecutionData as { proposalGroup?: unknown })?.proposalGroup,
                proposalCount: (toolExecutionData as { proposalGroup?: { proposals?: unknown[] } })?.proposalGroup?.proposals?.length,
              });
            }
          }
        });
      }

      let responseText = typeof response === 'object' && response !== null && 'text' in response
        ? (response as { text?: string }).text
        : String(response);

      if (targetId === 'priceInquiryAgent' && hasToolExecution && toolExecutionData) {
        const { symbol, currentPrice, priceChangePercent24h } = toolExecutionData as {
          symbol?: string;
          currentPrice?: number;
          priceChangePercent24h?: number;
        };
        if (currentPrice) {
          const currencyName = symbol ? symbol.replace('USDT', '') : 'BTC';
          const formattedPrice = currentPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const changePrefix = priceChangePercent24h >= 0 ? '+' : '';
          responseText = `${currencyName}の現在価格は $${formattedPrice} です。24時間変化率は ${changePrefix}${priceChangePercent24h}% です。`;
          logger.info('[AgentNetwork] Generated price response from tool data', {
            originalText: (response as { text?: string }).text,
            generatedText: responseText,
            toolData: { symbol, currentPrice, priceChangePercent24h },
          });
        }
      }

      let extractedProposalGroup = null;
      if (
        targetId === 'tradingAnalysisAgent' &&
        hasToolExecution &&
        (toolExecutionData as { proposalGroup?: { proposals?: unknown[]; id: string } })?.proposalGroup
      ) {
        const proposalCount = (toolExecutionData as { proposalGroup: { proposals?: unknown[] } }).proposalGroup.proposals?.length || 0;
        extractedProposalGroup = (toolExecutionData as { proposalGroup: unknown }).proposalGroup;
        responseText = (response as { text?: string }).text || `${proposalCount}個の提案を生成しました。`;
        logger.info('[AgentNetwork] Generated proposal response from tool data', {
          originalText: (response as { text?: string }).text,
          proposalCount,
          proposalGroupId: (toolExecutionData as { proposalGroup: { id: string } }).proposalGroup.id,
          isEmpty: proposalCount === 0,
        });
      }

      const executionTime = Date.now() - startTime;
      target.lastSeen = new Date();
      target.messageCount++;

      const responseMessage: A2AMessage = {
        id: `resp-${messageId}`,
        type: 'response',
        source: targetId,
        target: sourceId,
        result: responseText,
        timestamp: Date.now(),
        correlationId: message.correlationId,
        ...(response as { steps?: unknown[] }).steps && { steps: (response as { steps?: unknown[] }).steps },
        ...(response as { toolResults?: unknown[] }).toolResults && {
          toolResults: (response as { toolResults?: unknown[] }).toolResults,
        },
        ...(extractedProposalGroup && { proposalGroup: extractedProposalGroup }),
      };

      if (this.config.enableLogging) {
        logger.info('[AgentNetwork] Message processed', {
          messageId,
          sourceId,
          targetId,
          method,
          executionTime,
          correlationId: message.correlationId,
        });
      }

      return responseMessage;
    } catch (error) {
      logger.error('[AgentNetwork] Message processing failed', {
        messageId,
        sourceId,
        targetId,
        method,
        error: String(error),
      });

      const errorMessage: A2AMessage = {
        id: `err-${messageId}`,
        type: 'error',
        source: targetId,
        target: sourceId,
        error: {
          code: -32603,
          message: 'Agent execution failed',
          data: { originalError: String(error) },
        },
        timestamp: Date.now(),
        correlationId: message.correlationId,
      };

      return errorMessage;
    }
  }

  async broadcastMessage(
    sourceId: string,
    method: string,
    params?: Record<string, unknown>,
    targetFilter?: (agent: RegisteredAgent) => boolean
  ): Promise<A2AMessage[]> {
    const targets = Array.from(this.agents.values())
      .filter(a => a.isActive && a.id !== sourceId)
      .filter(targetFilter || (() => true));

    const responses: A2AMessage[] = [];
    const promises = targets.map(target => this.sendMessage(sourceId, target.id, method, params));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        responses.push(result.value);
      } else {
        logger.warn('[AgentNetwork] Broadcast message failed', {
          sourceId,
          targetId: targets[index].id,
          method,
          error: result.status === 'rejected' ? String(result.reason) : 'No response',
        });
      }
    });

    logger.info('[AgentNetwork] Broadcast completed', {
      sourceId,
      method,
      targetCount: targets.length,
      successCount: responses.length,
    });

    return responses;
  }

  async routeMessage(
    sourceId: string,
    query: string,
    context?: AgentContext
  ): Promise<A2AMessage | null> {
    const targetId = await this.selectAgent(query, context);
    if (!targetId) {
      logger.error('[AgentNetwork] No suitable agent found', {
        sourceId,
        query,
      });
      return null;
    }

    return this.sendMessage(sourceId, targetId, 'process_query', {
      query,
      context,
    });
  }

  getNetworkStats() {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter(a => a.isActive);
    const totalMessages = agents.reduce((sum, a) => sum + a.messageCount, 0);

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      totalMessages,
      queueSize: this.messageQueue.length,
      averageMessages: totalMessages / Math.max(agents.length, 1),
      lastActivity: Math.max(...agents.map(a => a.lastSeen.getTime())),
    };
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [id] of this.agents) {
      try {
        const response = await this.sendMessage('system', id, 'health_check', {}, `health-${id}-${Date.now()}`);
        results[id] = response?.type !== 'error';
      } catch {
        results[id] = false;
      }
    }

    logger.info('[AgentNetwork] Health check completed', {
      results,
      healthy: Object.values(results).filter(Boolean).length,
      total: Object.keys(results).length,
    });

    return results;
  }
}

export const agentNetwork = new AgentNetwork({
  maxHops: 5,
  timeout: 10000,
  enableLogging: true,
  enableMetrics: true,
});

export function registerCryptradeAgent(
  id: string,
  agent: Agent<unknown, unknown>,
  capabilities: string[],
  description: string
): void {
  agentNetwork.registerAgent(id, agent, capabilities, description);
}

export async function sendAgentMessage(
  sourceId: string,
  targetId: string,
  method: string,
  params?: ProcessQueryParams | Record<string, unknown>
): Promise<A2AMessage | null> {
  return agentNetwork.sendMessage(sourceId, targetId, method, params);
}

export async function routeToAgent(
  sourceId: string,
  query: string,
  context?: AgentContext
): Promise<A2AMessage | null> {
  return agentNetwork.routeMessage(sourceId, query, context);
}
