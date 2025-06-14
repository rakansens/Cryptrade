import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { ChatAPI } from '@/lib/api/chat-api';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const includeMessages = request.nextUrl.searchParams.get('include') === 'messages';
    
    if (includeMessages) {
      const sessionData = await ChatDatabaseService.getSessionWithMessages(params.sessionId);
      if (!sessionData) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        session: ChatAPI.convertToChatSession(sessionData),
        messages: sessionData.messages.map(msg => ChatAPI.convertToChatMessage(msg)),
      });
    }
    
    // Just return session info
    const session = await ChatDatabaseService.getSession(params.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      session: ChatAPI.convertToChatSession(session),
    });
  } catch (error) {
    logger.error('[API] Failed to get session', { error });
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { title } = await request.json();
    await ChatDatabaseService.updateSessionTitle(params.sessionId, title);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to update session', { error });
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    await ChatDatabaseService.deleteSession(params.sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to delete session', { error });
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}