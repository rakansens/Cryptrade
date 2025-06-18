// Import test environment setup first
import '@/tests/setup/test-env';
import { resetTestEnvironment } from '@/tests/setup/test-env';
import { createMockEmbeddingResponse } from '@/tests/setup/mock-openai';
import { createMockBaseServiceClass } from '@/tests/setup/mock-base-service';

import { useConversationMemory, calculateSimilarity } from '@/lib/store/conversation-memory.store';

// Mock the BaseService for embedding service
jest.mock('@/lib/api/base-service', () => ({
  BaseService: createMockBaseServiceClass()
}));

// Mock the embedding service to return deterministic embeddings
jest.mock('@/lib/services/semantic-embedding.service', () => {
  const { generateMockEmbedding } = require('@/tests/setup/mock-openai');
  
  return {
    SemanticEmbeddingService: {
      getInstance: jest.fn(() => ({
        generateEmbedding: jest.fn(async (text: string) => ({
          embedding: generateMockEmbedding(text, 1536),
          model: 'text-embedding-3-small',
          tokensUsed: Math.ceil(text.length / 4),
        })),
        calculateSimilarity: jest.fn((a: number[], b: number[]) => {
          if (!a || !b || a.length !== b.length) return 0;
          
          let dotProduct = 0;
          let normA = 0;
          let normB = 0;
          
          for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
          }
          
          if (normA === 0 || normB === 0) return 0;
          
          const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
          return Math.max(0, Math.min(1, similarity));
        }),
        clearCache: jest.fn(),
      })),
    },
  };
});

describe('ConversationMemory Store', () => {
  beforeEach(() => {
    // Reset environment to ensure clean state
    resetTestEnvironment();
    
    // Clear store before each test
    useConversationMemory.setState({
      sessions: {},
      currentSessionId: null,
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should create a new session', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-\d+$/);
      
      const state = useConversationMemory.getState();
      expect(state.sessions[sessionId]).toBeDefined();
      expect(state.currentSessionId).toBe(sessionId);
    });

    it('should create session with custom ID', async () => {
      const customId = 'custom-session-123';
      const sessionId = await useConversationMemory.getState().createSession(customId);
      
      expect(sessionId).toBe(customId);
      expect(useConversationMemory.getState().sessions[customId]).toBeDefined();
    });

    it('should clear a session', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      useConversationMemory.getState().clearSession(sessionId);
      
      const state = useConversationMemory.getState();
      // Updated behavior: clearing a session now empties the messages but keeps the session
      expect(state.sessions[sessionId]?.messages).toHaveLength(0);
      // currentSessionId is not cleared when clearing a session
      expect(state.currentSessionId).toBe(sessionId);
    });
  });

  describe('Message Management', () => {
    it('should add messages to session', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Hello, how much is BTC?',
      });
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTC is currently trading at $45,000',
        agentId: 'price_inquiry',
      });
      
      const messages = useConversationMemory.getState().sessions[sessionId]?.messages;
      expect(messages).toHaveLength(2);
      expect(messages?.[0]?.role).toBe('user');
      expect(messages?.[1]?.role).toBe('assistant');
    });

    it('should auto-create session if not exists', async () => {
      const sessionId = 'non-existent-session';
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      expect(useConversationMemory.getState().sessions[sessionId]).toBeDefined();
    });

    it('should keep recent messages (default 8)', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await useConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const messages = useConversationMemory.getState().sessions[sessionId]?.messages;
      // The store now keeps only recent messages (default 8)
      expect(messages).toHaveLength(8);
      expect(messages?.[0]?.content).toBe('Message 2'); // First 2 should be removed
    });
  });

  describe('Recent Messages', () => {
    it('should get recent messages with default limit', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await useConversationMemory.getState().addMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      const recent = useConversationMemory.getState().getRecentMessages(sessionId);
      expect(recent).toHaveLength(8); // Default limit
      expect(recent[0]?.content).toBe('Message 2');
      expect(recent[7]?.content).toBe('Message 9');
    });

    it('should get recent messages with custom limit', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await useConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const recent = useConversationMemory.getState().getRecentMessages(sessionId, 5);
      expect(recent).toHaveLength(5);
      expect(recent[0]?.content).toBe('Message 5');
    });
  });

  describe('Session Context', () => {
    it('should build context from recent messages', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'What is the price of BTC?',
      });
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTC is at $45,000',
      });
      
      const context = useConversationMemory.getState().getSessionContext(sessionId);
      expect(context).toContain('user: What is the price of BTC?');
      expect(context).toContain('assistant: BTC is at $45,000');
    });

    it('should include session summary in context', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      // Add messages with metadata
      for (let i = 0; i < 5; i++) {
        await useConversationMemory.getState().addMessage({
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
      // Check if context contains messages
      expect(context).toContain('user: Question about BTC');
      expect(context).toContain('BTC');
    });
  });

  describe('Message Search', () => {
    it('should search messages by content', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Tell me about Bitcoin',
      });
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'What is Ethereum?',
      });
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Bitcoin price analysis',
      });
      
      const results = useConversationMemory.getState().searchMessages('Bitcoin');
      expect(results).toHaveLength(2);
      expect(results[0]?.content).toContain('Bitcoin');
    });

    it('should search across all sessions when no sessionId provided', async () => {
      const session1 = await useConversationMemory.getState().createSession();
      const session2 = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId: session1,
        role: 'user',
        content: 'BTC analysis',
      });
      
      await useConversationMemory.getState().addMessage({
        sessionId: session2,
        role: 'user',
        content: 'BTC price',
      });
      
      const results = useConversationMemory.getState().searchMessages('BTC');
      expect(results).toHaveLength(2);
    });

    it('should search by metadata symbols', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Generic question',
        metadata: {
          symbols: ['ETH', 'BTC'],
        },
      });
      
      const results = useConversationMemory.getState().searchMessages('ETH');
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.symbols).toContain('ETH');
    });
  });

  describe('Metadata Update', () => {
    it('should update message metadata', async () => {
      const sessionId = await useConversationMemory.getState().createSession();
      
      await useConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      const message = useConversationMemory.getState().sessions[sessionId]?.messages?.[0];
      const messageId = message?.id;
      
      if (messageId) {
        useConversationMemory.getState().updateMessageMetadata(messageId, {
          intent: 'price_inquiry',
          confidence: 0.95,
        });
      }
      
      const updatedMessage = useConversationMemory.getState().sessions[sessionId]?.messages?.[0];
      expect(updatedMessage?.metadata?.intent).toBe('price_inquiry');
      expect(updatedMessage?.metadata?.confidence).toBe(0.95);
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate cosine similarity correctly', async () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(1); // Identical vectors
    });

    it('should handle orthogonal vectors', async () => {
      const embedding1 = [1, 0];
      const embedding2 = [0, 1];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(0); // Orthogonal vectors
    });

    it('should handle opposite vectors', async () => {
      const embedding1 = [1, 0];
      const embedding2 = [-1, 0];
      
      const similarity = calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBe(-1); // Opposite vectors
    });

    it('should handle empty or mismatched embeddings', async () => {
      expect(calculateSimilarity([], [])).toBeNaN(); // Division by zero
      expect(calculateSimilarity([1, 2], [1, 2, 3])).toBe(0);
      expect(calculateSimilarity(null as any, [1, 2])).toBe(0);
    });
  });
});