import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol') || undefined;
    const dbRecords = await AnalysisService.getActiveAnalyses(symbol);
    const records = dbRecords.map(record => AnalysisAPI.convertToAnalysisRecord(record));
    
    return NextResponse.json({ records });
  } catch (error) {
    logger.error('[API] Failed to get active analyses', { error });
    return NextResponse.json(
      { error: 'Failed to get active analyses' },
      { status: 500 }
    );
  }
}