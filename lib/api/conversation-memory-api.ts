/**
 * Client-side API functions for conversation memory operations
 */

import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';
import { apiCache, createKey } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import type { ConversationMemory } from '@/lib/api/types';

export interface ConversationMessage extends Omit<ConversationMemory, 'timestamp'> {
  sessionId: string;
  timestamp: Date;
  agentId?: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    symbols?: string[];
    topics?: string[];
    [key: string]: unknown;
  };
}

export interface ConversationSession {
  id: string;
  summary?: string;
  startedAt: Date;
  lastActiveAt: Date;
  metadata?: Record<string, unknown>;
}

export class ConversationMemoryAPI {
  /**
   * Add a message to memory
   */
  static async addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<ConversationMessage> {
    try {
      const response = await fetch('/api/memory/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Failed to add message: ${response.statusText}`);
      }

      const { message: savedMessage } = await response.json();
      return savedMessage;
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to add message', { error });
      throw error;
    }
  }

  /**
   * Get recent messages with retry and caching
   */
  static async getRecentMessages(sessionId: string, limit: number = 8): Promise<ConversationMessage[]> {
    const cacheKey = createKey('memory_messages', { sessionId, limit });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<ConversationMessage[]>(cacheKey, { 
      ttl: 30000, // 30秒
      useLocalStorage: false // メモリキャッシュのみ
    });
    
    if (cached) {
      logger.debug('[ConversationMemoryAPI] Returning cached messages', { sessionId, limit });
      return cached;
    }
    
    try {
      const messages = await withRetry(async () => {
        const response = await fetch(`/api/memory/sessions/${sessionId}/messages?limit=${limit}`);

        if (!response.ok) {
          throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const { messages } = await response.json();
        return messages.map((msg: ConversationMemory & { sessionId: string; agentId?: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ConversationMemoryAPI] Retrying getRecentMessages', { 
            error: error.message, 
            attempt, 
            sessionId, 
            limit 
          });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, messages, { useLocalStorage: false });
      
      return messages;
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to get messages after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<ConversationMessage[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: false 
      });
      
      if (staleCache) {
        logger.warn('[ConversationMemoryAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ConversationMemoryAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to retrieve messages for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search messages with retry and caching
   */
  static async searchMessages(query: string, sessionId?: string): Promise<ConversationMessage[]> {
    const cacheKey = createKey('memory_search', { query, sessionId: sessionId || 'all' });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<ConversationMessage[]>(cacheKey, { 
      ttl: 60000, // 1分
      useLocalStorage: false 
    });
    
    if (cached) {
      logger.debug('[ConversationMemoryAPI] Returning cached search results', { query, sessionId });
      return cached;
    }
    
    try {
      const messages = await withRetry(async () => {
        const params = new URLSearchParams({ query });
        if (sessionId) params.append('sessionId', sessionId);

        const response = await fetch(`/api/memory/search?${params}`);

        if (!response.ok) {
          throw new Error(`Failed to search messages: ${response.statusText}`);
        }

        const { messages } = await response.json();
        return messages.map((msg: ConversationMemory & { sessionId: string; agentId?: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ConversationMemoryAPI] Retrying searchMessages', { 
            error: error.message, 
            attempt, 
            query, 
            sessionId 
          });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, messages, { useLocalStorage: false });
      
      return messages;
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to search messages after retries', { error, query, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<ConversationMessage[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: false 
      });
      
      if (staleCache) {
        logger.warn('[ConversationMemoryAPI] Using stale cache due to API failure', { query, sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ConversationMemoryAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to search messages with query "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session context
   */
  static async getSessionContext(sessionId: string): Promise<string> {
    try {
      const response = await fetch(`/api/memory/sessions/${sessionId}/context`);

      if (!response.ok) {
        throw new Error(`Failed to get context: ${response.statusText}`);
      }

      const { context } = await response.json();
      return context;
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to get context', { error });
      return '';
    }
  }

  /**
   * Update session summary
   */
  static async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
    try {
      const response = await fetch(`/api/memory/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update summary: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to update summary', { error });
      throw error;
    }
  }
}