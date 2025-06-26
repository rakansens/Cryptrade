import { NextRequest } from 'next/server';
import { AlertService } from '@/lib/services/alert.service';
import { z } from 'zod';
import { createApiSuccessResponse, createApiErrorResponse, handleApiError, parseRequestBody } from '@/app/api/utils/responses';
import { getServerSession } from '@/lib/auth/server';

// Request validation schema
const createAlertSchema = z.object({
  userId: z.string().optional(),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Symbol must contain only uppercase letters and numbers'),
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

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized - Please login', 401);
    }

    const userId = session.user?.id;
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
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized - Please login', 401);
    }

    const { data, error } = await parseRequestBody(request, createAlertSchema);
    if (error) return error;
    
    const { symbol, conditions } = data;
    const userId = session.user?.id;
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
