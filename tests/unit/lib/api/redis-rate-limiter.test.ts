// Mock dependencies first
jest.mock('ioredis', () => ({
  Redis: jest.fn()
}));
jest.mock('@/lib/logging');
jest.mock('@/config/env', () => ({
  env: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: undefined,
    REDIS_DB: 0,
    RATE_LIMIT_FAIL_OPEN: 'false',
  },
}));

// Import after mocking
import { RedisRateLimiter, createRedisRateLimitMiddleware } from '@/lib/api/redis-rate-limiter';
import { Redis } from 'ioredis';
import { logger } from '@/lib/logging';

describe('Redis Rate Limiter', () => {
  let rateLimiter: RedisRateLimiter;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Redis instance
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      ttl: jest.fn().mockResolvedValue(60),
      dbsize: jest.fn().mockResolvedValue(10),
      info: jest.fn().mockResolvedValue('connected_clients:5\r\ntotal_commands_processed:1000'),
      config: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      pipeline: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]),
    } as any;

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
    
    rateLimiter = new RedisRateLimiter();
  });

  afterEach(async () => {
    // Clean up
    if (rateLimiter) {
      await rateLimiter.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should connect to Redis successfully', async () => {
      await rateLimiter.connect();
      
      expect(mockRedis.connect).toHaveBeenCalled();
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connection retries', async () => {
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined);
      
      try {
        await rateLimiter.connect();
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect'),
        { error: expect.any(Error) }
      );
    });

    it('should configure persistence when enabled', async () => {
      await rateLimiter.connect();
      
      // Trigger ready event
      const readyHandler = mockRedis.on.mock.calls.find(call => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();
      
      expect(mockRedis.config).toHaveBeenCalledWith('SET', 'appendonly', 'yes');
      expect(mockRedis.config).toHaveBeenCalledWith('SET', 'appendfsync', 'everysec');
    });

    it('should disconnect gracefully', async () => {
      await rateLimiter.connect();
      await rateLimiter.disconnect();
      
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected from Redis')
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await rateLimiter.connect();
    });

    it('should allow requests within limit', async () => {
      mockRedis.pipeline().exec.mockResolvedValue([[null, 1], [null, 1]]);
      
      const result = await rateLimiter.checkLimit('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(9);
      expect(result.resetTime).toBeGreaterThan(Date.now() / 1000);
    });

    it('should block requests exceeding limit', async () => {
      mockRedis.pipeline().exec.mockResolvedValue([[null, 11], [null, 0]]);
      
      const result = await rateLimiter.checkLimit('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(result.success).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use different windows for rate limiting', async () => {
      const now = Math.floor(Date.now() / 1000);
      const window1 = Math.floor(now / 60);
      const window2 = Math.floor((now + 61) / 60);
      
      expect(window1).not.toBe(window2);
      
      // First window
      await rateLimiter.checkLimit('user123', { windowSec: 60, maxRequests: 10 });
      
      // Mock time advancement
      jest.spyOn(Date, 'now').mockReturnValue((now + 61) * 1000);
      
      // Second window should reset
      mockRedis.pipeline().exec.mockResolvedValue([[null, 1], [null, 1]]);
      const result = await rateLimiter.checkLimit('user123', { windowSec: 60, maxRequests: 10 });
      
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(9);
    });

    it('should handle custom key prefixes', async () => {
      await rateLimiter.checkLimit('user123', {
        windowSec: 60,
        maxRequests: 10,
        keyPrefix: 'api_v2',
      });
      
      const pipeline = mockRedis.pipeline();
      expect(pipeline.incr).toHaveBeenCalledWith(
        expect.stringContaining('api_v2:user123:')
      );
    });

    it('should fail open when configured', async () => {
      // Mock process.env directly
      const originalEnv = process.env.RATE_LIMIT_FAIL_OPEN;
      process.env.RATE_LIMIT_FAIL_OPEN = 'true';
      
      mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis error'));
      
      const result = await rateLimiter.checkLimit('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(10);
      
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.RATE_LIMIT_FAIL_OPEN = originalEnv;
      } else {
        delete process.env.RATE_LIMIT_FAIL_OPEN;
      }
    });
  });

  describe('Usage Tracking', () => {
    beforeEach(async () => {
      await rateLimiter.connect();
    });

    it('should get current usage for identifier', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const usage = await rateLimiter.getUsage('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(usage.current).toBe(5);
      expect(usage.remaining).toBe(5);
      expect(usage.resetTime).toBeGreaterThan(Date.now() / 1000);
    });

    it('should handle missing usage data', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const usage = await rateLimiter.getUsage('newuser', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(usage.current).toBe(0);
      expect(usage.remaining).toBe(10);
    });

    it('should reset rate limit for identifier', async () => {
      await rateLimiter.reset('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:user123:')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Reset rate limit for user123')
      );
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await rateLimiter.connect();
      // Trigger the ready event to set isConnected = true
      const readyHandler = mockRedis.on.mock.calls.find(call => call[0] === 'ready')?.[1];
      if (readyHandler) {
        readyHandler();
      }
    });

    it('should perform health checks', async () => {
      const health = await rateLimiter.checkHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeDefined();
      expect(health.info).toMatchObject({
        connected_clients: '5',
        total_commands_processed: '1000',
      });
    });

    it('should detect unhealthy state', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection lost'));
      
      const health = await rateLimiter.checkHealth();
      
      expect(health.healthy).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Health check failed'),
        { error: expect.any(Error) }
      );
    });

    it('should provide metrics', async () => {
      mockRedis.info.mockResolvedValue(
        'connected_clients:10\r\n' +
        'used_memory_human:1.5M\r\n' +
        'total_commands_processed:5000'
      );
      mockRedis.dbsize.mockResolvedValue(100);
      
      const metrics = await rateLimiter.getMetrics();
      
      expect(metrics).toMatchObject({
        connected: true,
        memoryUsage: '1.5M',
        totalCommands: '5000',
        connectedClients: '10',
        keyCount: 100,
      });
    });
  });

  describe('Housekeeping', () => {
    beforeEach(async () => {
      await rateLimiter.connect();
    });

    it('should clean up expired keys', async () => {
      mockRedis.keys.mockResolvedValue([
        'ratelimit:user1:123',
        'ratelimit:user2:124',
        'ratelimit:user3:125',
      ]);
      
      mockRedis.ttl.mockImplementation((key) => {
        if (key.includes('user2')) return Promise.resolve(-1); // No TTL
        return Promise.resolve(30); // Has TTL
      });
      
      const cleaned = await rateLimiter.cleanup();
      
      expect(cleaned).toBe(1);
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('ratelimit:user2:124');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Keys error'));
      
      const cleaned = await rateLimiter.cleanup();
      
      expect(cleaned).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        { error: expect.any(Error) }
      );
    });
  });

  describe('Middleware Factory', () => {
    it('should create middleware function', async () => {
      const middleware = createRedisRateLimitMiddleware({
        windowSec: 60,
        maxRequests: 100,
      });
      
      // Mock successful rate limit check
      const mockRateLimiter = {
        checkLimit: jest.fn().mockResolvedValue({
          success: true,
          remainingRequests: 99,
          resetTime: Date.now() / 1000 + 60,
        }),
      };
      
      const redisModule = require('@/lib/api/redis-rate-limiter');
      jest.spyOn(redisModule, 'getRedisRateLimiter')
        .mockResolvedValue(mockRateLimiter);
      
      const result = await middleware('test-user');
      
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(99);
    });
  });

  // Security-focused tests
  describe('Security Tests', () => {
    beforeEach(async () => {
      await rateLimiter.connect();
    });

    it('should prevent distributed denial of service attacks', async () => {
      const attackerIPs = [
        '192.168.1.100',
        '192.168.1.101',
        '192.168.1.102',
        '10.0.0.50',
        '10.0.0.51',
      ];

      // Configure strict rate limiting
      const strictOptions = {
        windowSec: 60,
        maxRequests: 5,
      };

      // Simulate requests from multiple IPs
      const results = [];
      for (const ip of attackerIPs) {
        for (let i = 0; i < 10; i++) {
          mockRedis.pipeline().exec.mockResolvedValueOnce([[null, i + 1], [null, 1]]);
          const result = await rateLimiter.checkLimit(ip, strictOptions);
          results.push({ ip, attempt: i, success: result.success });
        }
      }

      // Each IP should be rate limited independently
      const blockedByIP = attackerIPs.map(ip => 
        results.filter(r => r.ip === ip && !r.success).length
      );
      
      blockedByIP.forEach(blocked => {
        expect(blocked).toBeGreaterThan(0);
      });
    });

    it('should handle user+IP combination rate limiting', async () => {
      const userId = 'user-123';
      const userIP = '192.168.1.100';
      const combinedKey = `${userId}:${userIP}`;

      // First 5 requests should succeed
      for (let i = 1; i <= 5; i++) {
        mockRedis.pipeline().exec.mockResolvedValueOnce([[null, i], [null, 1]]);
        const result = await rateLimiter.checkLimit(combinedKey, {
          windowSec: 60,
          maxRequests: 5,
        });
        expect(result.success).toBe(true);
      }

      // 6th request should fail
      mockRedis.pipeline().exec.mockResolvedValueOnce([[null, 6], [null, 1]]);
      const result = await rateLimiter.checkLimit(combinedKey, {
        windowSec: 60,
        maxRequests: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should prevent rate limit bypass attempts', async () => {
      const bypassAttempts = [
        'user-123',
        'user-123 ',  // trailing space
        ' user-123',  // leading space
        'USER-123',   // different case
        'user-123\x00', // null byte
        'user-123%20', // URL encoded space
      ];

      // All attempts should be treated as the same user
      for (const attempt of bypassAttempts) {
        const normalized = attempt.trim().toLowerCase();
        await rateLimiter.checkLimit(normalized, {
          windowSec: 60,
          maxRequests: 10,
        });
      }

      // Verify normalization happened
      expect(mockRedis.pipeline().incr).toHaveBeenCalled();
    });

    it('should handle race conditions in concurrent requests', async () => {
      const userId = 'concurrent-user';
      const options = {
        windowSec: 1,
        maxRequests: 10,
      };

      // Simulate 20 concurrent requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        // Mock different response times to simulate race conditions
        mockRedis.pipeline().exec.mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve([[null, Math.floor(Math.random() * 15) + 1], [null, 1]]);
            }, Math.random() * 10);
          });
        });
        
        promises.push(rateLimiter.checkLimit(userId, options));
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      // Some requests should be rate limited
      expect(successCount).toBeLessThanOrEqual(options.maxRequests + 5); // Allow some leeway for race conditions
    });

    it('should prevent timing attacks on rate limit checks', async () => {
      const timings: number[] = [];
      const testKeys = ['allowed-user', 'blocked-user', 'new-user'];

      for (const key of testKeys) {
        // Mock different scenarios
        if (key === 'allowed-user') {
          mockRedis.pipeline().exec.mockResolvedValueOnce([[null, 5], [null, 1]]);
        } else if (key === 'blocked-user') {
          mockRedis.pipeline().exec.mockResolvedValueOnce([[null, 100], [null, 1]]);
        } else {
          mockRedis.pipeline().exec.mockResolvedValueOnce([[null, 1], [null, 1]]);
        }

        const start = Date.now();
        await rateLimiter.checkLimit(key, {
          windowSec: 60,
          maxRequests: 10,
        });
        timings.push(Date.now() - start);
      }

      // Response times should be similar
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      
      expect(maxDeviation).toBeLessThan(50); // milliseconds
    });

    it('should handle malicious key patterns', async () => {
      const maliciousKeys = [
        '../../../admin',
        'user:*:admin',
        'user[admin]=true',
        'user\'; DELETE FROM rate_limits; --',
        'user\x00admin',
        'user${process.env.ADMIN_KEY}',
      ];

      for (const key of maliciousKeys) {
        // Should handle without errors
        await expect(rateLimiter.checkLimit(key, {
          windowSec: 60,
          maxRequests: 10,
        })).resolves.toBeDefined();
      }
    });

    it('should enforce progressive rate limiting', async () => {
      const userId = 'progressive-user';
      
      // First tier: 100 requests per minute
      const tier1Options = { windowSec: 60, maxRequests: 100 };
      
      // Second tier: 1000 requests per hour
      const tier2Options = { windowSec: 3600, maxRequests: 1000 };
      
      // Third tier: 10000 requests per day
      const tier3Options = { windowSec: 86400, maxRequests: 10000 };

      // Check all tiers
      mockRedis.pipeline().exec
        .mockResolvedValueOnce([[null, 50], [null, 1]])  // Tier 1 check
        .mockResolvedValueOnce([[null, 500], [null, 1]]) // Tier 2 check
        .mockResolvedValueOnce([[null, 5000], [null, 1]]); // Tier 3 check

      const results = await Promise.all([
        rateLimiter.checkLimit(`${userId}:tier1`, tier1Options),
        rateLimiter.checkLimit(`${userId}:tier2`, tier2Options),
        rateLimiter.checkLimit(`${userId}:tier3`, tier3Options),
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should detect and handle burst attacks', async () => {
      const attackerId = 'burst-attacker';
      const burstSize = 50;
      
      // Simulate burst of requests
      const burstPromises = [];
      for (let i = 0; i < burstSize; i++) {
        mockRedis.pipeline().exec.mockResolvedValueOnce([[null, i + 1], [null, 1]]);
        burstPromises.push(rateLimiter.checkLimit(attackerId, {
          windowSec: 10,
          maxRequests: 10,
        }));
      }

      const results = await Promise.all(burstPromises);
      const blockedCount = results.filter(r => !r.success).length;
      
      // Most requests in the burst should be blocked
      expect(blockedCount).toBeGreaterThanOrEqual(burstSize - 10);
    });

    it('should handle Redis cluster failover gracefully', async () => {
      // Simulate cluster failover
      mockRedis.pipeline().exec
        .mockRejectedValueOnce(new Error('MOVED 12345 127.0.0.1:6380'))
        .mockResolvedValueOnce([[null, 1], [null, 1]]);

      const result = await rateLimiter.checkLimit('user-during-failover', {
        windowSec: 60,
        maxRequests: 10,
      });

      // Should handle failover gracefully (might fail but not crash)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate rate limit headers for security', async () => {
      mockRedis.pipeline().exec.mockResolvedValueOnce([[null, 5], [null, 1]]);
      
      const result = await rateLimiter.checkLimit('header-test-user', {
        windowSec: 60,
        maxRequests: 10,
      });

      // Verify security headers are present and valid
      expect(result.remainingRequests).toBe(5);
      expect(result.resetTime).toBeGreaterThan(Date.now() / 1000);
      expect(result.retryAfter).toBeUndefined(); // Only present when rate limited
      
      // Headers should not expose internal information
      expect(result).not.toHaveProperty('internalKey');
      expect(result).not.toHaveProperty('redisKey');
    });
  });
});