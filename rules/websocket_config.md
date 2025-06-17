# WebSocket Configuration

## WebSocket Architecture

### 1. Core WebSocket Manager (lib/ws/WSManager.ts)
- **Framework**: RxJS-based WebSocket management
- **Features**:
  - Observable pattern for reactive streams
  - Connection sharing with `shareReplay`
  - Automatic reconnection with exponential backoff
  - Full jitter strategy to prevent thundering herd
  - Resource cleanup with periodic idle connection removal
  - Metrics collection for monitoring

### 2. Binance WebSocket Integration
Two implementations for Binance market data:

#### a) BinanceWebSocketManager (lib/binance/websocket-manager.ts)
- Direct WebSocket connection to Binance
- Symbol-based subscription management
- Heartbeat monitoring
- Automatic reconnection with exponential backoff

#### b) BinanceConnectionManager (lib/binance/connection-manager.ts)
- Multi-stream WebSocket management
- Message validation with type safety
- Rate-limited logging for errors
- Security checks for trusted domains

### 3. Server-Sent Events (SSE) Support
- **SSE Handler Factory** (lib/api/create-sse-handler.ts)
  - Unified SSE streaming interface
  - Heartbeat support
  - Buffer management
  - CORS configuration
  - Event broadcasting capabilities

- **Streaming API** (lib/api/streaming.ts)
  - StreamingResponseBuilder for SSE responses
  - Progress tracking
  - Text streaming with effects
  - Transform streams for event processing

## Real-time Data Sources

### 1. Market Data
- **Binance Trade Stream**: Real-time trade updates
- **Binance Kline Stream**: Candlestick data updates
- **Binance Depth Stream**: Order book updates

### 2. Application Events
- **Analysis Progress**: Real-time analysis status updates
- **Chat Streaming**: AI response streaming
- **Chart Updates**: Real-time chart data synchronization

## Connection Management Strategies

### 1. Automatic Reconnection
- **Exponential Backoff**: Base delay of 1s, max 30s
- **Full Jitter**: Random delay between 0 and calculated delay
- **Max Retry Attempts**: Configurable (default: 10)
- **Connection State Tracking**: Observable connection status

### 2. Resource Management
- **Connection Pooling**: Shared connections for same streams
- **Reference Counting**: Automatic cleanup when no subscribers
- **Idle Timeout**: 5-minute idle connection cleanup
- **Memory Management**: Periodic garbage collection hints

### 3. Browser Lifecycle
- **Page Visibility**: Pause/resume on visibility changes
- **Unload Handling**: Cleanup on page unload
- **Mobile Optimization**: Special handling for mobile browsers

## Error Handling and Reconnection

### 1. Error Recovery
```typescript
// Retry configuration
{
  maxRetryAttempts: 10,
  baseRetryDelay: 1000,  // 1 second
  maxRetryDelay: 30000,  // 30 seconds
  jitterRange: 0.5
}
```

### 2. Error Types
- **Connection Errors**: Automatic retry with backoff
- **Parse Errors**: Logged and skipped
- **Handler Errors**: Isolated to prevent cascade failures
- **Validation Errors**: Rate-limited logging

### 3. Monitoring & Alerting
- **Metrics Collection**:
  - Active connections
  - Retry attempts
  - Stream creations/cleanups
  - High water marks
- **Prometheus Format**: Export metrics for monitoring systems

## Performance Considerations

### 1. Optimization Strategies
- **Message Buffering**: Configurable buffer sizes
- **Rate Limiting**: Prevent log spam
- **Lazy Initialization**: Connect only when needed
- **Connection Reuse**: Share WebSocket connections

### 2. Memory Management
- **Automatic Cleanup**: Remove idle connections
- **Event Listener Management**: Proper cleanup on disconnect
- **Stream Completion**: Finalize handlers for resource cleanup

### 3. Network Efficiency
- **Compression**: WebSocket compression support
- **Heartbeat**: Keep-alive mechanism
- **Batch Updates**: Aggregate messages when possible

### 4. Security Measures
- **Domain Whitelisting**: Only connect to trusted domains
- **Rate Limiting**: Prevent DoS through excessive reconnections
- **Error Sanitization**: Don't expose internal errors in production

## Usage Examples

### WebSocket Subscription
```typescript
const wsManager = new WSManager({ url: 'wss://stream.binance.com:9443/ws' });
const subscription = wsManager.subscribe<TradeData>('btcusdt@trade')
  .subscribe(data => console.log('Trade:', data));
```

### SSE Streaming
```typescript
const sseHandler = createSSEHandler({
  handler: {
    onConnect: async ({ stream }) => {
      stream.write({ event: 'data', data: { value: 42 } });
    }
  },
  heartbeat: { enabled: true, interval: 30000 }
});
```