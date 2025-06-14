import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';

interface Params {
  params: {
    sessionId: string;
  };
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;

    // Delete all drawings
    await prisma.chartDrawing.deleteMany({
      where: { sessionId },
    });

    // Delete all patterns
    await prisma.chartPattern.deleteMany({
      where: { sessionId },
    });

    // Clear timeframe state from session metadata
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      await prisma.chatSession.update({
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