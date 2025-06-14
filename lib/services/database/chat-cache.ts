import { logger } from '@/lib/utils/logger';
import type { ConversationSession, ConversationMessage } from '@prisma/client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Simple LRU cache implementation
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];

  constructor(
    private maxSize: number = 100,
    private defaultTTL: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.delete(key);
      return null;
    }
    
    // Update access order
    this.updateAccessOrder(key);
    
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
    
    this.updateAccessOrder(key);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
}

/**
 * Chat-specific caches
 */
export const chatCaches = {
  // Cache for individual sessions
  sessions: new LRUCache<ConversationSession>(1000, 10 * 60 * 1000), // 10 minutes
  
  // Cache for session lists by user
  sessionLists: new LRUCache<ConversationSession[]>(100, 5 * 60 * 1000), // 5 minutes
  
  // Cache for messages by session
  messages: new LRUCache<ConversationMessage[]>(500, 5 * 60 * 1000), // 5 minutes
  
  // Cache for message counts
  messageCounts: new LRUCache<number>(1000, 15 * 60 * 1000), // 15 minutes
};

/**
 * Invalidate cache entries for a session
 */
export function invalidateSessionCache(sessionId: string, userId?: string): void {
  chatCaches.sessions.delete(sessionId);
  chatCaches.messages.delete(sessionId);
  chatCaches.messageCounts.delete(sessionId);
  
  if (userId) {
    chatCaches.sessionLists.delete(userId);
  }
  
  logger.debug('[ChatCache] Invalidated cache for session', { sessionId, userId });
}

/**
 * Invalidate cache entries for a user
 */
export function invalidateUserCache(userId: string): void {
  chatCaches.sessionLists.delete(userId);
  
  logger.debug('[ChatCache] Invalidated cache for user', { userId });
}

/**
 * Invalidate all caches
 */
export function invalidateAllCaches(): void {
  chatCaches.sessions.clear();
  chatCaches.sessionLists.clear();
  chatCaches.messages.clear();
  chatCaches.messageCounts.clear();
  
  logger.info('[ChatCache] All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    sessions: chatCaches.sessions.size(),
    sessionLists: chatCaches.sessionLists.size(),
    messages: chatCaches.messages.size(),
    messageCounts: chatCaches.messageCounts.size(),
  };
}