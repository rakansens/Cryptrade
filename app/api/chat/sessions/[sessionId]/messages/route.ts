import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const messages = await ChatDatabaseService.getMessages(params.sessionId);
    
    return NextResponse.json({ messages });
  } catch (error) {
    logger.error('[API] Failed to get messages', { error });
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const message = await request.json();
    const dbMessage = await ChatDatabaseService.addMessage(params.sessionId, message);
    
    return NextResponse.json({ message: dbMessage });
  } catch (error) {
    logger.error('[API] Failed to add message', { 
      error,
      sessionId: params.sessionId 
    });
    return NextResponse.json(
      { 
        error: 'Failed to add message',
        ...(process.env.NODE_ENV === 'development' && typeof error === 'object' ? { detail: (error as Error).message, stack: (error as Error).stack } : {})
      },
      { status: 500 }
    );
  }
}