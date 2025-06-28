/**
 * Shared environment mocking utilities for testing
 * 
 * テスト環境での環境変数モックを提供
 * 複数のテストファイルで使用される共通実装
 */

export interface EnvMockValues {
  [key: string]: string | undefined;
}

export type RestoreFunction = () => void;

/**
 * Mock environment variables for testing
 * 
 * 環境変数をモックし、テスト終了時に元の値を復元する関数を返す
 * 
 * @param mockValues - 環境変数のモック値
 * @returns 元の環境変数を復元する関数
 * 
 * @example
 * ```typescript
 * const restore = mockEnv({
 *   NODE_ENV: 'test',
 *   API_KEY: 'test-key'
 * });
 * 
 * // テスト実行
 * 
 * restore(); // 元の環境変数を復元
 * ```
 */
export function mockEnv(mockValues: EnvMockValues = {}): RestoreFunction {
  // Ensure process.env exists
  if (!process.env) {
    // @ts-ignore
    process.env = {};
  }
  
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
    // Module not loaded yet or _resetEnvCache not available - this is expected
    // during initial test setup when env module hasn't been imported yet.
    // No action needed as the module will be loaded when first accessed.
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
      // Module not loaded yet or _resetEnvCache not available after restoration.
      // This is expected behavior and doesn't affect test execution.
      // The env module will reload with correct values when next imported.
    }
  };
}

/**
 * Create a mock environment setup for test suites
 * 
 * テストスイート用の環境変数モックセットアップを作成
 * beforeEach/afterEachで自動的に環境変数を管理
 * 
 * @param defaultValues - デフォルトの環境変数値
 * @returns セットアップとティアダウンを行うヘルパーオブジェクト
 */
export function createEnvMockSetup(defaultValues: EnvMockValues = {}) {
  let restore: RestoreFunction | null = null;

  return {
    setup(overrides: EnvMockValues = {}) {
      restore = mockEnv({ ...defaultValues, ...overrides });
    },
    teardown() {
      if (restore) {
        restore();
        restore = null;
      }
    }
  };
}