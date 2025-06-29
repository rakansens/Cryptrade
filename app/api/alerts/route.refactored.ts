import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/lib/services/alert.service';
import { z } from 'zod';
import { 
  createStandardApiHandler,
  commonSchemas,
  withAuth,
  withValidation,
  asyncHandler,
} from '@/lib/api/middleware';

// Price validation function
const isValidPrice = (value: unknown): boolean => {
  if (typeof value !== 'number') return false;
  if (!isFinite(value)) return false;
  if (value <= 0) return false;
  if (value > Number.MAX_SAFE_INTEGER) return false;
  if (value > Number.MAX_VALUE / 2) return false;
  return true;
};

// Request validation schema
const createAlertSchema = z.object({
  userId: z.string().optional(),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Symbol must contain only uppercase letters and numbers'),
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

// GET /api/alerts - Get user alerts
export const GET = createStandardApiHandler(
  async (req: NextRequest, context: any) => {
    const userId = context.session.user?.id;
    const alerts = await AlertService.getUserAlerts(userId);
    
    return NextResponse.json({ alerts });
  },
  {
    auth: true,
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
    },
  }
);

// POST /api/alerts - Create new alert
export const POST = createStandardApiHandler(
  async (req: NextRequest, context: any) => {
    const { body } = context.validatedData;
    const userId = context.session.user?.id;
    
    // Create alert with validated data
    const alert = await AlertService.createAlert({
      ...body,
      userId,
    });
    
    return NextResponse.json({ alert }, { status: 201 });
  },
  {
    auth: true,
    validation: {
      body: createAlertSchema,
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 30,
    },
  }
);

// Alternative implementation using composed middleware
export const GET_ALT = withAuth(
  asyncHandler(async (req: NextRequest, context: any) => {
    const userId = context.session.user?.id;
    const alerts = await AlertService.getUserAlerts(userId);
    
    return NextResponse.json({ alerts });
  })
);

export const POST_ALT = withAuth(
  withValidation(
    asyncHandler(async (req: NextRequest, context: any) => {
      const { body } = context.validatedData;
      const userId = context.session.user?.id;
      
      const alert = await AlertService.createAlert({
        ...body,
        userId,
      });
      
      return NextResponse.json({ alert }, { status: 201 });
    }),
    { body: createAlertSchema }
  )
);