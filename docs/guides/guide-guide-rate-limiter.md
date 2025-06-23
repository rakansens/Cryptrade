# Rate Limiter Configuration Guide

## Overview

The enhanced rate limiting system now includes persistent storage fallback to ensure rate limits are maintained across server restarts. The system attempts to use storage backends in the following order:

1. **Vercel KV** (if configured)
2. **Upstash Redis** (if configured)
3. **SQLite** (persistent fallback)
4. **Memory** (last resort, non-persistent)

## Configuration

### Environment Variables

```bash
# Optional: Custom SQLite database path
RATE_LIMIT_DB_PATH=./data/rate-limit.db

# Vercel KV (if available)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Upstash Redis (if available)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Default Configuration

```typescript
const defaultConfig: RateLimitConfig = {
  windowSec: 60,      // 1 minute window
  maxRequests: 60     // 60 requests per window
};
```

## Usage Examples

### Basic Usage

```typescript
import { checkRateLimit, getClientIdentifier } from '@/lib/api/rate-limit-persistent';

// In API route
export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request);
  
  const result = await checkRateLimit(identifier, {
    windowSec: 60,
    maxRequests: 10
  });
  
  if (!result.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(result.remainingRequests),
          'X-RateLimit-Reset': String(result.resetTime)
        }
      }
    );
  }
  
  // Process request...
}
```

### Custom Configuration

```typescript
// Different limits for different endpoints
const apiLimits = {
  chat: { windowSec: 60, maxRequests: 30 },
  analysis: { windowSec: 300, maxRequests: 10 },
  webhook: { windowSec: 3600, maxRequests: 100 }
};

// Usage
const result = await checkRateLimit(
  `${endpoint}:${identifier}`, 
  apiLimits[endpoint]
);
```

## Migration from Existing Implementation

### 1. Update Imports

```typescript
// Old
import { checkRateLimit } from '@/lib/api/rate-limit';

// New
import { checkRateLimit } from '@/lib/api/rate-limit-persistent';
```

### 2. No API Changes Required

The new implementation maintains the same API interface, so existing code will continue to work without modifications.

### 3. Optional: Add Cleanup Handler

For graceful shutdown:

```typescript
// In server shutdown handler
import { cleanupRateLimiter } from '@/lib/api/rate-limit-persistent';

process.on('SIGTERM', async () => {
  await cleanupRateLimiter();
  process.exit(0);
});
```

## Storage Backend Details

### SQLite Persistence

- **Location**: `./data/rate-limit.db` (configurable via `RATE_LIMIT_DB_PATH`)
- **Auto-cleanup**: Expired entries are cleaned up every minute
- **Performance**: Suitable for moderate traffic (thousands of requests per minute)
- **Persistence**: Survives server restarts

### Database Schema

```sql
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_time INTEGER NOT NULL
);

CREATE INDEX idx_reset_time ON rate_limits(reset_time);
```

## Performance Considerations

1. **Redis/KV Priority**: Always configure Redis or Vercel KV in production for best performance
2. **SQLite Fallback**: Suitable for small to medium deployments
3. **Memory Fallback**: Only for development or when persistence is not critical

## Monitoring

Check logs for storage backend usage:

```
[RateLimit] SQLite persistence initialized
[RateLimit] Cleaned up 42 expired entries
[RateLimit] Using memory fallback (not persistent across restarts)
```

## Troubleshooting

### SQLite Initialization Fails

1. Check write permissions for data directory
2. Ensure `better-sqlite3` is installed: `npm install better-sqlite3`
3. Check disk space availability

### Performance Issues

1. Monitor SQLite database size
2. Consider implementing Redis/KV for high-traffic scenarios
3. Adjust cleanup interval if needed

## Security Considerations

1. Client identification combines IP and User-Agent for better accuracy
2. Rate limits are enforced per unique identifier
3. Headers are properly sanitized to prevent bypassing

## Testing

```typescript
import { checkRateLimit, memoryStore } from '@/lib/api/rate-limit-persistent';

// Clear memory store for testing
beforeEach(() => {
  memoryStore.clear();
});

// Test rate limiting
test('enforces rate limits', async () => {
  const config = { windowSec: 60, maxRequests: 2 };
  
  const result1 = await checkRateLimit('test-key', config);
  expect(result1.success).toBe(true);
  expect(result1.remainingRequests).toBe(1);
  
  const result2 = await checkRateLimit('test-key', config);
  expect(result2.success).toBe(true);
  expect(result2.remainingRequests).toBe(0);
  
  const result3 = await checkRateLimit('test-key', config);
  expect(result3.success).toBe(false);
  expect(result3.retryAfter).toBeGreaterThan(0);
});
```