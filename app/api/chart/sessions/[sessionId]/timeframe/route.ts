import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface Params {
  params: {
    sessionId: string;
  };
}

const timeframeStateSchema = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  timestamp: z.number(),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;

    // Get the session to retrieve timeframe state from metadata
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { metadata: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const metadata = session.metadata as { timeframeState?: z.infer<typeof timeframeStateSchema> } | null;
    const timeframeState = metadata?.timeframeState;
    
    if (!timeframeState) {
      return NextResponse.json(
        { error: 'No timeframe state found' },
        { status: 404 }
      );
    }

    logger.info('[API] Retrieved timeframe state', { sessionId });

    return NextResponse.json({ state: timeframeState });
  } catch (error) {
    logger.error('[API] Failed to get timeframe state', { error });
    
    return NextResponse.json(
      { error: 'Failed to get timeframe state' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const state = timeframeStateSchema.parse(body);

    // Update session metadata with timeframe state
    await prisma.chatSession.upsert({
      where: { id: sessionId },
      update: {
        metadata: {
          timeframeState: state,
        },
        lastActiveAt: new Date(),
      },
      create: {
        id: sessionId,
        summary: 'Chart session',
        metadata: {
          timeframeState: state,
        },
        lastActiveAt: new Date(),
      },
    });

    logger.info('[API] Saved timeframe state', { 
      sessionId,
      state,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to save timeframe state', { error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save timeframe state' },
      { status: 500 }
    );
  }
}