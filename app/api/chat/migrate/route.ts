import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';

interface MigrateSession {
  title: string;
  createdAt?: number;
  updatedAt?: number;
}

interface MigrateMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: unknown;
  entryProposalGroup?: unknown;
  isTyping?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { sessions, messages } = await request.json();
    
    // Process each session
    for (const [sessionId, session] of Object.entries(sessions as Record<string, MigrateSession>)) {
      try {
        // Check if session already exists
        const existingSession = await ChatDatabaseService.getSession(sessionId);
        
        if (!existingSession) {
          // Create new session
          await ChatDatabaseService.createSession(undefined, session.title);
        }
        
        // Add messages for this session
        const sessionMessages = (messages[sessionId] || []) as MigrateMessage[];
        for (const message of sessionMessages) {
          try {
            await ChatDatabaseService.addMessage(sessionId, {
              content: message.content,
              role: message.role,
              type: message.type,
              proposalGroup: message.proposalGroup,
              entryProposalGroup: message.entryProposalGroup,
              isTyping: message.isTyping,
            });
          } catch (error) {
            logger.error('[API] Failed to migrate message', { error, sessionId, messageId: message.id });
          }
        }
      } catch (error) {
        logger.error('[API] Failed to migrate session', { error, sessionId });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to migrate data', { error });
    return NextResponse.json(
      { error: 'Failed to migrate data' },
      { status: 500 }
    );
  }
}