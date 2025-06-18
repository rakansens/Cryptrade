import {
  getClientEnv,
  getClientEnvOrThrow,
  isClientSide,
  ClientEnvSchema,
} from '@/lib/utils/client-env';
//  // 削除

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock z
jest.mock('zod', () => {
  const actual = jest.requireActual('zod');
  return {
    ...actual,
    z: {
      ...actual.z,
      object: jest.fn(() => ({
        safeParse: jest.fn(),
        parse: jest.fn(),
      })),
    },
  };
});

// Mock server env module
jest.mock('@/config/env', () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: 'https://test.example.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test.com',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: 'true',
    NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: 'false',
    NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.test.com/dsn',
  },
}));

describe('client-env utilities', () => {
  let originalWindow: Window & typeof globalThis;
  let originalProcessEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Reset cache before each test
    _resetClientEnvCache();
    
    // Store originals
    originalWindow = global.window;
    originalProcessEnv = process.env;
    
    // Reset process.env
    process.env = {};
  });

  afterEach(() => {
    // Restore originals
    global.window = originalWindow;
    process.env = originalProcessEnv;
    jest.clearAllMocks();
  });

  describe('getClientEnv', () => {
    describe('server-side context', () => {
      beforeEach(() => {
        delete (global as any).window;
      });

      it('should load environment from server env module', () => {
        const env = getClientEnv();
        
        expect(env).toEqual({
          NEXT_PUBLIC_BASE_URL: 'https://test.example.com',
          NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test.com',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: true,
          NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: false,
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.test.com/dsn',
        });
      });

      it('should cache the environment after first load', () => {
        const env1 = getClientEnv();
        const env2 = getClientEnv();
        
        expect(env1).toBe(env2); // Same reference
      });

      it('should handle server env module errors gracefully', () => {
        // Mock require to throw
        const originalRequire = require;
        (global as any).require = jest.fn().mockImplementation(() => {
          throw new Error('Module not found');
        });
        
        // Reset cache to force reload
        _resetClientEnvCache();
        
        process.env.NEXT_PUBLIC_BASE_URL = 'https://fallback.com';
        
        const env = getClientEnv();
        
        expect(env.NEXT_PUBLIC_BASE_URL).toBe('https://fallback.com');
        
        (global as any).require = originalRequire;
      });
    });

    describe('client-side context', () => {
      beforeEach(() => {
        global.window = {} as Window & typeof globalThis;
      });

      it('should load environment from process.env', () => {
        process.env.NEXT_PUBLIC_BASE_URL = 'https://client.example.com';
        process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER = 'true';
        process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER = 'true';
        
        const env = getClientEnv();
        
        expect(env.NEXT_PUBLIC_BASE_URL).toBe('https://client.example.com');
        expect(env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(true);
        expect(env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER).toBe(true);
      });

      it('should handle missing optional variables', () => {
        // Don't set any env vars
        const env = getClientEnv();
        
        expect(env.NEXT_PUBLIC_BASE_URL).toBeUndefined();
        expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
        expect(env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(false); // Defaults to false
        expect(env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER).toBe(false); // Defaults to false
      });

      it('should validate and transform boolean flags', () => {
        process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER = 'false';
        process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER = 'invalid'; // Invalid value
        
        const env = getClientEnv();
        
        expect(env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(false);
        expect(env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER).toBe(false); // Fallback
      });

      it('should validate URL formats', () => {
        process.env.NEXT_PUBLIC_BASE_URL = 'not-a-url';
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-url.com';
        
        const env = getClientEnv();
        
        // Invalid URL should be undefined due to validation failure
        expect(env.NEXT_PUBLIC_BASE_URL).toBeUndefined();
        expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://valid-url.com');
      });
    });
  });

  describe('feature flag helpers', () => {
    describe('isDrawingRendererEnabled', () => {
      it('should return true when enabled', () => {
        process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER = 'true';
        global.window = {} as Window & typeof globalThis;
        _resetClientEnvCache();
        
        expect(isDrawingRendererEnabled()).toBe(true);
      });

      it('should return false when disabled', () => {
        process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER = 'false';
        global.window = {} as Window & typeof globalThis;
        _resetClientEnvCache();
        
        expect(isDrawingRendererEnabled()).toBe(false);
      });

      it('should return false when not set', () => {
        global.window = {} as Window & typeof globalThis;
        _resetClientEnvCache();
        
        expect(isDrawingRendererEnabled()).toBe(false);
      });
    });

    describe('isNewPatternRendererEnabled', () => {
      it('should return true when enabled', () => {
        process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER = 'true';
        global.window = {} as Window & typeof globalThis;
        _resetClientEnvCache();
        
        expect(isNewPatternRendererEnabled()).toBe(true);
      });

      it('should return false when disabled', () => {
        process.env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER = 'false';
        global.window = {} as Window & typeof globalThis;
        _resetClientEnvCache();
        
        expect(isNewPatternRendererEnabled()).toBe(false);
      });
    });
  });

  describe('getPublicBaseUrl', () => {
    beforeEach(() => {
      global.window = {
        location: {
          origin: 'https://browser.example.com',
        },
      } as Window & typeof globalThis;
    });

    it('should return env variable when set', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://env.example.com';
      _resetClientEnvCache();
      
      expect(getPublicBaseUrl()).toBe('https://env.example.com');
    });

    it('should return window origin in browser when env not set', () => {
      _resetClientEnvCache();
      
      expect(getPublicBaseUrl()).toBe('https://browser.example.com');
    });

    it('should return default URL on server when env not set', () => {
      delete (global as any).window;
      _resetClientEnvCache();
      
      expect(getPublicBaseUrl()).toBe('http://localhost:3000');
    });
  });

  describe('ClientEnvSchema', () => {
    it('should validate correct environment structure', () => {
      const validEnv = {
        NEXT_PUBLIC_BASE_URL: 'https://example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.com',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-123',
        NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: 'true',
        NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: 'false',
        NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/123',
      };
      
      const result = ClientEnvSchema.safeParse(validEnv);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(true);
        expect(result.data.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER).toBe(false);
      }
    });

    it('should handle partial environment', () => {
      const partialEnv = {
        NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: 'true',
      };
      
      const result = ClientEnvSchema.safeParse(partialEnv);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(true);
        expect(result.data.NEXT_PUBLIC_BASE_URL).toBeUndefined();
      }
    });

    it('should reject invalid URLs', () => {
      const invalidEnv = {
        NEXT_PUBLIC_BASE_URL: 'not a url',
      };
      
      const result = ClientEnvSchema.safeParse(invalidEnv);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid boolean values', () => {
      const invalidEnv = {
        NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: 'yes', // Should be 'true' or 'false'
      };
      
      const result = ClientEnvSchema.safeParse(invalidEnv);
      
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined process.env gracefully', () => {
      const originalEnv = process.env;
      (global as any).process = { env: null };
      global.window = {} as Window & typeof globalThis;
      _resetClientEnvCache();
      
      const env = getClientEnv();
      
      expect(env).toBeDefined();
      expect(env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER).toBe(false);
      
      (global as any).process = { env: originalEnv };
    });

    it('should handle concurrent access', () => {
      global.window = {} as Window & typeof globalThis;
      process.env.NEXT_PUBLIC_BASE_URL = 'https://concurrent.com';
      _resetClientEnvCache();
      
      // Simulate concurrent access
      const results = Promise.all([
        Promise.resolve(getClientEnv()),
        Promise.resolve(getClientEnv()),
        Promise.resolve(getClientEnv()),
      ]);
      
      results.then(([env1, env2, env3]) => {
        expect(env1).toBe(env2);
        expect(env2).toBe(env3);
        expect(env1.NEXT_PUBLIC_BASE_URL).toBe('https://concurrent.com');
      });
    });

    it('should handle environment changes after caching', () => {
      global.window = {} as Window & typeof globalThis;
      process.env.NEXT_PUBLIC_BASE_URL = 'https://initial.com';
      _resetClientEnvCache();
      
      const env1 = getClientEnv();
      expect(env1.NEXT_PUBLIC_BASE_URL).toBe('https://initial.com');
      
      // Change env after caching
      process.env.NEXT_PUBLIC_BASE_URL = 'https://changed.com';
      
      const env2 = getClientEnv();
      // Should still return cached value
      expect(env2.NEXT_PUBLIC_BASE_URL).toBe('https://initial.com');
      
      // Reset cache to pick up new value
      _resetClientEnvCache();
      const env3 = getClientEnv();
      expect(env3.NEXT_PUBLIC_BASE_URL).toBe('https://changed.com');
    });
  });
});

export {};