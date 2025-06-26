/**
 * Environment Configuration Tests
 * 
 * Tests for type-safe environment variable loading and validation
 * 
 * @jest-environment node
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { mockEnv, createTestEnv } from '@/tests/helpers/setupEnvMock';

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to avoid actually exiting in tests
const mockExit = jest.fn();

// Store original console and process.exit
let originalConsole: typeof console;
let originalExit: typeof process.exit;

describe('Environment Configuration', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    // Store original console and process.exit
    originalConsole = { ...console };
    originalExit = process.exit;

    // Mock console and process.exit
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    process.exit = mockExit as any;

    // Clear mocks
    jest.clearAllMocks();
    
    // Reset modules first to ensure clean state
    jest.resetModules();
    
    // Setup default test environment after module reset
    // Note: jest.setup.js sets default OPENAI_API_KEY='test-openai-key'
    restoreEnv = mockEnv(createTestEnv());
  });

  afterEach(() => {
    try {
      // Restore environment
      if (restoreEnv) {
        restoreEnv();
      }
      
      // Restore console and process.exit
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      process.exit = originalExit;
      
      // Clear all mocks
      jest.clearAllMocks();
    } catch (error) {
      // Silently handle cleanup errors to prevent test interference
    }
  });

  describe('loadEnv() - Happy Path', () => {
    it('should load valid environment successfully', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-test-key-12345',
        PORT: '3001',
      });

      // Reset modules before importing to ensure clean state
      jest.resetModules();
      
      // Mock window to be undefined for Node environment
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        const { loadEnv, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache(); // Clear any cached environment
        const env = loadEnv();

        // Assert
        expect(env.NODE_ENV).toBe('development');
        expect(env.OPENAI_API_KEY).toBe('sk-test-key-12345');
        expect(env.PORT).toBe(3001);
        expect(mockConsole.log).toHaveBeenCalledWith('✅ [Environment] Configuration loaded successfully');
      } finally {
        // Restore window
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should apply default values for optional fields', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        const { loadEnv, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        const env = loadEnv();

        // Assert
        expect(env.PORT).toBe(3000); // Default value
        expect(env.LOG_TRANSPORT).toBe('console'); // Default value
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should transform boolean string values correctly', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
        FORCE_VALIDATION: 'true',
        DISABLE_CONSOLE_LOGS: 'false',
        USE_NEW_WS_MANAGER: 'true',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        const { loadEnv, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        const env = loadEnv();

        // Assert
        expect(env.FORCE_VALIDATION).toBe(true);
        expect(env.DISABLE_CONSOLE_LOGS).toBe(false);
        expect(env.USE_NEW_WS_MANAGER).toBe(true);
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });
  });

  describe('loadEnv() - Validation Failures', () => {
    it('should fail when required OPENAI_API_KEY is missing', async () => {
      // Arrange - Override jest.setup.js defaults
      restoreEnv();
      // Delete all env vars to ensure clean state
      Object.keys(process.env).forEach(key => {
        if (key !== 'PATH' && key !== 'HOME' && key !== 'USER') {
          delete process.env[key];
        }
      });
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        // Explicitly not setting OPENAI_API_KEY
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act & Assert
        let errorThrown = false;
        try {
          const envModule = await import('@/config/env');
          // If module loads successfully, try calling loadEnv directly
          if (envModule._resetEnvCache) {
            envModule._resetEnvCache();
          }
          envModule.loadEnv();
        } catch (e) {
          errorThrown = true;
          expect(e).toEqual(expect.objectContaining({
            message: 'Environment validation failed in test environment'
          }));
        }
        
        expect(errorThrown).toBe(true);
        expect(mockConsole.error).toHaveBeenCalledWith('🚨 [Environment] Validation failed!');
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should fail with empty OPENAI_API_KEY', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: '', // Empty string should fail
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act & Assert - The module will throw during import
        await expect(async () => {
          await import('@/config/env');
        }).rejects.toThrow('Environment validation failed in test environment');
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should fail with invalid PORT value', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
        PORT: 'invalid-port',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act & Assert - The module will throw during import
        await expect(async () => {
          await import('@/config/env');
        }).rejects.toThrow('Environment validation failed in test environment');
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should call process.exit(1) in non-test environment on validation failure', async () => {
    // TODO: This test is skipped and needs investigation
      // Arrange - Override jest.setup.js defaults
      restoreEnv();
      // Delete all env vars to ensure clean state
      Object.keys(process.env).forEach(key => {
        if (key !== 'PATH' && key !== 'HOME' && key !== 'USER') {
          delete process.env[key];
        }
      });
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        // Explicitly not setting OPENAI_API_KEY
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        try {
          const envModule = await import('@/config/env');
          // If the module loads without calling exit (unlikely), call loadEnv directly
          if (envModule._resetEnvCache) {
            envModule._resetEnvCache();
          }
          envModule.loadEnv();
        } catch (e) {
          // Error is expected after process.exit is called
        }

        // Assert
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockConsole.error).toHaveBeenCalledWith('🚨 [Environment] Validation failed!');
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        const { loadEnv, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        const env1 = loadEnv();
        const env2 = loadEnv();

        // Assert
        expect(env1).toBe(env2); // Same reference
        expect(mockConsole.log).toHaveBeenCalledTimes(0); // No duplicate logs in test
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-test-key',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token123',
      });
      
      // Reset modules
      jest.resetModules();
    });

    it('should detect development mode correctly', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        const { isDevelopment, isProduction, isTest, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        
        expect(isDevelopment()).toBe(true);
        expect(isProduction()).toBe(false);
        expect(isTest()).toBe(false);
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should detect Redis availability', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        const { hasRedis, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        
        expect(hasRedis()).toBe(true);
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should return correct port', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        const { getPort, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        
        expect(getPort()).toBe(3000); // Default value
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });
  });

  describe('Production Environment Validation', () => {
    it('should enforce required API keys in production', async () => {
      // Arrange - Override jest.setup.js defaults
      restoreEnv();
      // Delete all env vars to ensure clean state
      Object.keys(process.env).forEach(key => {
        if (key !== 'PATH' && key !== 'HOME' && key !== 'USER') {
          delete process.env[key];
        }
      });
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        // Explicitly not setting OPENAI_API_KEY  
        PORT: '3000',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        try {
          const envModule = await import('@/config/env');
          // If the module loads without calling exit (unlikely), call loadEnv directly
          if (envModule._resetEnvCache) {
            envModule._resetEnvCache();
          }
          envModule.loadEnv();
        } catch (e) {
          // Error is expected after process.exit is called
        }

        // Assert - should call process.exit(1) in production
    // TODO: This test is skipped and needs investigation
        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });

    it('should pass validation with all required keys in production', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        OPENAI_API_KEY: 'sk-prod-key-12345',
      });

      // Reset modules and mock window
      jest.resetModules();
      const originalWindow = global.window;
      delete (global as any).window;

      try {
        // Act
        const { loadEnv, _resetEnvCache } = await import('@/config/env');
        _resetEnvCache();
        const env = loadEnv();

        // Assert
        expect(env.NODE_ENV).toBe('production');
        expect(env.OPENAI_API_KEY).toBe('sk-prod-key-12345');
      } finally {
        if (originalWindow) {
          (global as any).window = originalWindow;
        }
      }
    });
  });
});