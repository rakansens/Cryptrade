// Mock dependencies first
jest.mock('ioredis');
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
import Redis from 'ioredis';
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
    (Redis as any).mockImplementation(() => mockRedis);
    
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
        expect.any(Error)
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
      const { env } = require('@/config/env');
      env.RATE_LIMIT_FAIL_OPEN = 'true';
      
      mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis error'));
      
      const result = await rateLimiter.checkLimit('user123', {
        windowSec: 60,
        maxRequests: 10,
      });
      
      expect(result.success).toBe(true);
      expect(result.remainingRequests).toBe(10);
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
        expect.any(Error)
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
        expect.any(Error)
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
});