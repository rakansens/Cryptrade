import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { generateCorrelationId } from '@/types/agent-payload';

/**
 * Agent-to-Agent (A2A) Communication System
 * 
 * Mastra v2の新機能を活用したエージェント間通信
 * - Google A2A標準準拠
 * - JSON-RPC 2.0ベース
 * - LLMベースのルーティング
 * - 動的エージェント選択
 */

// A2A Message Schema (Google A2A Standard)
const A2AMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'response', 'notification', 'error']),
  source: z.string(), // Source agent ID
  target: z.string().optional(), // Target agent ID (optional for broadcast)
  method: z.string().optional(), // JSON-RPC method
  params: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  timestamp: z.number(),
  correlationId: z.string().optional(),
  // Extended fields for agent execution results
  steps: z.array(z.unknown()).optional(), // Steps with tool execution details
  toolResults: z.array(z.unknown()).optional(), // Direct tool results
  proposalGroup: z.unknown().optional(), // Proposal group data
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// Agent Network Configuration
interface AgentNetworkConfig {
  maxHops: number; // Maximum message routing hops
  timeout: number; // Message timeout in ms
  enableLogging: boolean;
  enableMetrics: boolean;
}

// Agent Registration Info
interface RegisteredAgent {
  id: string;
  agent: Agent<unknown, unknown>;
  capabilities: string[];
  description: string;
  isActive: boolean;
  lastSeen: Date;
  messageCount: number;
}

// Transmission Tool for Agent Selection
const transmitToolSchema = z.object({
  targetAgent: z.string(),
  message: z.string(),
  params: z.record(z.unknown()).optional(),
  broadcast: z.boolean().optional().default(false),
});

export class AgentNetwork {
  private agents: Map<string, RegisteredAgent> = new Map();
  private messageQueue: A2AMessage[] = [];
  private config: AgentNetworkConfig;
  private routingAgent: Agent<unknown, unknown>;

