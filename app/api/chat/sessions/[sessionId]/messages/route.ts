// Updated: チャットセッションメッセージAPIにて環境変数の型安全なアクセスを実装
import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';
import { isDevelopment } from '@/config/env';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const messages = await ChatDatabaseService.getMessages(sessionId);
    
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
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const message = await request.json();
    const dbMessage = await ChatDatabaseService.addMessage(sessionId, message);
    
    return NextResponse.json({ message: dbMessage });
  } catch (error) {
    logger.error('[API] Failed to add message', { 
      error,
      sessionId 
    });
    return NextResponse.json(
      { 
        error: 'Failed to add message',
        ...(isDevelopment() && typeof error === 'object'
          ? { detail: (error as Error).message, stack: (error as Error).stack }
          : {})
      },
      { status: 500 }
    );
  }
}