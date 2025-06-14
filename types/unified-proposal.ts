/**
 * Unified Proposal Interface
 * 
 * @deprecated This file is deprecated. Use types from './proposals' instead.
 * All unified proposal types have been consolidated.
 * 
 * For backward compatibility, this file now re-exports from the consolidated location.
 */

export {
  // Types
  type UnifiedProposal,
  type UnifiedProposalResponse,
  type BaseProposal,
  // Type guards
  isEntryProposalGroup as isEntryProposal,
  isDrawingProposalGroup as isTrendlineProposal,
  isDrawingProposalGroup as isPatternProposal,
  // Utilities
  toUnifiedProposal,
  extractUnifiedProposals,
} from './proposals';

// Keep the ProposalType export for files that import it directly from this file
export { ProposalType } from './proposals';