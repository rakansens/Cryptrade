import { TokenLimiter } from '../token-limiter';
import type { ConversationMessage } from '@/types/conversation-memory';

describe('TokenLimiter', () => {
  it('limits messages by estimated tokens', () => {
    const limiter = new TokenLimiter(5);
    const base: Omit<ConversationMessage, 'id' | 'timestamp'> = {
      sessionId: 's',
      role: 'user',
      content: 'aaaaaa',
    };
    const messages: ConversationMessage[] = Array.from({ length: 3 }).map((_, i) => ({
      ...base,
      id: String(i),
      timestamp: new Date(),
      content: 'aaaaaa',
    }));
    const result = limiter.process(messages);
    expect(result.length).toBeLessThan(messages.length);
  });
});
