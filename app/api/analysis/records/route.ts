import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const recordId = await AnalysisService.saveAnalysis(data);
    
    return NextResponse.json({ recordId });
  } catch (error) {
    logger.error('[API] Failed to save analysis', { error });
    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}