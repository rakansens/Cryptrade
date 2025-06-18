import { checkRateLimit, cleanupRateLimiter, memoryStore } from '@/lib/api/rate-limit-persistent';

describe('Persistent Rate Limiter', () => {
  beforeEach(() => {
    // Clear memory store before each test
    memoryStore.clear();
  });

  afterAll(async () => {
    // Cleanup after all tests
    await cleanupRateLimiter();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const config = { windowSec: 60, maxRequests: 3 };
      const identifier = 'test-key-1';

      // First request
      const result1 = await checkRateLimit(identifier, config);
      expect(result1.success).toBe(true);
      expect(result1.remainingRequests).toBe(2);

      // Second request
      const result2 = await checkRateLimit(identifier, config);
      expect(result2.success).toBe(true);
      expect(result2.remainingRequests).toBe(1);

      // Third request
      const result3 = await checkRateLimit(identifier, config);
      expect(result3.success).toBe(true);
      expect(result3.remainingRequests).toBe(0);
    });

    it('should reject requests over rate limit', async () => {
      const config = { windowSec: 60, maxRequests: 2 };
      const identifier = 'test-key-2';

      // Exhaust rate limit
      await checkRateLimit(identifier, config);
      await checkRateLimit(identifier, config);

      // Should reject third request
      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should reset rate limit after window expires', async () => {
      const config = { windowSec: 1, maxRequests: 1 }; // 1 second window
      const identifier = 'test-key-3';

      // First request
      const result1 = await checkRateLimit(identifier, config);
      expect(result1.success).toBe(true);

      // Second request should fail
      const result2 = await checkRateLimit(identifier, config);
      expect(result2.success).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third request should succeed
      const result3 = await checkRateLimit(identifier, config);
      expect(result3.success).toBe(true);
    });

    it('should track different identifiers separately', async () => {
      const config = { windowSec: 60, maxRequests: 1 };

      // First identifier
      const result1 = await checkRateLimit('user-1', config);
      expect(result1.success).toBe(true);

      // Same identifier should fail
      const result2 = await checkRateLimit('user-1', config);
      expect(result2.success).toBe(false);

      // Different identifier should succeed
      const result3 = await checkRateLimit('user-2', config);
      expect(result3.success).toBe(true);
    });

    it('should provide accurate reset time', async () => {
      const config = { windowSec: 60, maxRequests: 1 };
      const identifier = 'test-key-4';

      const before = Math.floor(Date.now() / 1000);
      const result = await checkRateLimit(identifier, config);
      const after = Math.floor(Date.now() / 1000);

      expect(result.resetTime).toBeGreaterThan(before);
      expect(result.resetTime).toBeLessThanOrEqual(after + 60);
    });

    it('should handle concurrent requests correctly', async () => {
      const config = { windowSec: 60, maxRequests: 5 };
      const identifier = 'test-key-5';

      // Make 5 concurrent requests
      const promises = Array(5).fill(null).map(() => 
        checkRateLimit(identifier, config)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Next request should fail
      const result6 = await checkRateLimit(identifier, config);
      expect(result6.success).toBe(false);
    });

    it('should use default config when not provided', async () => {
      const identifier = 'test-key-6';

      // Should use default: 60 requests per 60 seconds
      const result = await checkRateLimit(identifier);
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(59);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty identifier', async () => {
      const config = { windowSec: 60, maxRequests: 1 };
      
      const result1 = await checkRateLimit('', config);
      expect(result1.success).toBe(true);
      
      const result2 = await checkRateLimit('', config);
      expect(result2.success).toBe(false);
    });

    it('should handle very small time windows', async () => {
      const config = { windowSec: 1, maxRequests: 1000 };
      const identifier = 'test-key-7';

      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.resetTime).toBeGreaterThan(0);
    });

    it('should handle very large request limits', async () => {
      const config = { windowSec: 60, maxRequests: 1000000 };
      const identifier = 'test-key-8';

      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(999999);
    });
  });
});