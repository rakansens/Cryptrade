import { logger } from '@/lib/utils/logger';
import type { ExecutionResult, ProposalGroup, ToolResult } from '@/lib/api/types';

/**
 * ProposalGroupまたはEntryProposalGroupをレスポンスから抽出する
 * 様々な構造から統一的にProposalGroupまたはEntryProposalGroupを取り出す
 */
export function extractProposalGroup(executionResult: ExecutionResult | unknown): ProposalGroup | null {
  if (!executionResult || typeof executionResult !== 'object') {
    return null;
  }

  // 1. JSONレスポンスからの抽出
  if (typeof executionResult.response === 'string' && 
      (executionResult.response.includes('proposalGroup') || executionResult.response.includes('entryProposalGroup'))) {
    try {
      const parsed = JSON.parse(executionResult.response);
      if ((parsed.type === 'proposalGroup' || parsed.type === 'entryProposalGroup') && parsed.data) {
        logger.info('[ProposalExtractor] Found proposal group in JSON response', {
          type: parsed.type,
          proposalCount: parsed.data.proposals?.length || 0,
        });
        return parsed.data;
      }
    } catch (e) {
      logger.debug('[ProposalExtractor] Failed to parse JSON response', { error: String(e) });
    }
  }

  // 2. toolResultsから探索
  const toolResults = collectToolResults(executionResult);
  for (const toolResult of toolResults) {
    // 通常のproposalGroup
    if (toolResult?.result?.proposalGroup) {
      logger.info('[ProposalExtractor] Found proposalGroup in toolResults', {
        toolName: toolResult.toolName,
        proposalCount: toolResult.result.proposalGroup.proposals?.length || 0,
        source: 'toolResults',
      });
      return toolResult.result.proposalGroup;
    }
    // エントリー提案の専用チェック（複数のツール名パターンに対応）
    const entryToolNames = ['entryProposalGeneration', 'entry-proposal-generation', 'entryProposalGenerationTool'];
    if (entryToolNames.includes(toolResult?.toolName) && toolResult?.result?.proposalGroup) {
      logger.info('[ProposalExtractor] Found entryProposalGroup in toolResults', {
        toolName: toolResult.toolName,
        proposalCount: toolResult.result.proposalGroup.proposals?.length || 0,
        source: 'toolResults',
      });
      return {
        ...toolResult.result.proposalGroup,
        type: 'entryProposalGroup'
      };
    }
  }

  // 3. 直接参照できる場所を探す（優先順位順）
  const directLocations = [
    executionResult.proposalGroup,
    executionResult.entryProposalGroup,
    executionResult.executionResult?.proposalGroup,
    executionResult.executionResult?.entryProposalGroup,
    executionResult.executionResult?.executionResult?.proposalGroup, // Added nested path for E2E test
    executionResult.data?.proposalGroup,
    executionResult.data?.entryProposalGroup,
  ];

  for (const location of directLocations) {
    if (location) {
      logger.info('[ProposalExtractor] Found proposalGroup in direct location', {
        hasProposals: Array.isArray(location.proposals),
        proposalCount: location.proposals?.length || 0,
        groupId: location.id,
      });
      return location;
    }
  }

  return null;
}

/**
 * 様々な構造からtoolResultsを収集する
 */
function collectToolResults(execResult: ExecutionResult | Record<string, unknown>): ToolResult[] {
  const results: ToolResult[] = [];
  
  // 直接のtoolResults
  if (Array.isArray(execResult.toolResults)) {
    results.push(...execResult.toolResults);
  }
  
  // stepsからのtoolResults
  if (Array.isArray(execResult.steps)) {
    for (const step of execResult.steps) {
      if (Array.isArray(step.toolResults)) {
        results.push(...step.toolResults);
      }
    }
  }
  
  // executionResult内のA2A構造
  if (execResult.executionResult) {
    // A2A通信のsteps
    if (Array.isArray(execResult.executionResult.steps)) {
      for (const step of execResult.executionResult.steps) {
        if (Array.isArray(step.toolResults)) {
          results.push(...step.toolResults);
        }
      }
    }
    
    // A2A通信のtoolResults
    if (Array.isArray(execResult.executionResult.toolResults)) {
      results.push(...execResult.executionResult.toolResults);
    }
  }
  
  return results;
}

/**
 * ProposalGroup検索のデバッグ情報を出力
 */
export function debugProposalGroupStructure(execResult: ExecutionResult | unknown): void {
  if (!execResult || typeof execResult !== 'object') {
    logger.warn('[ProposalExtractor] No execution result to debug');
    return;
  }

  // エントリー提案のチェックを追加
  const toolResults = collectToolResults(execResult);
  for (const toolResult of toolResults) {
    if (toolResult?.toolName === 'entryProposalGeneration') {
      logger.debug('[ProposalExtractor] Found entry proposal generation tool result', {
        hasResult: !!toolResult.result,
        hasProposalGroup: !!toolResult.result?.proposalGroup,
        resultKeys: toolResult.result ? Object.keys(toolResult.result) : [],
      });
    }
  }

  // 既存の処理はそのまま継続
  debugProposalGroupStructureOriginal(execResult);
}

function debugProposalGroupStructureOriginal(execResult: ExecutionResult | unknown): void {
  if (!execResult || typeof execResult !== 'object') {
    logger.warn('[ProposalExtractor] No execution result to debug');
    return;
  }

  logger.debug('[ProposalExtractor] Debugging structure', {
    hasExecutionResult: !!execResult.executionResult,
    executionResultKeys: execResult.executionResult ? Object.keys(execResult.executionResult) : [],
    hasSteps: !!execResult.steps,
    hasToolResults: !!execResult.toolResults,
    hasExecutionResultSteps: !!(execResult.executionResult?.steps),
    hasExecutionResultToolResults: !!(execResult.executionResult?.toolResults),
    hasProposalGroup: !!execResult.proposalGroup,
    hasExecutionResultProposalGroup: !!(execResult.executionResult?.proposalGroup),
  });
}