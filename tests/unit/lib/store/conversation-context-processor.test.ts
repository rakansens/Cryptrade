import { ConversationContextProcessor, ConversationContext } from '@/lib/store/conversation-context-processor';

describe('conversation-context-processor', () => {

  // Mock logger
  jest.mock('@/lib/utils/logger', () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }
  }));

  // Mock zustand helpers
  jest.mock('@/lib/utils/zustand-helpers', () => ({
    createStoreDebugger: () => jest.fn()
  }));
  
  it('should export ConversationContextProcessor class', () => {
    expect(ConversationContextProcessor).toBeDefined();
    expect(typeof ConversationContextProcessor).toBe('function');
  });

  it('should create an instance of ConversationContextProcessor', () => {
    const processor = new ConversationContextProcessor();
    expect(processor).toBeInstanceOf(ConversationContextProcessor);
    expect(processor.extractContext).toBeDefined();
    expect(processor.adjustResponseStyle).toBeDefined();
  });
});
