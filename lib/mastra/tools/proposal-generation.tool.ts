/**
 * Proposal Generation Tool (Legacy Wrapper)
 * 
 * 後方互換性のため、既存のインポートをサポートする薄いラッパー
 * 実際の実装は新しいモジュール化されたコードを使用
 */

import { ProposalGenerationTool } from './proposal-generation';

// Lowercase export for backward compatibility
export const proposalGenerationTool = ProposalGenerationTool;

// PascalCase export for new code
export { ProposalGenerationTool } from './proposal-generation';

// Type exports
export type { 
  ProposalGenerationInput, 
  ProposalGenerationOutput,
  ProposalGroup 
} from './proposal-generation';

// Schema exports
export { 
  ProposalGenerationInputSchema, 
  ProposalGenerationOutputSchema 
} from './proposal-generation';