import { prisma } from '@/lib/db/prisma';
import type { ConversationSession, ConversationMessage, Prisma } from '@prisma/client';
import { logger } from '@/lib/utils/logger';
import { checkDatabaseHealth } from '@/lib/db/health-check';
import {
  validateAndSanitizeChatMessage,
  UpdateSessionTitleSchema,
  UserIdSchema,
  formatZodError,
  sanitizeString,
  MetadataSchema,
  PaginationSchema,
} from './chat.validation';
import { chatRateLimiters, enforceRateLimit } from './rate-limiter';
import { chatCaches, invalidateSessionCache, invalidateUserCache } from './chat-cache';
import type { ChatMessageMetadata, ProposalGroup, EntryProposalGroup } from '@/types/database.types';

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

export class ChatDatabaseService {
  /**
   * Create a new chat session
   */
  static async createSession(userId?: string, title?: string): Promise<ConversationSession> {
    try {
      // Validate inputs
      const validatedUserId = userId ? UserIdSchema.parse(userId) : undefined;
      const sanitizedTitle = title ? sanitizeString(title) : `Chat session ${new Date().toLocaleString()}`;
      
      // Apply rate limiting
      const rateLimitKey = userId || 'anonymous';
      await enforceRateLimit(chatRateLimiters.sessionCreation, rateLimitKey);
      
      // Check database health
      const health = await checkDatabaseHealth();
      if (health.status !== 'healthy') {
        throw new Error(`Database is not healthy: ${health.error}`);
      }
      
      const session = await prisma.conversationSession.create({
        data: {
          userId: validatedUserId,
          summary: sanitizedTitle,
        },
      });
      
      // Invalidate user's session list cache
      if (validatedUserId) {
        invalidateUserCache(validatedUserId);
      }
      
      logger.info('[ChatDB] Session created', { sessionId: session.id });
      return session;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('[ChatDB] Failed to create session', { 
          error,
          userId,
          title 
        });
      }
      throw error;
    }
  }

  /**
   * Get all sessions for a user with pagination
   */
  static async getUserSessions(
    userId?: string,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<ConversationSession[]> {
    try {
      const validatedUserId = userId ? UserIdSchema.parse(userId) : undefined;
      const { limit, cursor } = PaginationSchema.parse(pagination || {});
      
      // Check cache first (only for non-paginated requests)
      if (!cursor) {
        const cacheKey = validatedUserId || 'anonymous';
        const cached = chatCaches.sessionLists.get(cacheKey);
        if (cached) {
          logger.debug('[ChatDB] Sessions retrieved from cache', { userId, count: cached.length });
          return cached.slice(0, limit);
        }
      }
      
      // Apply rate limiting
      const rateLimitKey = userId || 'anonymous';
      await enforceRateLimit(chatRateLimiters.sessionQuery, rateLimitKey);
      
      const sessions = await prisma.conversationSession.findMany({
        where: userId ? { userId: validatedUserId } : {},
        orderBy: { lastActiveAt: 'desc' },
        take: limit,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });
      
      // Cache the results (only for non-paginated requests)
      if (!cursor && sessions.length > 0) {
        const cacheKey = validatedUserId || 'anonymous';
        chatCaches.sessionLists.set(cacheKey, sessions);
      }
      
      return sessions;
    } catch (error) {
      logger.error('[ChatDB] Failed to get sessions', { error, userId });
      return [];
    }
  }

  /**
   * Get a specific session
   */
  static async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const session = await prisma.conversationSession.findUnique({
        where: { id: sessionId },
      });
      
      return session;
    } catch (error) {
      logger.error('[ChatDB] Failed to get session', { error, sessionId });
      return null;
    }
  }

  /**
   * Get all messages for a session
   */
  static async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      // Check cache first
      const cachedMessages = chatCaches.messages.get(sessionId);
      if (cachedMessages) {
        logger.debug('[ChatDB] Messages retrieved from cache', { sessionId });
        return cachedMessages.map(msg => ChatDatabaseService.convertToChatMessage(msg));
      }
      
      const messages = await prisma.conversationMessage.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      });
      
      // Cache the results
      if (messages.length > 0) {
        chatCaches.messages.set(sessionId, messages);
      }
      
      return messages.map(msg => ChatDatabaseService.convertToChatMessage(msg));
    } catch (error) {
      logger.error('[ChatDB] Failed to get messages', { error, sessionId });
      return [];
    }
  }

  /**
   * Get a specific session with messages
   */
  static async getSessionWithMessages(sessionId: string) {
    try {
      // Check cache for session
      const cachedSession = chatCaches.sessions.get(sessionId);
      const cachedMessages = chatCaches.messages.get(sessionId);
      
      if (cachedSession && cachedMessages) {
        logger.debug('[ChatDB] Session and messages retrieved from cache', { sessionId });
        return {
          ...cachedSession,
          messages: cachedMessages,
        };
      }
      
      const session = await prisma.conversationSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });
      
      // Cache the results
      if (session) {
        chatCaches.sessions.set(sessionId, session);
        chatCaches.messages.set(sessionId, session.messages);
      }
      
      return session;
    } catch (error) {
      logger.error('[ChatDB] Failed to get session with messages', { error, sessionId });
      return null;
    }
  }

  /**
   * Add a message to a session
   */
  static async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ConversationMessage> {
    try {
      // Apply rate limiting per session
      await enforceRateLimit(chatRateLimiters.messageCreation, sessionId);
      
      // Validate and sanitize message
      const validatedMessage = validateAndSanitizeChatMessage(message);
      
      // Convert ChatMessage format to database format
      const metadata: ChatMessageMetadata = {};
      
      if (validatedMessage.type) metadata.type = validatedMessage.type;
      if (validatedMessage.proposalGroup) metadata.proposalGroup = validatedMessage.proposalGroup;
      if (validatedMessage.entryProposalGroup) metadata.entryProposalGroup = validatedMessage.entryProposalGroup;
      if (validatedMessage.isTyping !== undefined) metadata.isTyping = validatedMessage.isTyping;

      // Validate metadata size
      const validatedMetadata = Object.keys(metadata).length > 0 ? 
        MetadataSchema.parse(metadata) : null;

      // Use transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Verify session exists
        const session = await tx.conversationSession.findUnique({
          where: { id: sessionId },
        });
        
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        
        const dbMessage = await tx.conversationMessage.create({
          data: {
            sessionId,
            role: validatedMessage.role === 'user' ? 'user' : 'assistant',
            content: validatedMessage.content,
            metadata: validatedMetadata,
          },
        });

        // Update session's lastActiveAt
        await tx.conversationSession.update({
          where: { id: sessionId },
          data: { lastActiveAt: new Date() },
        });
        
        return { dbMessage, session };
      });

      // Invalidate caches
      if (result.session) {
        invalidateSessionCache(sessionId, result.session.userId || undefined);
      }
      
      logger.info('[ChatDB] Message added', { 
        sessionId, 
        messageId: result.dbMessage.id,
        role: result.dbMessage.role 
      });
      
      return result.dbMessage;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('[ChatDB] Failed to add message', { 
          error,
          sessionId,
          messageRole: message.role,
          contentLength: message.content?.length 
        });
      }
      throw error;
    }
  }

  /**
   * Update session title
   */
  static async updateSessionTitle(sessionId: string, title: string): Promise<ConversationSession> {
    try {
      // Validate inputs
      const validated = UpdateSessionTitleSchema.parse({ sessionId, title });
      const sanitizedTitle = sanitizeString(validated.title);
      
      const updatedSession = await prisma.conversationSession.update({
        where: { id: validated.sessionId },
        data: { summary: sanitizedTitle },
      });
      
      // Invalidate session cache
      chatCaches.sessions.delete(validated.sessionId);
      
      logger.info('[ChatDB] Session title updated', { sessionId, title: sanitizedTitle });
      return updatedSession;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('[ChatDB] Failed to update session title', { 
          error,
          sessionId,
          title 
        });
      }
      throw error;
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      // Get session to find userId before deletion
      const session = await prisma.conversationSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      
      await prisma.conversationSession.delete({
        where: { id: sessionId },
      });
      
      // Invalidate all related caches
      if (session) {
        invalidateSessionCache(sessionId, session.userId || undefined);
      }
      
      logger.info('[ChatDB] Session deleted', { sessionId });
    } catch (error) {
      logger.error('[ChatDB] Failed to delete session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Convert database message to chat message format
   */
  static convertToChatMessage(dbMessage: ConversationMessage): ChatMessage {
    const metadata = dbMessage.metadata as ChatMessageMetadata || {};
    
    return {
      id: dbMessage.id,
      content: dbMessage.content,
      role: dbMessage.role as 'user' | 'assistant',
      timestamp: dbMessage.timestamp.getTime(),
      type: metadata.type,
      proposalGroup: metadata.proposalGroup,
      entryProposalGroup: metadata.entryProposalGroup,
      isTyping: metadata.isTyping,
    };
  }

  /**
   * Convert database session to chat session format
   */
  static convertToChatSession(dbSession: ConversationSession): ChatSession {
    return {
      id: dbSession.id,
      title: dbSession.summary || 'Untitled session',
      createdAt: dbSession.createdAt.getTime(),
      updatedAt: dbSession.updatedAt.getTime(),
    };
  }

  /**
   * Migrate localStorage data to database
   */
  static async migrateFromLocalStorage(
    localData: {
      sessions: Record<string, ChatSession>;
      messagesBySession: Record<string, ChatMessage[]>;
    },
    userId?: string
  ): Promise<void> {
    logger.info('[ChatDB] Starting migration from localStorage');
    
    try {
      for (const [sessionId, session] of Object.entries(localData.sessions)) {
        // Check if session already exists in DB
        const existingSession = await prisma.conversationSession.findUnique({
          where: { id: sessionId },
        });

        if (existingSession) {
          logger.info('[ChatDB] Session already exists, skipping', { sessionId });
          continue;
        }

        // Create session with the same ID
        await prisma.conversationSession.create({
          data: {
            id: sessionId,
            userId,
            summary: session.title,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
          },
        });

        // Add messages for this session
        const messages = localData.messagesBySession[sessionId] || [];
        for (const message of messages) {
          const metadata: ChatMessageMetadata = {};
          if (message.type) metadata.type = message.type;
          if (message.proposalGroup) metadata.proposalGroup = message.proposalGroup;
          if (message.entryProposalGroup) metadata.entryProposalGroup = message.entryProposalGroup;

          await prisma.conversationMessage.create({
            data: {
              id: message.id,
              sessionId,
              role: message.role === 'user' ? 'user' : 'assistant',
              content: message.content,
              timestamp: new Date(message.timestamp),
              metadata: Object.keys(metadata).length > 0 ? metadata : null,
            },
          });
        }

        logger.info('[ChatDB] Session migrated', { 
          sessionId, 
          messageCount: messages.length 
        });
      }

      logger.info('[ChatDB] Migration completed successfully');
    } catch (error) {
      logger.error('[ChatDB] Migration failed', { error });
      throw error;
    }
  }
}