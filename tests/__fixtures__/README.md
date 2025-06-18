# Test Fixtures Documentation

This directory contains comprehensive test fixtures and mock data for the Cryptrade application.

## Directory Structure

```
__fixtures__/
├── ai/                    # AI service responses and proposals
├── api/                   # API response mocks
├── auth/                  # Authentication states and user data
├── binance/              # Binance WebSocket responses
├── chart/                # Chart data (candlesticks, patterns)
├── database/             # Database mock data
├── generators/           # Dynamic test data generators
├── indicators/           # Technical indicator data
├── market/               # Market data and edge cases
└── websocket/            # WebSocket message fixtures
```

## Usage Examples

### Basic Import

```typescript
import { 
  mockUsers, 
  mockTradingProposal,
  mockMarketDataResponses 
} from '@/tests/__fixtures__';
```

### Using Fixture Presets

```typescript
import { fixturePresets } from '@/tests/__fixtures__';

// Load a standard trading session
const session = await fixturePresets.standardSession.user();
const marketData = await fixturePresets.standardSession.marketData();
```

### Dynamic Data Generation

```typescript
import { TestDataGenerator } from '@/tests/__fixtures__/generators/test-data-generator';

const generator = new TestDataGenerator();
const users = generator.generateUsers(10);
const orders = generator.generateOrderHistory('user-123', 50);
const klines = generator.generateKlineData('BTCUSDT', '1h', 100, 'bullish');
```

### WebSocket Testing

```typescript
import { createMockWebSocket } from '@/tests/__mocks__/websocket';
import { mockWebSocketMessages } from '@/tests/__fixtures__/websocket/messages';

const ws = createMockWebSocket({ autoRespond: true });

// Simulate message sequences
ws.simulator
  .simulateConnection()
  .queueSequence('orderLifecycle')
  .start();
```

### API Mocking

```typescript
import { APIInterceptor } from '@/tests/__mocks__/mock-helpers';

const api = APIInterceptor.createMarketDataAPI();

// Or create custom routes
const customAPI = new APIInterceptor()
  .get('/api/user/:id', ({ params }) => ({
    id: params.id,
    name: 'Test User'
  }))
  .post('/api/order', () => 
    MockResponseBuilder.success({ orderId: '12345' })
  );
```

## Available Fixtures

### Authentication (`auth/user-states.ts`)
- `mockUsers`: Various user states (authenticated, admin, unverified, premium)
- `mockSessions`: Session states (valid, expired, invalid)
- `mockAuthTokens`: JWT tokens and refresh tokens
- `mockAuthResponses`: Login/logout/register responses
- `mockAuthErrors`: Common authentication errors

### API Responses (`api/responses.ts`)
- `mockMarketDataResponses`: Ticker, klines, order book, trades
- `mockTradingResponses`: Order placement, cancellation, status
- `mockAIServiceResponses`: AI analysis, proposals, chat
- `mockErrorResponses`: Standard HTTP error responses
- `mockPaginationResponses`: Paginated data responses

### Market Data (`market/edge-cases.ts`)
- `mockExtremeMarketData`: Flash crashes, zero volume, extreme volatility
- `mockEdgeCaseOrderBook`: Thin books, one-sided, spoofing, crossed
- `mockEdgeCaseTrades`: Dust trades, whale trades, HFT patterns
- `mockTimeEdgeCases`: DST transitions, leap seconds, weekend gaps

### WebSocket Messages (`websocket/messages.ts`)
- `mockTradingMessages`: Order updates, fills, cancellations
- `mockAccountMessages`: Balance updates, margin calls
- `mockSystemMessages`: Rate limits, maintenance, server time
- `mockChatMessages`: AI responses, streaming, proposals
- `mockMessageSequences`: Pre-defined message flows

## Test Helpers

### Mock Response Builder
```typescript
const response = MockResponseBuilder
  .success({ data: 'test' })
  .withDelay(100)
  .build();
```

### WebSocket Simulator
```typescript
const simulator = new WebSocketSimulator(ws)
  .simulateConnection()
  .queueEvent(mockKlineData, 1000)
  .simulateDisconnection('Network error');
```

### Time Controller
```typescript
const time = new TimeController(new Date('2024-01-01'));
time.install();
time.advance(3600000); // Advance 1 hour
```

### Scenario Runner
```typescript
const scenario = ScenarioRunner.tradingSession()
  .step('Place order', async () => {
    // Test logic
  })
  .withCleanup(async () => {
    // Cleanup
  })
  .run();
```

## Best Practices

1. **Use fixtures for consistency**: Always prefer fixtures over inline mock data
2. **Generate dynamic data when needed**: Use TestDataGenerator for large datasets
3. **Test edge cases**: Use the edge-case fixtures to ensure robustness
4. **Simulate realistic scenarios**: Use message sequences and scenario runners
5. **Clean up after tests**: Use cleanup functions in scenario runners

## Adding New Fixtures

1. Create a new file in the appropriate subdirectory
2. Export named constants for static data
3. Export generator functions for dynamic data
4. Update the main `index.ts` file to export your fixtures
5. Document complex fixtures with comments

Example:
```typescript
// tests/__fixtures__/my-feature/data.ts
export const mockFeatureData = {
  // Static fixture data
};

export const generateFeatureData = (options: any) => {
  // Dynamic data generation
};
```