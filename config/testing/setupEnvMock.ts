/**
 * Environment mocking utilities for testing
 * 
 * This module provides functions to temporarily mock environment variables
 * during tests and restore them afterward.
 * 
 * @example
 * ```typescript
 * // Mock specific environment variables
 * const restore = mockEnv({
 *   NODE_ENV: 'test',
 *   DATABASE_URL: 'sqlite::memory:',
 *   OPENAI_API_KEY: 'test-key'
 * });
 * 
 * // Run your tests...
 * 
 * // Restore original environment
 * restore();
 * ```
 */

// Re-export shared implementation
export { mockEnv, createEnvMockSetup } from '@/tests/helpers/shared/env-mock';
export type { EnvMockValues, RestoreFunction } from '@/tests/helpers/shared/env-mock';

/**
 * Get default test environment values
 * 
 * @returns Default environment values for testing
 */
export function getDefaultTestEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'sqlite::memory:',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-openai-key',
    CLAUDE_API_KEY: 'test-claude-key',
    LOG_LEVEL: 'warn',
    FEATURE_FLAGS: JSON.stringify({
      USE_MOCK_TRADES: true,
      ENABLE_AI_ANALYSIS: false
    })
  };
}