import { createTool } from '@mastra/core';
import { z } from 'zod';
import { agentNetwork, routeToAgent } from '../network/agent-network';
import { logger } from '@/lib/utils/logger';
import { FallbackHandler } from '../utils/fallback-handler';
import { emitUIEvent } from '@/lib/server/uiEventBus';

/**
 * Agent Selection Tool - エージェント選択ツール (A2A通信対応)
 * 
 * 適切な専門エージェントを選択・実行するためのオーケストレーターツール
 * - Agent-to-Agent (A2A) 通信システム統合
 * - インテリジェントなエージェント自動選択
 * - LLMベースのルーティング
 */

const AgentSelectionInput = z.object({
  agentType: z.enum([
    'price_inquiry',    // 価格照会専門エージェント
    'ui_control',       // UI操作専門エージェント  
    'trading_analysis', // 取引分析専門エージェント（既存）
  ]),
  query: z.string(),                    // ユーザークエリ
  context: z.record(z.unknown()).optional(), // 追加コンテキスト
  correlationId: z.string().optional(),  // トレース用ID
});

const AgentSelectionOutput = z.object({
  success: z.boolean(),
  selectedAgent: z.string(),
  executionResult: z.object({
    response: z.string(),
    data: z.record(z.unknown()).optional(),
    metadata: z.object({
      model: z.string().optional(),
      tokensUsed: z.number().optional(),
      executionTime: z.number().optional(),
      toolsUsed: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
  fallbackUsed: z.boolean().optional(),
  message: z.string(),
  error: z.string().optional(),
});

export const agentSelectionTool = createTool({
  id: 'ai-agent-selection',
  description: `
    AI-powered agent selection and execution tool for Cryptrade platform.
    Uses natural language understanding to route queries intelligently.
    
    Features:
    - Context-aware agent selection
    - Conversation history integration  
    - Dynamic response generation
    - Fallback handling with AI assistance
    - Multi-language support
  `,
  inputSchema: AgentSelectionInput,
  outputSchema: AgentSelectionOutput,

  execute: async ({ context }): Promise<z.infer<typeof AgentSelectionOutput>> => {
    const { agentType, query, context: userContext, correlationId } = context;
    const startTime = Date.now();
    
    try {
      // A2A通信を使用したエージェント実行
      const a2aResult = await executeWithA2ACommunication(
        agentType, 
        query, 
        userContext, 
        correlationId || `tool-${Date.now()}`
      );

      if (a2aResult.success) {
        // 🚀 UI Control Agent の operations を配信
        await broadcastUIOperations(agentType, a2aResult, correlationId);
        
        logger.info('[agentSelectionTool] A2A result details', {
          targetAgent: a2aResult.targetAgent,
          responseLength: a2aResult.response?.length,
          responsePreview: a2aResult.response?.substring(0, 100),
          hasData: !!a2aResult.data,
        });
        
        return {
          success: true,
          selectedAgent: a2aResult.targetAgent,
          executionResult: {
            response: a2aResult.response || 'No response from agent',
            data: a2aResult.data,
            metadata: {
              model: a2aResult.metadata?.model || 'unknown',
              tokensUsed: a2aResult.metadata?.tokensUsed,
              executionTime: Date.now() - startTime,
              toolsUsed: a2aResult.metadata?.toolsUsed || [],
            },
            // A2A通信の完全な結果を含める
            ...(a2aResult.steps && { steps: a2aResult.steps }),
            ...(a2aResult.toolResults && { toolResults: a2aResult.toolResults }),
            // proposalGroupを含める
            ...(a2aResult.proposalGroup && { proposalGroup: a2aResult.proposalGroup }),
          },
          message: a2aResult.response || `A2A communication successful: ${a2aResult.targetAgent}`,
        };
      } else {
        // A2A通信失敗時のフォールバック
        logger.warn('[agentSelectionTool] A2A communication failed, using fallback', {
          agentType,
          error: a2aResult.error,
          correlationId,
        });

        const fallbackResult = await FallbackHandler.handle({
          agentType,
          query,
          context: userContext,
          error: a2aResult.error,
        });
        
        // フォールバックでもUI操作を配信
        await broadcastUIOperations(agentType, fallbackResult, correlationId);
        
        return {
          success: true,
          selectedAgent: agentType,
          executionResult: fallbackResult,
          fallbackUsed: true,
          message: `A2A failed, used traditional fallback: ${agentType}`,
        };
      }

    } catch (error) {
      logger.error('[agentSelectionTool] Tool execution failed completely', {
        agentType,
        error: String(error),
        correlationId,
      });

      return {
        success: false,
        selectedAgent: agentType,
        message: `Complete tool failure: ${agentType}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * A2A通信を使用したエージェント実行
 */
async function executeWithA2ACommunication(
  agentType: string,
  query: string,
  userContext: Record<string, unknown>,
  correlationId: string
): Promise<{
  success: boolean;
  targetAgent: string;
  response: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  error?: string;
  steps?: unknown[];
  toolResults?: unknown[];
  proposalGroup?: unknown;
  [key: string]: unknown;
}> {
  try {
    // エージェント種別をA2A形式に変換
    const agentIdMap: Record<string, string> = {
      'price_inquiry': 'priceInquiryAgent',
      'ui_control': 'uiControlAgent', 
      'trading_analysis': 'tradingAnalysisAgent',
      'proposal_request': 'tradingAnalysisAgent', // 提案リクエストは取引分析エージェントが処理
    };


    // マッピングを試みる、見つからない場合はagentTypeをそのまま使用
    const targetAgentId = agentIdMap[agentType] || agentType;
    
    if (!agentIdMap[agentType]) {
      logger.warn('[agentSelectionTool] Using agentType directly as no mapping found', {
        agentType,
        targetAgentId,
        availableMappings: Object.keys(agentIdMap),
      });
    }

    // A2A通信でメッセージ送信
    logger.debug('[agentSelectionTool] Sending A2A message with context', {
      targetAgentId,
      userContext,
      contextKeys: userContext ? Object.keys(userContext) : [],
    });
    
    // タイムアウト付きでA2A通信を実行
    const a2aMessage = await Promise.race([
      agentNetwork.sendMessage(
        'orchestratorAgent',  // 送信元
        targetAgentId,        // 送信先
        'process_query',      // メソッド
        {
          query,
          context: userContext,
          timestamp: Date.now(),
        },
        correlationId
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('A2A communication timeout')), 10000)
      )
    ]);

    if (!a2aMessage) {
      return {
        success: false,
        targetAgent: targetAgentId,
        response: '',
        error: 'A2A message sending failed',
      };
    }

    if (a2aMessage.type === 'error') {
      return {
        success: false,
        targetAgent: targetAgentId,
        response: '',
        error: a2aMessage.error?.message || 'Agent execution error',
      };
    }

    // 成功レスポンスを解析
    const response = typeof a2aMessage.result === 'string' 
      ? a2aMessage.result 
      : String(a2aMessage.result);

    logger.info('[agentSelectionTool] A2A communication successful', {
      sourceAgent: 'orchestratorAgent',
      targetAgent: targetAgentId,
      correlationId,
      responseLength: response.length,
      hasSteps: !!a2aMessage.steps,
      hasToolResults: !!a2aMessage.toolResults,
    });

    // a2aMessageの全体構造を返す（stepsやtoolResultsを含む）
    return {
      success: true,
      targetAgent: targetAgentId,
      response,
      // a2aMessageの構造を保持
      ...a2aMessage, // steps, toolResults等を含む
      metadata: {
        model: 'a2a-communication',
        communicationType: 'agent-to-agent',
        messageId: a2aMessage.id,
        correlationId,
      },
    };

  } catch (error) {
    logger.error('[agentSelectionTool] A2A communication error', {
      agentType,
      error: String(error),
      correlationId,
    });

    return {
      success: false,
      targetAgent: agentType,
      response: '',
      error: String(error),
    };
  }
}


/**
 * UI Control Agent専用の直接実行関数
 */
async function executeDirectUIControl(
  query: string, 
  conversationHistory: Array<{role: string; content: string}>,
  userContext: Record<string, unknown> | undefined
): Promise<{
  response: string;
  data?: unknown;
  metadata: unknown;
}> {
  try {
    // Chart Control Toolを直接インポート・実行
    const { chartControlTool } = await import('./chart-control.tool');
    
    const toolResult = await chartControlTool.execute({
      context: {
        userRequest: query,
        conversationHistory,
        currentState: userContext?.currentState || {},
      }
    });

    logger.info('[agentSelectionTool] Direct UI control executed', {
      success: toolResult.success,
      operationsCount: toolResult.operations?.length || 0,
      queryLength: query.length,
    });

    return {
      response: toolResult.response,
      data: {
        operations: toolResult.operations,
        metadata: toolResult.metadata,
      },
      metadata: {
        model: 'chart-control-tool',
        executionTime: Date.now(),
        toolsUsed: ['chartControlTool'],
        fallbackType: 'direct_tool',
        directTool: true,
      }
    };

  } catch (error) {
    logger.error('[agentSelectionTool] Direct UI control failed', {
      error: String(error),
    });

    return {
      response: 'UI操作の処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。',
      metadata: {
        model: 'error-fallback',
        executionTime: 0,
        toolsUsed: [],
        fallbackType: 'error',
        error: String(error),
      }
    };
  }
}

// UI操作の型定義
interface UIOperation {
  clientEvent?: {
    event: string;
    data: unknown;
  };
  [key: string]: unknown;
}

interface ToolResult {
  operation?: unknown;
  result?: {
    operations?: UIOperation[];
  };
  [key: string]: unknown;
}

interface Step {
  toolResults?: ToolResult[];
  [key: string]: unknown;
}

interface AgentResult {
  toolResults?: ToolResult[];
  steps?: Step[];
  proposalGroup?: unknown;
  operations?: UIOperation[];
  data?: {
    operations?: UIOperation[];
    [key: string]: unknown;
  };
  result?: {
    operations?: UIOperation[];
    proposalGroup?: unknown;
    [key: string]: unknown;
  };
  executionResult?: {
    data?: {
      operations?: UIOperation[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * UI操作をブロードキャストする関数
 * Chart Control Toolからのoperationsを受信してwindow.dispatchEventで配信
 */
async function broadcastUIOperations(
  agentType: string,
  agentResult: AgentResult,
  correlationId?: string
) {
  // UI Control Agentの場合のみ処理（提案モードは除外）
  if (agentType !== 'ui_control') {
    return;
  }
  
  // 提案モードの場合はUIイベントを送信しない
  if (agentResult?.proposalGroup || agentResult?.result?.proposalGroup) {
    logger.info('[Agent Selection Tool] Skipping UI broadcast for proposal mode', { correlationId });
    return;
  }

  try {
    // toolResults配列からoperationsを抽出
    const fromToolResults = Array.isArray(agentResult?.toolResults)
      ? agentResult.toolResults.flatMap((tr: ToolResult) =>
          Array.isArray(tr?.result?.operations) ? tr.result.operations : []
        )
      : [];
    
    // stepsからtoolResultsを探す（A2A通信の場合）
    const fromSteps = Array.isArray(agentResult?.steps)
      ? agentResult.steps.flatMap((step: Step) =>
          Array.isArray(step?.toolResults)
            ? step.toolResults.flatMap((tr: ToolResult) =>
                Array.isArray(tr?.result?.operations) ? tr.result.operations : []
              )
            : []
        )
      : [];
    
    // Chart Control Toolの結果から operations を抽出
    // 複数の階層パターンに対応
    const operations = Array.isArray(agentResult.operations) 
      ? agentResult.operations                    // ルートレベル
      : Array.isArray(agentResult.data?.operations)
      ? agentResult.data.operations               // data配下
      : Array.isArray(agentResult.result?.operations)
      ? agentResult.result.operations             // result配下
      : Array.isArray(agentResult.executionResult?.data?.operations)
      ? agentResult.executionResult.data.operations // executionResult.data配下
      : fromToolResults.length > 0
      ? fromToolResults                           // toolResults配下
      : fromSteps.length > 0
      ? fromSteps                                 // steps→toolResults配下
      : [];
    
    // デバッグ用：agentResultの全体構造をログ
    if (agentType === 'ui_control') {
      logger.info('[Agent Selection Tool] Full agent result keys', Object.keys(agentResult || {}));
      
      // 最初の呼び出しのみ詳細ログ
      if (!(global as typeof globalThis & { _debuggedAgentResult?: boolean })._debuggedAgentResult) {
        (global as typeof globalThis & { _debuggedAgentResult?: boolean })._debuggedAgentResult = true;
        logger.info('[Agent Selection Tool] Full agent result structure (first call only)', 
          JSON.stringify(agentResult, null, 2).substring(0, 1000) + '...'
        );
      }
    }
    
    logger.debug('[Agent Selection Tool] Agent result structure', {
      hasToolResults: !!agentResult?.toolResults,
      hasSteps: !!agentResult?.steps,
      firstToolResult: agentResult?.toolResults?.[0],
      firstStepToolResult: agentResult?.steps?.[0]?.toolResults?.[0],
    });
    
    logger.info('[Agent Selection Tool] Broadcasting UI operations', {
      agentType,
      operationsCount: operations.length,
      correlationId,
      resultStructure: {
        hasOperations: !!agentResult.operations,
        hasDataOperations: !!agentResult.data?.operations,
        hasResultOperations: !!agentResult.result?.operations,
        hasExecutionResultOperations: !!agentResult.executionResult?.data?.operations,
        hasToolResults: fromToolResults.length > 0,
        hasStepsToolResults: fromSteps.length > 0,
      },
      operationsSource: operations.length > 0 
        ? (fromSteps.length > 0 ? 'steps->toolResults' 
          : fromToolResults.length > 0 ? 'toolResults' 
          : 'other')
        : 'none'
    });

    // 各operation のclientEventを配信
    for (let index = 0; index < operations.length; index++) {
      const operation = operations[index];
      if (operation.clientEvent) {
        const { event, data } = operation.clientEvent;
        
        logger.debug('[Agent Selection Tool] Dispatching client event', {
          event,
          data,
          operationIndex: index,
          correlationId,
        });

        // ブラウザ環境でのみ実行
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(event, {
            detail: data,
          }));
          
          logger.info('[Agent Selection Tool] UI event dispatched', {
            event,
            data,
            success: true,
          });
        } else {
          // サーバー環境ではSSE経由で配信
          await emitUIEvent({ event, data });
          
          logger.info('[Agent Selection Tool] UI event emitted to SSE', {
            event,
            data,
            success: true,
            environment: 'server',
          });
        }
      }
    }

    // 統計情報をログ
    const dispatchedEvents = operations.filter((op: UIOperation) => op.clientEvent).length;
    logger.info('[Agent Selection Tool] UI operations broadcast complete', {
      totalOperations: operations.length,
      dispatchedEvents,
      correlationId,
    });

  } catch (error) {
    logger.error('[Agent Selection Tool] Failed to broadcast UI operations', {
      agentType,
      error: String(error),
      correlationId,
    });
  }
}

