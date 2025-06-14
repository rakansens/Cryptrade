/**
 * Orchestrator Agent Handlers
 * 
 * オーケストレーターエージェントの各種ハンドラー
 */

import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/utils/logger';
import { agentNetwork } from '../network/agent-network';
import { IntentType, AgentResponse, OrchestratorContext } from './orchestrator.types';
import { OrchestratorError } from '@/types/orchestrator.types';
import { formatAgentResponse, createErrorResponse } from './orchestrator.utils';

/**
 * 価格照会ハンドラー
 */
export async function handlePriceInquiry(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    const a2aResponse = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'priceInquiryAgent',
      'process_query',
      { query, context }
    );

    if (a2aResponse?.type === 'error') {
      throw new Error(a2aResponse.error?.message || 'Price inquiry failed');
    }

    return formatAgentResponse(
      'price_inquiry',
      a2aResponse?.result || '価格情報を取得できませんでした。',
      a2aResponse?.toolResults,
      { processedBy: 'priceInquiryAgent' }
    );
  } catch (error) {
    logger.error('[Orchestrator] Price inquiry failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'price_inquiry');
  }
}

/**
 * 取引分析ハンドラー
 */
export async function handleTradingAnalysis(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    const a2aResponse = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'tradingAnalysisAgent',
      'process_query',
      { query, context }
    );

    if (a2aResponse?.type === 'error') {
      throw new Error(a2aResponse.error?.message || 'Trading analysis failed');
    }

    return formatAgentResponse(
      'trading_analysis',
      a2aResponse?.result || '分析を完了できませんでした。',
      a2aResponse?.proposalGroup || a2aResponse?.toolResults,
      { processedBy: 'tradingAnalysisAgent' }
    );
  } catch (error) {
    logger.error('[Orchestrator] Trading analysis failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'trading_analysis');
  }
}

/**
 * UI制御ハンドラー
 */
export async function handleUIControl(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    const a2aResponse = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'uiControlAgent',
      'process_query',
      { query, context }
    );

    if (a2aResponse?.type === 'error') {
      throw new Error(a2aResponse.error?.message || 'UI control failed');
    }

    return formatAgentResponse(
      'ui_control',
      a2aResponse?.result || 'UI操作を実行できませんでした。',
      a2aResponse?.toolResults,
      { processedBy: 'uiControlAgent' }
    );
  } catch (error) {
    logger.error('[Orchestrator] UI control failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'ui_control');
  }
}

/**
 * 一般会話ハンドラー（Orchestrator内で直接処理）
 */
export async function handleGeneralConversation(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    // シンプルな会話エージェントを作成
    const conversationAgent = new Agent({
      name: 'simple-conversation',
      model: openai('gpt-4o-mini'),
      instructions: `
あなたは親しみやすい会話相手です。
- 自然で温かみのある返答を心がけてください
- 適度に相手の話題に興味を示してください
- 必要に応じて仮想通貨市場の話題も織り交ぜてください（押し付けずに）
- 絵文字は控えめに使用してください

重要: 定型文ではなく、文脈に応じた自然な応答を生成してください。
      `.trim(),
    });

    const messages = [
      {
        role: 'user' as const,
        content: query,
      },
    ];

    const response = await conversationAgent.generate(messages);
    const responseText = typeof response === 'object' && 'text' in response
      ? response.text
      : String(response);

    return formatAgentResponse(
      'general_conversation',
      responseText,
      undefined,
      { processedBy: 'orchestrator-conversation' }
    );
  } catch (error) {
    logger.error('[Orchestrator] Conversation handling failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'general_conversation');
  }
}

/**
 * パターン検出ハンドラー
 */
export async function handlePatternDetection(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    // パターン検出は取引分析エージェントに委譲
    const enhancedContext = {
      ...context,
      isProposalMode: true,
      proposalType: 'pattern',
    };

    const a2aResponse = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'tradingAnalysisAgent',
      'process_query',
      { query, context: enhancedContext }
    );

    if (a2aResponse?.type === 'error') {
      throw new Error(a2aResponse.error?.message || 'Pattern detection failed');
    }

    return formatAgentResponse(
      'pattern_detection',
      a2aResponse?.result || 'パターン検出を完了できませんでした。',
      a2aResponse?.proposalGroup || a2aResponse?.toolResults,
      { processedBy: 'tradingAnalysisAgent' }
    );
  } catch (error) {
    logger.error('[Orchestrator] Pattern detection failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'pattern_detection');
  }
}

/**
 * エントリー提案ハンドラー
 */
export async function handleEntryProposal(
  query: string,
  context: OrchestratorContext
): Promise<AgentResponse> {
  try {
    // エントリー提案は取引分析エージェントに委譲
    const enhancedContext = {
      ...context,
      isProposalMode: true,
      proposalType: 'entry',
      isEntryProposal: true,
    };

    const a2aResponse = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'tradingAnalysisAgent',
      'process_query',
      { query, context: enhancedContext }
    );

    if (a2aResponse?.type === 'error') {
      throw new Error(a2aResponse.error?.message || 'Entry proposal failed');
    }

    return formatAgentResponse(
      'entry_proposal',
      a2aResponse?.result || 'エントリー提案を生成できませんでした。',
      a2aResponse?.proposalGroup || a2aResponse?.toolResults,
      { processedBy: 'tradingAnalysisAgent' }
    );
  } catch (error) {
    logger.error('[Orchestrator] Entry proposal failed', { error: String(error) });
    const orchError = error instanceof Error ? error : new Error(String(error));
    return createErrorResponse(orchError, 'entry_proposal');
  }
}