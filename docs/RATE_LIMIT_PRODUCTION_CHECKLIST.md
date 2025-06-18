# Rate Limit Production Deployment Checklist

## Pre-Deployment

### 1. Environment Configuration
- [ ] Configure Redis credentials (Vercel KV or Upstash)
  ```bash
  KV_REST_API_URL=<your-kv-url>
  KV_REST_API_TOKEN=<your-kv-token>
  # OR
  UPSTASH_REDIS_REST_URL=<your-redis-url>
  UPSTASH_REDIS_REST_TOKEN=<your-redis-token>
  ```

### 2. SQLite Setup (Self-Hosted Only)
- [ ] Ensure write permissions for data directory
- [ ] Configure custom path if needed:
  ```bash
  RATE_LIMIT_DB_PATH=/var/lib/app/rate-limit.db
  ```
- [ ] Add data directory to `.gitignore`
- [ ] Set up database backups if required

### 3. Rate Limit Configuration
- [ ] Review and adjust rate limits in `middleware.ts`:
  ```typescript
  const apiMiddleware = createApiMiddleware({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100      // 100 requests per minute
  });
  ```
- [ ] Configure per-route limits if needed

## Deployment Steps

### 1. Vercel Deployment
- [ ] Add environment variables in Vercel dashboard
- [ ] Deploy with automatic Vercel KV integration
- [ ] Verify KV connection in deployment logs

### 2. Self-Hosted Deployment
- [ ] Create data directory with proper permissions:
  ```bash
  mkdir -p /var/lib/app
  chmod 755 /var/lib/app
  ```
- [ ] Deploy application
- [ ] Verify SQLite database creation
- [ ] Monitor initial requests

### 3. Docker Deployment
- [ ] Add volume for SQLite persistence:
  ```yaml
  volumes:
    - ./data:/app/data
  ```
- [ ] Set environment variable:
  ```yaml
  environment:
    - RATE_LIMIT_DB_PATH=/app/data/rate-limit.db
  ```

## Post-Deployment Verification

### 1. Test Rate Limiting
- [ ] Send test requests to verify rate limiting works
- [ ] Exceed rate limit and verify 429 responses
- [ ] Check response headers:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99
  X-RateLimit-Reset: 1234567890
  Retry-After: 60
  ```

### 2. Test Persistence
- [ ] Make requests close to rate limit
- [ ] Restart application
- [ ] Verify rate limit state persists
- [ ] Check logs for storage backend confirmation

### 3. Monitor Performance
- [ ] Check response times
- [ ] Monitor database size (SQLite)
- [ ] Verify cleanup is working
- [ ] Check error logs for fallback warnings

## Monitoring & Alerts

### 1. Key Metrics
- [ ] Rate limit hit frequency
- [ ] Storage backend failures
- [ ] Response time impact
- [ ] Database size growth (SQLite)

### 2. Log Patterns to Monitor
```
[RateLimit] SQLite persistence initialized
[RateLimit] Vercel KV unavailable, falling back
[RateLimit] Using memory fallback (not persistent across restarts)
[RateLimit] Cleaned up X expired entries
```

### 3. Alerts to Configure
- [ ] High rate of 429 responses
- [ ] Storage backend failures
- [ ] Unusual database growth
- [ ] Memory fallback usage in production

## Troubleshooting

### Common Issues

1. **SQLite Permission Errors**
   - Check directory permissions
   - Verify process user has write access
   - Try alternative path

2. **Redis Connection Failures**
   - Verify credentials
   - Check network connectivity
   - Monitor Redis service status

3. **High Memory Usage**
   - Check if falling back to memory storage
   - Verify cleanup is running
   - Review rate limit windows

4. **Performance Degradation**
   - Monitor SQLite query times
   - Check index usage
   - Consider Redis for high-traffic sites

## Rollback Plan

If issues occur:

1. **Quick Rollback**
   - Change import from `rate-limit-persistent` to `rate-limit`
   - Redeploy
   - Memory-only rate limiting will resume

2. **Data Preservation**
   - Backup SQLite database before rollback
   - Document current rate limit states
   - Plan migration back to persistent storage

## Security Considerations

- [ ] Rate limits are per IP + User-Agent
- [ ] Consider additional fingerprinting for security
- [ ] Monitor for rate limit bypass attempts
- [ ] Implement IP allowlisting if needed

## Performance Tuning

### SQLite Optimization
- [ ] Enable WAL mode for better concurrency
- [ ] Configure appropriate cache size
- [ ] Monitor vacuum frequency

### Redis Optimization
- [ ] Use connection pooling
- [ ] Configure appropriate TTLs
- [ ] Monitor memory usage

## Success Criteria

- [ ] Rate limiting enforced consistently
- [ ] State persists across restarts
- [ ] No performance degradation
- [ ] Automatic cleanup working
- [ ] Proper failover on storage errors
- [ ] Monitoring and alerts configured