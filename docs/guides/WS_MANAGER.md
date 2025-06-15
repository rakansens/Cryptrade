# WebSocket Manager Documentation

## Overview

The WebSocket Manager (WSManager) is a complete rewrite of the WebSocket connection handling system with RxJS Observable API, designed to replace the legacy `binanceConnectionManager`. It provides connection sharing, exponential backoff with jitter, automatic cleanup, and comprehensive monitoring.

## Key Features

### 🔄 Connection Sharing
- **Same Stream → Single WebSocket**: Multiple subscriptions to the same stream share one WebSocket connection
- **Automatic Reference Counting**: Connections are closed when all subscribers unsubscribe
- **Memory Efficient**: Reduces resource usage for high-traffic applications

### 🔁 Exponential Backoff with Jitter
- **Full Jitter Strategy**: Prevents thundering herd problems during reconnection
- **30s Maximum Delay**: Configurable up to 30 seconds maximum retry delay
- **Smart Retry Logic**: Respects configurable retry attempt limits

### 🧹 Automatic Cleanup
- **5-Minute Idle Timeout**: Automatically cleans up inactive streams
- **Periodic Cleanup**: Runs every minute to maintain system health
- **Manual Cleanup**: Force cleanup API for administrative control

### 📊 Comprehensive Monitoring
- **Prometheus Metrics**: Ready-to-use metrics for monitoring systems
- **Health Checks**: Built-in health check endpoints
- **Performance Tracking**: Connection counts, retry rates, and more

## API Reference

### Constructor

```typescript
const manager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  maxRetryAttempts?: 10,        // Default: 10
  baseRetryDelay?: 1000,        // Default: 1000ms
  maxRetryDelay?: 30000,        // Default: 30000ms (30s)
  jitterRange?: 0.5,            // Default: 0.5 (not used with full jitter)
  debug?: false                 // Default: false
});
```

### Core Methods

#### `subscribe<T>(streamName: string): Observable<T>`

Subscribe to a WebSocket stream with Observable API.

```typescript
const subscription = manager.subscribe('btcusdt@trade').subscribe({
  next: (data) => console.log('Trade:', data),
  error: (error) => console.error('Stream error:', error),
  complete: () => console.log('Stream completed')
});

// Cleanup
subscription.unsubscribe();
```

#### `getConnectionStatus(): Observable<ConnectionState>`

Get real-time connection status updates.

```typescript
manager.getConnectionStatus().subscribe(status => {
  console.log('Connection status:', status); // 'disconnected' | 'connecting' | 'connected'
});
```

#### `getMetrics(): WSManagerMetrics`

Get comprehensive metrics for monitoring.

```typescript
const metrics = manager.getMetrics();
console.log('Active connections:', metrics.activeConnections);
console.log('Total retries:', metrics.retryCount);
console.log('Implementation:', metrics.implementation);
```

#### `getPrometheusMetrics(): string`

Export metrics in Prometheus format.

```typescript
const prometheus = manager.getPrometheusMetrics();
// Returns formatted metrics for Prometheus scraping
```

#### `destroy(): void`

Clean up all resources and connections.

```typescript
manager.destroy();
```

### Utility Methods

#### `getActiveStreamsCount(): number`

Get current number of active streams.

#### `getStreamInfo(): StreamInfo[]`

Get detailed information about all active streams.

#### `forceCleanupIdleStreams(idleTimeoutMs?: number): number`

Force cleanup of idle streams. Returns number of streams cleaned.

#### `getRetryDelayPreview(attempt: number): RetryDelayInfo`

Preview retry delay calculation for testing/debugging.

## Migration Guide

### From Legacy binanceConnectionManager

The WSManager provides backward compatibility through a shim layer. You can migrate gradually:

#### Step 1: Update Imports

```typescript
// Before
import { binanceConnectionManager } from '@/lib/binance/connection-manager';

// After
import { getBinanceConnection } from '@/lib/ws';
const binanceConnectionManager = getBinanceConnection();
```

#### Step 2: API Remains the Same

```typescript
// Same API, enhanced implementation
const unsubscribe = binanceConnectionManager.subscribe('btcusdt@trade', (data) => {
  console.log('Trade data:', data);
});

// Cleanup
unsubscribe();
```

#### Step 3: Enable WSManager (Optional)

Set environment variable to enable new implementation:

```bash
export USE_NEW_WS_MANAGER=true
```

### Feature Flag Control

Control implementation at runtime:

```typescript
import { connectionMigration } from '@/lib/ws';

// Switch to WSManager
connectionMigration.enableWSManager();

// Switch back to legacy
connectionMigration.enableLegacy();

// Check current implementation
console.log(connectionMigration.getCurrentImplementation()); // 'WSManager' | 'Legacy'
```

## Configuration Examples

### Production Configuration

```typescript
const manager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  maxRetryAttempts: 10,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  debug: false
});
```

### Development Configuration

```typescript
const manager = new WSManager({
  url: 'wss://testnet.binance.vision/ws/',
  maxRetryAttempts: 3,
  baseRetryDelay: 500,
  maxRetryDelay: 5000,
  debug: true
});
```

### High-Traffic Configuration

```typescript
const manager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  maxRetryAttempts: 15,
  baseRetryDelay: 100,
  maxRetryDelay: 30000,
  debug: false
});
```

## Monitoring and Observability

### Key Metrics

