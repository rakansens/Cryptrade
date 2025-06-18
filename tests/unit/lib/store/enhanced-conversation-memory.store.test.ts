import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { 
  useEnhancedConversationMemory,
  createEnhancedSession,
  addToolCallMessage,
  MAX_MESSAGES_IN_MEMORY,
  type ConversationSession,
  type EnhancedConversationMemoryState
} from '@/lib/store/enhanced-conversation-memory.store';
import { TokenLimiter, ToolCallFilter } from '@/lib/store/processors';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import type { ConversationMessage } from '@/types/conversation-memory';

// Mock dependencies
vi.mock('@/lib/services/database/chat.service');
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      update: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    conversationMessage: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/utils/logger');

// MSW server setup
const server = setupServer(
  rest.get('/api/sessions', (req, res, ctx) => {
    return res(ctx.json([]));
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  // Reset store state
  act(() => {
    useEnhancedConversationMemory.getState().clearSession('test-session');
  });
});
afterAll(() => server.close());

describe('EnhancedConversationMemoryStore', () => {
  describe('Session Management', () => {
    it('should create a session with default processors', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        expect(sessionId).toBeTruthy();
        expect(result.current.sessions[sessionId]).toBeDefined();
        expect(result.current.sessions[sessionId].processors).toHaveLength(2);
        expect(result.current.currentSessionId).toBe(sessionId);
      });
    });

    it('should create a session with custom processors', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      const customProcessors = [new TokenLimiter(50000)];
      
      await act(async () => {
        const sessionId = await result.current.createSession('custom-session', customProcessors);
        expect(result.current.sessions[sessionId]).toBeDefined();
        expect(result.current.sessions[sessionId].processors).toHaveLength(1);
        expect(result.current.sessions[sessionId].processors[0].getName()).toBe('TokenLimiter(50000)');
      });
    });

    it('should create session in database when DB is enabled', async () => {
      const mockDbSession = {
        id: 'db-session-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        summary: 'Test session',
      };
      
      vi.mocked(ChatDatabaseService.createSession).mockResolvedValue(mockDbSession as any);
      vi.mocked(prisma.conversationSession.update).mockResolvedValue({} as any);
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        expect(ChatDatabaseService.createSession).toHaveBeenCalled();
        expect(prisma.conversationSession.update).toHaveBeenCalledWith({
          where: { id: mockDbSession.id },
          data: expect.objectContaining({
            metadata: expect.any(Object),
          }),
        });
        expect(sessionId).toBe(mockDbSession.id);
      });
    });

    it('should fallback to local storage when DB creation fails', async () => {
      vi.mocked(ChatDatabaseService.createSession).mockRejectedValue(new Error('DB Error'));
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        expect(sessionId).toMatch(/^session-\d+$/);
        expect(result.current.sessions[sessionId]).toBeDefined();
        expect(logger.error).toHaveBeenCalledWith(
          '[EnhancedConversationMemory] Failed to create session in DB',
          expect.any(Object)
        );
      });
    });

    it('should clear session messages', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Test message',
        });
        
        expect(result.current.sessions[sessionId].messages).toHaveLength(1);
        
        result.current.clearSession(sessionId);
        expect(result.current.sessions[sessionId].messages).toHaveLength(0);
      });
    });
  });

  describe('Message Management', () => {
    it('should add a message to session', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Hello, world!',
          metadata: { topics: ['greeting'] },
        });
        
        const session = result.current.sessions[sessionId];
        expect(session.messages).toHaveLength(1);
        expect(session.messages[0].content).toBe('Hello, world!');
        expect(session.messages[0].role).toBe('user');
        expect(session.messages[0].metadata?.topics).toContain('greeting');
      });
    });

    it('should estimate token count for messages', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'This is a test message with approximately 20 characters',
        });
        
        const session = result.current.sessions[sessionId];
        const message = session.messages[0];
        expect(message.metadata?.tokenCount).toBeGreaterThan(0);
        expect(session.tokenUsage?.total).toBeGreaterThan(0);
        expect(session.tokenUsage?.input).toBeGreaterThan(0);
      });
    });

    it('should archive old messages when exceeding limit', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add messages beyond the limit
        for (let i = 0; i < MAX_MESSAGES_IN_MEMORY + 5; i++) {
          await result.current.addMessage({
            sessionId,
            role: 'user',
            content: `Message ${i}`,
          });
        }
        
        const session = result.current.sessions[sessionId];
        expect(session.messages).toHaveLength(MAX_MESSAGES_IN_MEMORY);
        expect(session.messages[0].content).toBe(`Message 5`);
      });
    });

    it('should save message to database when enabled', async () => {
      const mockDbMessage = {
        id: 'msg-db-123',
        sessionId: 'test-session',
        role: 'user',
        content: 'Test',
      };
      
      vi.mocked(prisma.conversationSession.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.conversationMessage.create).mockResolvedValue(mockDbMessage as any);
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Test',
        });
        
        expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            sessionId,
            role: 'user',
            content: 'Test',
          }),
        });
      });
    });

    it('should update message metadata', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Test',
        });
        
        const messageId = result.current.sessions[sessionId].messages[0].id;
        await result.current.updateMessageMetadata(messageId, {
          topics: ['updated'],
          symbols: ['BTC'],
        });
        
        const updatedMessage = result.current.sessions[sessionId].messages[0];
        expect(updatedMessage.metadata?.topics).toContain('updated');
        expect(updatedMessage.metadata?.symbols).toContain('BTC');
      });
    });
  });

  describe('Message Processing', () => {
    it('should apply processors to messages', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add multiple messages
        for (let i = 0; i < 10; i++) {
          await result.current.addMessage({
            sessionId,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`,
            metadata: {
              isToolCall: i === 5,
              toolName: i === 5 ? 'marketDataTool' : undefined,
            },
          });
        }
        
        const processedMessages = result.current.getProcessedMessages(sessionId);
        
        // Should filter out tool calls
        const toolMessages = processedMessages.filter(m => m.metadata?.isToolCall);
        expect(toolMessages).toHaveLength(0);
      });
    });

    it('should cache processed messages', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add messages
        for (let i = 0; i < 5; i++) {
          await result.current.addMessage({
            sessionId,
            role: 'user',
            content: `Message ${i}`,
          });
        }
        
        // First call processes messages
        const processed1 = result.current.getProcessedMessages(sessionId);
        
        // Second call should use cache
        const processed2 = result.current.getProcessedMessages(sessionId);
        
        expect(processed1).toEqual(processed2);
        expect(result.current.sessions[sessionId].processedMessages).toBeDefined();
      });
    });

    it('should invalidate cache when messages change', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Message 1',
        });
        
        const processed1 = result.current.getProcessedMessages(sessionId);
        expect(processed1).toHaveLength(1);
        
        // Add many more messages
        for (let i = 0; i < 10; i++) {
          await result.current.addMessage({
            sessionId,
            role: 'user',
            content: `Message ${i + 2}`,
          });
        }
        
        const processed2 = result.current.getProcessedMessages(sessionId);
        expect(processed2.length).toBeGreaterThan(processed1.length);
      });
    });

    it('should get session context with summary', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add messages
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'What is Bitcoin?',
        });
        await result.current.addMessage({
          sessionId,
          role: 'assistant',
          content: 'Bitcoin is a cryptocurrency.',
        });
        
        // Add summary
        await result.current.summarizeSession(sessionId);
        
        const context = result.current.getSessionContext(sessionId);
        expect(context).toContain('Session Summary:');
        expect(context).toContain('User: What is Bitcoin?');
        expect(context).toContain('Assistant: Bitcoin is a cryptocurrency.');
      });
    });
  });

  describe('Processor Management', () => {
    it('should add and remove processors', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        const session = result.current.sessions[sessionId];
        
        // Initial processors
        expect(session.processors).toHaveLength(2);
        
        // Add a new processor
        const newProcessor = new TokenLimiter(10000);
        result.current.addProcessor(sessionId, newProcessor);
        expect(result.current.sessions[sessionId].processors).toHaveLength(3);
        
        // Remove a processor
        result.current.removeProcessor(sessionId, 'TokenLimiter(10000)');
        expect(result.current.sessions[sessionId].processors).toHaveLength(2);
      });
    });

    it('should update default processors', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const newProcessors = [new TokenLimiter(5000)];
        result.current.setDefaultProcessors(newProcessors);
        
        const sessionId = await result.current.createSession();
        expect(result.current.sessions[sessionId].processors).toHaveLength(1);
        expect(result.current.sessions[sessionId].processors[0].getName()).toBe('TokenLimiter(5000)');
      });
    });

    it('should get memory statistics', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add messages
        for (let i = 0; i < 5; i++) {
          await result.current.addMessage({
            sessionId,
            role: 'user',
            content: 'Test message',
          });
        }
        
        const stats = result.current.getMemoryStats(sessionId);
        expect(stats.totalMessages).toBe(5);
        expect(stats.processedMessages).toBeLessThanOrEqual(5);
        expect(stats.estimatedTokens).toBeGreaterThan(0);
        expect(stats.processors).toHaveLength(2);
      });
    });
  });

  describe('Search and Filter', () => {
    it('should search messages by content', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Tell me about Bitcoin',
        });
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'What is Ethereum?',
        });
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Bitcoin price today',
        });
        
        const results = result.current.searchMessages('Bitcoin');
        expect(results).toHaveLength(2);
        expect(results.every(m => m.content.toLowerCase().includes('bitcoin'))).toBe(true);
      });
    });

    it('should search messages by metadata', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Analyze crypto',
          metadata: {
            topics: ['analysis'],
            symbols: ['BTC', 'ETH'],
          },
        });
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Market update',
          metadata: {
            topics: ['market'],
            symbols: ['BTC'],
          },
        });
        
        const results = result.current.searchMessages('BTC');
        expect(results).toHaveLength(2);
      });
    });
  });

  describe('Database Sync', () => {
    it('should enable database sync', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        result.current.disableDbSync();
        expect(result.current.isDbEnabled).toBe(false);
        
        await result.current.enableDbSync('test-session-id');
        expect(result.current.isDbEnabled).toBe(true);
        expect(result.current.currentSessionId).toBe('test-session-id');
      });
    });

    it('should sync unsynced records to database', async () => {
      vi.mocked(ChatDatabaseService.createSession).mockResolvedValue({
        id: 'db-session',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      } as any);
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        // Disable DB sync initially
        result.current.disableDbSync();
        
        // Create session and add messages
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Test message',
        });
        
        // Enable DB sync
        await result.current.enableDbSync();
        
        expect(ChatDatabaseService.createSession).toHaveBeenCalled();
        expect(prisma.conversationMessage.create).toHaveBeenCalled();
      });
    });

    it('should load sessions from database', async () => {
      const mockSessions = [{
        id: 'db-session-1',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        summary: 'Test session',
      }];
      
      const mockMessages = [{
        id: 'msg-1',
        sessionId: 'db-session-1',
        role: 'user',
        content: 'Hello from DB',
        timestamp: new Date(),
      }];
      
      vi.mocked(ChatDatabaseService.getUserSessions).mockResolvedValue(mockSessions as any);
      vi.mocked(ChatDatabaseService.getSessionWithMessages).mockResolvedValue({
        ...mockSessions[0],
        messages: mockMessages,
      } as any);
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        await result.current.loadFromDatabase();
        
        expect(result.current.sessions['db-session-1']).toBeDefined();
        expect(result.current.sessions['db-session-1'].messages).toHaveLength(1);
        expect(result.current.sessions['db-session-1'].messages[0].content).toBe('Hello from DB');
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(ChatDatabaseService.getUserSessions).mockRejectedValue(new Error('DB Error'));
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        await result.current.loadFromDatabase();
        
        expect(logger.error).toHaveBeenCalledWith(
          '[EnhancedConversationMemory] Failed to load from database',
          expect.any(Object)
        );
      });
    });
  });

  describe('Archive Functions', () => {
    it('should archive old messages', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add many messages
        for (let i = 0; i < MAX_MESSAGES_IN_MEMORY + 10; i++) {
          await result.current.addMessage({
            sessionId,
            role: 'user',
            content: `Message ${i}`,
          });
        }
        
        // Archive old messages
        await result.current.archiveOldMessages!(sessionId);
        
        const session = result.current.sessions[sessionId];
        expect(session.messages.length).toBeLessThanOrEqual(MAX_MESSAGES_IN_MEMORY);
      });
    });

    it('should retrieve archived messages from database', async () => {
      const mockArchivedMessages = [
        {
          id: 'archived-1',
          sessionId: 'test-session',
          role: 'user',
          content: 'Archived message 1',
          timestamp: new Date(),
        },
        {
          id: 'archived-2',
          sessionId: 'test-session',
          role: 'assistant',
          content: 'Archived message 2',
          timestamp: new Date(),
        },
      ];
      
      vi.mocked(prisma.conversationMessage.findMany).mockResolvedValue(mockArchivedMessages as any);
      
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const messages = await result.current.getArchivedMessages!('test-session');
        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe('Archived message 1');
      });
    });

    it('should fallback to memory when DB is disabled', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        result.current.disableDbSync();
        
        const sessionId = await result.current.createSession();
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Memory message',
        });
        
        const messages = await result.current.getArchivedMessages!(sessionId);
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe('Memory message');
      });
    });
  });

  describe('Utility Functions', () => {
    it('should create enhanced session with custom options', async () => {
      await act(async () => {
        const sessionId = await createEnhancedSession('custom-id', {
          maxTokens: 50000,
          excludeTools: ['debugTool'],
          includeAllTools: false,
        });
        
        const state = useEnhancedConversationMemory.getState();
        const session = state.sessions[sessionId];
        
        expect(session).toBeDefined();
        expect(session.processors).toHaveLength(2);
        expect(session.processors[0].getName()).toBe('TokenLimiter(50000)');
      });
    });

    it('should add tool call message', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        await addToolCallMessage(
          sessionId,
          'marketDataTool',
          'Fetching BTC price...',
          { price: 50000 }
        );
        
        const session = result.current.sessions[sessionId];
        expect(session.messages).toHaveLength(1);
        expect(session.messages[0].metadata?.isToolCall).toBe(true);
        expect(session.messages[0].metadata?.toolName).toBe('marketDataTool');
        expect(session.messages[0].metadata?.toolResult).toEqual({ price: 50000 });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent session gracefully', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const messages = result.current.getProcessedMessages('non-existent');
        expect(messages).toEqual([]);
        
        const context = result.current.getSessionContext('non-existent');
        expect(context).toBe('No previous context available.');
        
        const stats = result.current.getMemoryStats('non-existent');
        expect(stats.totalMessages).toBe(0);
      });
    });

    it('should handle invalid processor gracefully', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add a processor that throws
        const faultyProcessor = {
          getName: () => 'FaultyProcessor',
          process: () => {
            throw new Error('Processing failed');
          },
        };
        
        result.current.addProcessor(sessionId, faultyProcessor as any);
        
        // Should still return messages despite processor error
        await result.current.addMessage({
          sessionId,
          role: 'user',
          content: 'Test',
        });
        
        const processed = result.current.getProcessedMessages(sessionId);
        expect(processed.length).toBeGreaterThan(0);
        expect(logger.error).toHaveBeenCalledWith(
          '[EnhancedConversationMemory] Processor failed',
          expect.any(Object)
        );
      });
    });

    it('should handle concurrent message additions', async () => {
      const { result } = renderHook(() => useEnhancedConversationMemory());
      
      await act(async () => {
        const sessionId = await result.current.createSession();
        
        // Add messages concurrently
        await Promise.all([
          result.current.addMessage({
            sessionId,
            role: 'user',
            content: 'Message 1',
          }),
          result.current.addMessage({
            sessionId,
            role: 'user',
            content: 'Message 2',
          }),
          result.current.addMessage({
            sessionId,
            role: 'user',
            content: 'Message 3',
          }),
        ]);
        
        const session = result.current.sessions[sessionId];
        expect(session.messages).toHaveLength(3);
      });
    });
  });
});