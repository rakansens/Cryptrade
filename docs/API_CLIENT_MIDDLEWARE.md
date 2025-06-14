# API Client Middleware Architecture

The ApiClient has been refactored to use a pluggable middleware architecture, allowing you to compose custom request/response processing pipelines.

## Why Middleware?

ネットワーク横断関心事を **疎結合** で差し替え可能にするため。従来のAPIクライアントでは、タイムアウト・リトライ・レート制限などの機能が密結合していましたが、ミドルウェアアーキテクチャにより以下が実現できます：

- **関心の分離**: 各ミドルウェアが単一責任を持つ
- **テスタビリティ**: MockTransportで各機能を独立してテスト可能
- **拡張性**: 新しい機能をミドルウェアとして簡単追加
- **設定の柔軟性**: 環境変数で動作を制御可能

## Middleware Pipeline Sequence

```
Request Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Timeout   │ -> │ RateLimit   │ -> │   Retry     │ -> │ErrorHandler │ -> │    Fetch    │
│ (全体制限)  │    │ (頻度制御)  │    │(指数バックオフ)│    │(HTTP→例外) │    │ (実リクエスト)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

Response Flow (reverse order):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Fetch    │ <- │ErrorHandler │ <- │   Retry     │ <- │ RateLimit   │ <- │   Timeout   │
│ (HTTPレスポンス)│    │(例外変換)  │    │(リトライ判定)│    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Default Stack

| Order | Middleware | 責務 | 設定例 |
|-------|------------|------|--------|
| 1 | **Timeout** | 全体に締め切りを付与 | `duration: 10000` (10秒) |
| 2 | **RateLimit** | クライアント側の自律的レート制御 | `requests: 10, window: 1000` (10req/秒) |
| 3 | **Retry** | リトライ & exponential backoff | `maxAttempts: 3, delay: 1000` |
| 4 | **ErrorHandler** | HTTP≠2xx → 例外化 | - |
| 5 | **Fetch** | 実リクエスト | - |

## Overview

The middleware system provides:
- **Transport-agnostic design**: Easy to swap different middleware implementations
- **Composable pipeline**: Middleware can be combined in any order
- **Zero API changes**: Existing `client.get()`, `client.post()` calls work unchanged
- **Built-in middlewares**: Timeout, rate limiting, retry, error handling, auth, caching, circuit breaker

## Basic Usage

### Default Configuration

```typescript
import { createBinanceClient } from '@/lib/api/client';

// Uses default middleware stack: timeout → rateLimit → retry → errorHandler → fetch
const client = createBinanceClient();

const response = await client.get('/ticker', { symbol: 'BTCUSDT' });
```

### Custom Middleware Stack

```typescript
import { ApiClient } from '@/lib/api/client';
import { 
  createTimeoutMiddleware,
  createRetryMiddleware,
  createAuthMiddleware,
  createErrorHandlerMiddleware
} from '@/lib/api/middlewares';

const client = new ApiClient(
  {
    baseUrl: 'https://api.example.com',
    timeout: 10000,
    retries: 3,
    retryDelay: 1000,
    rateLimit: { requests: 10, window: 1000 }
  },
  [
    createTimeoutMiddleware({ duration: 5000 }),
    createAuthMiddleware({
      headerName: 'Authorization',
      tokenProvider: () => `Bearer ${getApiToken()}`
    }),
    createRetryMiddleware({
      maxAttempts: 3,
      delay: 500,
      exponentialBackoff: true
    }),
    createErrorHandlerMiddleware()
  ]
);
```

## Built-in Middleware

### Timeout Middleware

Aborts requests after a specified duration.

```typescript
import { createTimeoutMiddleware } from '@/lib/api/middlewares';

const timeoutMiddleware = createTimeoutMiddleware({
  duration: 5000 // 5 seconds
});
```

### Rate Limit Middleware

Enforces request frequency limits using token bucket algorithm.

```typescript
import { createRateLimitMiddleware, createAdvancedRateLimitMiddleware } from '@/lib/api/middlewares';

// Simple rate limiting
const rateLimitMiddleware = createRateLimitMiddleware({
  requests: 10,  // 10 requests
  window: 1000   // per 1 second
});

// Advanced rate limiting with per-host tracking
const advancedRateLimitMiddleware = createAdvancedRateLimitMiddleware({
  requests: 5,
  window: 1000
});
```

### Retry Middleware

Automatically retries failed requests with configurable conditions.

```typescript
import { 
  createRetryMiddleware, 
  createDefaultRetryMiddleware, 
  createRateLimitRetryMiddleware 
} from '@/lib/api/middlewares';

// Custom retry configuration
const retryMiddleware = createRetryMiddleware({
  maxAttempts: 3,
  delay: 1000,
  exponentialBackoff: true,
  retryCondition: (error, attempt) => {
    // Custom retry logic
    return error.status >= 500 || error.status === 429;
  }
});

// Sensible defaults (3 attempts, exponential backoff)
const defaultRetryMiddleware = createDefaultRetryMiddleware();

