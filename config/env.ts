/**
 * Updated: Environment Configuration - ESLintルール無効化（環境変数読み込み用ファイル）
 * 
 * This file provides type-safe access to all environment variables used in the application.
 * It uses Zod for runtime validation and ensures fail-fast behavior when required variables are missing.
 * 
 * @generated Epic #5 - Environment Configuration Centralization
 */

/* eslint-disable no-restricted-syntax */
import { z } from 'zod';

// =============================================================================
// ENVIRONMENT SCHEMA DEFINITION
// =============================================================================

const EnvSchema = z.object({
  // Core application environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // API Keys - Required for all environments
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Optional validation settings
  FORCE_VALIDATION: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  LOG_TRANSPORT: z.enum(['console', 'noop', 'sentry', 'multi']).optional().default('console'),
  DISABLE_CONSOLE_LOGS: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  ENABLE_SENTRY: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // CORS and security
  ALLOWED_ORIGINS: z.string().optional(),
  
  // API Authentication
  API_AUTH_SECRET: z.string().min(32, 'API auth secret must be at least 32 characters').optional(),
  API_AUTH_ENABLED: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true'),
  
  // Database and storage
  DATABASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Application URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
  
  // Feature flags
  USE_NEW_WS_MANAGER: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  ENABLE_ORCHESTRATOR_AGENT: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // Telemetry configuration
  TELEMETRY_SAMPLING_RATE: z.coerce.number().min(0).max(1).default(0.001).optional(),
  TELEMETRY_ENDPOINT: z.string().url().optional(),
  TELEMETRY_API_KEY: z.string().optional(),
  
  // Sentry configuration
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  
  // Server configuration
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  
  // Test environment variables
  CI: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  TEST_PORT: z.coerce.number().min(1).max(65535).optional(),
  TEST_TYPE: z.string().optional(),
  TEST_START_TIME: z.string().optional(),
  JEST_SHARD_INDEX: z.coerce.number().optional(),
  JEST_SHARD_TOTAL: z.coerce.number().optional(),
  
  // Demo mode
  DEMO_MODE: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // System environment
  TZ: z.string().optional(),
  
  // Next.js internal
  __NEXT_BUILD_ID: z.string().optional(),
  
  // Process-specific (for testing/development)
  CLAUDE_INSTANCE_PID: z.coerce.number().optional(),
}).refine((data) => {
  // Production-specific validation
  if (data.NODE_ENV === 'production') {
    // Ensure API keys are present in production
    if (!data.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required in production environment');
    }
  }
  return true;
}, {
  message: "Production environment requires all API keys to be configured"
});

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Env = z.infer<typeof EnvSchema>;

// =============================================================================
// ENVIRONMENT LOADING & VALIDATION
// =============================================================================

let _env: Env | null = null;

/**
 * Load and validate environment variables (singleton pattern)
 * 
 * @returns Validated environment configuration
 * @throws Will exit process with code 1 if validation fails
 */
export function loadEnv(): Env {
  // Return cached environment if already loaded
  if (_env !== null) {
    return _env;
  }

  // In browser environment, create minimal environment
  if (typeof window !== 'undefined') {
    _env = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      OPENAI_API_KEY: 'browser-env-not-available',
      PORT: 3000,
      LOG_TRANSPORT: 'console'
    } as Env;
    return _env;
  }

  // Parse and validate environment variables (Server-side only)
  const parseResult = EnvSchema.safeParse(process.env);

  if (!parseResult.success) {
    console.error('🚨 [Environment] Validation failed!');
    console.error('📋 Missing or invalid environment variables:');
    
    // Format error messages for better readability
    parseResult.error.issues.forEach((issue) => {
      const field = issue.path.join('.');
      const message = issue.message;
      console.error(`   ❌ ${field}: ${message}`);
    });

    console.error('');
    console.error('💡 Please check your environment configuration and try again.');
    console.error('📚 See docs/ARCHITECTURE.md for environment setup guide.');
    
    // Fail-fast: exit immediately in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      // Check if we're in browser environment
      if (typeof window !== 'undefined') {
        // Browser environment - throw error instead of process.exit
        throw new Error('Environment validation failed in browser environment');
      } else {
        // Node.js environment - can safely use process.exit
        process.exit(1);
      }
    } else {
      // In test environment, throw error instead of exiting
      throw new Error('Environment validation failed in test environment');
    }
  }

  // Cache the validated environment
  _env = parseResult.data;
  
  // Log successful initialization (except in test)
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ [Environment] Configuration loaded successfully');
    if (_env && _env.NODE_ENV === 'development') {
      console.log(`🔧 [Environment] Running in ${_env.NODE_ENV} mode`);
    }
  }

  return _env;
}

// =============================================================================
// EXPORTED ENVIRONMENT INSTANCE
// =============================================================================

/**
 * Type-safe environment configuration instance
 * 
 * This is the single source of truth for all environment variables.
 * Use this instead of direct process.env access throughout the application.
 * 
 * @example
 * ```typescript
 * import { env } from '@/config/env';
 * 
 * if (env.NODE_ENV === 'production') {
 *   // Production logic
 * }
 * 
 * const apiKey = env.OPENAI_API_KEY; // Type-safe access
 * ```
 */
export const env = loadEnv();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if running in development mode
 */
export const isDevelopment = () => env.NODE_ENV === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = () => env.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = () => env.NODE_ENV === 'test';

/**
 * Get the application port
 */
export const getPort = () => env.PORT;

/**
 * Check if Redis is available (either Upstash or Vercel KV)
 */
export const hasRedis = () => {
  const config = _env || loadEnv();
  return Boolean(
    (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) ||
    (config.KV_REST_API_URL && config.KV_REST_API_TOKEN)
  );
};

/**
 * Reset environment cache (for testing purposes only)
 * @internal
 */
export function _resetEnvCache(): void {
  _env = null;
}