/**
 * Environment Mocking Utility for Jest Tests
 * 
 * Provides a clean API for mocking environment variables in tests
 * without directly manipulating process.env or requiring manual cleanup.
 * 
 * @example
 * ```typescript
 * import { mockEnv } from '@/config/testing/setupEnvMock';
 * 
 * describe('My Test', () => {
 *   let restoreEnv: () => void;
 * 
 *   beforeEach(() => {
 *     restoreEnv = mockEnv({
 *       NODE_ENV: 'test',
 *       OPENAI_API_KEY: 'sk-test-key-12345',
 *       LOG_TRANSPORT: 'noop'
 *     });
 *   });
 * 
 *   afterEach(() => {
 *     restoreEnv();
 *   });
 * 
 *   it('should work with mocked environment', () => {
 *     // Test code here - env.OPENAI_API_KEY will be 'sk-test-key-12345'
 *   });
 * });
 * ```
 */

type EnvMockValues = Record<string, string | undefined>;
type RestoreFunction = () => void;

/**
 * Mock environment variables for the duration of a test
 * 
 * @param mockValues Object containing environment variables to mock
 * @returns Restore function to reset environment back to original state
 */
export function mockEnv(mockValues: EnvMockValues): RestoreFunction {
  // Store original environment values
  const originalValues: EnvMockValues = {};
  const keysToRestore = new Set<string>();
  
  // Backup original values
  Object.keys(mockValues).forEach(key => {
    originalValues[key] = process.env[key];
    keysToRestore.add(key);
  });
  
  // Also backup any existing keys that might be undefined in mockValues
  Object.keys(process.env).forEach(key => {
    if (!keysToRestore.has(key)) {
      originalValues[key] = process.env[key];
      keysToRestore.add(key);
    }
  });
  
  // Apply mock values
  Object.entries(mockValues).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
  
  // Reset module cache to force env.ts to reload with new values
  jest.resetModules();
  
  // Reset env cache if the module is already loaded
  try {
    // Use require to avoid TypeScript import issues during testing
    const envModule = require('@/config/env');
    if (envModule._resetEnvCache) {
      envModule._resetEnvCache();
    }
  } catch (error) {
    // Module not loaded yet or _resetEnvCache not available - that's fine
  }
  
  // Return restore function
  return (): void => {
    // Restore original values
    keysToRestore.forEach(key => {
      const originalValue = originalValues[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    });
    
    // Reset module cache again to ensure clean state
    jest.resetModules();
    
    // Reset env cache after restoration
    try {
      const envModule = require('@/config/env');
      if (envModule._resetEnvCache) {
        envModule._resetEnvCache();
      }
    } catch (error) {
      // Module not loaded yet or _resetEnvCache not available - that's fine
    }
  };
}

/**
 * Create a minimal valid environment for testing
 * Includes all required variables with sensible test defaults
 */
export function createTestEnv(overrides: Partial<EnvMockValues> = {}): EnvMockValues {
  const defaults: EnvMockValues = {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'sk-test-key-12345-mock-for-testing',
    PORT: '3000',
    LOG_LEVEL: 'error', // Reduce noise in tests
    LOG_TRANSPORT: 'noop', // No logging in tests by default
    DISABLE_CONSOLE_LOGS: 'true',
    ENABLE_SENTRY: 'false',
    USE_NEW_WS_MANAGER: 'false',
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Convenience function for creating a complete test environment
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   restoreEnv = mockTestEnv({ LOG_TRANSPORT: 'console' });
 * });
 * ```
 */
export function mockTestEnv(overrides: Partial<EnvMockValues> = {}): RestoreFunction {
  return mockEnv(createTestEnv(overrides));
}

/**
 * Reset environment cache without changing process.env values
 * Useful when you need to force env.ts to reload but keep current environment
 */
export function resetEnvCache(): void {
  jest.resetModules();
  
  try {
    const envModule = require('@/config/env');
    if (envModule._resetEnvCache) {
      envModule._resetEnvCache();
    }
  } catch (error) {
    // Module not loaded yet or _resetEnvCache not available - that's fine
  }
}