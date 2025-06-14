import { ToolCallFilter } from '../tool-call-filter';
import type { ConversationMessage } from '@/types/conversation-memory';

describe('ToolCallFilter', () => {
  it('filters tool call messages by default', () => {
    const filter = new ToolCallFilter();
    const msgs: ConversationMessage[] = [
      { id: '1', sessionId: 's', role: 'assistant', content: 'tool', timestamp: new Date(), metadata: { isToolCall: true, toolName: 't' } },
      { id: '2', sessionId: 's', role: 'user', content: 'hi', timestamp: new Date() }
    ];
    const result = filter.process(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('keeps tool calls when includeAll is true', () => {
    const filter = new ToolCallFilter({ includeAll: true });
    const msgs: ConversationMessage[] = [
      { id: '1', sessionId: 's', role: 'assistant', content: 'tool', timestamp: new Date(), metadata: { isToolCall: true, toolName: 't' } }
    ];
    const result = filter.process(msgs);
    expect(result).toHaveLength(1);
  });
});
