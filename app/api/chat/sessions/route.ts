import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || undefined;
    const sessions = await ChatDatabaseService.getUserSessions(userId);
    
    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error('[API] Failed to get sessions', { error });
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title } = await request.json();
    const session = await ChatDatabaseService.createSession(userId, title);
    
    return NextResponse.json({ session });
  } catch (error) {
    logger.error('[API] Failed to create session', { error });
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}