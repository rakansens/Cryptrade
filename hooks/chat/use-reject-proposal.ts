'use client';

import { useCallback } from 'react';
import { type ProposalMessage } from '@/types/proposals';
import { showProposalRejectionSuccess } from '@/lib/notifications/toast';
import { useChatProposalBase } from '@/hooks/shared/useChatProposalBase';

/**
 * Hook for handling proposal rejection logic
 */
export function useRejectProposal() {
  const proposalBase = useChatProposalBase({
    hookName: 'useRejectProposal',
    defaultSymbol: 'UNKNOWN',
    logLevel: 'info'
  });

  const rejectProposal = useCallback((message: ProposalMessage, proposalId: string) => {
    // バリデーション（基盤使用）
    const validation = proposalBase.validateProposalRequest(message, proposalId, true);
    if (!validation.success) {
      proposalBase.safeLog('warn', 'Rejection validation failed', { 
        error: validation.error,
        proposalId 
      });
      return;
    }

    const { context } = validation;
    proposalBase.safeLog('info', 'Rejecting proposal', { proposalId, context });

    // イベント発行（基盤使用）
    proposalBase.publishProposalEvent('reject', context!);
    
    // 成功通知
    showProposalRejectionSuccess(context!.symbol, context!.type);
  }, [proposalBase]);

  const rejectAllProposals = useCallback(async (message: ProposalMessage) => {
    // 一括処理（基盤使用）
    await proposalBase.processBatchProposals(message, rejectProposal, 'reject');
  }, [proposalBase, rejectProposal]);

  return {
    rejectProposal,
    rejectAllProposals,
  };
}