// types/shared/proposal.ts
// Proposal 系共通型 (shared)
// [2025-06-14] 更新 - proposals.ts から再エクスポートに変更

export type {
  DrawingProposal,
  DrawingProposalGroup,
  ExtendedProposal,
  ProposalMessage,
  ProposalActionEvent,
  EnhancedProposalActionEvent,
  MLPrediction,
  // Legacy aliases
  DrawingProposalGroup as ProposalGroup,
  DrawingProposal as Proposal
} from '../proposals';

export {
  ProposalStatus,
  ProposalType
} from '../enums';