import type { ProposalGroup, EntryProposalGroup } from '@/types/store.types';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: EntryProposalGroup;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}


