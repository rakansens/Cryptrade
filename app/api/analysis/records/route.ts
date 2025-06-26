import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { createApiSuccessResponse, createApiErrorResponse } from '@/app/api/utils/responses';
import { getServerSession } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized - Please login', 401);
    }

    const data = await request.json();
    const recordId = await AnalysisService.saveAnalysis(data);
    
    return createApiSuccessResponse({ recordId });
  } catch (error) {
    return createApiErrorResponse(error instanceof Error ? error.message : 'Failed to save analysis', 500);
  }
}