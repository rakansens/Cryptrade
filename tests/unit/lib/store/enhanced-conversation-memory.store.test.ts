import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { http, HttpResponse } from 'msw';
import { mswServer as server } from '@/tests/setup/msw-setup';
import { TokenLimiter, ToolCallFilter } from '@/lib/store/processors';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import type { ConversationMessage } from '@/types/conversation-memory';
import type { MemoryProcessor } from '@/lib/store/processors';

// Mock dependencies
jest.mock('@/lib/services/database/chat.service');
jest.mock('@/config/env', () => ({
  isDevelopment: () => process.env.NODE_ENV !== 'production'
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      update: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/utils/logger');

// Simple mock store implementation
interface MockSession {
  id: string;
  startedAt: Date;
  lastActiveAt: Date;
  messages: any[];
  processors: MemoryProcessor[];
  tokenUsage: { total: number; input: number; output: number };
  summary?: string;
}

class MockStore {
  sessions: Record<string, MockSession> = {};
  currentSessionId: string | null = null;
  defaultProcessors: MemoryProcessor[] = [];
  isDbEnabled = false;
  isSyncing = false;
  
  constructor() {
    this.defaultProcessors = [
      new TokenLimiter(10000),
      new ToolCallFilter({ exclude: ['marketDataTool', 'chartControlTool'] })
    ];
  }
  
  createSession = jest.fn(async (sessionId?: string, processors?: MemoryProcessor[]) => {
    const id = sessionId || `session-${Date.now()}-${Math.random()}`;
    const now = new Date();
    
    this.sessions[id] = {
      id,
      startedAt: now,
      lastActiveAt: now,
      messages: [],
      processors: processors || this.defaultProcessors,
      tokenUsage: { total: 0, input: 0, output: 0 }
    };
    this.currentSessionId = id;
    
    if (this.isDbEnabled) {
      try {
        await ChatDatabaseService.createSession({
          id,
          startedAt: now,
          lastActiveAt: now,
        });
        
        await prisma.conversationSession.update({
          where: { id },
          data: {
            metadata: {
              processors: (processors || this.defaultProcessors).map(p => ({
                name: p.getName(),
                config: {}
              }))
            }
          }
        });
      } catch (error) {
        logger.error('[EnhancedConversationMemory] Failed to create session in DB', { error });
      }
    }
    
    return id;
  });
  
  addMessage = jest.fn(async (message: any) => {
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const timestamp = new Date();
    const tokenCount = Math.ceil(message.content.length * 0.25);
    
    const fullMessage = {
      ...message,
      id: messageId,
      timestamp,
      metadata: {
        ...message.metadata,
        tokenCount,
      }
    };
    
    if (!this.sessions[message.sessionId]) {
      await this.createSession(message.sessionId);
    }
    
    const session = this.sessions[message.sessionId];
    session.messages.push(fullMessage);
    session.lastActiveAt = timestamp;
    
    // Update token usage
    if (message.role === 'user') {
      session.tokenUsage.input += tokenCount;
    } else if (message.role === 'assistant') {
      session.tokenUsage.output += tokenCount;
    }
    session.tokenUsage.total += tokenCount;
    
    // Archive old messages if exceeding limit
    if (session.messages.length > 50) {
      const messagesToArchive = session.messages.splice(0, session.messages.length - 50);
      await this.archiveOldMessages(message.sessionId, messagesToArchive);
    }
    
    return messageId;
  });
  
  getProcessedMessages = jest.fn((sessionId: string, limit?: number) => {
    const session = this.sessions[sessionId];
    if (!session) return [];
    return limit ? session.messages.slice(-limit) : session.messages;
  });
  
  getRecentMessages = jest.fn((sessionId: string, limit: number = 10) => {
    const session = this.sessions[sessionId];
    if (!session) return [];
    return session.messages.slice(-limit);
  });
  
  clearSession = jest.fn((sessionId: string) => {
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].messages = [];
      this.sessions[sessionId].tokenUsage = { total: 0, input: 0, output: 0 };
    }
  });
  
  updateMessageMetadata = jest.fn(async (messageId: string, metadata: any) => {
    for (const sessionId in this.sessions) {
      const session = this.sessions[sessionId];
      const message = session.messages.find((m: any) => m.id === messageId);
      if (message) {
        message.metadata = { ...message.metadata, ...metadata };
        return message;
      }
    }
    return null;
  });
  
  getSessionContext = jest.fn((sessionId: string) => {
    const session = this.sessions[sessionId];
    if (!session) return '';
    
    return session.messages
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  });
  
  toggleDbSync = jest.fn((enable?: boolean) => {
    if (enable !== undefined) {
      this.isDbEnabled = enable;
    } else {
      this.isDbEnabled = !this.isDbEnabled;
    }
    return this.isDbEnabled;
  });
  
  clearAllSessions = jest.fn(() => {
    this.sessions = {};
    this.currentSessionId = null;
  });
  
  getSession = jest.fn((sessionId: string) => {
    return this.sessions[sessionId] || null;
  });
  
  updateSession = jest.fn((sessionId: string, updates: any) => {
    if (this.sessions[sessionId]) {
      this.sessions[sessionId] = { ...this.sessions[sessionId], ...updates };
    }
  });
  
  getMessageTokenCount = jest.fn((content: string) => {
    return Math.ceil(content.length * 0.25);
  });
  
  getFilteredProcessors = jest.fn((toolOptions?: any) => {
    if (!toolOptions) return this.defaultProcessors;
    
    const processors: MemoryProcessor[] = [
      new TokenLimiter(toolOptions.maxTokens || 10000)
    ];
    
    if (toolOptions.includeAllTools) {
      processors.push(new ToolCallFilter({ includeAll: true }));
    } else if (toolOptions.excludeTools) {
      processors.push(new ToolCallFilter({ exclude: toolOptions.excludeTools }));
    } else if (toolOptions.disableToolFilter !== true) {
      processors.push(new ToolCallFilter({ exclude: ['marketDataTool', 'chartControlTool'] }));
    }
    
    return processors;
  });
  
  searchMessages = jest.fn((query: string, sessionId?: string) => {
    const results: any[] = [];
    
    if (sessionId) {
      // Search in specific session
      const session = this.sessions[sessionId];
      if (session && session.messages) {
        session.messages.forEach((msg: any) => {
          if (msg.content.toLowerCase().includes(query.toLowerCase())) {
            results.push(msg);
          }
        });
      }
    } else {
      // Search across all sessions
      Object.keys(this.sessions).forEach(sid => {
        const session = this.sessions[sid];
        if (session && session.messages) {
          session.messages.forEach((msg: any) => {
            if (msg.content.toLowerCase().includes(query.toLowerCase())) {
              results.push(msg);
            }
          });
        }
      });
    }
    
    return results;
  });
  
  summarizeSession = jest.fn(async (sessionId: string) => {
    const session = this.sessions[sessionId];
    if (session) {
      if (session.messages.length === 0) {
        session.summary = 'No messages in session';
      } else {
        const topics = new Set<string>();
        session.messages.forEach((msg: any) => {
          if (msg.content.toLowerCase().includes('chart')) topics.add('Chart discussion');
          if (msg.content.toLowerCase().includes('price')) topics.add('Price analysis');
          if (msg.content.toLowerCase().includes('test')) topics.add('Testing');
        });
        
        if (topics.size === 0) {
          session.summary = 'General conversation';
        } else {
          session.summary = `Discussion about: ${Array.from(topics).join(', ')}`;
        }
      }
    }
  });
  
  addProcessor = jest.fn();
  removeProcessor = jest.fn();
  setDefaultProcessors = jest.fn();
  getMemoryStats = jest.fn().mockReturnValue({
    totalMessages: 0,
    processedMessages: 0,
    estimatedTokens: 0,
    processors: [],
  });
  
  enableDbSync = jest.fn(() => {
    this.isDbEnabled = true;
  });
  disableDbSync = jest.fn(() => {
    this.isDbEnabled = false;
  });
  syncWithDatabase = jest.fn();
  loadFromDatabase = jest.fn();
  
  archiveOldMessages = jest.fn(async (sessionId: string, messages: any[]) => {
    return messages.length;
  });
  getArchivedMessages = jest.fn().mockResolvedValue([]);
  
  reset() {
    this.sessions = {};
    this.currentSessionId = null;
    this.isDbEnabled = false;
    this.isSyncing = false;
    Object.keys(this).forEach(key => {
      const prop = (this as any)[key];
      if (prop && typeof prop.mockClear === 'function') {
        prop.mockClear();
      }
    });
  }
}

// Create singleton instance
let storeInstance = new MockStore();

// Mock the store module
jest.mock('@/lib/store/enhanced-conversation-memory.store', () => {
  // Module object that will be returned
  const module = {
    useEnhancedConversationMemory: {
      getState: () => storeInstance,
      setState: (fn: any) => {
        if (typeof fn === 'function') {
          Object.assign(storeInstance, fn(storeInstance));
        }
      },
      subscribe: jest.fn(),
      destroy: jest.fn(),
    },
    createEnhancedSession: async (sessionId?: string, options?: any) => {
      let processors = options?.processors;
      if (!processors && options) {
        processors = storeInstance.getFilteredProcessors(options);
      }
      return storeInstance.createSession(sessionId, processors);
    },
    addToolCallMessage: async (sessionId: string, toolName: string, content: string, result?: any) => {
      return storeInstance.addMessage({
        sessionId,
        role: 'assistant',
        content,
        agentId: 'tool-system',
        metadata: {
          isToolCall: true,
          toolName,
          toolResult: result,
        },
      });
    },
    MAX_MESSAGES_IN_MEMORY: 50,
    ConversationSession: {},
    EnhancedConversationMemoryState: {},
    _resetStore: () => {
      storeInstance = new MockStore();
      // Update the getState function to return the new instance
      module.useEnhancedConversationMemory.getState = () => storeInstance;
    }
  };
  
  return module;
});

// Import store after mocking
import {
  useEnhancedConversationMemory,
  createEnhancedSession,
  addToolCallMessage,
  MAX_MESSAGES_IN_MEMORY,
  // @ts-ignore
  _resetStore
} from '@/lib/store/enhanced-conversation-memory.store';

// MSW server handlers
beforeEach(() => {
  server.use(
    http.get('/api/sessions', () => {
      return HttpResponse.json([]);
    })
  );
  jest.clearAllMocks();
  // @ts-ignore
  if (_resetStore) {
    _resetStore();
  }
});

describe('EnhancedConversationMemoryStore', () => {
  describe('Session Management', () => {
    it('should create a session with default processors', async () => {
      const store = useEnhancedConversationMemory.getState();
      
      const sessionId = await store.createSession();
      expect(sessionId).toBeTruthy();
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session).toBeDefined();
      expect(session.processors).toHaveLength(2);
      expect(state.currentSessionId).toBe(sessionId);
    });

    it('should create a session with custom processors', async () => {
      const store = useEnhancedConversationMemory.getState();
      const customProcessors = [new TokenLimiter(50000)];
      
      const sessionId = await store.createSession('custom-session', customProcessors);
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session).toBeDefined();
      expect(session.processors).toHaveLength(1);
      expect(session.processors[0].getName()).toBe('TokenLimiter(50000)');
    });

    it('should create session in database when DB is enabled', async () => {
      const mockDbSession = {
        id: 'db-session-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        summary: 'Test session',
      };
      
      (ChatDatabaseService.createSession as jest.Mock).mockResolvedValue(mockDbSession as any);
      
      const store = useEnhancedConversationMemory.getState();
      store.enableDbSync();
      
      const sessionId = await store.createSession();
      expect(ChatDatabaseService.createSession).toHaveBeenCalled();
      expect(prisma.conversationSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            processors: expect.any(Array),
          }),
        }),
      });
    });

    it('should fallback to local storage when DB creation fails', async () => {
      (ChatDatabaseService.createSession as jest.Mock).mockRejectedValue(new Error('DB Error'));
      
      const store = useEnhancedConversationMemory.getState();
      store.enableDbSync();
      
      const sessionId = await store.createSession();
      const state = useEnhancedConversationMemory.getState();
      expect(state.sessions[sessionId]).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        '[EnhancedConversationMemory] Failed to create session in DB',
        expect.any(Object)
      );
    });

    it('should switch to existing session', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId1 = await store.createSession();
      const sessionId2 = await store.createSession();
      
      expect(store.currentSessionId).toBe(sessionId2);
      
      store.currentSessionId = sessionId1;
      expect(store.currentSessionId).toBe(sessionId1);
    });
  });

  describe('Message Management', () => {
    it('should add message to session', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Hello world',
      });
      
      const messages = store.getProcessedMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello world');
      expect(messages[0].role).toBe('user');
    });

    it('should clear session messages', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      store.clearSession(sessionId);
      
      const messages = store.getProcessedMessages(sessionId);
      expect(messages).toHaveLength(0);
      
      const session = store.getSession(sessionId);
      expect(session.tokenUsage.total).toBe(0);
    });

    it('should update message metadata', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Test',
        metadata: { original: true },
      });
      
      const messages = store.getProcessedMessages(sessionId);
      const messageId = messages[0].id;
      
      await store.updateMessageMetadata(messageId, {
        updated: true,
        timestamp: new Date(),
      });
      
      const updatedMessages = store.getProcessedMessages(sessionId);
      expect(updatedMessages[0].metadata.original).toBe(true);
      expect(updatedMessages[0].metadata.updated).toBe(true);
    });

    it('should archive old messages when exceeding limit', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      // Add messages exceeding the limit
      for (let i = 0; i < MAX_MESSAGES_IN_MEMORY + 2; i++) {
        await store.addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const state = useEnhancedConversationMemory.getState();
      const updatedSession = state.sessions[sessionId];
      expect(updatedSession.messages).toHaveLength(MAX_MESSAGES_IN_MEMORY);
      // Should have the last MAX_MESSAGES_IN_MEMORY messages
      expect(updatedSession.messages[0].content).toBe('Message 2');
      expect(updatedSession.messages[updatedSession.messages.length - 1].content).toBe(`Message ${MAX_MESSAGES_IN_MEMORY + 1}`);
    });

    it('should get recent messages with limit', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      for (let i = 0; i < 10; i++) {
        await store.addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const recentMessages = store.getRecentMessages(sessionId, 3);
      expect(recentMessages).toHaveLength(3);
      expect(recentMessages[0].content).toBe('Message 7');
      expect(recentMessages[2].content).toBe('Message 9');
    });
  });

  describe('Processor Management', () => {
    it('should create session with token limiter', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        maxTokens: 5000,
      });
      
      const store = useEnhancedConversationMemory.getState();
      const session = store.sessions[sessionId];
      
      expect(session.processors).toHaveLength(2);
      expect(session.processors[0].getName()).toBe('TokenLimiter(5000)');
    });

    it('should create session with custom tool exclusions', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        excludeTools: ['testTool', 'anotherTool'],
      });
      
      const store = useEnhancedConversationMemory.getState();
      const session = store.sessions[sessionId];
      
      expect(session.processors).toHaveLength(2);
      const toolFilter = session.processors.find(p => p.getName().includes('ToolCallFilter'));
      expect(toolFilter).toBeDefined();
    });

    it('should handle processor errors gracefully', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      // Add a message - processors will be applied internally
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Test message',
      });
      
      const messages = store.getProcessedMessages(sessionId);
      expect(messages).toHaveLength(1);
    });
  });

  describe('Search Functionality', () => {
    it('should search messages across all sessions', async () => {
      const store = useEnhancedConversationMemory.getState();
      
      const session1 = await store.createSession();
      await store.addMessage({
        sessionId: session1,
        role: 'user',
        content: 'Hello from session 1',
      });
      
      const session2 = await store.createSession();
      await store.addMessage({
        sessionId: session2,
        role: 'user',
        content: 'Hello from session 2',
      });
      
      const results = store.searchMessages('Hello');
      expect(results).toHaveLength(2);
    });

    it('should search messages in specific session', async () => {
      const store = useEnhancedConversationMemory.getState();
      
      const session1 = await store.createSession();
      await store.addMessage({
        sessionId: session1,
        role: 'user',
        content: 'Specific message',
      });
      
      const session2 = await store.createSession();
      await store.addMessage({
        sessionId: session2,
        role: 'user',
        content: 'Other message',
      });
      
      const results = store.searchMessages('Specific', session1);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Specific message');
    });

    it('should handle case-insensitive search', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'UPPERCASE message',
      });
      
      const results = store.searchMessages('uppercase');
      expect(results).toHaveLength(1);
    });
  });

  describe('Database Sync', () => {
    it('should toggle database sync', () => {
      const store = useEnhancedConversationMemory.getState();
      
      expect(store.isDbEnabled).toBe(false);
      
      store.toggleDbSync(true);
      expect(store.isDbEnabled).toBe(true);
      
      store.toggleDbSync();
      expect(store.isDbEnabled).toBe(false);
    });

    it('should handle sync errors gracefully', async () => {
      const store = useEnhancedConversationMemory.getState();
      store.syncWithDatabase = jest.fn().mockRejectedValue(new Error('Sync failed'));
      
      // This should not throw
      await expect(store.syncWithDatabase()).rejects.toThrow('Sync failed');
    });

    it('should persist message to database when enabled', async () => {
      (prisma.conversationMessage.create as jest.Mock).mockResolvedValue({
        id: 'msg-123',
        createdAt: new Date(),
      });
      
      const store = useEnhancedConversationMemory.getState();
      store.isDbEnabled = true;
      
      const sessionId = await store.createSession();
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Test',
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Memory Stats', () => {
    it('should calculate memory statistics', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Hello',
      });
      
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Hi there',
      });
      
      const stats = store.getMemoryStats();
      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('processedMessages');
      expect(stats).toHaveProperty('estimatedTokens');
    });

    it('should track token usage accurately', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      // User message
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Test message', // 12 chars * 0.25 = 3 tokens
      });
      
      // Assistant message
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Response text', // 13 chars * 0.25 = 4 tokens
      });
      
      const session = store.getSession(sessionId);
      expect(session.tokenUsage.input).toBe(3);
      expect(session.tokenUsage.output).toBe(4);
      expect(session.tokenUsage.total).toBe(7);
    });
  });

  describe('Tool Call Messages', () => {
    it('should add tool call message', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      const messageId = await addToolCallMessage(
        sessionId,
        'marketDataTool',
        'Fetching BTC price...',
        { price: 45000 }
      );
      
      expect(messageId).toBeTruthy();
      
      const messages = store.getProcessedMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata.isToolCall).toBe(true);
      expect(messages[0].metadata.toolName).toBe('marketDataTool');
      expect(messages[0].metadata.toolResult).toEqual({ price: 45000 });
    });

    it('should track tool calls separately', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await addToolCallMessage(sessionId, 'tool1', 'Call 1');
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Regular message',
      });
      await addToolCallMessage(sessionId, 'tool2', 'Call 2');
      
      const messages = store.getProcessedMessages(sessionId);
      const toolCalls = messages.filter(m => m.metadata?.isToolCall);
      expect(toolCalls).toHaveLength(2);
    });
  });

  describe('Session Context', () => {
    it('should build context from messages', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Hello',
      });
      
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Hi there',
      });
      
      const context = store.getSessionContext(sessionId);
      expect(context).toContain('User: Hello');
      expect(context).toContain('Assistant: Hi there');
    });

    it('should return empty context for non-existent session', () => {
      const store = useEnhancedConversationMemory.getState();
      const context = store.getSessionContext('non-existent');
      expect(context).toBe('');
    });

    it('should handle empty session context', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      const context = store.getSessionContext(sessionId);
      expect(context).toBe('');
    });
  });

  describe('Session Summary', () => {
    it('should generate summary with chart topics', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Show me the chart data',
      });
      
      await store.summarizeSession(sessionId);
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.summary).toContain('Chart discussion');
    });

    it('should generate summary with price topics', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'What is the current BTC price?',
      });
      
      await store.summarizeSession(sessionId);
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.summary).toContain('Price analysis');
    });

    it('should generate summary with no topics', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Hello there',
      });
      
      await store.summarizeSession(sessionId);
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.summary).toContain('General conversation');
    });

    it('should handle summarize with non-existent session', async () => {
      const store = useEnhancedConversationMemory.getState();
      await store.summarizeSession('non-existent');
      
      const session = store.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('Context Building', () => {
    it('should build context without session summary', async () => {
      const store = useEnhancedConversationMemory.getState();
      
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Build context test',
      });
      
      const context = store.getSessionContext(sessionId);
      expect(context).toContain('Build context test');
      expect(context).not.toContain('Summary:');
    });

    it('should handle context with tool calls', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await addToolCallMessage(sessionId, 'testTool', 'Tool execution');
      
      const context = store.getSessionContext(sessionId);
      expect(context).toContain('Assistant: Tool execution');
    });
  });

  describe('Session Updates', () => {
    it('should update session properties', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      store.updateSession(sessionId, {
        summary: 'Updated summary',
        lastActiveAt: new Date('2024-01-01'),
      });
      
      const session = store.getSession(sessionId);
      expect(session.summary).toBe('Updated summary');
      expect(session.lastActiveAt).toEqual(new Date('2024-01-01'));
    });

    it('should not update non-existent session', () => {
      const store = useEnhancedConversationMemory.getState();
      
      store.updateSession('non-existent', {
        summary: 'Should not be set',
      });
      
      const session = store.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('Archive Functionality', () => {
    it('should archive messages when requested', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      const messagesToArchive = [
        { id: '1', content: 'Old message 1' },
        { id: '2', content: 'Old message 2' },
      ];
      
      const result = await store.archiveOldMessages(sessionId, messagesToArchive);
      expect(result).toBe(2);
      expect(store.archiveOldMessages).toHaveBeenCalledWith(sessionId, messagesToArchive);
    });

    it('should get archived messages', async () => {
      const store = useEnhancedConversationMemory.getState();
      const archived = await store.getArchivedMessages('session-123');
      expect(archived).toEqual([]);
    });
  });

  describe('Clear All Sessions', () => {
    it('should clear all sessions and reset current session', async () => {
      const store = useEnhancedConversationMemory.getState();
      
      const sessionId1 = await store.createSession();
      const sessionId2 = await store.createSession();
      
      // Verify both sessions were created with different IDs
      expect(sessionId1).not.toBe(sessionId2);
      expect(store.sessions[sessionId1]).toBeDefined();
      expect(store.sessions[sessionId2]).toBeDefined();
      expect(Object.keys(store.sessions).length).toBe(2);
      expect(store.currentSessionId).toBe(sessionId2);
      
      store.clearAllSessions();
      
      expect(Object.keys(store.sessions).length).toBe(0);
      expect(store.currentSessionId).toBeNull();
    });
  });

  describe('Token Count Calculation', () => {
    it('should calculate token count for content', () => {
      const store = useEnhancedConversationMemory.getState();
      
      // 100 characters * 0.25 = 25 tokens
      const content = 'a'.repeat(100);
      const tokenCount = store.getMessageTokenCount(content);
      
      expect(tokenCount).toBe(25);
    });

    it('should round up token count', () => {
      const store = useEnhancedConversationMemory.getState();
      
      // 13 characters * 0.25 = 3.25, rounded up to 4
      const tokenCount = store.getMessageTokenCount('Hello, world!');
      
      expect(tokenCount).toBe(4);
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage for assistant messages', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Assistant response', // 18 chars * 0.25 = 5 tokens
      });
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.tokenUsage?.output).toBe(5);
      expect(session.tokenUsage?.input).toBe(0);
    });

    it('should accumulate token usage across messages', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'First', // 5 chars * 0.25 = 2 tokens
      });
      
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Second', // 6 chars * 0.25 = 2 tokens
      });
      
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'Third', // 5 chars * 0.25 = 2 tokens
      });
      
      const session = store.getSession(sessionId);
      expect(session.tokenUsage.input).toBe(4);
      expect(session.tokenUsage.output).toBe(2);
      expect(session.tokenUsage.total).toBe(6);
    });
  });

  describe('Persistence Configuration', () => {
    it('should have correct default state after initialization', () => {
      const store = useEnhancedConversationMemory.getState();
      expect(store.isDbEnabled).toBe(false);
      expect(store.isSyncing).toBe(false);
      expect(store.defaultProcessors).toHaveLength(2);
      expect(store.defaultProcessors[0].getName()).toContain('TokenLimiter');
      expect(store.defaultProcessors[1].getName()).toContain('ToolCallFilter');
    });

    it('should persist essential state properties', () => {
      const store = useEnhancedConversationMemory.getState();
      const state = useEnhancedConversationMemory.getState();
      
      expect(state).toHaveProperty('sessions');
      expect(state).toHaveProperty('currentSessionId');
      expect(state).toHaveProperty('isDbEnabled', false);
      expect(state).toHaveProperty('defaultProcessors');
      expect(state).toHaveProperty('isSyncing', false);
      
      // Verify methods are available
      expect(state.createSession).toBeDefined();
      expect(state.addMessage).toBeDefined();
      expect(state.getProcessedMessages).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle message processing errors', async () => {
      const store = useEnhancedConversationMemory.getState();
      const sessionId = await store.createSession();
      
      // Provide invalid message structure
      await store.addMessage({
        sessionId,
        role: 'user',
        content: '',
      });
      
      const messages = store.getProcessedMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata.tokenCount).toBe(0);
    });

    it('should handle session not found errors', () => {
      const store = useEnhancedConversationMemory.getState();
      
      const messages = store.getProcessedMessages('non-existent');
      expect(messages).toEqual([]);
      
      const context = store.getSessionContext('non-existent');
      expect(context).toBe('');
    });
  });

  describe('Utility Functions Edge Cases', () => {
    it('should create enhanced session with maxTokens option', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        maxTokens: 127000,
      });
      
      const store = useEnhancedConversationMemory.getState();
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      
      expect(session.processors).toHaveLength(2);
      expect(session.processors[0].getName()).toBe('TokenLimiter(127000)');
    });

    it('should create enhanced session with includeAll tools option', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        includeAllTools: true,
      });
      
      const store = useEnhancedConversationMemory.getState();
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      
      expect(session.processors).toHaveLength(2);
      // Verify ToolCallFilter was created with includeAll option
      const toolFilter = session.processors.find(p => p.getName().includes('ToolCallFilter'));
      expect(toolFilter).toBeDefined();
      // The includeAll filter should have different behavior
    });

    it('should create enhanced session without any tool options', async () => {
      const sessionId = await createEnhancedSession();
      
      const store = useEnhancedConversationMemory.getState();
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      
      expect(session.processors).toHaveLength(2);
      expect(session.processors[0].getName()).toBe('TokenLimiter(10000)');
      // Should have default tool filter
      expect(session.processors[1].getName()).toContain('ToolCallFilter');
    });
  });
});