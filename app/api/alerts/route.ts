import { NextRequest } from 'next/server';
import { AlertService } from '@/lib/services/alert.service';
import { z } from 'zod';
import { createApiSuccessResponse, createApiErrorResponse, handleApiError, parseRequestBody } from '@/app/api/utils/responses';

// Request validation schema
const createAlertSchema = z.object({
  userId: z.string().optional(),
  symbol: z.string().min(1),
  conditions: z.object({
    priceAbove: z.number().optional(),
    priceBelow: z.number().optional(),
    volumeAbove: z.number().optional(),
    indicatorCrossover: z.object({
      indicator1: z.string(),
      indicator2: z.string(),
      direction: z.enum(['above', 'below']),
    }).optional(),
    patternDetected: z.string().optional(),
  }).refine(
    (conditions) => 
      conditions.priceAbove !== undefined ||
      conditions.priceBelow !== undefined ||
      conditions.volumeAbove !== undefined ||
      conditions.indicatorCrossover !== undefined ||
      conditions.patternDetected !== undefined,
    { message: 'At least one condition must be specified' }
  ),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return createApiErrorResponse('Missing user id', 400);
    }
    const alerts = await AlertService.getUserAlerts(userId);
    return createApiSuccessResponse({ alerts });
  } catch (error) {
    return handleApiError(error, 'Failed to get alerts');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseRequestBody(request, createAlertSchema);
    if (error) return error;
    
    const { symbol, conditions } = data;
    const userId = data.userId || request.headers.get('x-user-id');
    if (!userId) {
      return createApiErrorResponse('Missing user id', 400);
    }
    
    const alertConditions = {
      ...(conditions.priceAbove !== undefined && { priceAbove: conditions.priceAbove }),
      ...(conditions.priceBelow !== undefined && { priceBelow: conditions.priceBelow }),
      ...(conditions.volumeAbove !== undefined && { volumeAbove: conditions.volumeAbove }),
      ...(conditions.indicatorCrossover !== undefined && { indicatorCrossover: conditions.indicatorCrossover }),
      ...(conditions.patternDetected !== undefined && { patternDetected: conditions.patternDetected }),
    };
    
    const alert = await AlertService.createAlert({ userId, symbol, conditions: alertConditions });
    return createApiSuccessResponse({ alert });
  } catch (error) {
    return handleApiError(error, 'Failed to create alert');
  }
}
