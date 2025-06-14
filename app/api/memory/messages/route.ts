import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// Message schema
const createMessageSchema = z.object({
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  agentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createMessageSchema.parse(body);

    const message = await prisma.conversationMessage.create({
      data: {
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        agentId: data.agentId,
        metadata: data.metadata,
      },
    });

    logger.info('[API] Conversation message created', { 
      messageId: message.id,
      sessionId: message.sessionId,
    });

    return NextResponse.json({ 
      message: {
        ...message,
        timestamp: message.timestamp.toISOString(),
      }
    });
  } catch (error) {
    logger.error('[API] Failed to create conversation message', { error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}