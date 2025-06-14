'use client';

import { useCallback } from 'react';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { type ProposalMessage } from '@/types/proposal';
import { showProposalRejectionSuccess } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';
import type { EnhancedProposalActionEvent } from '@/types/proposal';

/**
 * Hook for handling proposal rejection logic
 */
export function useRejectProposal() {
  const { publish } = useUIEventPublisher();

  const rejectProposal = useCallback((message: ProposalMessage, proposalId: string) => {
    logger.info('[RejectProposal] Rejecting proposal', { proposalId });
    
    if (!publish || !message.proposalGroup) {
      logger.warn('[RejectProposal] Missing required data for rejection', {
        hasPublish: !!publish,
        hasProposalGroup: !!message.proposalGroup,
      });
      return;
    }

    // Find the proposal for better error messaging
    const proposalData = message.proposalGroup.proposals.find(p => p.id === proposalId);
    let symbol: string | undefined;
    let type: string | undefined;
    
    if (proposalData) {
      // Extract symbol and interval like in approve proposal
      const extractSymbolFromTitle = (title: string): string => {
        const symbolMatch = title.match(/([A-Z]{3,}USDT?|[A-Z]{3,}USD)/);
        return symbolMatch?.[1] || 'UNKNOWN';
      };

      symbol = extractSymbolFromTitle(message.proposalGroup.title);
      type = (proposalData as { type?: string }).type || 'unknown';
    }
    
    // Publish rejection event
    const rejectionEvent: EnhancedProposalActionEvent = {
      type: 'ui:proposal-action',
      timestamp: Date.now(),
      payload: {
        action: 'reject',
        proposalId: proposalId,
        proposalGroupId: message.proposalGroup.id,
        symbol,
        interval: proposalData ? (proposalData as { interval?: string }).interval : undefined,
      }
    };
    
    publish(rejectionEvent);
    
    // Show success notification
    showProposalRejectionSuccess(symbol, type);
  }, [publish]);

  const rejectAllProposals = useCallback((message: ProposalMessage) => {
    if (!message.proposalGroup) {
      logger.warn('[RejectProposal] No proposal group found for reject all');
      return;
    }
    
    logger.info('[RejectProposal] Rejecting all proposals', { 
      groupId: message.proposalGroup.id,
      count: message.proposalGroup.proposals.length 
    });
    
    // Reject all proposals
    message.proposalGroup.proposals.forEach(proposal => {
      rejectProposal(message, proposal.id);
    });
  }, [rejectProposal]);

  return {
    rejectProposal,
    rejectAllProposals,
  };
}