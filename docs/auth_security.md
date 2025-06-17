# Authentication and Security Configuration

## Authentication Flow and Providers

### Supabase Authentication Setup
- **Provider**: Supabase Auth (JWT-based authentication)
- **Client Configuration**: 
  - Browser client created with `@supabase/ssr` for client-side auth
  - Server client for middleware and API routes
  - Admin client for privileged operations (service role key)

### Authentication Flow
1. **User Registration** (`/signup`)
   - Email/password signup with optional metadata (name)
   - Auto-login after successful registration
   - Email verification support built-in

2. **User Login** (`/login`)
   - Email/password authentication
   - Session creation with JWT tokens
   - Automatic redirect to dashboard

3. **Password Reset** (`/reset-password`)
   - Email-based password reset flow
   - Secure token generation by Supabase

4. **Protected Routes**
   - Middleware-based route protection
   - Public routes: `/`, `/login`, `/signup`, `/reset-password`, `/api/binance/*`
   - All other routes require authentication

## Session Management Approach

### Client-Side Session Management
- **AuthProvider Context**: Centralized authentication state management
- **Session Persistence**: Supabase handles token storage in secure cookies
- **Session Monitoring**: Real-time auth state changes via `onAuthStateChange`
- **Auto-refresh**: Built-in token refresh mechanism by Supabase

### Server-Side Session Handling
- **Middleware Integration**: Session validation in `middleware.ts`
- **Cookie Configuration**:
  - `sameSite: 'lax'` for CSRF protection
  - `secure: true` in production
  - HTTPOnly cookies for token storage

### Chat Session Management
- **Dual Storage**: Local sessions + Database sync
- **Session Migration**: Automatic migration from localStorage to Supabase DB
- **UUID Validation**: Ensures proper session ID format for DB operations

## API Security Measures

### Rate Limiting
- **Default Limit**: 100 requests per minute per client
- **Implementation**: Production-ready rate limiter with Upstash Redis support
- **Headers**: `X-RateLimit-*` headers for client awareness
- **Graceful Degradation**: Falls back to allowing requests on rate limit errors

### API Authentication
- **Bearer Token**: `Authorization: Bearer <token>` header
- **Public Endpoints**: `/api/health`, `/api/binance/ticker`
- **Protected Endpoints**: All other API routes
- **API Key Support**: Optional API key authentication (when `API_AUTH_ENABLED=true`)

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (production only)

### CORS Configuration
- **Development**: Allows all origins (`*`)
- **Production**: Restricted to `ALLOWED_ORIGINS` environment variable
- **Methods**: GET, OPTIONS
- **Headers**: Content-Type, Authorization
- **Preflight Cache**: 24 hours

## Environment Variable Handling

### Required Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `OPENAI_API_KEY`: Required for AI features

### Optional Security Variables
- `API_AUTH_SECRET`: API key authentication (min 32 chars)
- `API_AUTH_ENABLED`: Enable/disable API key authentication
- `ALLOWED_ORIGINS`: CORS allowed origins (production)
- `SENTRY_DSN`: Error tracking configuration

### Environment Validation
- **Zod Schema**: Runtime validation of all environment variables
- **Type Safety**: Full TypeScript support via `env.ts`
- **Fail-Fast**: Application won't start with invalid configuration
- **Production Checks**: Extra validation for production environment

## Security Best Practices Implemented

### Authentication Security
- **Password Hashing**: Handled by Supabase (bcrypt)
- **JWT Tokens**: Short-lived access tokens with refresh mechanism
- **Secure Cookie Storage**: HTTPOnly, Secure, SameSite attributes
- **Session Timeout**: Automatic session expiration

### Input Validation
- **Symbol Validation**: Binance symbol format validation
- **Interval Validation**: Predefined valid intervals only
- **Request Validation**: Middleware-based input sanitization

### Error Handling
- **No Information Leakage**: Generic error messages for auth failures
- **Graceful Degradation**: Fallback to local operation if DB unavailable
- **Audit Logging**: Authentication events logged for monitoring

### Development Security
- **Environment Isolation**: Separate configs for dev/test/prod
- **Secret Management**: No hardcoded secrets, all via environment
- **HTTPS Enforcement**: Secure cookies in production only

### Monitoring and Compliance
- **Rate Limit Monitoring**: Track and log rate limit violations
- **Auth Event Tracking**: Login attempts and session creation
- **Error Tracking**: Sentry integration for production monitoring
- **Performance Metrics**: Response time tracking for auth operations