import { checkRateLimit, cleanupRateLimiter } from '@/lib/api/rate-limit-persistent';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Rate Limit Persistence Integration', () => {
  const TEST_DB_PATH = './test-data/rate-limit-test.db';
  const TEST_IDENTIFIER = 'integration-test-user';
  const TEST_CONFIG = {
    windowSec: 60,
    maxRequests: 3
  };

  beforeAll(async () => {
    // Set test database path
    process.env.RATE_LIMIT_DB_PATH = TEST_DB_PATH;
    
    // Ensure test directory exists
    const dir = path.dirname(TEST_DB_PATH);
    await fs.mkdir(dir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    await cleanupRateLimiter();
    
    // Remove test database
    try {
      await fs.unlink(TEST_DB_PATH);
      await fs.rmdir(path.dirname(TEST_DB_PATH));
    } catch {
      // Ignore errors if files don't exist
    }
    
    // Reset environment
    delete process.env.RATE_LIMIT_DB_PATH;
  });

  beforeEach(async () => {
    // Clean up any existing database
    try {
      await fs.unlink(TEST_DB_PATH);
    } catch {
      // Ignore if doesn't exist
    }
  });

  it('should persist rate limits to SQLite database', async () => {
    // Make some requests
    const result1 = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    expect(result1.success).toBe(true);
    expect(result1.remainingRequests).toBe(2);

    const result2 = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    expect(result2.success).toBe(true);
    expect(result2.remainingRequests).toBe(1);

    // Verify database was created
    const dbExists = await fs.access(TEST_DB_PATH).then(() => true).catch(() => false);
    expect(dbExists).toBe(true);

    // Close connections (simulate server shutdown)
    await cleanupRateLimiter();

    // Make another request (simulating server restart)
    const result3 = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    expect(result3.success).toBe(true);
    expect(result3.remainingRequests).toBe(0);

    // Fourth request should be rate limited
    const result4 = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    expect(result4.success).toBe(false);
    expect(result4.retryAfter).toBeGreaterThan(0);
  });

  it('should handle database initialization errors gracefully', async () => {
    // Set invalid database path
    process.env.RATE_LIMIT_DB_PATH = '/invalid/path/that/does/not/exist/rate-limit.db';

    // Should fall back to memory storage
    const result = await checkRateLimit('test-user', TEST_CONFIG);
    expect(result.success).toBe(true);

    // Reset
    process.env.RATE_LIMIT_DB_PATH = TEST_DB_PATH;
  });

  it('should clean up expired entries', async () => {
    const shortWindowConfig = {
      windowSec: 1, // 1 second window
      maxRequests: 1
    };

    // Create a rate limit entry
    const result1 = await checkRateLimit('cleanup-test', shortWindowConfig);
    expect(result1.success).toBe(true);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Make another request to trigger cleanup
    const result2 = await checkRateLimit('cleanup-test-2', shortWindowConfig);
    expect(result2.success).toBe(true);

    // Original entry should be cleaned up and new request should succeed
    const result3 = await checkRateLimit('cleanup-test', shortWindowConfig);
    expect(result3.success).toBe(true);
  });
});