| Metric | Description | Type | Alert Threshold |
|--------|-------------|------|-----------------|
| `ws_manager_active_connections` | Current active connections | Gauge | > 100 |
| `ws_manager_retry_count_total` | Total retry attempts | Counter | > 0.5/sec |
| `ws_manager_stream_creations_total` | Total streams created | Counter | - |
| `ws_manager_stream_cleanups_total` | Total streams cleaned | Counter | - |
| `ws_manager_active_connections_hwm` | High water mark | Gauge | - |

### Health Checks

```bash
# Health check endpoint
curl -I http://localhost:3000/api/ws/metrics
# Returns 200 if healthy, 503 if unhealthy

# Get metrics in JSON format
curl http://localhost:3000/api/ws/metrics

# Get metrics in Prometheus format
curl http://localhost:3000/api/ws/metrics?format=prometheus
```

### Grafana Dashboard

Import the provided Grafana dashboard from `monitoring/grafana-dashboard.json` to visualize:

- Active connection counts
- Retry rates over time
- Stream lifecycle metrics
- Connection high water marks
- Error rates and alerts

## Error Handling

### Connection Errors

WSManager automatically handles connection errors with exponential backoff:

```typescript
manager.subscribe('btcusdt@trade').subscribe({
  next: (data) => {
    // Handle data
  },
  error: (error) => {
    // Connection errors are retried automatically
    // This only fires for unrecoverable errors
    console.error('Unrecoverable error:', error);
  }
});
```

### Message Format Errors

Invalid message formats are handled gracefully:

```typescript
// WSManager validates and filters messages
// Invalid messages are logged but don't crash the stream
```

### Resource Limits

Connection limits and cleanup are enforced automatically:

```typescript
// Connections are automatically cleaned up after 5 minutes of inactivity
// Manual cleanup is also available
const cleanedCount = manager.forceCleanupIdleStreams();
```

## Best Practices

### 1. Use Connection Sharing

```typescript
// Good: Multiple subscribers share one connection
const sub1 = manager.subscribe('btcusdt@trade').subscribe(handler1);
const sub2 = manager.subscribe('btcusdt@trade').subscribe(handler2);

// Both subscriptions use the same WebSocket connection
```

### 2. Proper Cleanup

```typescript
// Always unsubscribe when done
const subscription = manager.subscribe('btcusdt@trade').subscribe(handler);

// In component unmount or cleanup
subscription.unsubscribe();
```

### 3. Error Handling

```typescript
manager.subscribe('btcusdt@trade').subscribe({
  next: (data) => {
    // Handle successful data
  },
  error: (error) => {
    // Handle unrecoverable errors
    // Retryable errors are handled automatically
  },
  complete: () => {
    // Handle stream completion
  }
});
```

### 4. Monitoring Integration

```typescript
// Regularly check metrics for health
setInterval(() => {
  const metrics = manager.getMetrics();
  if (metrics.activeConnections > 100) {
    console.warn('High connection count:', metrics.activeConnections);
  }
}, 60000);
```

## Performance Characteristics

### Memory Usage
- **Base Memory**: ~50KB per WSManager instance
- **Per Connection**: ~1KB per active stream
- **Cleanup**: Automatic cleanup reduces memory leaks

### CPU Usage
- **Idle**: Minimal CPU usage when no activity
- **Active**: Scales linearly with message volume
- **Retry Logic**: Minimal overhead during reconnection

### Network Efficiency
- **Connection Sharing**: Reduces network connections by up to 90%
- **Jitter**: Prevents connection storms during outages
- **Cleanup**: Closes unused connections promptly

## Troubleshooting

### High Retry Rates

```bash
# Check retry metrics
curl http://localhost:3000/api/ws/metrics | jq '.metrics.retryCount'

# Check recent logs
grep "WSManager.*retry" /var/log/app.log | tail -20
```

### Memory Leaks

```bash
# Check active connections
curl http://localhost:3000/api/ws/metrics | jq '.metrics.activeConnections'

# Force cleanup
# (Would require admin API or direct access)
```

### Connection Issues

```bash
# Check connection status
curl http://localhost:3000/api/ws/metrics | jq '.metrics'

# Test WebSocket connectivity
wscat -c wss://stream.binance.com:9443/ws/btcusdt@trade
```

## Advanced Usage

### Custom Stream Processing

```typescript
manager.subscribe('btcusdt@trade').pipe(
  map(trade => ({
    symbol: trade.s,
    price: parseFloat(trade.p),
    timestamp: trade.T
  })),
  filter(trade => trade.price > 50000),
  debounceTime(100)
).subscribe(processedTrade => {
  console.log('High-value trade:', processedTrade);
});
```

### Multiple Managers

```typescript
// Separate managers for different purposes
const tradeManager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  debug: false
});

const depthManager = new WSManager({
  url: 'wss://stream.binance.com:9443/ws/',
  maxRetryAttempts: 5,
  debug: true
});
```

### Testing Integration

```typescript
// WSManager integrates well with testing
const manager = new WSManager({
  url: 'wss://mock-server.test:9443/ws/',
  debug: true
});

// Use in tests with proper cleanup
afterEach(() => {
  manager.destroy();
});
```

## Version History

- **v1.0.0** - Initial WSManager implementation
- **v1.1.0** - Added Prometheus metrics and health checks
- **v1.2.0** - Enhanced error handling and monitoring
- **v1.3.0** - Backward compatibility shim and migration utilities

## Support

- **Documentation**: This file and inline code documentation
- **Issues**: Report issues on the project repository
- **Monitoring**: Use provided Grafana dashboard and Prometheus metrics
- **Migration**: Follow the migration guide for gradual rollout