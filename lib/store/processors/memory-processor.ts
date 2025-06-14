import type { ConversationMessage } from '@/types/conversation-memory';

export interface MemoryProcessor {
  process(messages: ConversationMessage[]): ConversationMessage[];
  getName(): string;
}
