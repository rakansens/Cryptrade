import { createTool } from '@mastra/core';
import { z } from 'zod';
import { useConversationMemory } from '@/lib/store/conversation-memory.store';
import { logger } from '@/lib/utils/logger';

/**
 * Memory Recall Tool for Mastra Agents
 * 
 * 会話履歴の取得とコンテキスト管理を提供
 * - 最新メッセージの取得
 * - セマンティック検索（将来実装）
 * - セッションコンテキストの構築
 */

// Input Schema
const MemoryRecallInput = z.object({
  sessionId: z.string().describe('Session ID for conversation context'),
  operation: z.enum(['getRecent', 'search', 'getContext', 'addMessage']).describe('Memory operation type'),
  limit: z.number().min(1).max(20).optional().default(8).describe('Number of messages to retrieve'),
  query: z.string().optional().describe('Search query for semantic recall'),
  message: z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    agentId: z.string().optional(),
    metadata: z.object({
      intent: z.string().optional(),
      confidence: z.number().optional(),
      symbols: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
    }).optional(),
  }).optional().describe('Message to add to memory'),
});

// Output Schema
const MemoryRecallOutput = z.object({
  success: z.boolean(),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string(),
    agentId: z.string().optional(),
    metadata: z.unknown().optional(),
  })).optional(),
  context: z.string().optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
});

export const memoryRecallTool = createTool({
  id: 'memory-recall',
  description: 'Access and manage conversation memory for context-aware responses',
  inputSchema: MemoryRecallInput,
  outputSchema: MemoryRecallOutput,
  
  execute: async ({ context }) => {
    const input = context;
    const startTime = Date.now();
    const memoryStore = useConversationMemory.getState();
    
    try {
      logger.info('[MemoryRecallTool] Executing operation', {
        operation: input.operation,
        sessionId: input.sessionId,
      });

      switch (input.operation) {
        case 'getRecent': {
          const messages = memoryStore.getRecentMessages(input.sessionId, input.limit);
          
          return {
            success: true,
            messages: messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.toISOString(),
              agentId: msg.agentId,
              metadata: msg.metadata,
            })),
            summary: `Retrieved ${messages.length} recent messages`,
          };
        }

        case 'search': {
          if (!input.query) {
            return {
              success: false,
              error: 'Search query is required for search operation',
            };
          }
          
          const messages = memoryStore.searchMessages(input.query, input.sessionId);
          
          return {
            success: true,
            messages: messages.slice(0, input.limit).map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.toISOString(),
              agentId: msg.agentId,
              metadata: msg.metadata,
            })),
            summary: `Found ${messages.length} messages matching "${input.query}"`,
          };
        }

        case 'getContext': {
          const context = memoryStore.getSessionContext(input.sessionId);
          const session = memoryStore.sessions[input.sessionId];
          
          return {
            success: true,
            context,
            summary: session?.summary || 'No session summary available',
          };
        }

        case 'addMessage': {
          if (!input.message) {
            return {
              success: false,
              error: 'Message is required for addMessage operation',
            };
          }
          
          await memoryStore.addMessage({
            sessionId: input.sessionId,
            ...input.message,
          });
          
          return {
            success: true,
            summary: `Message added to session ${input.sessionId}`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown operation: ${input.operation}`,
          };
      }
    } catch (error) {
      logger.error('[MemoryRecallTool] Operation failed', {
        operation: input.operation,
        sessionId: input.sessionId,
        error: String(error),
        executionTime: Date.now() - startTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Memory operation failed',
      };
    }
  },
});

/**
 * Helper function to format conversation context for LLM
 */
export function formatConversationContext(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2000
): string {
  let context = '';
  let tokenCount = 0;
  
  // Process messages in reverse order (most recent first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const formattedMsg = `${msg.role}: ${msg.content}\n\n`;
    const msgTokens = Math.ceil(formattedMsg.length / 4); // Rough token estimate
    
    if (tokenCount + msgTokens > maxTokens) {
      break;
    }
    
    context = formattedMsg + context;
    tokenCount += msgTokens;
  }
  
  return context.trim();
}

/**
 * Extract topics and symbols from user query
 */
export function extractMetadataFromQuery(query: string): {
  symbols: string[];
  topics: string[];
} {
  const symbols: string[] = [];
  const topics: string[] = [];
  
  // Extract cryptocurrency symbols
  const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC'];
  const queryUpper = query.toUpperCase();
  
  for (const symbol of cryptoSymbols) {
    if (queryUpper.includes(symbol)) {
      symbols.push(symbol);
    }
  }
  
  // Extract topics based on keywords
  const topicKeywords = {
    price: ['価格', 'いくら', 'price', 'cost', 'value'],
    trading: ['取引', '売買', 'trading', 'trade', 'buy', 'sell'],
    analysis: ['分析', '解析', 'analysis', 'analyze', 'technical'],
    market: ['市場', '相場', 'market', 'trend'],
    chart: ['チャート', 'グラフ', 'chart', 'graph'],
    indicator: ['インジケーター', '指標', 'indicator', 'rsi', 'macd'],
  };
  
  const queryLower = query.toLowerCase();
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      topics.push(topic);
    }
  }
  
  return { symbols, topics };
}