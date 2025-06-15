import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { logger } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await context.params;
    const body = await request.json();
    const { price, result, strength, volume } = body;
    
    // Validate required fields
    if (!price || !result || strength === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: price, result, strength' },
        { status: 400 }
      );
    }
    
    await AnalysisService.recordTouchEvent({
      recordId,
      price,
      result,
      strength,
      volume
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