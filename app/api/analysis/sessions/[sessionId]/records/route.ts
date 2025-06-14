import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const dbRecords = await AnalysisService.getSessionAnalyses(params.sessionId);
    const records = dbRecords.map(record => AnalysisAPI.convertToAnalysisRecord(record));
    
    return NextResponse.json({ records });
  } catch (error) {
    logger.error('[API] Failed to get session analyses', { error });
    return NextResponse.json(
      { error: 'Failed to get session analyses' },
      { status: 500 }
    );
  }
}