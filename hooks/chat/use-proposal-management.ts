'use client';

import { useApproveProposal } from './use-approve-proposal';
import { useRejectProposal } from './use-reject-proposal';
import { useCancelDrawing } from './use-cancel-drawing';
import { useApprovedDrawingIds } from '@/store/proposal-approval.store';

/**
 * Unified proposal management hook - refactored wrapper
 * 
 * This hook now serves as a clean interface that combines the
 * separated concerns of proposal approval, rejection, and drawing cancellation.
 * 
 * @deprecated Individual hooks (useApproveProposal, useRejectProposal, useCancelDrawing) 
 * should be used directly for better separation of concerns.
 */
export function useProposalManagement() {
  const { approveProposal, approveAllProposals, approveLoading } = useApproveProposal();
  const { rejectProposal, rejectAllProposals } = useRejectProposal();
  const { cancelDrawing } = useCancelDrawing();
  const approvedDrawingIds = useApprovedDrawingIds();

  return {
    approvedDrawingIds,
    handleApproveProposal: approveProposal,
    handleRejectProposal: rejectProposal,
    handleApproveAllProposals: approveAllProposals,
    handleRejectAllProposals: rejectAllProposals,
    handleCancelDrawing: cancelDrawing,
    approveLoading,
  };
}