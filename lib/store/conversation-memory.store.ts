import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { logger } from '@/lib/utils/logger';
import { ConversationMemoryAPI } from '@/lib/api/conversation-memory-api';

import { createDbSyncHandlers } from "@/lib/store/db-sync";
import type { ConversationMessage, ConversationSession } from "@/types/conversation-memory";
/**
 * Conversation Memory Store with Database Integration
 * 
 * エージェントの会話履歴を管理し、コンテキストを保持
 * - 最新8メッセージの保持
 * - セマンティック検索用のメタデータ
 * - セッション別の会話管理
 * - データベース統合
 */


// ストアの状態型定義
interface ConversationMemoryState {
  sessions: Record<string, ConversationSession>;
  currentSessionId: string | null;
  
  // DB sync state
  isDbEnabled: boolean;
  isSyncing: boolean;
  
  // Actions
  createSession: (sessionId?: string) => Promise<string>;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => Promise<void>;
  getRecentMessages: (sessionId: string, limit?: number) => ConversationMessage[];
  getSessionContext: (sessionId: string) => string;
  updateMessageMetadata: (messageId: string, metadata: ConversationMessage['metadata']) => Promise<void>;
  clearSession: (sessionId: string) => void;
  searchMessages: (query: string, sessionId?: string) => ConversationMessage[];
  summarizeSession: (sessionId: string) => Promise<void>;
  
  // DB sync actions
  enableDbSync: () => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

// Memory Store Implementation
export const useConversationMemory = create<ConversationMemoryState>()(
  devtools(
    persist(
      immer((set, get) => ({
        sessions: {},
        currentSessionId: null,
        isDbEnabled: true,
        isSyncing: false,

        createSession: async (sessionId?: string) => {
          const id = sessionId || `session-${Date.now()}`;
          const now = new Date();
          const state = get();
          
          // For now, just create locally since we need API endpoints for session creation
          // Local creation
          set((state) => {
            state.sessions[id] = {
              id,
              startedAt: now,
              lastActiveAt: now,
              messages: [],
            };
            state.currentSessionId = id;
          });
          
          logger.info('[ConversationMemory] Session created locally', { sessionId: id });
          return id;
        },

        addMessage: async (message) => {
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const timestamp = new Date();
          const state = get();
          
          const fullMessage: ConversationMessage = {
            ...message,
            id: messageId,
            timestamp,
          };
          
          // Update local state
          set((state) => {
            const session = state.sessions[message.sessionId];
            if (!session) {
              logger.warn('[ConversationMemory] Session not found, creating new', { 
                sessionId: message.sessionId 
              });
              state.sessions[message.sessionId] = {
                id: message.sessionId,
                startedAt: timestamp,
                lastActiveAt: timestamp,
                messages: [],
              };
            }
            
            const currentSession = state.sessions[message.sessionId];
            currentSession.messages.push(fullMessage);
            currentSession.lastActiveAt = timestamp;
            
            // Keep only recent 8 messages per session for memory efficiency
            if (currentSession.messages.length > 8) {
              currentSession.messages = currentSession.messages.slice(-8);
            }
          });
          
          // Save to database if enabled
          if (state.isDbEnabled) {
            try {
              const dbMessage = await ConversationMemoryAPI.addMessage(message);
              
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
              
              logger.info('[ConversationMemory] Message saved to DB', { 
                messageId: dbMessage.id,
                sessionId: message.sessionId 
              });
            } catch (error) {
              logger.error('[ConversationMemory] Failed to save message to DB', { error });
            }
          }
          
          logger.info('[ConversationMemory] Message added', { 
            sessionId: message.sessionId,
            role: message.role,
            hasMetadata: !!message.metadata,
          });
        },

        getRecentMessages: (sessionId, limit = 8) => {
          const session = get().sessions[sessionId];
          if (!session) return [];
          
          return session.messages.slice(-limit);
        },

        getSessionContext: (sessionId) => {
          const session = get().sessions[sessionId];
          if (!session || session.messages.length === 0) {
            return 'No previous context available.';
          }
          
          const recentMessages = session.messages.slice(-5);
          const context = recentMessages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');
          
          return `Recent conversation context:\n${context}`;
        },

        updateMessageMetadata: async (messageId, metadata) => {
          const state = get();
          
          set((state) => {
            for (const session of Object.values(state.sessions)) {
              const message = session.messages.find(m => m.id === messageId);
              if (message) {
                message.metadata = { ...message.metadata, ...metadata };
                break;
              }
            }
          });
          
          // Update in database if enabled
            messageId, 
            metadata 
          });
        },

        clearSession: (sessionId) => {
          set((state) => {
            if (state.sessions[sessionId]) {
              state.sessions[sessionId].messages = [];
              state.sessions[sessionId].lastActiveAt = new Date();
            }
          });
          
          logger.info('[ConversationMemory] Session cleared', { sessionId });
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
          
              .join(', ') || 'General conversation'
          }`;
          
          set((state) => {
            state.sessions[sessionId].summary = summary;
          });
          
          logger.info('[ConversationMemory] Session summarized', { sessionId, summary });

        },
          ...createDbSyncHandlers(set, get),
        
      })),
      {
        name: 'conversation-memory',
        version: 2, // Increment for DB integration
        migrate: (persistedState: any, version: number) => {
          if (version === 0 || version === 1) {
            return {
              ...persistedState,
              isDbEnabled: true,
              isSyncing: false,
            };
          }
          return persistedState;
        },
        partialize: (state) => ({
          sessions: state.sessions,
          currentSessionId: state.currentSessionId,
          isDbEnabled: state.isDbEnabled,
        }),
      }
    )
  )
);

// Helper functions for semantic search (future implementation)
export function calculateSimilarity(embedding1: number[], embedding2: number[]): number {
  // Cosine similarity calculation
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return similarity;
}

// Export semantic search function
export async function semanticSearch(
  query: string, 
  sessionId?: string,
  threshold = 0.7
): Promise<ConversationMessage[]> {
  try {
    const state = useConversationMemory.getState();
    const sessions = sessionId 
      ? { [sessionId]: state.sessions[sessionId] } 
      : state.sessions;
    
    // Collect all messages with their embeddings
    const allMessages: ConversationMessage[] = [];
    for (const session of Object.values(sessions)) {
      if (!session) continue;
      allMessages.push(...session.messages);
    }
    
    if (allMessages.length === 0) {
      return [];
    }
    
    logger.info('[ConversationMemory] Semantic search fallback to text search', {
      query,
      threshold,
    });
    
    return state.searchMessages(query, sessionId);
    
  } catch (error) {
    logger.error('[ConversationMemory] Semantic search failed, falling back to text search', {
      error: String(error),
    });
    
    // Fallback to text search
    return useConversationMemory.getState().searchMessages(query, sessionId);
  }
}

// Generate embeddings for new messages
export async function generateMessageEmbedding(message: ConversationMessage): Promise<void> {
  try {
    // Only generate embeddings for user and assistant messages
    if (message.role === 'system') return;
    
    logger.debug('[ConversationMemory] Embedding generation placeholder', {
      messageId: message.id,
      role: message.role,
    });
  } catch (error) {
    logger.error('[ConversationMemory] Failed to generate embedding for message', {
      messageId: message.id,
      error: String(error),
    });
  }
}