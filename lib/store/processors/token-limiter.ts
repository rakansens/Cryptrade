import { logger } from '@/lib/utils/logger';
import type { ConversationMessage } from '@/types/conversation-memory';
import type { MemoryProcessor } from './memory-processor';

export class TokenLimiter implements MemoryProcessor {
  private estimatedTokensPerChar = 0.25;
  constructor(private maxTokens: number = 127000) {}

  process(messages: ConversationMessage[]): ConversationMessage[] {
    let totalTokens = 0;
    const filtered: ConversationMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const est = Math.ceil(m.content.length * this.estimatedTokensPerChar);
      if (totalTokens + est <= this.maxTokens) {
        filtered.unshift(m);
        totalTokens += est;
      } else {
        break;
      }
    }
    if (filtered.length < messages.length) {
      logger.info('[TokenLimiter] Filtered messages for token limit', {
        original: messages.length,
        filtered: filtered.length,
        estimatedTokens: totalTokens,
        maxTokens: this.maxTokens,
      });
    }
    return filtered;
  }

  getName(): string {
    return `TokenLimiter(${this.maxTokens})`;
  }
}