  constructor(config: Partial<AgentNetworkConfig> = {}) {
    this.config = {
      maxHops: 5,
      timeout: 10000, // Reduced from 30s to 10s for better performance
      enableLogging: true,
      enableMetrics: true,
      ...config,
    };

    // Create LLM-based routing agent
    this.routingAgent = new Agent({
      name: 'agent-router',
      model: openai('gpt-4o-mini'), // Fast and cost-effective
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

Examples:
"What's the BTC price?" → "priceInquiryAgent"
"Analyze ETHUSDT for trading" → "tradingAgent"  
"Draw a trendline on the chart" → "uiControlAgent"
"Complex analysis with multiple steps" → "orchestratorAgent"
      `,
    });

    logger.info('[AgentNetwork] Network initialized', {
      config: this.config,
    });
  }

  /**
   * Register an agent in the network
   */
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

  /**
   * Unregister an agent
   */
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

  /**
   * Intelligent agent selection using LLM router
   */
  async selectAgent(query: string, context?: Record<string, unknown>): Promise<string | null> {
    try {
      const availableAgents = Array.from(this.agents.values())
        .filter(a => a.isActive)
        .map(a => `${a.id}: ${a.description}`)
        .join('\n');

      // より具体的でルール化されたプロンプト
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
      
      // レスポンスの解析を改善
      let selectedAgent: string;
      
      if (typeof response === 'object' && response !== null) {
        // AI SDKのレスポンスオブジェクトの場合
        selectedAgent = (response as { text?: string }).text || String(response);
      } else {
        selectedAgent = String(response);
      }
      
      // クリーンアップと検証
      selectedAgent = selectedAgent.trim().replace(/[^\w]/g, '');
      
      // 直接マッチングを試行
      if (this.agents.has(selectedAgent)) {
        logger.debug('[AgentNetwork] Agent selected directly', {
          query,
          selectedAgent,
          responseRaw: String(response),
        });
        return selectedAgent;
      }

      // パターンマッチングによるフォールバック選択
      const queryLower = query.toLowerCase();
      let fallbackAgent = 'orchestratorAgent';
      
      if (queryLower.includes('価格') || queryLower.includes('price') || 
          queryLower.includes('btc') || queryLower.includes('eth') ||
          queryLower.includes('cost') || queryLower.includes('value')) {
        fallbackAgent = 'priceInquiryAgent';
      } else if (queryLower.includes('チャート') || queryLower.includes('chart') ||
                 queryLower.includes('描画') || queryLower.includes('draw') ||
                 queryLower.includes('表示') || queryLower.includes('display')) {
        fallbackAgent = 'uiControlAgent';
      } else if (queryLower.includes('分析') || queryLower.includes('analysis') ||
                 queryLower.includes('取引') || queryLower.includes('trading') ||
                 queryLower.includes('投資') || queryLower.includes('investment')) {
        fallbackAgent = 'tradingAnalysisAgent';
      }

      // フォールバックエージェントが存在するか確認
      if (this.agents.has(fallbackAgent)) {
        logger.info('[AgentNetwork] Using pattern-based fallback selection', {
          query,
          selectedAgent: fallbackAgent,
          originalResponse: String(response),
          patterns: queryLower.split(' ').slice(0, 3),
        });
        return fallbackAgent;
      }

      // 最終フォールバック
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
      
      // エラー時は最小限のパターンマッチング
      const queryLower = query.toLowerCase();
      if (queryLower.includes('price') || queryLower.includes('btc')) {
        return 'priceInquiryAgent';
      }
      return 'orchestratorAgent';
    }
  }

  /**
   * Send message to specific agent
   */
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
      // Execute on target agent
      const startTime = Date.now();
      const prompt = this.formatMessageForAgent(message);
      
      // Mastraのエージェントはメッセージ配列を期待する
      const messages = [
        {
          role: 'user' as const,
          content: prompt
        }
      ];
      
      // コンテキストをエージェントに渡す（dynamic instructionsで使用される）
      const agentContext = message.params?.context || {};
      
      // デバッグ: エントリー提案のコンテキストをログ出力
      if (agentContext.proposalType === 'entry' || agentContext.isEntryProposal) {
        logger.info('[AgentNetwork] Entry proposal context detected', {
          targetId,
          proposalType: agentContext.proposalType,
          isEntryProposal: agentContext.isEntryProposal,
          isProposalMode: agentContext.isProposalMode,
          contextKeys: Object.keys(agentContext),
        });
      }
      
      // generate()メソッドを正しく呼び出す（ツール使用を明示的に有効化）
      const generateOptions: Record<string, unknown> = {
        maxSteps: 5,  // ツールを使用できるように複数ステップを許可
        // MastraのcontextはgenerateOptionsに含める
        ...agentContext,
      };
      
      // 価格照会エージェントの場合、ツール使用を強制
      if (targetId === 'priceInquiryAgent' && message.method === 'process_query') {
        generateOptions.toolChoice = 'required'; // ツール使用を必須にする
      }
      
      // 提案モードの場合もツール使用を強制
      if (targetId === 'tradingAnalysisAgent' && agentContext.isProposalMode) {
        generateOptions.toolChoice = 'required'; // ツール使用を必須にする
        logger.info('[AgentNetwork] Forcing tool usage for proposal mode', {
          targetId,
          isProposalMode: true,
          proposalType: agentContext.proposalType,
          isEntryProposal: agentContext.isEntryProposal,
          extractedSymbol: agentContext.extractedSymbol,
        });
      }
      
      const response = await target.agent.generate(messages, generateOptions);
      
      // デバッグ: レスポンス構造を確認
      logger.debug('[AgentNetwork] Agent response structure', {
        targetId,
        hasText: 'text' in response,
        hasToolCalls: 'toolCalls' in response,
        hasToolResults: 'toolResults' in response,
        hasSteps: 'steps' in response,
        responseKeys: Object.keys(response),
      });
      
      // ツール実行結果をログと解析
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
                result: tr.result
              }))
            });
            
            // marketDataResilientToolの結果を抽出
            const marketDataResult = step.toolResults.find((tr: { toolName: string; result: unknown }) => 
              tr.toolName === 'marketDataResilientTool' || 
              tr.toolName === 'get-market-data-resilient'
            );
            
            if (marketDataResult) {
              toolExecutionData = marketDataResult.result;
              logger.info('[AgentNetwork] Market data extracted', {
                symbol: toolExecutionData?.symbol,
                currentPrice: toolExecutionData?.currentPrice,
                priceChangePercent24h: toolExecutionData?.priceChangePercent24h,
              });
            }
            
            // proposalGenerationToolの結果を抽出
            const proposalResult = step.toolResults.find((tr: { toolName: string; result: unknown }) => 
              tr.toolName === 'proposalGeneration' || // This is the actual registered name
              tr.toolName === 'proposalGenerationTool' || 
              tr.toolName === 'proposal-generation'
            );
            
            if (proposalResult) {
              toolExecutionData = proposalResult.result;
              logger.info('[AgentNetwork] Proposal generation result extracted', {
                success: toolExecutionData?.success,
                proposalGroup: toolExecutionData?.proposalGroup,
                proposalCount: toolExecutionData?.proposalGroup?.proposals?.length,
              });
            }
            
            // entryProposalGenerationToolの結果を抽出
            const entryProposalResult = step.toolResults.find((tr: { toolName: string; result: unknown }) => 
              tr.toolName === 'entryProposalGeneration' || // This is the actual registered name
              tr.toolName === 'entryProposalGenerationTool' || 
              tr.toolName === 'entry-proposal-generation'
            );
            
            if (entryProposalResult) {
              toolExecutionData = entryProposalResult.result;
              logger.info('[AgentNetwork] Entry proposal generation result extracted', {
                success: toolExecutionData?.success,
                proposalGroup: toolExecutionData?.proposalGroup,
                proposalCount: toolExecutionData?.proposalGroup?.proposals?.length,
              });
            }
          }
        });
      }
      
      // レスポンスからテキストを抽出
      let responseText = typeof response === 'object' && response !== null && 'text' in response
        ? response.text
        : String(response);
      
      // 価格照会エージェントの場合、ツール実行結果から直接応答を生成
      if (targetId === 'priceInquiryAgent' && hasToolExecution && toolExecutionData) {
        const { symbol, currentPrice, priceChangePercent24h } = toolExecutionData;
        if (currentPrice) {
          // シンボルから通貨名を抽出
          const currencyName = symbol ? symbol.replace('USDT', '') : 'BTC';
          
          // フォーマットされた価格
          const formattedPrice = currentPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          
          // 変化率の符号を考慮
          const changePrefix = priceChangePercent24h >= 0 ? '+' : '';
          
          responseText = `${currencyName}の現在価格は $${formattedPrice} です。24時間変化率は ${changePrefix}${priceChangePercent24h}% です。`;
          
          logger.info('[AgentNetwork] Generated price response from tool data', {
            originalText: response.text,
            generatedText: responseText,
            toolData: { symbol, currentPrice, priceChangePercent24h },
          });
        }
      }
      
      // 提案生成エージェントの場合、ツール実行結果から提案データを返す
      let extractedProposalGroup = null;
      if (targetId === 'tradingAnalysisAgent' && hasToolExecution && toolExecutionData?.proposalGroup) {
        const proposalCount = toolExecutionData.proposalGroup.proposals?.length || 0;
        
        // proposalGroupを保存
        extractedProposalGroup = toolExecutionData.proposalGroup;
        
        // responseTextはそのまま
        responseText = response.text || `${proposalCount}個の提案を生成しました。`;
        
        logger.info('[AgentNetwork] Generated proposal response from tool data', {
          originalText: response.text,
          proposalCount,
          proposalGroupId: toolExecutionData.proposalGroup.id,
          isEmpty: proposalCount === 0,
        });
      }

      const executionTime = Date.now() - startTime;

      // Update target agent stats
      target.lastSeen = new Date();
      target.messageCount++;

      // Create response message with full structure
      const responseMessage: A2AMessage = {
        id: `resp-${messageId}`,
        type: 'response',
        source: targetId,
        target: sourceId,
        result: responseText,  // Keep text for backward compatibility
        timestamp: Date.now(),
        correlationId: message.correlationId,
        // Include the full response structure for tool results
        ...(response.steps && { steps: response.steps }),
        ...(response.toolResults && { toolResults: response.toolResults }),
        // Include proposalGroup if extracted
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

      // Create error response
      const errorMessage: A2AMessage = {
        id: `err-${messageId}`,
        type: 'error',
        source: targetId,
        target: sourceId,
        error: {
          code: -32603, // JSON-RPC Internal Error
          message: 'Agent execution failed',
          data: { originalError: String(error) },
        },
        timestamp: Date.now(),
        correlationId: message.correlationId,
      };

      return errorMessage;
    }
  }

  /**
   * Broadcast message to multiple agents
   */
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

    // Send to all targets in parallel
    const promises = targets.map(target =>
      this.sendMessage(sourceId, target.id, method, params)
    );

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

  /**
   * Smart agent routing with automatic selection
   */
  async routeMessage(
    sourceId: string,
    query: string,
    context?: Record<string, unknown>
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

  /**
   * Get network statistics
   */
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

  /**
   * Format message for agent consumption
   */
  private formatMessageForAgent(message: A2AMessage): string {
    // price_inquiry メソッドの場合、価格取得を明示的に指示
    if (message.method === 'process_query' && message.params && 'query' in message.params) {
      const params = message.params as ProcessQueryParams;
      const query = params.query;
      const context = params.context || {};
      
      // シンボルを抽出
      let symbol = 'BTCUSDT'; // デフォルト
      const queryUpper = query.toUpperCase();
      
      for (const s of SUPPORTED_SYMBOLS) {
        if (queryUpper.includes(s)) {
          symbol = s + 'USDT';
          break;
        }
      }
      
      // targetが tradingAnalysisAgent で提案モードの場合
      if (message.target === AGENT_IDS.TRADING_ANALYSIS && isProposalContext(context)) {
        logger.info('[AgentNetwork] Formatting message for proposal mode', {
          target: message.target,
          extractedSymbol: context.extractedSymbol,
          proposalType: context.proposalType,
          isEntryProposal: context.isEntryProposal,
        });
        
        // エントリー提案の場合
        if (context.proposalType === 'entry' || context.isEntryProposal) {
          return `
ユーザーのリクエスト: "${query}"

## エントリー提案モードの実行
以下のパラメータを使用してentryProposalGenerationを実行してください:

entryProposalGeneration({
  symbol: "${context.extractedSymbol || symbol}",
  interval: "${context.interval || '1h'}",
  strategyPreference: "dayTrading",
  riskPercentage: 1,
  maxProposals: 3
})

必須: 上記のツールを必ず実行し、proposalGroupを返してください。
          `.trim();
        }
        
        // 通常の提案モード
        return `
ユーザーのリクエスト: "${query}"

## 提案モードの実行
以下のパラメータを使用してproposalGenerationを実行してください:

proposalGeneration({
  symbol: "${context.extractedSymbol || symbol}",
  interval: "${context.interval || '1h'}",
  analysisType: "${context.proposalType || 'trendline'}",
  maxProposals: 5
})

必須: 上記のツールを必ず実行し、proposalGroupを返してください。
      `.trim();
      }
      
      // conversationalAgent用の処理
      if (message.target === AGENT_IDS.CONVERSATIONAL) {
        if (isConversationalContext(context)) {
          logger.info('[AgentNetwork] Formatting message for conversational mode', {
            target: message.target,
            conversationMode: context.conversationMode,
            emotionalTone: context.emotionalTone,
            relationshipLevel: context.relationshipLevel,
          });
        
        return `
ユーザーからのメッセージ: "${query}"

## コンテキスト情報:
- 会話モード: ${context.conversationMode || 'casual'}
- 感情トーン: ${context.emotionalTone || 'neutral'}
- 関係性レベル: ${context.relationshipLevel || 'new'}
- 最近の話題: ${context.memoryContext ? '会話履歴あり' : 'なし'}

## 応答ガイドライン:
1. 自然で親しみやすい口調で返答してください
2. ユーザーの感情に共感し、寄り添ってください
3. 適度に市場の話題を織り交ぜてください（押し付けずに）
4. 関係性レベルに応じて距離感を調整してください
5. 必要に応じてmarketSnapshotやtrendingTopicsツールを使用してください

重要: 定型文ではなく、文脈に応じた自然な応答を生成してください。
        `.trim();
        }
      }
      
      // price_inquiry専用の処理
      if (message.target === AGENT_IDS.PRICE_INQUIRY) {
        return `
ユーザーの質問: "${query}"

対象シンボル: ${symbol}

## 実行手順（必須）:
1. まず最初に、marketDataResilientToolを使って価格データを取得する
   実行: marketDataResilientTool({ symbol: "${symbol}" })

2. ツールから返されたデータを確認する：
   - currentPrice（現在価格）
   - priceChangePercent24h（24時間変化率）

3. 取得したデータを使って応答する：
   "${symbol.replace('USDT', '')}の現在価格は $[currentPrice] です。24時間変化率は [priceChangePercent24h]% です。"

## 絶対ルール:
- ツールを使わずに価格を答えない
- 取得したcurrentPriceをそのまま使う（架空の価格は厳禁）
- 価格は必ず$表記（円換算しない）
        `.trim();
      }
    }
    
    // デフォルトのフォーマット
    return `
Agent-to-Agent Message:
From: ${message.source}
Method: ${message.method}
${message.params ? `Parameters: ${JSON.stringify(message.params, null, 2)}` : ''}

Please process this request and provide an appropriate response.
Use available tools when necessary to fulfill the request.
    `.trim();
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [id, registration] of this.agents) {
      try {
        const response = await this.sendMessage(
          'system',
          id,
          'health_check',
          {},
          `health-${id}-${Date.now()}`
        );
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

// Export singleton instance
export const agentNetwork = new AgentNetwork({
  maxHops: 5,
  timeout: 10000, // Reduced from 30s to 10s for better performance
  enableLogging: true,
  enableMetrics: true,
});

// Convenience functions
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