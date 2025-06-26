import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { conversationMemoryService } from '@/lib/services/conversation-memory.service';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api/create-api-handler';
import { getServerSession } from '@/lib/auth/server';

// Request validation schema
const memorySearchSchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
  filters: z.object({
    type: z.string().optional(),
    symbol: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional()
  }).optional()
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const sessionId = url.searchParams.get('sessionId');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const queryLower = query.toLowerCase();

    const messages = await prisma.conversationMessage.findMany({
      where: {
        ...(sessionId && { sessionId }),
        OR: [
          { content: { contains: queryLower, mode: 'insensitive' } },
          { metadata: { path: ['topics'], array_contains: queryLower } },
          { metadata: { path: ['symbols'], array_contains: queryLower } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    logger.info('[API] Searched conversation messages', { 
      query,
      sessionId,
      count: messages.length,
    });

    return NextResponse.json({ 
      messages: messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }))
    });
  } catch (error) {
    logger.error('[API] Failed to search messages', { error });
    
    return NextResponse.json(
      { error: 'Failed to search messages' },
      { status: 500 }
    );
  }
}

export const POST = createApiHandler({
  schema: memorySearchSchema,
  handler: async ({ data }) => {
    try {
      // Sanitize query - remove HTML tags and script content
      const sanitizedQuery = data.query
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (!sanitizedQuery) {
        throw new Error('Query parameter is required');
      }

      logger.info('[MemorySearch] Searching memories', {
        query: sanitizedQuery,
        sessionId: data.sessionId,
        limit: data.limit
      });

      const searchResults = await conversationMemoryService.searchMemories({
        query: sanitizedQuery,
        sessionId: data.sessionId,
        filters: data.filters,
        limit: data.limit
      });

      return {
        results: searchResults,
        count: searchResults.length
      };
    } catch (error) {
      logger.error('[MemorySearch] Search failed', { error });
      throw error;
    }
  }
});