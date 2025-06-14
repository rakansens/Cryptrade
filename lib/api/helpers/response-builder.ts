import { NextResponse } from 'next/server';
import { applyCorsHeaders, applySecurityHeaders } from '@/lib/api/middleware';
import { UnifiedProposal, toUnifiedProposal, extractUnifiedProposals } from '@/types/proposals';
import type { OrchestratorResult, ProposalGroup, ToolResult } from '@/lib/api/types';

/**
 * チャットレスポンスのパラメータ
 */
export interface ChatResponseParams {
  message: string;
  orchestratorResult: OrchestratorResult;
  proposalGroup?: ProposalGroup;
  sessionId?: string;
}

/**
 * 標準的なチャットレスポンスを構築する
 */
export interface ChatResponse {
  message: string;
  selectedAgent: string;
  analysis: {
    intent: string;
    confidence: number;
    reasoning: string;
    analysisDepth: string;
    isProposalMode: boolean;
    proposalType?: string;
  };
  execution: {
    success: boolean;
    executionTime: number;
    memoryContext: string;
  };
  data: unknown;
  proposals?: UnifiedProposal[];
  proposal?: UnifiedProposal;
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: ProposalGroup;
  metadata: {
    sessionId: string;
    timestamp: string;
    a2aEnabled: boolean;
    agentType: string;
  };
}

export function buildChatResponse(params: ChatResponseParams): ChatResponse {
  const { message, orchestratorResult, proposalGroup, sessionId } = params;
  
  // processOrchestratorResultからentryProposalGroupも取得
  const processedResult = processOrchestratorResult(orchestratorResult);
  
  // Extract all proposals and convert to unified format
  const unifiedProposals: UnifiedProposal[] = [];
  
  if (proposalGroup) {
    unifiedProposals.push(toUnifiedProposal(proposalGroup, 'trendline'));
  }
  if (processedResult.entryProposalGroup) {
    unifiedProposals.push(toUnifiedProposal(processedResult.entryProposalGroup, 'entry'));
  }
  
  // Legacy support: Include old format for backward compatibility
  const legacyProps = {
    ...(proposalGroup && { proposalGroup }),
    ...(processedResult.entryProposalGroup && { entryProposalGroup: processedResult.entryProposalGroup }),
  };
  
  return {
    message,
    selectedAgent: orchestratorResult.analysis.intent,
    analysis: {
      intent: orchestratorResult.analysis.intent,
      confidence: orchestratorResult.analysis.confidence,
      reasoning: orchestratorResult.analysis.reasoning,
      analysisDepth: orchestratorResult.analysis.analysisDepth,
      isProposalMode: orchestratorResult.analysis.isProposalMode,
      proposalType: orchestratorResult.analysis.proposalType,
    },
    execution: {
      success: orchestratorResult.success,
      executionTime: orchestratorResult.executionTime,
      memoryContext: orchestratorResult.memoryContext ? 'available' : 'none',
    },
    data: orchestratorResult.executionResult?.data || null,
    // New unified format
    ...(unifiedProposals.length > 0 && { 
      proposals: unifiedProposals,
      proposal: unifiedProposals[0], // Primary proposal for convenience
    }),
    // Legacy format for backward compatibility
    ...legacyProps,
    metadata: {
      sessionId: sessionId || 'auto-generated',
      timestamp: new Date().toISOString(),
      a2aEnabled: true,
      agentType: orchestratorResult.analysis.intent,
    }
  };
}

/**
 * 成功レスポンスを作成する
 */
export function createSuccessResponse<T = unknown>(data: T): NextResponse {
  const response = NextResponse.json(data);
  return applyCorsHeaders(applySecurityHeaders(response));
}

/**
 * Orchestratorの結果を処理してメッセージとProposalGroupを抽出する
 */
export function processOrchestratorResult(orchestratorResult: OrchestratorResult): {
  message: string;
  proposalGroup: ProposalGroup | null;
  entryProposalGroup?: ProposalGroup | null;
} {
  let responseMessage = orchestratorResult.executionResult?.response;
  let proposalGroup = null;
  
  // executionResultがオブジェクトの場合、responseフィールドを探す
  if (orchestratorResult.executionResult && typeof orchestratorResult.executionResult === 'object') {
    const execResult = orchestratorResult.executionResult as Record<string, unknown>;
    responseMessage = execResult.response || 
                     execResult.executionResult?.response || 
                     execResult.message;
  }
  
  // 提案モードで応答がない場合の処理
  if (!responseMessage && orchestratorResult.analysis.isProposalMode) {
    responseMessage = 'トレンドラインの提案を生成しました。';
  } else if (!responseMessage) {
    responseMessage = `Intent: ${orchestratorResult.analysis.intent} (${orchestratorResult.analysis.confidence})`;
  }
  
  // 通常の提案（trendline等）のチェック
  if (orchestratorResult.executionResult?.toolResults) {
    const proposalTool = orchestratorResult.executionResult.toolResults.find(
      (tr: ToolResult) => tr.toolName === 'proposalGeneration' || tr.toolName === 'proposalGenerationTool'
    );
    if (proposalTool?.result?.proposalGroup) {
      proposalGroup = proposalTool.result.proposalGroup;
      if (!responseMessage || responseMessage.includes('Intent:')) {
        responseMessage = 'トレンドラインの提案を生成しました。';
      }
    }
  }
  
  // エントリー提案のチェック
  let entryProposalGroup = null;
  if (orchestratorResult.executionResult?.toolResults) {
    const entryTool = orchestratorResult.executionResult.toolResults.find(
      (tr: ToolResult) => tr.toolName === 'entryProposalGeneration'
    );
    if (entryTool?.result?.proposalGroup) {
      entryProposalGroup = entryTool.result.proposalGroup;
      responseMessage = 'エントリー提案を生成しました。';
    }
  }
  
  // A2A通信の場合、stepsからもツール結果を探す
  if (!proposalGroup && !entryProposalGroup && orchestratorResult.executionResult?.steps) {
    orchestratorResult.executionResult.steps.forEach((step: { toolResults?: ToolResult[] }) => {
      if (step.toolResults) {
        step.toolResults.forEach((tr: ToolResult) => {
          if ((tr.toolName === 'proposalGeneration' || tr.toolName === 'proposalGenerationTool' || tr.toolName === 'proposal-generation') && tr.result?.proposalGroup) {
            proposalGroup = tr.result.proposalGroup;
            if (!responseMessage || responseMessage.includes('Intent:')) {
              responseMessage = 'トレンドラインの提案を生成しました。';
            }
          }
          if (tr.toolName === 'entryProposalGeneration' && tr.result?.proposalGroup) {
            entryProposalGroup = tr.result.proposalGroup;
            responseMessage = 'エントリー提案を生成しました。';
          }
        });
      }
    });
  }
  
  // proposalGroupが直接executionResultに含まれている場合
  if (!proposalGroup && orchestratorResult.executionResult?.proposalGroup) {
    proposalGroup = orchestratorResult.executionResult.proposalGroup;
    if (!responseMessage || responseMessage.includes('Intent:')) {
      responseMessage = 'トレンドラインの提案を生成しました。';
    }
  }
  
  return {
    message: responseMessage,
    proposalGroup,
    entryProposalGroup,
  };
}