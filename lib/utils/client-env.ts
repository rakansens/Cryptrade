/**
 * Client-side Environment Variable Access
 * 
 * This module provides safe access to environment variables in the browser context.
 * Only NEXT_PUBLIC_* variables are available in the browser.
 * 
 * This file requires direct process.env access for client-side environment handling
 * and should be added to ESLint overrides.
 */

/* eslint-disable no-restricted-syntax */
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Client-side environment schema (only NEXT_PUBLIC_* variables)
const ClientEnvSchema = z.object({
  // Public URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  
  // Public feature flags
  NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  
  // Public Sentry DSN
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;

let _clientEnv: ClientEnv | null = null;

/**
 * Creates a client environment object from raw values
 * This abstraction helps with testing and reduces direct process.env access
 */
function createClientEnv(rawEnv: Record<string, string | undefined>): ClientEnv | null {
  const parseResult = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_BASE_URL: rawEnv['NEXT_PUBLIC_BASE_URL'],
    NEXT_PUBLIC_SUPABASE_URL: rawEnv['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: rawEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: rawEnv['NEXT_PUBLIC_FEATURE_DRAWING_RENDERER'],
    NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: rawEnv['NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER'],
    NEXT_PUBLIC_SENTRY_DSN: rawEnv['NEXT_PUBLIC_SENTRY_DSN'],
  });

  if (!parseResult.success) {
    logger.warn('[ClientEnv] Some client environment variables are invalid', {
      issues: parseResult.error.issues
    });
    // Return partial data even if validation fails in client
    return {
      NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: false,
      NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: false,
    } as ClientEnv;
  }
  
  return parseResult.data;
}

/**
 * Get client-side environment variables
 * 
 * This function provides type-safe access to NEXT_PUBLIC_* environment variables
 * that are available in the browser context.
 * 
 * @returns Validated client environment configuration
 */
export function getClientEnv(): ClientEnv {
  // Return cached environment if already loaded
  if (_clientEnv !== null) {
    return _clientEnv;
  }

  // Server-side context detection
  const isServer = typeof window === 'undefined';

  if (isServer) {
    try {
      // Import server env dynamically to avoid client-side bundling
      // This is safe because it only runs on the server
      const { env } = require('@/config/env');
      _clientEnv = {
        NEXT_PUBLIC_BASE_URL: env.NEXT_PUBLIC_BASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER,
        NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER,
        NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN,
      };
      return _clientEnv;
    } catch (error) {
      // Fallback if server env is not available (e.g., during build)
      logger.warn('[ClientEnv] Failed to load server environment, using process.env fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Client-side or server-side fallback: read from process.env
  // Next.js automatically injects NEXT_PUBLIC_* variables at build time
  _clientEnv = createClientEnv(process.env);
  
  if (!_clientEnv) {
    // This should never happen due to the createClientEnv fallback, but just in case
    _clientEnv = {
      NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: false,
      NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: false,
    } as ClientEnv;
  }

  return _clientEnv;
}

/**
 * Check if drawing renderer feature is enabled
 */
export function isDrawingRendererEnabled(): boolean {
  const env = getClientEnv();
  return env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER ?? false;
}

/**
 * Check if new pattern renderer is enabled
 */
export function isNewPatternRendererEnabled(): boolean {
  const env = getClientEnv();
  return env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER ?? false;
}

/**
 * Get the public base URL
 */
export function getPublicBaseUrl(): string {
  const env = getClientEnv();
  return env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
}

/**
 * Reset client environment cache (for testing purposes only)
 * @internal
 */
export function _resetClientEnvCache(): void {
  _clientEnv = null;
}