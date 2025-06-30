import { NextRequest } from 'next/server';
import { AlertService } from '@/lib/services/alert.service';
import { z } from 'zod';
import { createApiSuccessResponse, createApiErrorResponse, handleApiError, parseRequestBody } from '@/app/api/utils/responses';
import { getServerSession } from '@/lib/auth/server';

// 価格検証の関数
const isValidPrice = (value: unknown): boolean => {
  if (typeof value !== 'number') return false;
  if (!isFinite(value)) return false;
  if (value <= 0) return false;
  if (value > Number.MAX_SAFE_INTEGER) return false;
  // '1e308'のような文字列が数値に変換された場合の検証
  if (value > Number.MAX_VALUE / 2) return false; // MAX_VALUEの半分以下に制限
  return true;
};

// Security validation helper
const containsSecurityThreat = (input: string): boolean => {
  const threats = [
    /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i,
    /'.*or.*'/i, /'.*union.*'/i, /'.*drop.*'/i, /'.*exec.*'/i,
    /\$ne/, /\$gt/, /\$lt/, /\$regex/, /\$where/,
    /\.\./, // Path traversal
    /%00/, /%2e%2e/, /%252e/, // Encoded threats
    /&[a-z]+;/i, // XML entities
    /.{1000,}/, // Extremely long input
    /[\u0080-\uFFFF]/, // Unicode exploitation
    /a{100,}/, // ReDoS pattern
  ];
  
  return threats.some(threat => threat.test(input));
};

// Request validation schema
const createAlertSchema = z.object({
  userId: z.string().optional(),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Symbol must contain only uppercase letters and numbers')
    .refine(val => !containsSecurityThreat(val), {
      message: 'Invalid symbol format - contains prohibited characters'
    }),
  conditions: z.object({
    priceAbove: z.number().refine(isValidPrice, {
      message: 'Price must be a positive finite number within safe range',
    }).optional(),
    priceBelow: z.number().refine(isValidPrice, {
      message: 'Price must be a positive finite number within safe range',
    }).optional(),
    volumeAbove: z.number().positive().optional(),
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

    // リクエストボディを取得
    const body = await request.json();
    
    // Additional security checks for the entire body
    const bodyStr = JSON.stringify(body);
    if (containsSecurityThreat(bodyStr)) {
      return createApiErrorResponse('Invalid input - security violation detected', 400);
    }
    
    // 価格値が文字列の場合の事前検証
    if (body.conditions) {
      if (body.conditions.priceAbove && typeof body.conditions.priceAbove === 'string') {
        const parsed = Number(body.conditions.priceAbove);
        if (!isValidPrice(parsed)) {
          return createApiErrorResponse('Invalid price value', 400);
        }
        body.conditions.priceAbove = parsed;
      }
      if (body.conditions.priceBelow && typeof body.conditions.priceBelow === 'string') {
        const parsed = Number(body.conditions.priceBelow);
        if (!isValidPrice(parsed)) {
          return createApiErrorResponse('Invalid price value', 400);
        }
        body.conditions.priceBelow = parsed;
      }
    }

    // 検証済みのボディでスキーマ検証
    const result = createAlertSchema.safeParse(body);
    if (!result.success) {
      return createApiErrorResponse('Invalid input', 400);
    }
    
    const { symbol, conditions } = result.data;
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
