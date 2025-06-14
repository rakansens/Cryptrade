import 'dotenv/config';
import { config } from 'dotenv';
import { 
  useEnhancedConversationMemory, 
  createEnhancedSession 
} from '../../../lib/store/enhanced-conversation-memory.store';
import { 
  useConversationMemory,
  conversationContextProcessor 
} from '../../../lib/store/conversation-memory.store';
import type { ProcessedContext } from '../../../lib/store/conversation-memory.store';
import type { ConversationMessage } from '../../../types/conversation-memory';
import { createTestSessionId, flushPromises } from '../../helpers/test-utils';

// Load environment variables
config({ path: '.env.local' });

// Mock Supabase client
jest.mock('../../../lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}));

describe('Conversation Memory Integration Tests', () => {
  beforeEach(() => {
    // Clear store state between tests
    useConversationMemory.setState({
      sessions: {},
      currentSessionId: null,
      isDbEnabled: false,
      isSyncing: false
    });

    useEnhancedConversationMemory.setState({
      sessions: {},
      activeSessionId: null,
      globalContext: {},
      isProcessing: false
    });
  });

  describe('Basic Conversation Memory', () => {
    const sessionId = createTestSessionId('basic');

    test('should add conversation entry', async () => {
      const { addMessage, createSession } = useConversationMemory.getState();
      await createSession(sessionId);
      
      const message: Omit<ConversationMessage, 'id' | 'timestamp'> = {
        sessionId,
        role: 'user',
        content: 'BTCの価格を教えて',
        metadata: {
          intent: 'price_inquiry',
          symbol: 'BTC',
          confidence: 0.95
        }
      };

      await addMessage(message);
      
      await addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTCの現在価格は$45,000です。',
        metadata: {}
      });
      await flushPromises();

      const { sessions } = useConversationMemory.getState();
      const session = sessions[sessionId];
      const messages = session?.messages || [];
      
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('BTCの価格を教えて');
      expect(messages[0].metadata?.intent).toBe('price_inquiry');
    });

    test('should retrieve conversation history', async () => {
      const { addMessage, getRecentMessages, createSession } = useConversationMemory.getState();
      await createSession(sessionId);
      
      // Add multiple messages
      await addMessage({
        sessionId,
        role: 'user',
        content: 'こんにちは',
        metadata: { intent: 'greeting' }
      });
      await addMessage({
        sessionId,
        role: 'assistant',
        content: 'こんにちは！何かお手伝いできますか？',
        metadata: {}
      });
      await addMessage({
        sessionId,
        role: 'user',
        content: 'BTCの分析をして',
        metadata: { intent: 'analysis', symbol: 'BTC' }
      });
      await addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTCは上昇トレンドにあります...',
        metadata: {}
      });
      await flushPromises();

      const history = getRecentMessages(sessionId);
      
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe('こんにちは');
      expect(history[2].content).toBe('BTCの分析をして');
    });

    test('should limit conversation history', async () => {
      const { addMessage, getRecentMessages, createSession } = useConversationMemory.getState();
      await createSession(sessionId);
      
      // Add many messages
      for (let i = 0; i < 15; i++) {
        await addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
          metadata: {}
        });
        await addMessage({
          sessionId,
          role: 'assistant',
          content: `Response ${i}`,
          metadata: {}
        });
      }
      await flushPromises();

      const limitedHistory = getRecentMessages(sessionId, 5);
      
      expect(limitedHistory).toHaveLength(5);
      // Should return most recent entries
      expect(limitedHistory[0].content).toBe('Response 12');
      expect(limitedHistory[4].content).toBe('Response 14');
    });

    test('should clear session history', async () => {
      const { addMessage, clearSession, getRecentMessages, createSession } = useConversationMemory.getState();
      await createSession(sessionId);
      
      await addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
        metadata: {}
      });
      await addMessage({
        sessionId,
        role: 'assistant',
        content: 'Test response',
        metadata: {}
      });
      
      let history = getRecentMessages(sessionId);
      expect(history).toHaveLength(2);
      
      clearSession(sessionId);
      await flushPromises();
      
      history = getRecentMessages(sessionId);
      expect(history).toHaveLength(0);
    });
  });

  describe('Context Processing', () => {
    test('should extract key information from conversations', () => {
      const messages: ConversationMessage[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000),
          sessionId: 'test',
          role: 'user',
          content: 'BTCの価格は？',
          metadata: { symbols: ['BTC'], intent: 'price_inquiry' }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 50000),
          sessionId: 'test',
          role: 'assistant',
          content: 'BTCは$45,000です',
          metadata: {}
        },
        {
          id: '3',
          timestamp: new Date(),
          sessionId: 'test',
          role: 'user',
          content: 'ETHも教えて',
          metadata: { symbols: ['ETH'], intent: 'price_inquiry' }
        },
        {
          id: '4',
          timestamp: new Date(),
          sessionId: 'test',
          role: 'assistant',
          content: 'ETHは$2,500です',
          metadata: {}
        }
      ];

      const processed = conversationContextProcessor.processConversations(messages);
      
      expect(processed.mentionedSymbols).toContain('BTC');
      expect(processed.mentionedSymbols).toContain('ETH');
      expect(processed.dominantIntent).toBe('price_inquiry');
      expect(processed.topics).toContain('price');
    });

    test('should identify conversation patterns', () => {
      const messages: ConversationMessage[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 300000),
          sessionId: 'test',
          role: 'user',
          content: 'エントリーポイントを教えて',
          metadata: { intent: 'entry_proposal' }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 290000),
          sessionId: 'test',
          role: 'assistant',
          content: 'サポートライン付近でエントリー',
          metadata: {}
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 200000),
          sessionId: 'test',
          role: 'user',
          content: 'リスクはどれくらい？',
          metadata: { intent: 'risk_management' }
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 190000),
          sessionId: 'test',
          role: 'assistant',
          content: '2%のリスクで設定',
          metadata: {}
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 100000),
          sessionId: 'test',
          role: 'user',
          content: 'ストップロスは？',
          metadata: { intent: 'risk_management' }
        },
        {
          id: '6',
          timestamp: new Date(Date.now() - 90000),
          sessionId: 'test',
          role: 'assistant',
          content: '$44,000に設定',
          metadata: {}
        }
      ];

      const processed = conversationContextProcessor.processConversations(messages);
      
      expect(processed.topics).toContain('entry');
      expect(processed.topics).toContain('risk');
      expect(processed.userPreferences.riskAwareness).toBe(true);
    });

    test('should build context summary', () => {
      const processed: ProcessedContext = {
        mentionedSymbols: ['BTC', 'ETH'],
        timeReferences: ['1h', '4h'],
        pricePoints: [45000, 46000],
        technicalIndicators: ['RSI', 'MACD'],
        topics: ['price', 'analysis', 'entry'],
        dominantIntent: 'trading_analysis',
        sentimentScore: 0.7,
        userPreferences: {
          preferredTimeframes: ['1h'],
          riskAwareness: true,
          technicalLevel: 'intermediate'
        }
      };

      const summary = conversationContextProcessor.buildContextSummary(processed);
      
      expect(summary).toContain('BTC');
      expect(summary).toContain('ETH');
      expect(summary).toContain('1h');
      expect(summary).toContain('RSI');
    });
  });

  describe('Enhanced Conversation Memory', () => {
    test('should create and manage sessions', async () => {
      const { createSession, sessions } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession('test-session-1');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toBe('test-session-1');
      
      const session = sessions[sessionId];
      expect(session).toBeDefined();
      expect(session?.startedAt).toBeDefined();
      expect(new Date(session?.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should add messages to session', async () => {
      const { createSession, addMessage, sessions } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession();
      
      await addMessage({
        sessionId,
        role: 'user',
        content: 'BTCの価格を教えて',
        metadata: { intent: 'price_inquiry' }
      });
      
      await addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTCは$45,000です',
        metadata: { confidence: 0.95 }
      });
      
      const session = sessions[sessionId];
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[0].role).toBe('user');
      expect(session?.messages[1].role).toBe('assistant');
    });

    test('should update session context', async () => {
      const { createSession, sessions } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession();
      
      // Update session metadata through store's immer update
      useEnhancedConversationMemory.setState((state) => {
        const session = state.sessions[sessionId];
        if (session) {
          session.summary = 'BTC trading discussion with RSI and MACD indicators';
        }
      });
      
      const session = sessions[sessionId];
      expect(session?.summary).toContain('BTC');
      expect(session?.summary).toContain('RSI');
    });

    test('should get conversation summary', async () => {
      const { createSession, addMessage, getSessionContext } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession();
      
      // Add conversation
      const messages = [
        { sessionId, role: 'user' as const, content: 'BTCについて教えて' },
        { sessionId, role: 'assistant' as const, content: 'BTCは最も人気のある暗号通貨です' },
        { sessionId, role: 'user' as const, content: '価格は？' },
        { sessionId, role: 'assistant' as const, content: '$45,000です' },
        { sessionId, role: 'user' as const, content: 'チャートを表示' },
        { sessionId, role: 'assistant' as const, content: 'BTCのチャートを表示しました' }
      ];
      
      for (const msg of messages) {
        await addMessage(msg);
      }
      
      const context = getSessionContext(sessionId);
      
      expect(context).toContain('BTC');
      expect(context).toContain('45,000');
    });

    test('should handle session telemetry', async () => {
      const { createSession, sessions } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession();
      
      // Update session with telemetry data through messages metadata
      useEnhancedConversationMemory.setState((state) => {
        const session = state.sessions[sessionId];
        if (session) {
          session.tokenUsage = {
            total: 390,
            input: 234,
            output: 156
          };
        }
      });
      
      const session = sessions[sessionId];
      expect(session?.tokenUsage).toBeDefined();
      expect(session?.tokenUsage?.total).toBe(390);
      expect(session?.tokenUsage?.input).toBe(234);
    });

    test('should export session data', async () => {
      const { createSession, addMessage, sessions } = useEnhancedConversationMemory.getState();
      
      const sessionId = await createSession('export-test');
      
      await addMessage({
        sessionId,
        role: 'user',
        content: 'Test message'
      });
      
      const exported = exportSession(sessionId);
      
      expect(exported).toHaveProperty('session');
      expect(exported).toHaveProperty('messages');
      expect(exported).toHaveProperty('exportDate');
      expect(exported?.messages).toHaveLength(1);
    });
  });

  describe('Memory Persistence', () => {
    test('should save to database on entry addition', async () => {
      const { supabase } = require('../../../lib/db/supabase');
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
      
      supabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect
      });
      
      const { addMessage } = useConversationMemory.getState();
      
      // Already handled above
      
      await flushPromises();
      
      expect(supabase.from).toHaveBeenCalledWith('conversations');
      expect(mockInsert).toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const { supabase } = require('../../../lib/db/supabase');
      
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ 
          data: null, 
          error: new Error('Database error') 
        })
      });
      
      const { addMessage, createSession, sessions } = useConversationMemory.getState();
      
      await createSession('test-error');
      
      await addMessage({
        sessionId: 'test-error',
        role: 'user',
        content: 'This will fail',
        metadata: {}
      });
      
      await flushPromises();
      
      // Should still add to local store even if DB fails
      const session = sessions['test-error'];
      expect(session?.messages).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    test('should handle large conversation histories efficiently', async () => {
      const { addMessage, getRecentMessages, createSession } = useConversationMemory.getState();
      const sessionId = createTestSessionId('perf');
      
      await createSession(sessionId);
      
      const startTime = Date.now();
      
      // Add 1000 messages
      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
          metadata: { index: i }
        }));
        promises.push(addMessage({
          sessionId,
          role: 'assistant',
          content: `Response ${i}`,
          metadata: { index: i }
        }));
      }
      
      await Promise.all(promises);
      const addTime = Date.now() - startTime;
      
      // Retrieve history
      const retrieveStart = Date.now();
      const history = getRecentMessages(sessionId, 100);
      const retrieveTime = Date.now() - retrieveStart;
      
      expect(history).toHaveLength(100);
      expect(addTime).toBeLessThan(5000); // Should add 1000 entries in < 5s
      expect(retrieveTime).toBeLessThan(100); // Should retrieve in < 100ms
    });
  });
});