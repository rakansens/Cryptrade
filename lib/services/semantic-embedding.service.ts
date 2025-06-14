import { logger } from '@/lib/utils/logger';
import { BaseService } from '@/lib/api/base-service';
import { APP_CONSTANTS } from '@/config/app-constants';
import { env } from '@/config/env';

/**
 * Semantic Embedding Service
 * 
 * テキストの意味的埋め込みベクトルを生成し、
 * セマンティック検索を可能にする
 */

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface SimilaritySearchOptions {
  threshold?: number;
  topK?: number;
  filter?: (item: any) => boolean;
}

export class SemanticEmbeddingService extends BaseService {
  private static instance: SemanticEmbeddingService;
  private embeddingCache: Map<string, number[]> = new Map();
  private readonly model = 'text-embedding-3-small';
  
  private constructor() {
    super('https://api.openai.com/v1'); // OpenAI API base URL
  }

  // Override the post method to add OpenAI specific headers
  protected async post<T>(url: string, data?: any) {
    const originalHeaders = this.client['config']?.headers || {};
    
    // We need to add the Authorization header for OpenAI
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Use a different approach since we can't directly access the client config
    return await super.post<T>(url, data);
  }
  
  static getInstance(): SemanticEmbeddingService {
    if (!SemanticEmbeddingService.instance) {
      SemanticEmbeddingService.instance = new SemanticEmbeddingService();
    }
    return SemanticEmbeddingService.instance;
  }
  
  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      logger.debug('[EmbeddingService] Cache hit', { textLength: text.length });
      return {
        embedding: cached,
        model: this.model,
        tokensUsed: 0,
      };
    }
    
    try {
      const response = await this.post<{
        object: string;
        data: Array<{ embedding: number[]; index: number; object: string }>;
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
      }>('/embeddings', {
        model: this.model,
        input: text,
      });
      
      const embedding = response.data.data[0].embedding;
      
      // Cache the result
      this.embeddingCache.set(cacheKey, embedding);
      
      // Limit cache size to use APP_CONSTANTS configuration
      const maxCacheSize = Math.floor(APP_CONSTANTS.ui.bufferSize * 10); // 1000 items
      if (this.embeddingCache.size > maxCacheSize) {
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
      }
      
      logger.info('[EmbeddingService] Embedding generated', {
        textLength: text.length,
        dimensions: embedding.length,
        tokensUsed: response.data.usage?.total_tokens || 0,
      });
      
      return {
        embedding,
        model: this.model,
        tokensUsed: response.data.usage?.total_tokens || 0,
      };
    } catch (error) {
      logger.error('[EmbeddingService] Failed to generate embedding', {
        error: String(error),
        textLength: text.length,
      });
      throw error;
    }
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
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
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }
  
  /**
   * Find similar items based on embedding similarity
   */
  async findSimilar<T extends { embedding?: number[]; content: string }>(
    query: string,
    items: T[],
    options: SimilaritySearchOptions = {}
  ): Promise<Array<{ item: T; similarity: number }>> {
    const { threshold = 0.7, topK = 10, filter } = options;
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Calculate similarities
    const results: Array<{ item: T; similarity: number }> = [];
    
    for (const item of items) {
      // Apply filter if provided
      if (filter && !filter(item)) continue;
      
      // Get or generate item embedding
      let itemEmbedding = item.embedding;
      if (!itemEmbedding) {
        const result = await this.generateEmbedding(item.content);
        itemEmbedding = result.embedding;
      }
      
      const similarity = this.calculateSimilarity(
        queryEmbedding.embedding,
        itemEmbedding
      );
      
      if (similarity >= threshold) {
        results.push({ item, similarity });
      }
    }
    
    // Sort by similarity (descending) and take top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }
  
  /**
   * Batch generate embeddings for multiple texts
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logger.error('[EmbeddingService] Batch generation failed', {
          batchIndex: i / batchSize,
          error: String(error),
        });
        // Continue with next batch
      }
      
      // Small delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
  
  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    logger.info('[EmbeddingService] Cache cleared');
  }
  
  /**
   * Get cache key for text
   */
  private getCacheKey(text: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.model}_${hash}_${text.length}`;
  }
}

// Export singleton instance
export const embeddingService = SemanticEmbeddingService.getInstance();