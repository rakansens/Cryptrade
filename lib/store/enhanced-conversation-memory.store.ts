import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { logger } from '@/lib/utils/logger';
import { ConversationMemoryAPI } from '@/lib/api/conversation-memory-api';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { prisma } from '@/lib/db/prisma';

import { TokenLimiter, ToolCallFilter } from "@/lib/store/processors";
import type { MemoryProcessor } from "@/lib/store/processors";
import type { ConversationMessage } from "@/types/conversation-memory";
/**
 * Enhanced Conversation Memory Store with Database Integration
 * 
 * Combines:
 * - Mastra v2 Memory Processors (TokenLimiter, ToolCallFilter)
 * - Database persistence with Prisma/Supabase
 * - Automatic fallback to localStorage
 * - Session and message management
 */

// Enhanced store state with DB integration
export interface ConversationSession {
  id: string;
  startedAt: Date;
  lastActiveAt: Date;
  messages: ConversationMessage[];
  summary?: string;
  processors: MemoryProcessor[];
  processedMessages?: ConversationMessage[];
  tokenUsage?: { total: number; input: number; output: number };
}

interface EnhancedConversationMemoryState {
  sessions: Record<string, ConversationSession>;
  currentSessionId: string | null;
  defaultProcessors: MemoryProcessor[];
  
  // DB sync state
  isDbEnabled: boolean;
  isSyncing: boolean;
  
  // Enhanced Actions
  createSession: (sessionId?: string, processors?: MemoryProcessor[]) => Promise<string>;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => Promise<void>;
  getProcessedMessages: (sessionId: string, limit?: number) => ConversationMessage[];
  getRecentMessages: (sessionId: string, limit?: number) => ConversationMessage[];
  getSessionContext: (sessionId: string) => string;
  updateMessageMetadata: (messageId: string, metadata: ConversationMessage['metadata']) => Promise<void>;
  clearSession: (sessionId: string) => void;
  searchMessages: (query: string, sessionId?: string) => ConversationMessage[];
  summarizeSession: (sessionId: string) => Promise<void>;
  
  // Processor management
  addProcessor: (sessionId: string, processor: MemoryProcessor) => void;
  removeProcessor: (sessionId: string, processorName: string) => void;
  setDefaultProcessors: (processors: MemoryProcessor[]) => void;
  getMemoryStats: (sessionId: string) => {
    totalMessages: number;
    processedMessages: number;
    estimatedTokens: number;
    processors: string[];
  };
  
