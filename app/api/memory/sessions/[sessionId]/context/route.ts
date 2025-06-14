import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';

interface Params {
  params: {
    sessionId: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;

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

    const context = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    logger.info('[API] Generated conversation context', { 
      sessionId,
      messageCount: messages.length,
    });

    return NextResponse.json({ 
      context: `Recent conversation context:\n${context}`
    });
  } catch (error) {
    logger.error('[API] Failed to get conversation context', { error });
    
    return NextResponse.json(
      { error: 'Failed to get context' },
      { status: 500 }
    );
  }
}