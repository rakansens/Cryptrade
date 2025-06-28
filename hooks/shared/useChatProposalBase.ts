/**
 * Chat Proposal Base Hook
 * 
 * Chat提案処理フック群の共通基盤
 * useApproveProposal/useRejectProposal間の重複パターンを統合
 */

import { useCallback, useRef, useEffect } from 'react';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { logger } from '@/lib/utils/logger';
import type { ProposalMessage } from '@/types/proposals';

export interface ProposalBaseConfig {
  hookName: string;
  defaultSymbol?: string;
  logLevel?: 'info' | 'warn' | 'error';
}

export interface ProposalContext {
  messageId: string;
  proposalId: string;
  proposalGroupId: string;
  symbol: string;
  interval?: string;
  type?: string;
}

export interface ProposalValidation {
  success: boolean;
  error?: string;
  context?: ProposalContext;
}

/**
 * Chat提案処理の共通基盤フック
 */
export function useChatProposalBase(config: ProposalBaseConfig) {
  const { hookName, defaultSymbol = 'BTCUSDT', logLevel = 'info' } = config;
  const { publish } = useUIEventPublisher();

  // マウント状態管理
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * タイトルからシンボル抽出（統一版）
   */
  const extractSymbolFromTitle = useCallback((title: string): string => {
    const symbolMatch = title.match(/([A-Z]{3,}USDT?|[A-Z]{3,}USD)/);
    return symbolMatch?.[1] || defaultSymbol;
  }, [defaultSymbol]);

  /**
   * 説明文からインターバル抽出
   */
  const extractIntervalFromDescription = useCallback((description: string): string => {
    const intervalMatch = description.match(/(\d+[mhd])/);
    return intervalMatch?.[1] || '1h';
  }, []);

  /**
   * 統一ログ出力
   */
  const safeLog = useCallback((level: 'info' | 'warn' | 'error', message: string, context?: any) => {
    const logContext = {
      hook: hookName,
      ...context
    };
    logger[level](message, logContext);
  }, [hookName]);

  /**
   * 提案基本バリデーション
   */
  const validateProposalRequest = useCallback((
    message: ProposalMessage, 
    proposalId: string,
    requirePublish = true
  ): ProposalValidation => {
    // 基本要件チェック
    if (!message.proposalGroup) {
      safeLog('error', 'Missing proposal group', {
        messageId: message.id,
        proposalId
      });
      return { 
        success: false, 
        error: 'Missing proposal group' 
      };
    }

    if (requirePublish && !publish) {
      safeLog('error', 'Publisher not available', {
        messageId: message.id,
        proposalId
      });
      return { 
        success: false, 
        error: 'Publisher not available' 
      };
    }

    if (!proposalId) {
      safeLog('error', 'Proposal ID is required', {
        messageId: message.id,
        proposalGroupId: message.proposalGroup.id
      });
      return { 
        success: false, 
        error: 'Proposal ID is required' 
      };
    }

    // 提案検索
    const proposalData = message.proposalGroup.proposals.find(p => p.id === proposalId);
    if (!proposalData) {
      safeLog('error', 'Proposal not found', { 
        proposalId,
        availableProposals: message.proposalGroup.proposals.map(p => p.id) 
      });
      return { 
        success: false, 
        error: 'Proposal not found' 
      };
    }

    // コンテキスト作成
    const context: ProposalContext = {
      messageId: message.id,
      proposalId,
      proposalGroupId: message.proposalGroup.id,
      symbol: extractSymbolFromTitle(message.proposalGroup.title),
      interval: extractIntervalFromDescription(message.proposalGroup.description),
      type: (proposalData as any).type
    };

    return { 
      success: true, 
      context 
    };
  }, [publish, safeLog, extractSymbolFromTitle, extractIntervalFromDescription]);

  /**
   * 提案データ取得ヘルパー
   */
  const getProposalData = useCallback((message: ProposalMessage, proposalId: string) => {
    return message.proposalGroup?.proposals.find(p => p.id === proposalId);
  }, []);

  /**
   * UIイベント発行ヘルパー
   */
  const publishProposalEvent = useCallback((
    action: 'approve' | 'reject',
    context: ProposalContext,
    additionalData?: Record<string, any>
  ) => {
    if (!publish) {
      safeLog('warn', 'Cannot publish event - publisher not available', { action, context });
      return;
    }

    const event = new CustomEvent('ui:proposal-action', {
      detail: {
        action,
        proposalId: context.proposalId,
        proposalGroupId: context.proposalGroupId,
        symbol: context.symbol,
        ...(context.interval && { interval: context.interval }),
        ...(context.type && { type: context.type }),
        timestamp: Date.now(),
        ...additionalData
      }
    });

    publish(event);
    safeLog(logLevel, `Published ${action} event`, { context, additionalData });
  }, [publish, safeLog, logLevel]);

  /**
   * 一括提案処理ヘルパー
   */
  const processBatchProposals = useCallback(async (
    message: ProposalMessage,
    processor: (message: ProposalMessage, proposalId: string) => Promise<void> | void,
    actionName: string
  ) => {
    if (!message.proposalGroup) {
      safeLog('warn', `No proposal group found for ${actionName} all`);
      return;
    }

    safeLog('info', `Processing all proposals: ${actionName}`, {
      groupId: message.proposalGroup.id,
      count: message.proposalGroup.proposals.length
    });

    const results = await Promise.allSettled(
      message.proposalGroup.proposals.map(async proposal => {
        try {
          await processor(message, proposal.id);
          return { success: true, proposalId: proposal.id };
        } catch (error) {
          safeLog('error', `Failed to ${actionName} proposal in batch`, {
            proposalId: proposal.id,
            error: error instanceof Error ? error.message : String(error)
          });
          return { success: false, proposalId: proposal.id, error };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    safeLog('info', `Batch ${actionName} completed`, {
      total: results.length,
      successful,
      failed
    });

    return { successful, failed, total: results.length };
  }, [safeLog]);

  /**
   * エラーハンドラ
   */
  const handleProposalError = useCallback((error: unknown, context: ProposalContext, operation: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('error', `${operation} failed`, {
      context,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
  }, [safeLog]);

  return {
    // Validation & Data
    validateProposalRequest,
    getProposalData,
    extractSymbolFromTitle,
    extractIntervalFromDescription,
    
    // Event & Communication
    publishProposalEvent,
    
    // Batch Processing
    processBatchProposals,
    
    // Utilities
    safeLog,
    handleProposalError,
    
    // State
    hasPublisher: !!publish,
    isMounted: () => isMountedRef.current,
  };
}

export type ChatProposalBase = ReturnType<typeof useChatProposalBase>;