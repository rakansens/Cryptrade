# API Integration Tests

This directory contains integration tests for all API routes in the Cryptrade application.

## Test Coverage

### 1. AI Chat API (`/api/ai/chat`)
- Basic chat message processing
- Proposal generation requests
- Request validation
- Error handling
- Rate limiting
- Context parameter handling
- CORS preflight requests

### 2. Analysis Stream API (`/api/ai/analysis-stream`)
- SSE streaming for analysis progress
- Different analysis types (trendline, support-resistance, fibonacci, pattern, all)
- Step-by-step progress tracking
- Character-by-character text streaming
- Request parameter validation
- Error handling during streaming
- Session ID generation

### 3. Binance Klines API (`/api/binance/klines`)
- Fetching candlestick data
- Symbol validation
- Interval validation
- Limit parameter validation
- Binance API error handling
- Invalid response data handling
- Rate limiting
- Timeout handling

### 4. Binance Ticker API (`/api/binance/ticker`)
- Single ticker data fetching
- All tickers data fetching
- Symbol validation
- Binance API error handling
- Response data validation
- Rate limiting
- Network error handling

## Running Tests

### Run all API tests
```bash
npm run test:api
```

### Run tests in watch mode
```bash
npm run test:api:watch
```

### Run individual test suite
```bash
npm test -- app/api/ai/chat/__tests__/route.test.ts
npm test -- app/api/ai/analysis-stream/__tests__/route.test.ts
npm test -- app/api/binance/klines/__tests__/route.test.ts
npm test -- app/api/binance/ticker/__tests__/route.test.ts
```

### Run with coverage
```bash
npm run test:coverage -- app/api
```

## Test Structure

Each test file follows this structure:
1. Environment setup with `mockTestEnv()`
2. Mock external dependencies
3. Test suites organized by HTTP method
4. Individual test cases for different scenarios
5. Cleanup after tests

## Common Test Utilities

The `test-utils.ts` file provides:
- Mock data generators for all data types
- Request builders for GET/POST requests
- Response helpers for parsing JSON and SSE events
- Mock fetch helper for simulating external API calls
- Test environment helpers

## Writing New Tests

When adding new API routes:
1. Create a `__tests__` directory in the route folder
2. Create a `route.test.ts` file
3. Import and use the mock environment setup
4. Mock external dependencies
5. Write tests covering:
   - Success cases
   - Validation errors
   - External API errors
   - Rate limiting
   - Edge cases

## Debugging Tests

To debug failing tests:
1. Run tests with verbose output: `npm test -- --verbose`
2. Use `console.log` in tests to inspect data
3. Check mock implementations are returning expected data
4. Verify environment variables are properly mocked
5. Use `test.only` to run a single test in isolation

## Best Practices

1. Always mock external dependencies (fetch, database, etc.)
2. Test both success and error paths
3. Validate response structure and status codes
4. Test rate limiting behavior
5. Use realistic mock data
6. Keep tests isolated and independent
7. Clean up after each test
8. Use descriptive test names