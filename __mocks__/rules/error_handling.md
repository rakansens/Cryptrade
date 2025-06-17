# Error Handling and Monitoring Patterns in Cryptrade

## Error Type Hierarchy

### Base Error Classes

1. **MastraBaseError** (`lib/errors/base-error.ts`)
   - Generic base error with type-safe data and context
   - Includes error metadata (code, timestamp, correlationId)
   - Error categorization and severity levels
   - Retry information (retryable, retryAfter)
   - Specialized error types:
     - `ApiError` - API-related errors with status codes
     - `AgentError` - Agent execution errors
     - `ToolError` - Tool execution errors
     - `ValidationError` - Validation failures
     - `RateLimitError` - Rate limiting errors
     - `AuthError` - Authentication errors

2. **AppError** (`lib/errors/index.ts`)
   - Primary application error base class
   - Operational vs programmer errors distinction
   - HTTP status code mapping
   - Specialized error types:
     - `ValidationError` - Request/data validation with Zod support
     - `ApiError` - External API failures with response mapping
     - `StreamingError` - SSE/WebSocket failures
     - `AuthenticationError` - 401 errors
     - `AuthorizationError` - 403 errors
     - `NotFoundError` - 404 errors
     - `RateLimitError` - 429 errors with retry info
     - `ConfigurationError` - Programmer errors

### Error Categories
- `API_ERROR` - API related issues
- `VALIDATION_ERROR` - Input validation failures
- `NETWORK_ERROR` - Network connectivity issues
- `AGENT_ERROR` - Agent execution problems
- `TOOL_ERROR` - Tool execution failures
- `WORKFLOW_ERROR` - Workflow processing errors
- `AUTH_ERROR` - Authentication/authorization issues
- `RATE_LIMIT_ERROR` - Rate limiting violations
- `UNKNOWN` - Uncategorized errors

### Error Severity Levels
- `INFO` - Informational messages
- `WARNING` - Non-critical issues
- `ERROR` - Standard errors
- `CRITICAL` - Severe errors requiring immediate attention

## Error Boundary Usage

### API Error Boundary (`lib/api/error-boundary.ts`)
- Global error handling wrapper for all API routes
- Features:
  - Request ID generation for tracing
  - Client info extraction (IP, User-Agent, Referer)
  - Structured error responses with metadata
  - Development vs production error detail exposure
  - Rate limit header management
  - Context-aware logging

### Middleware Wrappers
1. **withErrorBoundary** - Standard API error handling
2. **withStreamingErrorBoundary** - SSE/streaming response error handling
3. **withValidation** - Request body validation with Zod support
4. **withAuth** - Authentication requirement enforcement
5. **withMiddleware** - Middleware chain composition
6. **withFallback** - Graceful degradation support

### React Error Boundaries
- **Not implemented yet** - No React error boundaries found in components
- Recommendation: Add error boundaries for critical UI sections

## Logging and Monitoring Approach

### Logger Implementation (`lib/utils/logger.ts`)
- Transport-agnostic design with dependency injection
- Multiple transport support:
  - **ConsoleTransport** - Development console logging
  - **SentryTransport** - Production error tracking (stub)
  - **NoopTransport** - Testing/disabled logging
- Features:
  - Log level configuration (debug, info, warn, error)
  - Environment-based defaults
  - Log throttling for production
  - Structured logging with metadata
  - Error serialization with stack traces (dev only)
  - Timing utilities

### Error Tracking Service (`lib/errors/error-tracker.ts`)
- Centralized error management
- Features:
  - Error buffering with periodic flush (30s interval)
  - Critical error immediate reporting
  - Error statistics aggregation
  - Batch error submission
  - Sentry integration ready (when enabled)
  - Context enrichment (userId, sessionId, etc.)

### Logging Patterns
1. **Structured Logging**
   ```typescript
   logger.error('API Error', { 
     requestId, 
     path, 
     method, 
     statusCode, 
     duration,
     client: clientInfo,
     error: errorData
   });
   ```

2. **Error Tracking**
   ```typescript
   errorTracker.trackException(error, {
     userId,
     sessionId,
     agentName,
     endpoint,
     statusCode
   });
   ```

## User-Facing Error Messages

### API Error Responses
```typescript
{
  success: false,
  error: {
    code: string,        // Machine-readable error code
    message: string,     // Human-readable message
    details?: object     // Additional context (dev/operational only)
  },
  metadata: {
    timestamp: string,
    requestId: string,
    path: string,
    method: string
  }
}
```

### Error Message Guidelines
- Production: Generic messages for non-operational errors
- Development: Full error details including stack traces
- Operational errors: Always show actual error messages
- Rate limits: Include retry-after information

## Development vs Production Error Handling

### Development Mode
- Full error details exposed in responses
- Stack traces included in logs
- Console transport enabled by default
- Debug log level
- Throttling disabled
- All error details in API responses

### Production Mode
- Generic messages for programmer errors
- No stack traces in responses
- Warning log level by default
- Log throttling enabled (5s interval)
- Sentry integration available
- Telemetry endpoint for error batching

### Test Mode
- Error log level only
- NoopTransport option for silent tests
- Throttling disabled
- Mock-friendly logger design

## Recommendations

1. **Add React Error Boundaries**
   - Create global app error boundary
   - Add boundaries for critical components
   - Implement error recovery UI

2. **Enable Sentry Integration**
   - Complete SentryTransport implementation
   - Add source maps for better stack traces
   - Configure user context

3. **Improve Error Recovery**
   - Implement retry mechanisms for transient errors
   - Add circuit breakers for external services
   - Create fallback UI states

4. **Enhanced Monitoring**
   - Set up error alerting thresholds
   - Create error dashboards
   - Implement error budgets

5. **Error Documentation**
   - Create error code reference
   - Document recovery procedures
   - Add troubleshooting guides