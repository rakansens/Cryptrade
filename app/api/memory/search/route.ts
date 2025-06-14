import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
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