// Optimized for rate-limited APIs
const rateLimitRetryMiddleware = createRateLimitRetryMiddleware();
```

### Authentication Middleware

Adds authentication headers to requests.

```typescript
import { 
  createAuthMiddleware, 
  createBearerAuthMiddleware, 
  createApiKeyAuthMiddleware 
} from '@/lib/api/middlewares';

// Generic auth middleware
const authMiddleware = createAuthMiddleware({
  headerName: 'Authorization',
  tokenProvider: async () => {
    const token = await getTokenFromStorage();
    return `Bearer ${token}`;
  }
});

// Bearer token auth
const bearerAuthMiddleware = createBearerAuthMiddleware(
  () => getAccessToken()
);

// API key auth
const apiKeyAuthMiddleware = createApiKeyAuthMiddleware(
  () => process.env.API_KEY,
  'X-API-Key'
);
```

### Cache Middleware

Caches successful GET responses with configurable TTL.

```typescript
import { createCacheMiddleware, createDefaultCacheMiddleware } from '@/lib/api/middlewares';

// Custom cache configuration
const cacheMiddleware = createCacheMiddleware({
  ttl: 5 * 60 * 1000, // 5 minutes
  keyGenerator: (url, init) => `${init.method || 'GET'}:${url}`,
  storage: customCacheStorage // Optional custom storage
});

// Default cache (5 minutes TTL, in-memory storage)
const defaultCacheMiddleware = createDefaultCacheMiddleware(300000);
```

### Circuit Breaker Middleware

Implements circuit breaker pattern to prevent cascading failures.

```typescript
import { 
  createCircuitBreakerMiddleware, 
  createDefaultCircuitBreakerMiddleware 
} from '@/lib/api/middlewares';

const circuitBreakerMiddleware = createCircuitBreakerMiddleware({
  threshold: 5,        // Open after 5 failures
  timeout: 10000,      // 10 second request timeout
  resetTimeout: 60000  // Try again after 1 minute
});

// Default circuit breaker
const defaultCircuitBreakerMiddleware = createDefaultCircuitBreakerMiddleware();
```

### Error Handler Middleware

Converts HTTP error responses to ApiError objects for middleware chain.

```typescript
import { createErrorHandlerMiddleware } from '@/lib/api/middlewares';

const errorHandlerMiddleware = createErrorHandlerMiddleware();
```

## Creating Custom Middleware

Middleware follow a simple interface:

```typescript
import type { ApiMiddleware, RequestCtx } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export const createCustomMiddleware = (config: CustomConfig): ApiMiddleware =>
  async (ctx, next) => {
    // Pre-request processing
    logger.debug('Custom middleware: before request', { url: ctx.request.url });
    
    // Modify request if needed
    ctx.request.headers = {
      ...ctx.request.headers,
      'X-Custom-Header': 'custom-value'
    };

    try {
      // Call next middleware in chain
      const result = await next();
      
      // Post-response processing
      logger.debug('Custom middleware: after request', { 
        url: ctx.request.url,
        status: result.response?.status 
      });
      
      return result;
    } catch (error) {
      // Error handling
      logger.error('Custom middleware: request failed', { 
        url: ctx.request.url 
      }, error);
      
      throw error;
    }
  };
```

## Middleware Execution Order

Middleware execute in the order they're provided, with each middleware calling the next one in the chain:

```typescript
const client = new ApiClient(config, [
  middleware1,  // Executes first
  middleware2,  // Executes second
  middleware3,  // Executes third
  // ... fetch happens last
]);
```

Execution flow:
1. `middleware1` pre-processing
2. `middleware2` pre-processing  
3. `middleware3` pre-processing
4. HTTP fetch
5. `middleware3` post-processing
6. `middleware2` post-processing
7. `middleware1` post-processing

## Environment Configuration

You can configure transport behavior via environment variables:

```bash
# Disable console logs
DISABLE_CONSOLE_LOGS=true

# Set log level
LOG_LEVEL=warn

# Configure log transport
LOG_TRANSPORT=console    # Default
LOG_TRANSPORT=noop       # Disable logging
LOG_TRANSPORT=sentry     # Use Sentry transport
LOG_TRANSPORT=multi      # Multiple transports

# Enable Sentry (when using multi transport)
ENABLE_SENTRY=true
```

## Examples

### Basic API Client with Auth

```typescript
import { ApiClient } from '@/lib/api/client';
import { createBearerAuthMiddleware } from '@/lib/api/middlewares';

const client = new ApiClient(
  {
    baseUrl: 'https://api.example.com',
    timeout: 10000,
    retries: 3,
    retryDelay: 1000,
    rateLimit: { requests: 10, window: 1000 }
  },
  [
    createBearerAuthMiddleware(() => localStorage.getItem('token'))
  ]
);

const user = await client.get('/user');
```

### High-Performance API Client

```typescript
import { 
  createRateLimitMiddleware,
  createCacheMiddleware,
  createCircuitBreakerMiddleware,
  createErrorHandlerMiddleware
} from '@/lib/api/middlewares';

