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
import type { ConversationEntry, ProcessedContext } from '../../../lib/store/conversation-memory.store';
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
      entries: new Map(),
      isLoading: false,
      error: null
    });

    useEnhancedConversationMemory.setState({
      sessions: new Map(),
      activeSessionId: null,
      globalContext: {},
      isProcessing: false
    });
  });

  describe('Basic Conversation Memory', () => {
    const sessionId = createTestSessionId('basic');

    test('should add conversation entry', async () => {
      const { addEntry } = useConversationMemory.getState();
      
      const entry: Omit<ConversationEntry, 'id' | 'timestamp'> = {
        sessionId,
        userMessage: 'BTCの価格を教えて',
        assistantResponse: 'BTCの現在価格は$45,000です。',
        context: {
          intent: 'price_inquiry',
          symbol: 'BTC',
          confidence: 0.95
        }
      };

      await addEntry(entry);
      await flushPromises();

      const { entries } = useConversationMemory.getState();
      const sessionEntries = entries.get(sessionId);
      
      expect(sessionEntries).toHaveLength(1);
      expect(sessionEntries![0].userMessage).toBe('BTCの価格を教えて');
      expect(sessionEntries![0].context.intent).toBe('price_inquiry');
    });

    test('should retrieve conversation history', async () => {
      const { addEntry, getHistory } = useConversationMemory.getState();
      
      // Add multiple entries
      const entries = [
        {
          sessionId,
          userMessage: 'こんにちは',
          assistantResponse: 'こんにちは！何かお手伝いできますか？',
          context: { intent: 'greeting' }
        },
        {
          sessionId,
          userMessage: 'BTCの分析をして',
          assistantResponse: 'BTCは上昇トレンドにあります...',
          context: { intent: 'analysis', symbol: 'BTC' }
        }
      ];

      for (const entry of entries) {
        await addEntry(entry);
      }
      await flushPromises();

      const history = await getHistory(sessionId);
      
      expect(history).toHaveLength(2);
      expect(history[0].userMessage).toBe('こんにちは');
      expect(history[1].userMessage).toBe('BTCの分析をして');
    });

    test('should limit conversation history', async () => {
      const { addEntry, getHistory } = useConversationMemory.getState();
      
      // Add many entries
      for (let i = 0; i < 15; i++) {
        await addEntry({
          sessionId,
          userMessage: `Message ${i}`,
          assistantResponse: `Response ${i}`,
          context: {}
        });
      }
      await flushPromises();

      const limitedHistory = await getHistory(sessionId, 5);
      
      expect(limitedHistory).toHaveLength(5);
      // Should return most recent entries
      expect(limitedHistory[0].userMessage).toBe('Message 10');
      expect(limitedHistory[4].userMessage).toBe('Message 14');
    });

    test('should clear session history', async () => {
      const { addEntry, clearSession, getHistory } = useConversationMemory.getState();
      
      await addEntry({
        sessionId,
        userMessage: 'Test message',
        assistantResponse: 'Test response',
        context: {}
      });
      
      let history = await getHistory(sessionId);
      expect(history).toHaveLength(1);
      
      await clearSession(sessionId);
      await flushPromises();
      
      history = await getHistory(sessionId);
      expect(history).toHaveLength(0);
    });
  });

  describe('Context Processing', () => {
    test('should extract key information from conversations', () => {
      const entries: ConversationEntry[] = [
        {
          id: '1',
          timestamp: Date.now() - 60000,
          sessionId: 'test',
          userMessage: 'BTCの価格は？',
          assistantResponse: 'BTCは$45,000です',
          context: { symbol: 'BTC', intent: 'price_inquiry' }
        },
        {
          id: '2',
          timestamp: Date.now(),
          sessionId: 'test',
          userMessage: 'ETHも教えて',
          assistantResponse: 'ETHは$2,500です',
          context: { symbol: 'ETH', intent: 'price_inquiry' }
        }
      ];

      const processed = conversationContextProcessor.processConversations(entries);
      
      expect(processed.mentionedSymbols).toContain('BTC');
      expect(processed.mentionedSymbols).toContain('ETH');
      expect(processed.dominantIntent).toBe('price_inquiry');
      expect(processed.topics).toContain('price');
    });

    test('should identify conversation patterns', () => {
      const entries: ConversationEntry[] = [
        {
          id: '1',
          timestamp: Date.now() - 300000,
          sessionId: 'test',
          userMessage: 'エントリーポイントを教えて',
          assistantResponse: 'サポートライン付近でエントリー',
          context: { intent: 'entry_proposal' }
        },
        {
          id: '2',
          timestamp: Date.now() - 200000,
          sessionId: 'test',
          userMessage: 'リスクはどれくらい？',
          assistantResponse: '2%のリスクで設定',
          context: { intent: 'risk_management' }
        },
        {
          id: '3',
          timestamp: Date.now() - 100000,
          sessionId: 'test',
          userMessage: 'ストップロスは？',
          assistantResponse: '$44,000に設定',
          context: { intent: 'risk_management' }
        }
      ];

      const processed = conversationContextProcessor.processConversations(entries);
      
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
    test('should create and manage sessions', () => {
      const { createSession, getSession } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession({
        userId: 'user-123',
        metadata: { source: 'web', browser: 'chrome' }
      });
      
      expect(sessionId).toBeDefined();
      
      const session = getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.metadata.source).toBe('web');
      expect(session?.startTime).toBeLessThanOrEqual(Date.now());
    });

    test('should add messages to session', () => {
      const { createSession, addMessage, getSession } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession();
      
      addMessage(sessionId, {
        role: 'user',
        content: 'BTCの価格を教えて',
        metadata: { intent: 'price_inquiry' }
      });
      
      addMessage(sessionId, {
        role: 'assistant',
        content: 'BTCは$45,000です',
        metadata: { confidence: 0.95 }
      });
      
      const session = getSession(sessionId);
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[0].role).toBe('user');
      expect(session?.messages[1].role).toBe('assistant');
    });

    test('should update session context', () => {
      const { createSession, updateSessionContext, getSession } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession();
      
      updateSessionContext(sessionId, {
        currentSymbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: ['RSI', 'MACD']
      });
      
      const session = getSession(sessionId);
      expect(session?.context.currentSymbol).toBe('BTCUSDT');
      expect(session?.context.indicators).toContain('RSI');
    });

    test('should get conversation summary', () => {
      const { createSession, addMessage, getConversationSummary } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession();
      
      // Add conversation
      const messages = [
        { role: 'user' as const, content: 'BTCについて教えて' },
        { role: 'assistant' as const, content: 'BTCは最も人気のある暗号通貨です' },
        { role: 'user' as const, content: '価格は？' },
        { role: 'assistant' as const, content: '$45,000です' },
        { role: 'user' as const, content: 'チャートを表示' },
        { role: 'assistant' as const, content: 'BTCのチャートを表示しました' }
      ];
      
      messages.forEach(msg => addMessage(sessionId, msg));
      
      const summary = getConversationSummary(sessionId);
      
      expect(summary.totalMessages).toBe(6);
      expect(summary.topics).toContain('BTC');
      expect(summary.mainIntent).toBeDefined();
    });

    test('should handle session telemetry', () => {
      const { createSession, addTelemetry, getSession } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession();
      
      addTelemetry(sessionId, {
        event: 'tool_called',
        tool: 'price_lookup',
        duration: 234,
        success: true
      });
      
      addTelemetry(sessionId, {
        event: 'api_call',
        endpoint: '/api/binance/ticker',
        duration: 156,
        success: true
      });
      
      const session = getSession(sessionId);
      expect(session?.telemetry).toHaveLength(2);
      expect(session?.telemetry[0].event).toBe('tool_called');
      expect(session?.telemetry[1].duration).toBe(156);
    });

    test('should export session data', () => {
      const { createSession, addMessage, exportSession } = useEnhancedConversationMemory.getState();
      
      const sessionId = createSession({ userId: 'test-user' });
      
      addMessage(sessionId, {
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
      
      const { addEntry } = useConversationMemory.getState();
      
      await addEntry({
        sessionId: 'test-db',
        userMessage: 'Save to DB',
        assistantResponse: 'Saved',
        context: {}
      });
      
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
      
      const { addEntry, error } = useConversationMemory.getState();
      
      await addEntry({
        sessionId: 'test-error',
        userMessage: 'This will fail',
        assistantResponse: 'Error',
        context: {}
      });
      
      await flushPromises();
      
      // Should still add to local store even if DB fails
      const { entries } = useConversationMemory.getState();
      expect(entries.get('test-error')).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    test('should handle large conversation histories efficiently', async () => {
      const { addEntry, getHistory } = useConversationMemory.getState();
      const sessionId = createTestSessionId('perf');
      
      const startTime = Date.now();
      
      // Add 1000 entries
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(addEntry({
          sessionId,
          userMessage: `Message ${i}`,
          assistantResponse: `Response ${i}`,
          context: { index: i }
        }));
      }
      
      await Promise.all(promises);
      const addTime = Date.now() - startTime;
      
      // Retrieve history
      const retrieveStart = Date.now();
      const history = await getHistory(sessionId, 100);
      const retrieveTime = Date.now() - retrieveStart;
      
      expect(history).toHaveLength(100);
      expect(addTime).toBeLessThan(5000); // Should add 1000 entries in < 5s
      expect(retrieveTime).toBeLessThan(100); // Should retrieve in < 100ms
    });
  });
});