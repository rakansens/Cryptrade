import type { SpecificToolResult } from '@/lib/mastra/types/tool-results';

export interface ConversationMessageMetadata {
  intent?: string;
  confidence?: number;
  symbols?: string[];
  topics?: string[];
  embedding?: number[];
  isToolCall?: boolean;
  toolName?: string;
  toolResult?: SpecificToolResult;
  tokenCount?: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: ConversationMessageMetadata;
}

export interface ConversationSessionMetadata {
  agentIds?: string[];
  primaryTopic?: string;
  totalTokens?: number;
  toolsUsed?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  language?: string;
  tags?: string[];
}

export interface ConversationSession {
  id: string;
  userId?: string | null;
  startedAt: Date;
  lastActiveAt: Date;
  messages: ConversationMessage[];
  summary?: string | null;
  metadata?: ConversationSessionMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}
