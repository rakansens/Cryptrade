import type { ConversationMessage } from '@/types/conversation-memory';
import type { MemoryProcessor } from './memory-processor';

export class ToolCallFilter implements MemoryProcessor {
  private excludedTools: string[];
  private includeAllTools: boolean;

  constructor(options: { exclude?: string[]; includeAll?: boolean } = {}) {
    this.excludedTools = options.exclude || [];
    this.includeAllTools = options.includeAll || false;
  }

  process(messages: ConversationMessage[]): ConversationMessage[] {
    return messages.filter(msg => {
      if (msg.role === 'user') return true;
      if (msg.metadata?.isToolCall) {
        const name = msg.metadata.toolName;
        if (this.includeAllTools) return true;
        if (this.excludedTools.length > 0) {
          return !this.excludedTools.includes(name || '');
        }
        return false;
      }
      return true;
    });
  }

  getName(): string {
    return `ToolCallFilter(exclude: [${this.excludedTools.join(', ')}])`;
  }
}
