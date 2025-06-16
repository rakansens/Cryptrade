/**
 * Client-side Environment Variable Access
 * 
 * This module provides safe access to environment variables in the browser context.
 * Only NEXT_PUBLIC_* variables are available in the browser.
 */

import { z } from 'zod';

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

  // In server context, use the full env
  if (typeof window === 'undefined') {
    // Import server env dynamically to avoid client-side bundling
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
  }

  // In browser context, parse from process.env
  const parseResult = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER,
    NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!parseResult.success) {
    console.warn('[ClientEnv] Some client environment variables are invalid:', parseResult.error.issues);
    // Return partial data even if validation fails in client
    _clientEnv = {
      NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: false,
      NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: false,
    } as ClientEnv;
  } else {
    _clientEnv = parseResult.data;
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