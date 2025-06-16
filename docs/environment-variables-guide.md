# Environment Variables Guide

## Overview

This guide explains how to properly use environment variables in the Cryptrade application with type safety and validation.

## Centralized Configuration

All environment variables are defined and validated in `/config/env.ts` using Zod schemas. This provides:

- **Type Safety**: All environment variables are typed
- **Validation**: Variables are validated at startup
- **Fail-Fast**: Missing required variables cause immediate startup failure
- **Documentation**: All variables are documented in one place

## Usage

### 1. Import the env object

```typescript
import { env } from '@/config/env';
```

### 2. Use typed environment variables

```typescript
// ❌ Don't do this
const apiKey = process.env.OPENAI_API_KEY;

// ✅ Do this instead
const apiKey = env.OPENAI_API_KEY;
```

### 3. Use helper functions

```typescript
import { isDevelopment, isProduction, isTest } from '@/config/env';

if (isDevelopment()) {
  // Development-only code
}
```

## Adding New Environment Variables

### 1. Update the schema in `/config/env.ts`

```typescript
const EnvSchema = z.object({
  // ... existing variables
  
  // Add your new variable
  MY_NEW_VARIABLE: z.string().optional(),
  
  // For boolean flags, use this pattern:
  ENABLE_FEATURE: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // For numbers:
  MAX_RETRIES: z.coerce.number().min(1).max(10).default(3),
});
```

### 2. Update `.env.example`

```bash
# My New Feature Configuration
# MY_NEW_VARIABLE=some-value
# ENABLE_FEATURE=true
# MAX_RETRIES=3
```

### 3. Update type definitions if needed

The `Env` type is automatically inferred from the schema, so no manual updates are needed.

## Environment Variable Categories

### Required Variables

- `OPENAI_API_KEY`: Required for AI features

### Optional Variables

#### API Keys
- `ANTHROPIC_API_KEY`: For Anthropic AI integration

#### Database
- `DATABASE_URL`: PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL`: Redis cache URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis authentication
- `KV_REST_API_URL`: Vercel KV storage
- `KV_REST_API_TOKEN`: Vercel KV auth
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase admin key

#### Feature Flags
- `USE_NEW_WS_MANAGER`: Enable new WebSocket implementation
- `ENABLE_ORCHESTRATOR_AGENT`: Enable orchestrator agent
- `NEXT_PUBLIC_FEATURE_DRAWING_RENDERER`: Enable drawing renderer
- `NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER`: Enable new pattern renderer

#### Logging & Monitoring
- `LOG_LEVEL`: debug | info | warn | error
- `LOG_TRANSPORT`: console | noop | sentry | multi
- `DISABLE_CONSOLE_LOGS`: Disable console logging
- `ENABLE_SENTRY`: Enable Sentry error tracking
- `SENTRY_DSN`: Sentry project DSN
- `TELEMETRY_SAMPLING_RATE`: Telemetry sampling (0.0-1.0)

#### Testing
- `CI`: Running in CI environment
- `TEST_PORT`: Port for test server
- `TEST_TYPE`: Type of test being run
- `DEMO_MODE`: Enable demo mode

## Best Practices

### 1. Never use process.env directly

Always use the typed `env` object to ensure type safety.

### 2. Validate early

Environment validation happens at startup, ensuring all required variables are present before the app runs.

### 3. Use appropriate types

- Use `z.enum(['true', 'false']).transform()` for booleans
- Use `z.coerce.number()` for numeric values
- Use `z.string().url()` for URLs

### 4. Document variables

Add comments in both the schema and `.env.example` explaining what each variable does.

### 5. Handle missing optional variables

```typescript
// Check if optional variables are defined
if (env.DATABASE_URL) {
  // Use database
} else {
  // Use fallback
}
```

## Migration from process.env

To migrate existing code:

1. Run the check script: `npm run check:env-usage`
2. Import `env` from `@/config/env`
3. Replace `process.env.VARIABLE` with `env.VARIABLE`
4. Remove any manual parsing or validation

## Testing

Test utilities automatically mock environment variables. See `/config/testing/setupEnvMock.ts` for details.

```typescript
// In tests
beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
});
```

## Troubleshooting

### Missing required variable

If you see an error like:
```
❌ OPENAI_API_KEY: OpenAI API key is required
```

1. Copy `.env.example` to `.env.local`
2. Fill in the required values
3. Restart the development server

### Type errors

If TypeScript complains about a variable not existing on `env`:

1. Make sure it's added to the schema in `/config/env.ts`
2. Restart your TypeScript server (in VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")

### Variable not updating

Environment variables are loaded once at startup. After changing `.env.local`:

1. Stop the development server
2. Start it again with `npm run dev`