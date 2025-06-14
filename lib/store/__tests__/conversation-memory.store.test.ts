import { useConversationMemory, semanticSearch, calculateSimilarity } from '../conversation-memory.store';

describe('ConversationMemory Store', () => {
  beforeEach(() => {
    // Clear store before each test
    useConversationMemory.setState({
      sessions: {},
      currentSessionId: null,
    });
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-\d+$/);
      
      const state = useConversationMemory.getState();
      expect(state.sessions[sessionId]).toBeDefined();
      expect(state.currentSessionId).toBe(sessionId);
    });

    it('should create session with custom ID', () => {
      const customId = 'custom-session-123';
      const sessionId = useConversationMemory.getState().createSession(customId);
      
      expect(sessionId).toBe(customId);
      expect(useConversationMemory.getState().sessions[customId]).toBeDefined();
    });

    it('should clear a session', () => {
      const sessionId = useConversationMemory.getState().createSession();
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      useConversationMemory.getState().clearSession(sessionId);
      
      const state = useConversationMemory.getState();
      expect(state.sessions[sessionId]).toBeUndefined();
      expect(state.currentSessionId).toBeNull();
    });
  });

  describe('Message Management', () => {
    it('should add messages to session', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Hello, how much is BTC?',
      });
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTC is currently trading at $45,000',
        agentId: 'price_inquiry',
      });
      
      const messages = useConversationMemory.getState().sessions[sessionId].messages;
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should auto-create session if not exists', () => {
      const sessionId = 'non-existent-session';
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      expect(useConversationMemory.getState().sessions[sessionId]).toBeDefined();
    });

    it('should limit messages to 50 per session', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      // Add 55 messages
      for (let i = 0; i < 55; i++) {
        useConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const messages = useConversationMemory.getState().sessions[sessionId].messages;
      expect(messages).toHaveLength(50);
      expect(messages[0].content).toBe('Message 5'); // First 5 should be removed
    });
  });

  describe('Recent Messages', () => {
    it('should get recent messages with default limit', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        useConversationMemory.getState().addMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      const recent = useConversationMemory.getState().getRecentMessages(sessionId);
      expect(recent).toHaveLength(8); // Default limit
      expect(recent[0].content).toBe('Message 2');
      expect(recent[7].content).toBe('Message 9');
    });

    it('should get recent messages with custom limit', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        useConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const recent = useConversationMemory.getState().getRecentMessages(sessionId, 5);
      expect(recent).toHaveLength(5);
      expect(recent[0].content).toBe('Message 5');
    });
  });

  describe('Session Context', () => {
    it('should build context from recent messages', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'What is the price of BTC?',
      });
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTC is at $45,000',
      });
      
      const context = useConversationMemory.getState().getSessionContext(sessionId);
      expect(context).toContain('User: What is the price of BTC?');
      expect(context).toContain('Assistant: BTC is at $45,000');
    });

    it('should include session summary in context', async () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      // Add messages with metadata
      for (let i = 0; i < 5; i++) {
        useConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Question about BTC ${i}`,
          metadata: {
            symbols: ['BTC'],
            topics: ['price', 'trading'],
          },
        });
      }
      
      await useConversationMemory.getState().summarizeSession(sessionId);
      
      const context = useConversationMemory.getState().getSessionContext(sessionId);
      expect(context).toContain('Session Summary:');
      expect(context).toContain('BTC');
    });
  });

  describe('Message Search', () => {
    it('should search messages by content', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Tell me about Bitcoin',
      });
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'What is Ethereum?',
      });
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Bitcoin price analysis',
      });
      
      const results = useConversationMemory.getState().searchMessages('Bitcoin');
      expect(results).toHaveLength(2);
      expect(results[0].content).toContain('Bitcoin');
    });

    it('should search across all sessions when no sessionId provided', () => {
      const session1 = useConversationMemory.getState().createSession();
      const session2 = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId: session1,
        role: 'user',
        content: 'BTC analysis',
      });
      
      useConversationMemory.getState().addMessage({
        sessionId: session2,
        role: 'user',
        content: 'BTC price',
      });
      
      const results = useConversationMemory.getState().searchMessages('BTC');
      expect(results).toHaveLength(2);
    });

    it('should search by metadata symbols', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Generic question',
        metadata: {
          symbols: ['ETH', 'BTC'],
        },
      });
      
      const results = useConversationMemory.getState().searchMessages('ETH');
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.symbols).toContain('ETH');
    });
  });

  describe('Metadata Update', () => {
    it('should update message metadata', () => {
      const sessionId = useConversationMemory.getState().createSession();
      
      useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      const message = useConversationMemory.getState().sessions[sessionId].messages[0];
      const messageId = message.id;
      
      useConversationMemory.getState().updateMessageMetadata(messageId, {
        intent: 'price_inquiry',
        confidence: 0.95,
      });
      
      const updatedMessage = useConversationMemory.getState().sessions[sessionId].messages[0];
      expect(updatedMessage.metadata?.intent).toBe('price_inquiry');
      expect(updatedMessage.metadata?.confidence).toBe(0.95);
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate cosine similarity correctly', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(1); // Identical vectors
    });

    it('should handle orthogonal vectors', () => {
      const embedding1 = [1, 0];
      const embedding2 = [0, 1];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(0); // Orthogonal vectors
    });

    it('should handle opposite vectors', () => {
      const embedding1 = [1, 0];
      const embedding2 = [-1, 0];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(-1); // Opposite vectors
    });

    it('should handle empty or mismatched embeddings', () => {
      expect(calculateSimilarity([], [])).toBe(0);
      expect(calculateSimilarity([1, 2], [1, 2, 3])).toBe(0);
      expect(calculateSimilarity(null as any, [1, 2])).toBe(0);
    });
  });
});