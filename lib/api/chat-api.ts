/**
 * Client-side API functions for chat operations
 * These functions call the API routes instead of directly using Prisma
 */

import { logger } from '@/lib/utils/logger';
import { apiCache, createKey } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { env } from '@/config/env';
import type { ProposalGroup, EntryProposalGroup } from '@/types/proposals';
import type { 
  CreateSessionRequest, 
  CreateSessionResponse,
  AddMessageRequest,
  AddMessageResponse 
} from '@/types/api.types';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: EntryProposalGroup;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export class ChatAPI {
  /**
   * Convert database session to chat session format
   */
  static convertToChatSession(dbSession: CreateSessionResponse['session']): ChatSession {
    return {
      id: dbSession.id,
      title: dbSession.title || 'Untitled Session',
      createdAt: new Date(dbSession.createdAt).getTime(),
      updatedAt: new Date(dbSession.updatedAt).getTime(),
    };
  }

  /**
   * Convert database message to chat message format
   */
  static convertToChatMessage(dbMessage: AddMessageResponse['message']): ChatMessage {
    const message: ChatMessage = {
      id: dbMessage.id,
      content: dbMessage.content,
      role: dbMessage.role,
      timestamp: dbMessage.timestamp,
      type: dbMessage.type || 'text',
      isTyping: dbMessage.isTyping || false,
    };
    
    if (dbMessage.proposalGroup !== undefined && dbMessage.proposalGroup !== null) {
      message.proposalGroup = dbMessage.proposalGroup as ProposalGroup;
    }
    
    if (dbMessage.entryProposalGroup !== undefined && dbMessage.entryProposalGroup !== null) {
      message.entryProposalGroup = dbMessage.entryProposalGroup as EntryProposalGroup;
    }
    
    return message;
  }
  /**
   * Create a new chat session
   */
  static async createSession(userId?: string, title?: string): Promise<ChatSession> {
    try {
      const request: CreateSessionRequest = { 
        ...(userId !== undefined && { userId }),
        ...(title !== undefined && { title })
      };
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const { session }: CreateSessionResponse = await response.json();
      return this.convertToChatSession(session);
    } catch (error) {
      logger.error('[ChatAPI] Failed to create session', { error });
      throw error;
    }
  }

  /**
   * Get user sessions with retry and caching
   */
  static async getUserSessions(userId?: string): Promise<ChatSession[]> {
    const cacheKey = createKey('chat_sessions', { userId: userId || 'default' });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<ChatSession[]>(cacheKey, { 
      ttl: 60000, // 1分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[ChatAPI] Returning cached sessions', { userId });
      return cached;
    }
    
    try {
      const sessions = await withRetry(async () => {
        const headers: HeadersInit = {};
        if (userId) {
          headers['x-user-id'] = userId;
        }

        const response = await fetch('/api/chat/sessions', {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to get sessions: ${response.statusText}`);
        }

        const { sessions } = await response.json();
        return sessions as ChatSession[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ChatAPI] Retrying getUserSessions', { error: error.message, attempt, userId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, sessions, { useLocalStorage: true });
      
      return sessions;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get sessions after retries', { error, userId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<ChatSession[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[ChatAPI] Using stale cache due to API failure', { userId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ChatAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to get sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a message to a session
   */
  static async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ChatMessage> {
    try {
      const request: AddMessageRequest = {
        content: message.content,
        role: message.role,
        ...(message.type !== undefined && { type: message.type }),
        ...(message.proposalGroup !== undefined && { proposalGroup: message.proposalGroup }),
        ...(message.entryProposalGroup !== undefined && { entryProposalGroup: message.entryProposalGroup }),
        ...(message.isTyping !== undefined && { isTyping: message.isTyping }),
      };
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to add message: ${response.statusText}`);
      }

      const { message: dbMessage }: AddMessageResponse = await response.json();
      return this.convertToChatMessage(dbMessage);
    } catch (error) {
      logger.error('[ChatAPI] Failed to add message', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get messages for a session with retry and caching
   */
  static async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const cacheKey = createKey('chat_messages', { sessionId });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<ChatMessage[]>(cacheKey, { 
      ttl: 30000, // 30秒
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[ChatAPI] Returning cached messages', { sessionId });
      return cached;
    }
    
    try {
      const messages = await withRetry(async () => {
        const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const { messages } = await response.json();
        return messages as ChatMessage[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ChatAPI] Retrying getMessages', { error: error.message, attempt, sessionId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, messages, { useLocalStorage: true });
      
      return messages;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get messages after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<ChatMessage[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[ChatAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ChatAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to get messages for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session with messages with retry and caching
   */
  static async getSessionWithMessages(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
    const cacheKey = createKey('chat_session_full', { sessionId });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<{ session: ChatSession; messages: ChatMessage[] }>(cacheKey, { 
      ttl: 60000, // 1分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[ChatAPI] Returning cached session with messages', { sessionId });
      return cached;
    }
    
    try {
      const data = await withRetry(async () => {
        const response = await fetch(`/api/chat/sessions/${sessionId}?include=messages`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to get session: ${response.statusText}`);
        }

        return await response.json();
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ChatAPI] Retrying getSessionWithMessages', { error: error.message, attempt, sessionId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, data, { useLocalStorage: true });
      
      return data;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get session with messages after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<{ session: ChatSession; messages: ChatMessage[] }>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[ChatAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境ではnullを返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ChatAPI] Returning null in development mode');
        return null;
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to get session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session title
   */
  static async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update session: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChatAPI] Failed to update session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChatAPI] Failed to delete session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Migrate data from localStorage to database
   */
  static async migrateFromLocalStorage(data: {
    sessions: Record<string, ChatSession>;
    messages: Record<string, ChatMessage[]>;
  }): Promise<void> {
    try {
      const response = await fetch('/api/chat/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to migrate data: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChatAPI] Failed to migrate from localStorage', { error });
      throw error;
    }
  }
}