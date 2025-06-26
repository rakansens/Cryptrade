import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { ChartDrawingSchema } from '@/lib/validation/chart-drawing.schema';
import { z } from 'zod';
import { prepareChartDrawingData } from '@/lib/utils/db-conversions';
import { getServerSession } from '@/lib/auth/server';


const saveDrawingsSchema = z.object({
  drawings: z.array(ChartDrawingSchema),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;
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
        data: {
          points: d.points,
          style: d.style,
          price: d.price?.toNumber(),
          time: d.time?.toString(),
          levels: d.levels,
          metadata: d.metadata,
        },
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
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;
    const body = await request.json();
    const data = saveDrawingsSchema.parse(body);

    // Delete existing drawings for this session
    await prisma.chartDrawing.deleteMany({
      where: { sessionId },
    });

    // Create new drawings
    if (data.drawings.length > 0) {
      const drawingsToCreate = data.drawings.map(drawing => 
        prepareChartDrawingData({
          ...drawing,
          sessionId,
        })
      );
      
      await prisma.chartDrawing.createMany({
        data: drawingsToCreate,
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