  // DB sync actions
  enableDbSync: () => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

// Memory management constants
export const MAX_MESSAGES_IN_MEMORY = 50; // Maximum messages to keep in memory

// Default processors for production use
const DEFAULT_PROCESSORS: MemoryProcessor[] = [
  new TokenLimiter(127000), // GPT-4o token limit
  new ToolCallFilter({ exclude: ['marketDataTool', 'chartControlTool'] }) // Exclude heavy tools
];

// Enhanced Memory Store Implementation with DB
export const useEnhancedConversationMemory = create<EnhancedConversationMemoryState>()(
  devtools(
    persist(
      immer((set, get) => ({
        sessions: {},
        currentSessionId: null,
        defaultProcessors: DEFAULT_PROCESSORS,
        isDbEnabled: true,
        isSyncing: false,

        createSession: async (sessionId?: string, processors?: MemoryProcessor[]) => {
          const id = sessionId || `session-${Date.now()}`;
          const now = new Date();
          const sessionProcessors = processors || get().defaultProcessors;
          const state = get();
          
          if (state.isDbEnabled) {
            try {
              // Create in database
              const dbSession = await ChatDatabaseService.createSession(undefined, `Enhanced session ${id}`);
              
              // Store processor configuration in metadata
              await prisma.conversationSession.update({
                where: { id: dbSession.id },
                data: {
                  metadata: {
                    processors: sessionProcessors.map(p => ({
                      name: p.getName(),
                      type: p.constructor.name,
                    })),
                  },
                },
              });
              
              set((state) => {
                state.sessions[dbSession.id] = {
                  id: dbSession.id,
                  startedAt: dbSession.createdAt,
                  lastActiveAt: dbSession.lastActiveAt,
                  messages: [],
                  summary: dbSession.summary || undefined,
                  processors: sessionProcessors,
                  tokenUsage: { total: 0, input: 0, output: 0 }
                };
                state.currentSessionId = dbSession.id;
              });
              
              logger.info('[EnhancedConversationMemory] Session created in DB with processors', { 
                sessionId: dbSession.id,
                processors: sessionProcessors.map(p => p.getName())
              });
              return dbSession.id;
            } catch (error) {
              logger.error('[EnhancedConversationMemory] Failed to create session in DB', { error });
              // Fallback to local
            }
          }
          
          // Local creation
          set((state) => {
            state.sessions[id] = {
              id,
              startedAt: now,
              lastActiveAt: now,
              messages: [],
              processors: sessionProcessors,
              tokenUsage: { total: 0, input: 0, output: 0 }
            };
            state.currentSessionId = id;
          });
          
          logger.info('[EnhancedConversationMemory] Session created locally with processors', { 
            sessionId: id,
            processors: sessionProcessors.map(p => p.getName())
          });
          return id;
        },

        addMessage: async (message) => {
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const timestamp = new Date();
          const state = get();
          
          const tokenCount = Math.ceil(message.content.length * 0.25); // Rough estimate
          
          const fullMessage: ConversationMessage = {
            ...message,
            id: messageId,
            timestamp,
            metadata: {
              ...message.metadata,
              tokenCount,
            }
          };
          
          // Update local state
          set((state) => {
            const session = state.sessions[message.sessionId];
            if (!session) {
              logger.warn('[EnhancedConversationMemory] Session not found, creating new', { 
                sessionId: message.sessionId 
              });
              state.sessions[message.sessionId] = {
                id: message.sessionId,
                startedAt: timestamp,
                lastActiveAt: timestamp,
                messages: [],
                processors: state.defaultProcessors,
                tokenUsage: { total: 0, input: 0, output: 0 }
              };
            }
            
            const currentSession = state.sessions[message.sessionId];
            currentSession.messages.push(fullMessage);
            currentSession.lastActiveAt = timestamp;
            
            // Clear processed cache to force reprocessing
            delete currentSession.processedMessages;
            
            // Update token usage
            if (currentSession.tokenUsage) {
              currentSession.tokenUsage.total += tokenCount;
              if (message.role === 'user') {
                currentSession.tokenUsage.input += tokenCount;
              } else {
                currentSession.tokenUsage.output += tokenCount;
              }
            }
            
            // Keep only last MAX_MESSAGES_IN_MEMORY messages for memory efficiency
            // Archive older messages to DB if enabled
            if (currentSession.messages.length > MAX_MESSAGES_IN_MEMORY) {
              const messagesToArchive = currentSession.messages.slice(0, currentSession.messages.length - MAX_MESSAGES_IN_MEMORY);
              
              // DBが有効な場合はアーカイブを保存
              if (state.isDbEnabled) {
                logger.info('[EnhancedConversationMemory] Archiving old messages to DB', {
                  sessionId: message.sessionId,
                  archiveCount: messagesToArchive.length,
                });
              }
              
              currentSession.messages = currentSession.messages.slice(-MAX_MESSAGES_IN_MEMORY);
            }
          });
          
          // Save to database if enabled
          if (state.isDbEnabled) {
            try {
              const dbMessage = await prisma.conversationMessage.create({
                data: {
                  sessionId: message.sessionId,
                  role: message.role as any,
                  content: message.content,
                  agentId: message.agentId,
                  metadata: message.metadata,
                },
              });
              
              // Update message ID to match DB
              set((state) => {
                const session = state.sessions[message.sessionId];
                if (session) {
                  const lastMsg = session.messages[session.messages.length - 1];
                  if (lastMsg && lastMsg.id === messageId) {
                    lastMsg.id = dbMessage.id;
                  }
                }
              });
              
              logger.info('[EnhancedConversationMemory] Message saved to DB', { 
                messageId: dbMessage.id,
                sessionId: message.sessionId,
                tokenCount
              });
            } catch (error) {
              logger.error('[EnhancedConversationMemory] Failed to save message to DB', { error });
            }
          }
          
          logger.debug('[EnhancedConversationMemory] Message added', { 
            sessionId: message.sessionId,
            role: message.role,
            hasMetadata: !!message.metadata,
            tokenCount
          });
        },

        getProcessedMessages: (sessionId, limit = 20) => {
          const state = get();
          const session = state.sessions[sessionId];
          if (!session) return [];
          
          // Use cached processed messages if available and still valid
          if (session.processedMessages && session.processedMessages.length > 0) {
            // Check if cache is still valid (messages count matches)
            const processedCount = session.processedMessages.length;
            const currentCount = session.messages.length;
            
            // If message count changed, invalidate cache
            if (Math.abs(processedCount - currentCount) > 5) {
              delete session.processedMessages;
            } else {
              return session.processedMessages.slice(-limit);
            }
          }
          
          // Apply processors in sequence
          let processedMessages = [...session.messages];
          
          for (const processor of session.processors) {
            try {
              processedMessages = processor.process(processedMessages);
              logger.debug('[EnhancedConversationMemory] Applied processor', {
                processor: processor.getName(),
                beforeCount: session.messages.length,
                afterCount: processedMessages.length,
              });
            } catch (error) {
              logger.error('[EnhancedConversationMemory] Processor failed', {
                processor: processor.getName(),
                error: String(error),
              });
            }
          }
          
          // Cache processed messages
          set((state) => {
            if (state.sessions[sessionId]) {
              state.sessions[sessionId].processedMessages = processedMessages;
            }
          });
          
          return processedMessages.slice(-limit);
        },

        getRecentMessages: (sessionId, limit = 8) => {
          // For compatibility with memory-recall.tool.ts
          return get().getProcessedMessages(sessionId, limit);
        },

        getSessionContext: (sessionId) => {
          const processedMessages = get().getProcessedMessages(sessionId, 8);
          
          if (processedMessages.length === 0) {
            return 'No previous context available.';
          }
          
          // Build context string with role prefixes
          const contextParts = processedMessages.map(msg => {
            const rolePrefix = msg.role === 'user' ? 'User' : 'Assistant';
            return `${rolePrefix}: ${msg.content}`;
          });
          
          // Add session summary if available
          const session = get().sessions[sessionId];
          if (session?.summary) {
            contextParts.unshift(`Session Summary: ${session.summary}`);
          }
          
          return contextParts.join('\n\n');
        },

        updateMessageMetadata: async (messageId, metadata) => {
          const state = get();
          
          set((state) => {
            for (const session of Object.values(state.sessions)) {
              const message = session.messages.find(m => m.id === messageId);
              if (message) {
                message.metadata = { ...message.metadata, ...metadata };
                // Clear processed cache
                delete session.processedMessages;
                break;
              }
            }
          });
          
          // Update in database if enabled
          if (state.isDbEnabled) {
            try {
              await prisma.conversationMessage.update({
                where: { id: messageId },
                data: { metadata },
              });
              logger.info('[EnhancedConversationMemory] Message metadata updated in DB', { messageId });
            } catch (error) {
              logger.error('[EnhancedConversationMemory] Failed to update metadata in DB', { error });
            }
          }
          
          logger.info('[EnhancedConversationMemory] Message metadata updated', { 
            messageId, 
            metadata 
          });
        },

        clearSession: (sessionId) => {
          set((state) => {
            if (state.sessions[sessionId]) {
              state.sessions[sessionId].messages = [];
              state.sessions[sessionId].lastActiveAt = new Date();
              delete state.sessions[sessionId].processedMessages;
            }
          });
          
          logger.info('[EnhancedConversationMemory] Session cleared', { sessionId });
        },

        searchMessages: (query, sessionId) => {
          const state = get();
          const sessions = sessionId 
            ? { [sessionId]: state.sessions[sessionId] }
            : state.sessions;
          
          const results: ConversationMessage[] = [];
          const queryLower = query.toLowerCase();
          
          for (const session of Object.values(sessions)) {
            if (!session) continue;
            
            for (const message of session.messages) {
              if (message.content.toLowerCase().includes(queryLower) ||
                  message.metadata?.topics?.some(t => t.toLowerCase().includes(queryLower)) ||
                  message.metadata?.symbols?.some(s => s.toLowerCase().includes(queryLower))) {
                results.push(message);
              }
            }
          }
          
          return results;
        },

        summarizeSession: async (sessionId) => {
          const session = get().sessions[sessionId];
          if (!session || session.messages.length === 0) return;
          
          const summary = `Session with ${session.messages.length} messages. Topics discussed: ${
            [...new Set(session.messages.flatMap(m => m.metadata?.topics || []))]
              .join(', ') || 'General conversation'
          }`;
          
          set((state) => {
            state.sessions[sessionId].summary = summary;
          });
          
          logger.info('[EnhancedConversationMemory] Session summarized', { sessionId, summary });
        },
        
        // Processor management
        addProcessor: (sessionId, processor) => {
          set((state) => {
            const session = state.sessions[sessionId];
            if (session) {
              session.processors.push(processor);
              // Clear processed cache to force reprocessing
              delete session.processedMessages;
            }
          });
          
          logger.info('[EnhancedConversationMemory] Processor added', {
            sessionId,
            processor: processor.getName(),
          });
        },

        removeProcessor: (sessionId, processorName) => {
          set((state) => {
            const session = state.sessions[sessionId];
            if (session) {
              session.processors = session.processors.filter(
                p => p.getName() !== processorName
              );
              // Clear processed cache
              delete session.processedMessages;
            }
          });
          
          logger.info('[EnhancedConversationMemory] Processor removed', {
            sessionId,
            processorName,
          });
        },

        setDefaultProcessors: (processors) => {
          set((state) => {
            state.defaultProcessors = processors;
          });
          
          logger.info('[EnhancedConversationMemory] Default processors updated', {
            processors: processors.map(p => p.getName()),
          });
        },

        getMemoryStats: (sessionId) => {
          const state = get();
          const session = state.sessions[sessionId];
          if (!session) {
            return {
              totalMessages: 0,
              processedMessages: 0,
              estimatedTokens: 0,
              processors: [],
            };
          }
          
          const processedMessages = state.getProcessedMessages(sessionId);
          const estimatedTokens = processedMessages.reduce(
            (sum, msg) => sum + (msg.metadata?.tokenCount || 0),
            0
          );
          
          return {
            totalMessages: session.messages.length,
            processedMessages: processedMessages.length,
            estimatedTokens,
            processors: session.processors.map(p => p.getName()),
          };
        },
        
        // DB sync actions
        enableDbSync: async () => {
          set((state) => {
            state.isDbEnabled = true;
          });
          
          // Migrate existing sessions to DB
          const state = get();
          if (Object.keys(state.sessions).length > 0) {
            try {
              set((state) => {
                state.isSyncing = true;
              });
              
              for (const session of Object.values(state.sessions)) {
                // Create session in DB
                const dbSession = await ChatDatabaseService.createSession(
                  undefined,
                  session.summary || `Enhanced session ${session.id}`
                );
                
                // Store processor configuration
                await prisma.conversationSession.update({
                  where: { id: dbSession.id },
                  data: {
                    metadata: {
                      processors: session.processors.map(p => ({
                        name: p.getName(),
                        type: p.constructor.name,
                      })),
                      tokenUsage: session.tokenUsage,
                    },
                  },
                });
                
                // Add messages
                for (const message of session.messages) {
                  await prisma.conversationMessage.create({
                    data: {
                      sessionId: dbSession.id,
                      role: message.role as any,
                      content: message.content,
                      agentId: message.agentId,
                      metadata: message.metadata,
                      timestamp: message.timestamp,
                    },
                  });
                }
              }
              
              set((state) => {
                state.isSyncing = false;
              });
              
              logger.info('[EnhancedConversationMemory] DB sync enabled and data migrated');
            } catch (error) {
              logger.error('[EnhancedConversationMemory] Failed to migrate to DB', { error });
              set((state) => {
                state.isSyncing = false;
              });
            }
          }
        },
        
        disableDbSync: () => {
          set((state) => {
            state.isDbEnabled = false;
          });
          logger.info('[EnhancedConversationMemory] DB sync disabled');
        },
        
        syncWithDatabase: async () => {
          const state = get();
          if (!state.isDbEnabled) return;
          
          set((state) => {
            state.isSyncing = true;
          });
          
          try {
            // Sync all sessions and messages
            for (const session of Object.values(state.sessions)) {
              // Check if session exists in DB
              const dbSession = await prisma.conversationSession.findUnique({
                where: { id: session.id },
              });
              
              if (!dbSession) {
                // Create session
                await ChatDatabaseService.createSession(undefined, session.summary);
                
                // Store processor configuration
                await prisma.conversationSession.update({
                  where: { id: session.id },
                  data: {
                    metadata: {
                      processors: session.processors.map(p => ({
                        name: p.getName(),
                        type: p.constructor.name,
                      })),
                      tokenUsage: session.tokenUsage,
                    },
                  },
                });
              }
              
              // Sync messages
              for (const message of session.messages) {
                const exists = await prisma.conversationMessage.findUnique({
                  where: { id: message.id },
                });
                
                if (!exists) {
                  await prisma.conversationMessage.create({
                    data: {
                      id: message.id,
                      sessionId: session.id,
                      role: message.role as any,
                      content: message.content,
                      agentId: message.agentId,
                      metadata: message.metadata,
                      timestamp: message.timestamp,
                    },
                  });
                }
              }
            }
            
            set((state) => {
              state.isSyncing = false;
            });
            
            logger.info('[EnhancedConversationMemory] Synced with database');
          } catch (error) {
            logger.error('[EnhancedConversationMemory] Sync failed', { error });
            set((state) => {
              state.isSyncing = false;
            });
          }
        },
        
        loadFromDatabase: async () => {
          const state = get();
          if (!state.isDbEnabled) return;
          
          try {
            const dbSessions = await ChatDatabaseService.getUserSessions();
            const sessions: Record<string, ConversationSession> = {};
            
            for (const dbSession of dbSessions) {
              const sessionData = await ChatDatabaseService.getSessionWithMessages(dbSession.id);
              if (sessionData) {
                // Reconstruct processors from metadata
                let processors = DEFAULT_PROCESSORS;
                if (dbSession.metadata && typeof dbSession.metadata === 'object') {
                  const metadata = dbSession.metadata as any;
                  if (metadata.processors && Array.isArray(metadata.processors)) {
                    processors = metadata.processors.map((p: any) => {
                      if (p.type === 'TokenLimiter') {
                        const match = p.name.match(/TokenLimiter\((\d+)\)/);
                        return new TokenLimiter(match ? parseInt(match[1]) : 127000);
                      } else if (p.type === 'ToolCallFilter') {
                        return new ToolCallFilter();
                      }
                      return new TokenLimiter(127000); // Fallback
                    });
                  }
                }
                
                sessions[dbSession.id] = {
                  id: dbSession.id,
                  startedAt: dbSession.createdAt,
                  lastActiveAt: dbSession.lastActiveAt,
                  messages: sessionData.messages.map(msg => ({
                    id: msg.id,
                    sessionId: msg.sessionId,
                    role: msg.role as any,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    agentId: msg.agentId || undefined,
                    metadata: msg.metadata as any,
                  })),
                  summary: dbSession.summary || undefined,
                  processors,
                  tokenUsage: (dbSession.metadata as any)?.tokenUsage || { total: 0, input: 0, output: 0 },
                };
              }
            }
            
            set((state) => {
              state.sessions = sessions;
              if (dbSessions.length > 0) {
                state.currentSessionId = dbSessions[0].id;
              }
            });
            
            logger.info('[EnhancedConversationMemory] Loaded from database', { 
              sessionCount: dbSessions.length 
            });
          } catch (error) {
            logger.error('[EnhancedConversationMemory] Failed to load from database', { error });
          }
        },
        
        // Archive old messages manually
        archiveOldMessages: async (sessionId: string) => {
          const state = get();
          const session = state.sessions[sessionId];
          
          if (!session || session.messages.length <= MAX_MESSAGES_IN_MEMORY) {
            return;
          }
          
          const messagesToArchive = session.messages.slice(0, session.messages.length - MAX_MESSAGES_IN_MEMORY);
          
          // Archive to DB if enabled
          if (state.isDbEnabled) {
            logger.info('[EnhancedConversationMemory] Manually archiving messages', {
              sessionId,
              archiveCount: messagesToArchive.length,
            });
          }
          
          // Keep only recent messages in memory
          set((state) => {
            const currentSession = state.sessions[sessionId];
            if (currentSession) {
              currentSession.messages = currentSession.messages.slice(-MAX_MESSAGES_IN_MEMORY);
            }
          });
        },
        
        // Get archived messages from DB
        getArchivedMessages: async (sessionId: string) => {
          const state = get();
          
          if (!state.isDbEnabled) {
            return [];
          }
          
          try {
            const archivedMessages = await prisma.conversationMessage.findMany({
              where: { sessionId },
              orderBy: { timestamp: 'asc' },
              take: 100, // Limit to prevent memory issues
            });
            
            return archivedMessages.map(msg => ({
              id: msg.id,
              sessionId: msg.sessionId,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              agentId: msg.agentId || undefined,
              metadata: msg.metadata as any,
            }));
          } catch (error) {
            logger.error('[EnhancedConversationMemory] Failed to get archived messages', { error });
            return [];
          }
        },
      })),
      {
        name: 'enhanced-conversation-memory',
        version: 3, // Increment for DB integration
        migrate: (persistedState: any, version: number) => {
          if (version < 3) {
            return {
              ...persistedState,
              isDbEnabled: true,
              isSyncing: false,
              defaultProcessors: DEFAULT_PROCESSORS,
            };
          }
          return persistedState;
        },
        partialize: (state) => ({
          sessions: state.sessions,
          currentSessionId: state.currentSessionId,
          isDbEnabled: state.isDbEnabled,
          defaultProcessors: state.defaultProcessors,
        }),
        // Custom serialization for processors
        serialize: (state) => {
          const serializedState = {
            ...state,
            state: {
              ...state.state,
              sessions: Object.fromEntries(
                Object.entries(state.state.sessions).map(([id, session]) => [
                  id,
                  {
                    ...session,
                    processors: session.processors.map(p => ({
                      name: p.getName(),
                      type: p.constructor.name,
                    })),
                  },
                ])
              ),
              defaultProcessors: state.state.defaultProcessors.map(p => ({
                name: p.getName(),
                type: p.constructor.name,
              })),
            },
          };
          return JSON.stringify(serializedState);
        },
        // Custom deserialization to recreate processors
        deserialize: (str) => {
          const parsed = JSON.parse(str);
          if (parsed.state?.sessions) {
            Object.values(parsed.state.sessions).forEach((session: any) => {
              if (session.processors) {
                session.processors = session.processors.map((p: any) => {
                  // Recreate processors based on stored metadata
                  if (p.type === 'TokenLimiter') {
                    const match = p.name.match(/TokenLimiter\((\d+)\)/);
                    return new TokenLimiter(match ? parseInt(match[1]) : 127000);
                  } else if (p.type === 'ToolCallFilter') {
                    return new ToolCallFilter();
                  }
                  return new TokenLimiter(127000); // Fallback
                });
              }
            });
          }
          if (parsed.state?.defaultProcessors) {
            parsed.state.defaultProcessors = parsed.state.defaultProcessors.map((p: any) => {
              if (p.type === 'TokenLimiter') {
                const match = p.name.match(/TokenLimiter\((\d+)\)/);
                return new TokenLimiter(match ? parseInt(match[1]) : 127000);
              } else if (p.type === 'ToolCallFilter') {
                return new ToolCallFilter();
              }
              return new TokenLimiter(127000); // Fallback
            });
          }
          return parsed;
        },
      }
    )
  )
);

// Export convenience functions
export function createEnhancedSession(
  sessionId?: string,
  options: {
    maxTokens?: number;
    excludeTools?: string[];
    includeAllTools?: boolean;
  } = {}
): Promise<string> {
  const processors: MemoryProcessor[] = [];
  
  if (options.maxTokens) {
    processors.push(new TokenLimiter(options.maxTokens));
  }
  
  if (options.excludeTools || options.includeAllTools !== undefined) {
    processors.push(new ToolCallFilter({
      exclude: options.excludeTools,
      includeAll: options.includeAllTools,
    }));
  }
  
  return useEnhancedConversationMemory.getState().createSession(sessionId, processors);
}

export function addToolCallMessage(
  sessionId: string,
  toolName: string,
  content: string,
  result?: any
): Promise<void> {
  return useEnhancedConversationMemory.getState().addMessage({
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
}

// Export archiveOldMessages function for testing
export const archiveOldMessages = (sessionId: string) => 
  useEnhancedConversationMemory.getState().archiveOldMessages(sessionId);

export const getArchivedMessages = (sessionId: string) =>
  useEnhancedConversationMemory.getState().getArchivedMessages(sessionId);