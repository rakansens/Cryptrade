import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  routeContext: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await routeContext.params;

    const messages = await prisma.conversationMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    // Reverse to get chronological order
    messages.reverse();

    if (messages.length === 0) {
      return NextResponse.json({ context: 'No previous context available.' });
    }

    const conversationContext = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    logger.info('[API] Generated conversation context', { 
      sessionId,
      messageCount: messages.length,
    });

    return NextResponse.json({ 
      context: `Recent conversation context:\n${conversationContext}`
    });
  } catch (error) {
    logger.error('[API] Failed to get conversation context', { error });
    
    return NextResponse.json(
      { error: 'Failed to get context' },
      { status: 500 }
    );
  }
}