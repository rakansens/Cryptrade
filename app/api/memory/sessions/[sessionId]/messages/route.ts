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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '8');

    const messages = await prisma.conversationMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Reverse to get chronological order
    messages.reverse();

    logger.info('[API] Retrieved conversation messages', { 
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
    logger.error('[API] Failed to get conversation messages', { error });
    
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}