import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { PatternDataSchema } from '@/lib/validation/chart-drawing.schema';
import { z } from 'zod';

interface Params {
  params: {
    sessionId: string;
  };
}

const savePatternsSchema = z.object({
  patterns: z.array(PatternDataSchema),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;

    const patterns = await prisma.patternAnalysis.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('[API] Retrieved chart patterns', { 
      sessionId,
      count: patterns.length,
    });

    return NextResponse.json({ 
      patterns: patterns.map(p => ({
        id: p.id,
        sessionId: p.sessionId,
        type: p.type,
        symbol: p.symbol,
        interval: p.interval,
        confidence: p.confidence.toString(),
        startTime: p.startTime.toString(),
        endTime: p.endTime.toString(),
        visualization: p.visualization,
        metrics: p.metrics,
        description: p.description,
        tradingImplication: p.tradingImplication,
        timestamp: p.createdAt.toISOString(),
      }))
    });
  } catch (error) {
    logger.error('[API] Failed to get chart patterns', { error });
    
    return NextResponse.json(
      { error: 'Failed to get patterns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const data = savePatternsSchema.parse(body);

    // Delete existing patterns for this session
    await prisma.patternAnalysis.deleteMany({
      where: { sessionId },
    });

    // Create new patterns
    if (data.patterns.length > 0) {
      await prisma.patternAnalysis.createMany({
        data: data.patterns.map(pattern => ({
          id: pattern.id,
          sessionId,
          type: pattern.type,
          symbol: pattern.symbol,
          interval: pattern.interval,
          confidence: pattern.confidence,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          visualization: pattern.visualization,
          metrics: pattern.metrics,
          description: pattern.description,
          tradingImplication: pattern.tradingImplication,
        })),
      });
    }

    logger.info('[API] Saved chart patterns', { 
      sessionId,
      count: data.patterns.length,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to save chart patterns', { error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save patterns' },
      { status: 500 }
    );
  }
}