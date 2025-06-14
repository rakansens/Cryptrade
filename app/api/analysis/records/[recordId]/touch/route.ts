import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { logger } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const touchEvent = await request.json();
    await AnalysisService.recordTouchEvent(params.recordId, touchEvent);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[API] Failed to record touch event', { error });
    return NextResponse.json(
      { error: 'Failed to record touch event' },
      { status: 500 }
    );
  }
}