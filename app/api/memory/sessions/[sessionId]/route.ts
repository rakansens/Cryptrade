import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface Params {
  params: {
    sessionId: string;
  };
}

const updateSessionSchema = z.object({
  summary: z.string(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const data = updateSessionSchema.parse(body);

    // Try to update if session exists, otherwise create it
    const session = await prisma.conversationSession.upsert({
      where: { id: sessionId },
      update: {
        summary: data.summary,
        lastActiveAt: new Date(),
      },
      create: {
        id: sessionId,
        summary: data.summary,
        lastActiveAt: new Date(),
      },
    });

    logger.info('[API] Updated conversation session summary', { 
      sessionId: session.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to update session summary', { error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}