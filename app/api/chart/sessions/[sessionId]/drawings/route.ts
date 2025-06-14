import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { ChartDrawingSchema } from '@/lib/validation/chart-drawing.schema';
import { z } from 'zod';

interface Params {
  params: {
    sessionId: string;
  };
}

const saveDrawingsSchema = z.object({
  drawings: z.array(ChartDrawingSchema),
});

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  try {
    const drawings = await prisma.chartDrawing.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('[API] Retrieved chart drawings', { 
      sessionId,
      count: drawings.length,
    });

    return NextResponse.json({ 
      drawings: drawings.map(d => ({
        id: d.id,
        sessionId: d.sessionId,
        type: d.type,
        data: d.data,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))
    });
  } catch (error) {
    logger.error('[API] Failed to get chart drawings', { error });
    
    return NextResponse.json(
      { error: 'Failed to get drawings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  try {
    const body = await request.json();
    const data = saveDrawingsSchema.parse(body);

    // Delete existing drawings for this session
    await prisma.chartDrawing.deleteMany({
      where: { sessionId },
    });

    // Create new drawings
    if (data.drawings.length > 0) {
      await prisma.chartDrawing.createMany({
        data: data.drawings.map(drawing => ({
          id: drawing.id,
          sessionId,
          type: drawing.type,
          data: drawing.data,
        })),
      });
    }

    logger.info('[API] Saved chart drawings', { 
      sessionId,
      count: data.drawings.length,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to save chart drawings', { error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save drawings' },
      { status: 500 }
    );
  }
}