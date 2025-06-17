# API Structure Documentation

## API Route Organization

### Directory Structure
```
app/api/
├── ai/                    # AI/ML endpoints
│   ├── chat/             # AI chat interactions
│   ├── stream/           # Server-sent events streaming
│   └── analysis-stream/  # Streaming analysis
├── analysis/             # Trading analysis endpoints
│   ├── records/          # Analysis records management
│   ├── sessions/         # Analysis sessions
│   └── active/           # Active analysis status
├── auth/                 # Authentication endpoints
│   └── me/              # Current user info
├── binance/             # Binance integration
│   ├── klines/          # K-line/candlestick data
│   └── ticker/          # Price ticker data
├── chart/               # Chart management
│   └── sessions/        # Chart session data
├── chat/                # Chat functionality
│   ├── sessions/        # Chat sessions
│   └── migrate/         # Migration utilities
├── memory/              # Conversation memory
│   ├── messages/        # Message storage
│   ├── search/          # Search functionality
│   └── sessions/        # Memory sessions
├── monitoring/          # System monitoring
│   ├── circuit-breaker/ # Circuit breaker status
│   └── telemetry/       # Performance metrics
├── logs/                # Logging endpoints
│   ├── stream/          # Log streaming
│   └── stats/           # Log statistics
├── health/              # Health checks
│   └── db/              # Database health
├── utils/               # Shared utilities
│   └── responses.ts     # Response helpers
└── types.ts             # API type definitions
```

### Shared API Utilities (lib/api/)
```
lib/api/
├── middleware.ts         # Rate limiting, CORS, auth middleware
├── create-api-handler.ts # Factory for standardized handlers
├── create-sse-handler.ts # SSE streaming handler factory
├── auth-handler.ts       # Authentication wrapper
├── streaming.ts          # Streaming utilities
├── client.ts            # API client
├── middlewares/         # Middleware components
│   ├── auth.ts          # Authentication middleware
│   ├── rateLimit.ts     # Rate limiting
│   ├── cache.ts         # Response caching
│   ├── circuitBreaker.ts # Circuit breaker pattern
│   ├── errorHandler.ts  # Error handling
│   ├── retry.ts         # Retry logic
│   └── timeout.ts       # Request timeout
└── helpers/             # Helper utilities
    ├── error-handler.ts # Error response builder
    ├── response-builder.ts # Success response builder
    └── request-validator.ts # Request validation
```

## Authentication Requirements per Route

### Public Routes (No Authentication Required)
- `/api/health/*` - System health checks
- `/api/binance/ticker` - Public price data

### Protected Routes (Authentication Required)
- `/api/auth/me` - User profile (Bearer token)
- `/api/chat/*` - Chat functionality (session-based)
- `/api/analysis/*` - Analysis features (session-based)
- `/api/memory/*` - Conversation memory (session-based)
- `/api/chart/*` - Chart management (session-based)
- `/api/logs/*` - System logs (admin only)
- `/api/monitoring/*` - System monitoring (admin only)

### Authentication Methods
1. **Supabase Auth** - Primary authentication using JWT tokens
2. **Session IDs** - Via `x-session-id` header for stateful operations
3. **API Keys** - Via `Authorization: Bearer <key>` for service-to-service

## Request/Response Patterns

### Standard Response Format
```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-17T12:00:00Z"
}

// Error Response
{
  "error": "Error message",
  "message": "User-friendly message",
  "details": { ... },
  "timestamp": "2024-01-17T12:00:00Z"
}
```

### Request Validation
- Uses Zod schemas for runtime validation
- Automatic error formatting for validation failures
- Type-safe request/response handling

### Streaming Patterns
1. **Server-Sent Events (SSE)**
   - Used for: AI responses, real-time analysis
   - Format: `data: {"type": "chunk", "text": "..."}\n\n`
   - Heartbeat: Every 30 seconds

2. **WebSocket-like Streaming**
   - Via SSE for unidirectional streaming
   - Supports reconnection and error recovery

## Error Handling Conventions

### Error Types
1. **Validation Errors (400)**
   - Invalid request data
   - Missing required fields
   - Type mismatches

2. **Authentication Errors (401)**
   - Missing/invalid token
   - Expired session

3. **Not Found Errors (404)**
   - Resource doesn't exist
   - Invalid IDs

4. **Conflict Errors (409)**
   - Duplicate resources
   - State conflicts

5. **Rate Limit Errors (429)**
   - Too many requests
   - Includes retry-after header

6. **Server Errors (500)**
   - Unexpected errors
   - Database failures

### Error Handling Middleware
- Global error boundary
- Structured error logging
- Client-safe error messages
- Stack traces in development only

## API Documentation Approach

### OpenAPI/Swagger
- Location: `/docs/api_schema.yaml`
- Version: OpenAPI 3.0.3
- Coverage: Authentication endpoints fully documented
- Tools: Can generate client SDKs from schema

### In-Code Documentation
- JSDoc comments for all route handlers
- Zod schemas serve as runtime documentation
- Type definitions exported for TypeScript clients

### API Patterns
1. **RESTful Design**
   - Resource-based URLs
   - Standard HTTP methods
   - Stateless operations

2. **Factory Pattern**
   - `createApiHandler` for consistent handling
   - `createSSEHandler` for streaming
   - Middleware composition

3. **Rate Limiting**
   - Default: 100 requests/minute
   - Configurable per route
   - Redis-backed counters

4. **CORS Configuration**
   - Production: Restricted origins
   - Development: Allow all origins
   - Preflight handling

## API Versioning Strategy
- Currently: No explicit versioning
- Routes follow `/api/{resource}` pattern
- Future: Consider `/api/v2/{resource}` for breaking changes
- Header-based versioning as alternative

## Performance Optimizations
1. **Caching**
   - Response caching for GET requests
   - Redis-backed cache storage
   - ETags for conditional requests

2. **Circuit Breaker**
   - Prevents cascading failures
   - Auto-recovery mechanisms
   - Monitoring integration

3. **Request Batching**
   - Supported for analysis operations
   - Reduces round trips
   - Configurable batch sizes