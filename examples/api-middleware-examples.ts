/**
 * API Middleware Examples
 * 
 * This file demonstrates how to use the new API middleware system
 * to reduce code duplication and improve consistency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createStandardApiHandler,
  withAuth,
  withValidation,
  withRateLimit,
  asyncHandler,
  commonSchemas,
  composeSchemas,
  AppError,
} from '@/lib/api/middleware';

// ============================================
// Example 1: Simple authenticated GET endpoint
// ============================================

// Before (with duplication):
export async function GET_OLD() {
  try {
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized', 401);
    }
    
    const data = await service.getData(session.user.id);
    return createApiSuccessResponse({ data });
  } catch (error) {
    return handleApiError(error, 'Failed to get data');
  }
}

// After (with middleware):
export const GET_NEW = createStandardApiHandler(
  async (req, context) => {
    const data = await service.getData(context.session.user.id);
    return NextResponse.json({ data });
  },
  { auth: true }
);

// ============================================
// Example 2: POST with validation
// ============================================

const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
});

// Before:
export async function POST_OLD(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized', 401);
    }
    
    const body = await request.json();
    const validation = createItemSchema.safeParse(body);
    
    if (!validation.success) {
      return createApiErrorResponse(
        'Validation failed',
        400,
        validation.error.errors
      );
    }
    
    const item = await service.createItem({
      ...validation.data,
      userId: session.user.id,
    });
    
    return createApiSuccessResponse({ item }, 201);
  } catch (error) {
    return handleApiError(error, 'Failed to create item');
  }
}

// After:
export const POST_NEW = createStandardApiHandler(
  async (req, context) => {
    const item = await service.createItem({
      ...context.validatedData.body,
      userId: context.session.user.id,
    });
    
    return NextResponse.json({ item }, { status: 201 });
  },
  {
    auth: true,
    validation: {
      body: createItemSchema,
    },
  }
);

// ============================================
// Example 3: Paginated list with filters
// ============================================

const listQuerySchema = composeSchemas(
  commonSchemas.pagination,
  commonSchemas.dateRange,
  commonSchemas.sort,
  z.object({
    status: z.enum(['active', 'inactive', 'all']).default('all'),
    category: z.string().optional(),
  })
);

export const GET_LIST = createStandardApiHandler(
  async (req, context) => {
    const { page, limit, sortBy, sortOrder, status, category, startDate, endDate } = 
      context.validatedData.query;
    
    const { items, total } = await service.listItems({
      userId: context.session.user.id,
      page,
      limit,
      sortBy,
      sortOrder,
      filters: { status, category, startDate, endDate },
    });
    
    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
  {
    auth: true,
    validation: {
      query: listQuerySchema,
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
    },
  }
);

// ============================================
// Example 4: Admin-only endpoint
// ============================================

export const DELETE_ADMIN = createStandardApiHandler(
  async (req, context) => {
    const { id } = context.validatedData.params;
    
    await service.deleteItem(id);
    
    return NextResponse.json({ success: true });
  },
  {
    auth: { requireAdmin: true },
    validation: {
      params: commonSchemas.idParam,
    },
  }
);

// ============================================
// Example 5: Public endpoint with optional auth
// ============================================

export const GET_PUBLIC = createStandardApiHandler(
  async (req, context) => {
    // Session might be null
    const userId = context.session?.user?.id;
    
    const data = await service.getPublicData({
      includePrivate: !!userId,
      userId,
    });
    
    return NextResponse.json({ data });
  },
  {
    auth: false, // No authentication required
    rateLimit: {
      windowMs: 60000,
      maxRequests: 50,
    },
  }
);

// ============================================
// Example 6: Custom error handling
// ============================================

export const POST_TRANSFER = createStandardApiHandler(
  async (req, context) => {
    const { fromAccountId, toAccountId, amount } = context.validatedData.body;
    
    // Check account ownership
    const fromAccount = await service.getAccount(fromAccountId);
    if (!fromAccount) {
      throw AppError.notFound('Source account');
    }
    
    if (fromAccount.userId !== context.session.user.id) {
      throw AppError.forbidden('You do not own this account');
    }
    
    // Check balance
    if (fromAccount.balance < amount) {
      throw new AppError(
        'Insufficient balance',
        'INSUFFICIENT_BALANCE',
        400,
        { 
          required: amount,
          available: fromAccount.balance,
        }
      );
    }
    
    // Perform transfer
    const result = await service.transfer({
      fromAccountId,
      toAccountId,
      amount,
    });
    
    return NextResponse.json({ result });
  },
  {
    auth: true,
    validation: {
      body: z.object({
        fromAccountId: z.string().uuid(),
        toAccountId: z.string().uuid(),
        amount: z.number().positive(),
      }),
    },
  }
);

// ============================================
// Example 7: Composed middleware (manual)
// ============================================

// For more control, compose middleware manually
export const MANUAL_COMPOSE = withAuth(
  withRateLimit(
    withValidation(
      asyncHandler(async (req, context) => {
        // Your handler logic
        return NextResponse.json({ success: true });
      }),
      {
        body: z.object({ data: z.string() }),
      }
    ),
    {
      windowMs: 60000,
      maxRequests: 10,
    }
  ),
  {
    requireAdmin: true,
  }
);

// ============================================
// Example 8: File upload with validation
// ============================================

export const POST_UPLOAD = createStandardApiHandler(
  async (req, context) => {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw AppError.validation('File is required');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      throw AppError.validation('File too large', {
        maxSize: '10MB',
        actualSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      });
    }
    
    const result = await service.uploadFile(file, context.session.user.id);
    
    return NextResponse.json({ result });
  },
  {
    auth: true,
    rateLimit: {
      windowMs: 300000, // 5 minutes
      maxRequests: 10,
    },
  }
);

// ============================================
// Example 9: Webhook endpoint with API key
// ============================================

export const POST_WEBHOOK = createStandardApiHandler(
  async (req, context) => {
    const { event, data } = context.validatedData.body;
    
    await service.processWebhook(event, data);
    
    return NextResponse.json({ received: true });
  },
  {
    auth: { allowApiKey: true },
    validation: {
      body: z.object({
        event: z.string(),
        data: z.record(z.unknown()),
      }),
    },
  }
);

// ============================================
// Example 10: Complex validation with refinements
// ============================================

const complexSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  participants: z.array(z.string().email()).min(1).max(10),
  options: z.object({
    sendNotifications: z.boolean().default(true),
    requireApproval: z.boolean().default(false),
  }),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export const POST_COMPLEX = createStandardApiHandler(
  async (req, context) => {
    const data = context.validatedData.body;
    
    const result = await service.createEvent({
      ...data,
      createdBy: context.session.user.id,
    });
    
    return NextResponse.json({ result }, { status: 201 });
  },
  {
    auth: true,
    validation: {
      body: complexSchema,
    },
  }
);