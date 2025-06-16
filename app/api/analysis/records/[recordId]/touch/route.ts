import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

// Request validation schema
const touchEventSchema = z.object({
  price: z.number().positive(),
  result: z.enum(['bounce', 'break', 'test']),
  strength: z.number().min(0).max(100),
  volume: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await context.params;
    const body = await request.json();
    
    // Validate request body
    const validationResult = touchEventSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.flatten() 
        },
        { status: 400 }
      );
    }
    
    const { price, result, strength, volume } = validationResult.data;
    
    await AnalysisService.recordTouchEvent({
      recordId,
      price,
      result,
      strength,
      ...(volume !== undefined && { volume })
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to record touch event', { error });
    return NextResponse.json(
      { error: 'Failed to record touch event' },
      { status: 500 }
    );
  }
}