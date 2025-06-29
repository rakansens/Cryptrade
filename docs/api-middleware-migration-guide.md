# API Middleware Migration Guide

## Overview

This guide explains how to migrate existing API routes to use the new unified middleware system, which eliminates code duplication and provides consistent error handling, authentication, and validation.

## Benefits

- **Code reduction**: ~40% less code per route
- **Consistency**: Unified error responses and logging
- **Security**: Built-in authentication and rate limiting
- **Maintainability**: Single source of truth for common patterns
- **Type safety**: Full TypeScript support with context typing

## Migration Steps

### 1. Basic Migration (Minimal Changes)

Replace the existing try-catch and authentication checks with `createStandardApiHandler`:

```typescript
// Before
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized', 401);
    }
    
    const data = await someService.getData();
    return createApiSuccessResponse({ data });
  } catch (error) {
    return handleApiError(error, 'Failed to get data');
  }
}

// After
export const GET = createStandardApiHandler(
  async (req, context) => {
    const data = await someService.getData();
    return NextResponse.json({ data });
  },
  { auth: true }
);
```

### 2. Adding Validation

Use the validation middleware for request body, query, and params:

```typescript
// Define schemas
const querySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

const bodySchema = z.object({
  name: z.string().min(1),
  value: z.number().positive(),
});

// Use in handler
export const POST = createStandardApiHandler(
  async (req, context) => {
    const { body, query } = context.validatedData;
    // body and query are fully typed!
    
    const result = await service.create(body);
    return NextResponse.json({ result }, { status: 201 });
  },
  {
    auth: true,
    validation: {
      body: bodySchema,
      query: querySchema,
    },
  }
);
```

### 3. Rate Limiting

Add rate limiting to prevent abuse:

```typescript
export const POST = createStandardApiHandler(
  async (req, context) => {
    // Handler logic
  },
  {
    auth: true,
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 10, // 10 requests per minute
    },
  }
);
```

### 4. Custom Middleware Composition

For more control, compose middleware manually:

```typescript
import { withAuth, withValidation, asyncHandler } from '@/lib/api/middleware';

export const POST = withAuth(
  withValidation(
    asyncHandler(async (req, context) => {
      // Handler logic
    }),
    { body: schema }
  ),
  { requireAdmin: true }
);
```

## Common Patterns

### Pagination

```typescript
import { commonSchemas, paginatedResponse } from '@/lib/api/middleware';

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const GET = createStandardApiHandler(
  async (req, context) => {
    const { page, limit } = context.validatedData.query;
    
    const { items, total } = await service.getItems({ page, limit });
    
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
    validation: {
      query: commonSchemas.pagination,
    },
  }
);
```

### Optional Authentication

```typescript
export const GET = createStandardApiHandler(
  async (req, context) => {
    const userId = context.session?.user?.id; // May be undefined
    const data = await service.getData({ userId });
    return NextResponse.json({ data });
  },
  {
    auth: false, // No auth required
  }
);
```

### Admin-only Routes

```typescript
export const DELETE = createStandardApiHandler(
  async (req, context) => {
    await service.deleteItem(context.params.id);
    return NextResponse.json({ success: true });
  },
  {
    auth: { requireAdmin: true },
    validation: {
      params: commonSchemas.idParam,
    },
  }
);
```

## Error Handling

Errors are automatically handled and formatted:

```typescript
// Throw AppError for custom errors
import { AppError } from '@/lib/errors/app-error';

export const POST = createStandardApiHandler(
  async (req, context) => {
    const resource = await service.find(context.body.id);
    
    if (!resource) {
      throw AppError.notFound('Resource');
    }
    
    if (resource.userId !== context.session.user.id) {
      throw AppError.forbidden('You do not own this resource');
    }
    
    // Regular errors are caught and logged
    const result = await service.riskyOperation(); // May throw
    
    return NextResponse.json({ result });
  },
  { auth: true }
);
```

## Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [...],
    "timestamp": "2025-06-29T12:00:00Z",
    "path": "/api/alerts"
  }
}
```

## Testing

Test your migrated routes:

```typescript
// Using the test client
const response = await fetch('/api/alerts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ invalid: 'data' }),
});

expect(response.status).toBe(400);
expect(await response.json()).toMatchObject({
  error: {
    code: 'VALIDATION_ERROR',
  },
});
```

## Migration Checklist

- [ ] Remove try-catch blocks
- [ ] Remove manual session checks
- [ ] Remove manual request parsing
- [ ] Add validation schemas
- [ ] Configure middleware options
- [ ] Update error throws to use AppError
- [ ] Test error cases
- [ ] Test rate limiting
- [ ] Update API documentation

## Gradual Migration

You don't need to migrate all routes at once. The old and new patterns can coexist:

1. Start with high-traffic routes
2. Migrate routes with the most duplication
3. New routes should use the new pattern
4. Migrate remaining routes over time

## Performance Considerations

- Rate limiting uses in-memory storage (consider Redis for production)
- Validation is async and supports streaming
- Middleware is composable with minimal overhead
- Error logging is automatic but can be customized

## Next Steps

1. Review the [API Middleware Reference](./api-middleware-reference.md)
2. Check example migrations in `app/api/*/route.refactored.ts`
3. Start with a simple route to get familiar
4. Ask for help if you encounter issues