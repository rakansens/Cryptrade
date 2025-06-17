# Environment Configuration Analysis

## Environment Variable Categories

### 1. **Core Application Settings**
- `NODE_ENV`: development/test/production (default: development)
- `PORT`: Server port (default: 3000)

### 2. **Required Variables**
- `OPENAI_API_KEY`: Required for AI trading insights
  - Production validation enforces presence
  - Minimum 1 character validation

### 3. **Optional API Keys**
- `ANTHROPIC_API_KEY`: Anthropic AI integration
- `API_AUTH_SECRET`: API authentication (min 32 chars)
- `API_AUTH_ENABLED`: Enable API auth (boolean)

### 4. **Database & Storage**
- **PostgreSQL**: `DATABASE_URL`, `DIRECT_DATABASE_URL`
- **Redis/Upstash**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Vercel KV**: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- **Supabase**: 
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 5. **Feature Flags**
- `USE_NEW_WS_MANAGER`: New WebSocket implementation
- `ENABLE_ORCHESTRATOR_AGENT`: Orchestrator agent feature
- `NEXT_PUBLIC_FEATURE_DRAWING_RENDERER`: Drawing renderer
- `NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER`: Pattern renderer

### 6. **Monitoring & Logging**
- `LOG_LEVEL`: debug/info/warn/error
- `LOG_TRANSPORT`: console/noop/sentry/multi (default: console)
- `DISABLE_CONSOLE_LOGS`: Boolean flag
- `ENABLE_SENTRY`: Sentry integration
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`: Sentry project IDs
- `TELEMETRY_SAMPLING_RATE`: 0.0-1.0 (default: 0.001)

### 7. **Testing & Development**
- `CI`: CI environment flag
- `TEST_PORT`: Test server port
- `TEST_TYPE`: Test type identifier
- `DEMO_MODE`: Demo mode flag
- `FORCE_VALIDATION`: Force env validation

## Validation Requirements

### Schema-based Validation
- Uses **Zod** for runtime validation
- Type-safe access via `env` object
- Fail-fast on missing required variables
- Custom refinements for production environment

### Validation Scripts
1. **env-validate.ts**: 
   - Checks environment files existence
   - Validates all variables against schema
   - Provides configuration summary
   
2. **check-env-usage.ts**:
   - Scans for direct `process.env` usage
   - Suggests migrations to typed `env` object

## Edge vs Node Runtime Differences

### Node.js Runtime (`/config/env.ts`)
- Full Zod schema validation
- Singleton pattern with caching
- Environment-specific refinements
- Comprehensive error reporting
- Helper functions (isDevelopment, isProduction, etc.)

### Edge Runtime (`/config/env-edge.ts`)
- Direct `process.env` access
- No Zod validation (Edge Runtime limitations)
- Simplified object literal
- Type definitions via `const` assertion
- Used in middleware.ts and Edge API routes

## Secret Management Approach

### Development
1. Use `.env.local` (gitignored)
2. Copy from `.env.example` template
3. Never commit actual secrets

### Production
1. **API Keys**: Store in deployment platform env vars
2. **Database URLs**: Use connection pooling URLs
3. **Service Keys**: Separate admin/public keys
4. **Authentication**: Generate secure secrets (32+ chars)

### Security Patterns
- Public keys prefixed with `NEXT_PUBLIC_`
- Service role keys kept server-side only
- Validation ensures minimum key lengths
- Optional API authentication layer

## Development vs Production Configs

### Development Defaults
```typescript
NODE_ENV: 'development'
LOG_LEVEL: 'debug'
LOG_TRANSPORT: 'console'
PORT: 3000
API_AUTH_ENABLED: false
```

### Production Requirements
- `OPENAI_API_KEY`: Mandatory
- `NODE_ENV`: Must be 'production'
- Recommended: Enable Sentry, API auth
- Use actual domain URLs (not localhost)
- Enable appropriate feature flags

### Environment-Specific Features
- Browser environment returns minimal config
- Test environment skips console logs
- Production enforces stricter validation
- Development allows optional variables

## Best Practices

1. **Type Safety**: Always import from `@/config/env`
2. **Validation**: Run `npm run validate:env` before deployment
3. **Migration**: Use `npm run check:env-usage` to find direct usage
4. **Documentation**: Update `.env.example` when adding variables
5. **Testing**: Env mocking handled automatically in tests