const client = new ApiClient(config, [
  createCircuitBreakerMiddleware({ threshold: 3, timeout: 5000, resetTimeout: 30000 }),
  createRateLimitMiddleware({ requests: 100, window: 1000 }),
  createCacheMiddleware({ ttl: 60000 }), // 1 minute cache
  createErrorHandlerMiddleware()
]);
```

### Testing with Mock Middleware

```typescript
import type { ApiMiddleware } from '@/types/api';

const mockMiddleware: ApiMiddleware = async (ctx, next) => {
  if (ctx.request.url.includes('/mock')) {
    return {
      ...ctx,
      response: new Response(JSON.stringify({ mocked: true }), {
        status: 200,
        statusText: 'OK'
      })
    };
  }
  return next();
};

const testClient = new ApiClient(config, [mockMiddleware]);
```

## Environment Configuration

ミドルウェアの動作を環境変数で制御できます：

```bash
# ログ制御
DISABLE_CONSOLE_LOGS=true     # コンソールログ無効化
LOG_LEVEL=warn                # ログレベル設定
LOG_TRANSPORT=console         # デフォルト
LOG_TRANSPORT=noop            # ログ無効化
LOG_TRANSPORT=sentry          # Sentry送信
LOG_TRANSPORT=multi           # 複数transport

# Sentry有効化（multiで使用）
ENABLE_SENTRY=true

# 将来拡張（例）
API_MW_DISABLE_RETRY=1        # リトライ無効化
API_MW_ORDER="timeout,auth,rateLimit,retry,errorHandler"  # 順序指定
```

## Testing Strategy

### 1. MSW でHTTPレイヤーMock

```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  // 正常レスポンス
  http.get('/api/success', () => {
    return HttpResponse.json({ success: true });
  }),
  
  // エラーレスポンス（リトライテスト用）
  http.get('/api/retry', () => {
    return HttpResponse.json({ error: 'Server error' }, { status: 500 });
  }),
  
  // レート制限テスト用
  http.get('/api/rate-limit', () => {
    return HttpResponse.json({ error: 'Rate limited' }, { status: 429 });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 2. MockTransport でミドルウェア単体テスト

```ts
const mockTransport: ApiMiddleware = async (ctx) => {
  // リクエストをログに記録
  console.log('Mock request:', ctx.request.url);
  
  return {
    ...ctx,
    response: new Response(JSON.stringify({ mocked: true }), {
      status: 200,
      statusText: 'OK'
    })
  };
};

// 特定ミドルウェアのテスト
const client = new ApiClient(config, [
  createRetryMiddleware({ maxAttempts: 3, delay: 100, exponentialBackoff: false }),
  mockTransport  // 実際のfetch呼び出しをモック
]);
```

### 3. 統合テスト例

```ts
describe('Middleware Integration', () => {
  it('should handle retry with exponential backoff', async () => {
    let requestTimes: number[] = [];
    
    server.use(
      http.get('/api/backoff-test', () => {
        requestTimes.push(Date.now());
        if (requestTimes.length <= 2) {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const client = new ApiClient(config, [
      createRetryMiddleware({
        maxAttempts: 3,
        delay: 100,
        exponentialBackoff: true
      }),
      createErrorHandlerMiddleware()
    ]);

    await client.get('/api/backoff-test');
    
    // 指数バックオフの検証
    const delay1 = requestTimes[1] - requestTimes[0];
    const delay2 = requestTimes[2] - requestTimes[1];
    expect(delay2).toBeGreaterThan(delay1);
  });
});
```

## Migration Guide

### From Legacy ApiClient

The new middleware-based ApiClient maintains 100% API compatibility:

```typescript
// Before - still works
const client = createBinanceClient();
const response = await client.get('/ticker', { symbol: 'BTCUSDT' });

// After - same API, enhanced with middleware
const client = createBinanceClient(); // Now uses middleware internally
const response = await client.get('/ticker', { symbol: 'BTCUSDT' });
```

### Adding Custom Behavior

Instead of modifying the ApiClient class, add middleware:

```typescript
// Before - had to modify client internals
class CustomApiClient extends ApiClient {
  // Custom logic mixed with client logic
}

// After - compose middleware
const client = new ApiClient(config, [
  createCustomMiddleware(customConfig),
  // ... other middleware
]);
```

## Testing

The middleware architecture makes testing much easier:

```typescript
import { ApiClient } from '@/lib/api/client';
import { createErrorHandlerMiddleware } from '@/lib/api/middlewares';

describe('Custom Middleware', () => {
  it('should handle errors correctly', async () => {
    const mockTransport: ApiMiddleware = async (ctx) => {
      return {
        ...ctx,
        response: new Response('', { status: 500 })
      };
    };

    const client = new ApiClient(config, [
      createErrorHandlerMiddleware(),
      mockTransport
    ]);

    await expect(client.get('/test')).rejects.toMatchObject({
      status: 500
    });
  });
});
```

For comprehensive testing examples, see `lib/api/__tests__/middleware.test.ts`.