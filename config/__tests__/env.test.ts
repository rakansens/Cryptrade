/**
 * Environment Configuration Tests
 * 
 * Tests for type-safe environment variable loading and validation
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { mockEnv, createTestEnv } from '../testing/setupEnvMock';

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

    // Setup default test environment
    restoreEnv = mockEnv(createTestEnv());
  });

  afterEach(() => {
    // Restore environment
    restoreEnv();
    
    // Restore console and process.exit
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
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

      // Act
      const { loadEnv } = await import('../env');
      const env = loadEnv();

      // Assert
      expect(env.NODE_ENV).toBe('development');
      expect(env.OPENAI_API_KEY).toBe('sk-test-key-12345');
      expect(env.PORT).toBe(3001);
      expect(mockConsole.log).toHaveBeenCalledWith('✅ [Environment] Configuration loaded successfully');
    });

    it('should apply default values for optional fields', async () => {
      // Arrange
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
      });

      // Act
      const { loadEnv } = await import('../env');
      const env = loadEnv();

      // Assert
      expect(env.PORT).toBe(3000); // Default value
      expect(env.LOG_TRANSPORT).toBe('console'); // Default value
    });

    it('should transform boolean string values correctly', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
        FORCE_VALIDATION: 'true',
        DISABLE_CONSOLE_LOGS: 'false',
        USE_NEW_WS_MANAGER: 'true',
      };

      // Act
      const { loadEnv } = await import('../env');
      const env = loadEnv();

      // Assert
      expect(env.FORCE_VALIDATION).toBe(true);
      expect(env.DISABLE_CONSOLE_LOGS).toBe(false);
      expect(env.USE_NEW_WS_MANAGER).toBe(true);
    });
  });

  describe('loadEnv() - Validation Failures', () => {
    it('should fail when required OPENAI_API_KEY is missing', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'test', // Set NODE_ENV to test to avoid exit behavior
        // Missing OPENAI_API_KEY
      };

      // Reset and reimport module
      jest.resetModules();
      
      // Act & Assert  
      await expect(async () => {
        const { loadEnv } = await import('../env');
        loadEnv();
      }).rejects.toThrow('Environment validation failed in test environment');
      
      expect(mockConsole.error).toHaveBeenCalledWith('🚨 [Environment] Validation failed!');
    });

    it('should fail with empty OPENAI_API_KEY', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'test',
        OPENAI_API_KEY: '', // Empty string should fail
      };

      // Reset and reimport module
      jest.resetModules();
      
      // Act & Assert
      await expect(async () => {
        const { loadEnv } = await import('../env');
        loadEnv();
      }).rejects.toThrow('Environment validation failed in test environment');
    });

    it('should fail with invalid PORT value', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
        PORT: 'invalid-port',
      };

      // Reset and reimport module
      jest.resetModules();
      
      // Act & Assert
      await expect(async () => {
        const { loadEnv } = await import('../env');
        loadEnv();
      }).rejects.toThrow('Environment validation failed in test environment');
    });

    it('should call process.exit(1) in non-test environment on validation failure', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'production',
        // Missing OPENAI_API_KEY
      };

      // Act
      const { loadEnv } = await import('../env');
      loadEnv();

      // Assert
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsole.error).toHaveBeenCalledWith('🚨 [Environment] Validation failed!');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test-key',
      };

      // Act
      const { loadEnv } = await import('../env');
      const env1 = loadEnv();
      const env2 = loadEnv();

      // Assert
      expect(env1).toBe(env2); // Same reference
      expect(mockConsole.log).toHaveBeenCalledTimes(0); // No duplicate logs in test
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      process.env = {
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-test-key',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token123',
      };
      
      // Reset and reimport module after setting env
      jest.resetModules();
    });

    it('should detect development mode correctly', async () => {
      const { isDevelopment, isProduction, isTest } = await import('../env');
      
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect Redis availability', async () => {
      const { hasRedis } = await import('../env');
      
      expect(hasRedis()).toBe(true);
    });

    it('should return correct port', async () => {
      const { getPort } = await import('../env');
      
      expect(getPort()).toBe(3000); // Default value
    });
  });

  describe('Production Environment Validation', () => {
    it('should enforce required API keys in production', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'production',
        // Missing OPENAI_API_KEY  
        PORT: '3000',
      };

      // Reset and reimport module
      jest.resetModules();

      // Act
      const { loadEnv } = await import('../env');
      loadEnv();

      // Assert - should call process.exit(1) in production
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass validation with all required keys in production', async () => {
      // Arrange
      process.env = {
        NODE_ENV: 'production',
        OPENAI_API_KEY: 'sk-prod-key-12345',
      };

      // Act
      const { loadEnv } = await import('../env');
      const env = loadEnv();

      // Assert
      expect(env.NODE_ENV).toBe('production');
      expect(env.OPENAI_API_KEY).toBe('sk-prod-key-12345');
    });
  });
});