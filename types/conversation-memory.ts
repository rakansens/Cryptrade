export interface ConversationMessageMetadata {
  intent?: string;
  confidence?: number;
  symbols?: string[];
  topics?: string[];
  embedding?: number[];
  isToolCall?: boolean;
  toolName?: string;
  toolResult?: any;
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

export interface ConversationSession {
  id: string;
  startedAt: Date;
  lastActiveAt: Date;
  messages: ConversationMessage[];
  summary?: string;
}
