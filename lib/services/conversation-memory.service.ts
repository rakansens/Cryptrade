import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import type { ConversationMessage } from '@/types/conversation-memory';
import { embeddingService } from './semantic-embedding.service';

/**
 * Conversation Memory Service
 * 
 * サーバーサイドでの会話メモリ管理とセマンティック検索機能を提供
 */
export class ConversationMemoryService {
  /**
   * Search memories based on query and filters
   */
  async searchMemories(params: {
    query: string;
    sessionId?: string;
    filters?: {
      type?: string;
      symbol?: string;
      dateRange?: {
        start?: string;
        end?: string;
      };
    };
    limit?: number;
  }): Promise<ConversationMessage[]> {
    try {
      const { query, sessionId, filters, limit = 20 } = params;

      // Semantic search using embeddings
      const { embedding: queryEmbedding } = await embeddingService.generateEmbedding(query);

      // Build where clause
      const where: any = {};
      
      if (sessionId) {
        where.sessionId = sessionId;
      }

      if (filters) {
        if (filters.type) {
          where.agentId = filters.type;
        }

        if (filters.symbol) {
          where.metadata = {
            path: ['symbols'],
            array_contains: filters.symbol,
          };
        }

        if (filters.dateRange) {
          const dateConditions: any = {};
          if (filters.dateRange.start) {
            dateConditions.gte = new Date(filters.dateRange.start);
          }
          if (filters.dateRange.end) {
            dateConditions.lte = new Date(filters.dateRange.end);
          }
          if (Object.keys(dateConditions).length > 0) {
            where.timestamp = dateConditions;
          }
        }
      }

      // Get messages from database
      const messages = await prisma.conversationMessage.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit * 2, // Get more to filter by similarity
      });

      // Calculate similarity scores
      const scoredMessages = messages.map(msg => {
        // Extract embedding from metadata if available
        const msgEmbedding = (msg.metadata as any)?.embedding;
        let similarity = 0;

        if (msgEmbedding && Array.isArray(msgEmbedding)) {
          similarity = this.calculateCosineSimilarity(queryEmbedding, msgEmbedding);
        } else {
          // Fallback to text similarity
          similarity = this.calculateTextSimilarity(query, msg.content);
        }

        return {
          ...msg,
          similarity,
        };
      });

      // Sort by similarity and take top results
      const results = scoredMessages
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity, ...msg }) => ({
          id: msg.id,
          sessionId: msg.sessionId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
          agentId: msg.agentId || undefined,
          metadata: msg.metadata as any,
        }));

      logger.info('[ConversationMemoryService] Search completed', {
        query: query.substring(0, 50),
        resultsCount: results.length,
        sessionId,
      });

      return results;
    } catch (error) {
      logger.error('[ConversationMemoryService] Search failed', { error });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const val1 = embedding1[i]!;
      const val2 = embedding2[i]!;
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Calculate simple text similarity (fallback)
   */
  private calculateTextSimilarity(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower.includes(queryLower)) {
      return 0.8 + (queryLower.length / textLower.length) * 0.2;
    }

    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    const matchingWords = queryWords.filter(word => textWords.includes(word));

    return matchingWords.length / queryWords.length * 0.5;
  }
}

// Export singleton instance
export const conversationMemoryService = new ConversationMemoryService();