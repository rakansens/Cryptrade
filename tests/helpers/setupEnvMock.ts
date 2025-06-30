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
export { mockEnv, createEnvMockSetup } from './shared/env-mock';
export type { EnvMockValues, RestoreFunction } from './shared/env-mock';

// Import mockEnv for the alias
import { mockEnv as mockEnvFunction } from './shared/env-mock';

/**
 * Test environment mock function alias
 * テスト環境用の環境変数モック関数（mockEnvのエイリアス）
 *
 * @param mockValues - モックする環境変数の値
 * @returns 元の環境変数を復元する関数
 */
export const mockTestEnv = mockEnvFunction;

/**
 * Create test environment configuration
 *
 * テスト用の環境変数設定を作成する
 *
 * @param overrides - デフォルト値を上書きする環境変数
 * @returns 環境変数の設定オブジェクト
 */
export function createTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    ...overrides
  };
}

/**
 * Get default test environment values for integration tests
 * 
 * @returns Default environment values for integration testing
 */
export function getDefaultIntegrationTestEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL || 'sqlite::memory:',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'test-secret',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-key-12345',
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || 'test-claude-key',
    LOG_LEVEL: 'warn',
    FEATURE_FLAGS: JSON.stringify({
      USE_MOCK_TRADES: !process.env.USE_REAL_TRADES,
      ENABLE_AI_ANALYSIS: !!process.env.ENABLE_AI_IN_TESTS
    })
  };
}