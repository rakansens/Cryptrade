import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { createApiSuccessResponse, handleApiError } from '@/app/api/utils/responses';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const recordId = await AnalysisService.saveAnalysis(data);
    
    return createApiSuccessResponse({ recordId });
  } catch (error) {
    return handleApiError(error, 'Failed to save analysis');
  }
}