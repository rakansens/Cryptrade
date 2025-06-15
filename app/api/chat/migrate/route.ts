import { NextRequest, NextResponse } from 'next/server';
import { ChatDatabaseService, type ChatMessage } from '@/lib/services/database/chat.service';
import { logger } from '@/lib/utils/logger';
import { DrawingProposalGroup, EntryProposalGroup, ProposalType } from '@/types/proposals';

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
  proposalGroup?: DrawingProposalGroup;
  entryProposalGroup?: EntryProposalGroup;
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
            const messageData: Omit<ChatMessage, 'id' | 'timestamp'> = {
              content: message.content,
              role: message.role,
              type: message.type || 'text',
            };
            
            if (message.proposalGroup) {
              // Convert DrawingProposalGroup to ProposalGroup format
              const drawingGroup = message.proposalGroup;
              messageData.proposalGroup = {
                id: drawingGroup.id,
                proposals: drawingGroup.proposals.map(p => ({
                  id: p.id,
                  type: 'buy' as const,
                  price: p.drawingData?.points?.[0]?.value || 0,
                  reason: p.reasoning || p.reason || '',
                  confidence: p.confidence,
                  timestamp: p.createdAt,
                  ...(p.metadata?.['stopLoss'] !== undefined && { stopLoss: p.metadata?.['stopLoss'] as number }),
                  ...(p.metadata?.['targetPrice'] !== undefined && { takeProfit: p.metadata?.['targetPrice'] as number }),
                })) as any,
                summary: drawingGroup.description,
                totalConfidence: drawingGroup.summary?.averageConfidence,
                timestamp: drawingGroup.createdAt,
              };
            }
            if (message.entryProposalGroup) {
              messageData.entryProposalGroup = {
                ...message.entryProposalGroup,
                entries: message.entryProposalGroup.proposals || [],
                timestamp: message.entryProposalGroup.createdAt || Date.now()
              } as any;
            }
            if (message.isTyping !== undefined) {
              messageData.isTyping = message.isTyping;
            }
            
            await ChatDatabaseService.addMessage(sessionId, messageData);
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