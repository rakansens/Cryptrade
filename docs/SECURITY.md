# Security Configuration

## API Authentication

The application now includes built-in API authentication to secure your endpoints.

### Enabling Authentication

1. Generate a secure API key:
   ```bash
   npm run generate:api-key
   ```

2. Add the generated key to your `.env.local` file:
   ```env
   API_AUTH_ENABLED=true
   API_AUTH_SECRET=your-generated-api-key-here
   ```

3. Restart your application to apply the changes.

### Making Authenticated Requests

Include the API key in the Authorization header:

```bash
curl -H "Authorization: Bearer your-api-key-here" http://localhost:3000/api/your-endpoint
```

### Public Endpoints

The following endpoints are accessible without authentication:
- `/api/health/*` - Health check endpoints
- `/api/binance/ticker` - Public market data

### Security Features

1. **Timing-safe comparison**: Prevents timing attacks on API key validation
2. **Rate limiting**: Protects against brute force and DoS attacks
3. **CORS protection**: Restricts cross-origin requests
4. **Security headers**: Implements best practices for HTTP security headers

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_AUTH_ENABLED` | Enable API authentication | No | `false` |
| `API_AUTH_SECRET` | Secret key for API authentication (min 32 chars) | Yes (if enabled) | - |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | No | `*` (dev only) |

## Rate Limiting

The API includes built-in rate limiting:

- Default: 100 requests per minute per IP
- Configurable per endpoint
- Headers included in response:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets
  - `Retry-After`: Seconds until next request allowed (on 429 response)

## Security Best Practices

1. **Never commit API keys**: Always use environment variables
2. **Use HTTPS in production**: Ensure all API traffic is encrypted
3. **Rotate keys regularly**: Generate new API keys periodically
4. **Monitor access logs**: Check for suspicious activity
5. **Keep dependencies updated**: Run `npm audit` regularly

## Dependency Security

To check for vulnerabilities:
```bash
npm audit
```

To automatically fix vulnerabilities:
```bash
npm audit fix
```

For breaking changes:
```bash
npm audit fix --force
```

## Reporting Security Issues

If you discover a security vulnerability, please email security@cryptrade.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)