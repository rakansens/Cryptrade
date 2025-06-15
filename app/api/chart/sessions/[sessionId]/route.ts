import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';


export async function DELETE(_request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;

    // Delete all drawings
    await prisma.chartDrawing.deleteMany({
      where: { sessionId },
    });

    // Delete all patterns
    await prisma.patternAnalysis.deleteMany({
      where: { sessionId },
    });

    // Clear timeframe state from session metadata
    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      await prisma.conversationSession.update({
        where: { id: sessionId },
        data: {
          metadata: {},
        },
      });
    }

    logger.info('[API] Cleared chart session data', { sessionId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to clear session', { error });
    
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}