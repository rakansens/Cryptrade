/**
 * Client-side API functions for chat operations
 * These functions call the API routes instead of directly using Prisma
 */

import { logger } from '@/lib/utils/logger';
import type { ProposalGroup, EntryProposalGroup } from '@/types/database.types';
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
      title: dbSession.summary || dbSession.title || 'Untitled Session',
      createdAt: new Date(dbSession.createdAt).getTime(),
      updatedAt: new Date(dbSession.updatedAt).getTime(),
    };
  }

  /**
   * Convert database message to chat message format
   */
  static convertToChatMessage(dbMessage: AddMessageResponse['message']): ChatMessage {
    return {
      id: dbMessage.id,
      content: dbMessage.content,
      role: dbMessage.role as 'user' | 'assistant',
      timestamp: new Date(dbMessage.timestamp || dbMessage.createdAt).getTime(),
      type: dbMessage.metadata?.type || 'text',
      proposalGroup: dbMessage.metadata?.proposalGroup,
      entryProposalGroup: dbMessage.metadata?.entryProposalGroup,
      isTyping: dbMessage.metadata?.isTyping || false,
    };
  }
  /**
   * Create a new chat session
   */
  static async createSession(userId?: string, title?: string): Promise<ChatSession> {
    try {
      const request: CreateSessionRequest = { userId, title };
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
   * Get user sessions
   */
  static async getUserSessions(userId?: string): Promise<ChatSession[]> {
    try {
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
      return sessions;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get sessions', { error });
      return [];
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
        type: message.type,
        proposalGroup: message.proposalGroup,
        entryProposalGroup: message.entryProposalGroup,
        isTyping: message.isTyping,
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
   * Get messages for a session
   */
  static async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }

      const { messages } = await response.json();
      return messages;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get messages', { error, sessionId });
      return [];
    }
  }

  /**
   * Get session with messages
   */
  static async getSessionWithMessages(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}?include=messages`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('[ChatAPI] Failed to get session with messages', { error, sessionId });
      return null;
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