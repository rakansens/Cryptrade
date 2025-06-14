/**
 * Client-side API functions for conversation memory operations
 */

import { logger } from '@/lib/utils/logger';
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
   * Get recent messages
   */
  static async getRecentMessages(sessionId: string, limit: number = 8): Promise<ConversationMessage[]> {
    try {
      const response = await fetch(`/api/memory/sessions/${sessionId}/messages?limit=${limit}`);

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }

      const { messages } = await response.json();
      return messages.map((msg: ConversationMemory & { sessionId: string; agentId?: string }) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to get messages', { error });
      return [];
    }
  }

  /**
   * Search messages
   */
  static async searchMessages(query: string, sessionId?: string): Promise<ConversationMessage[]> {
    try {
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
    } catch (error) {
      logger.error('[ConversationMemoryAPI] Failed to search messages', { error });
      return [];
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