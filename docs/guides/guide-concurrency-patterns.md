# Concurrency Patterns in Cryptrade

This document describes the concurrency patterns and utilities used throughout the Cryptrade application to prevent race conditions and ensure proper cleanup of async operations.

## Overview

The application uses several concurrent execution patterns:
- WebSocket real-time data updates
- Market data fetching from multiple timeframes
- Async state management in React hooks
- Agent-to-agent communication with timeouts

## Core Utilities

### 1. `raceWithCleanup`

Replaces `Promise.race` with proper cleanup for losing promises using AbortController.

```typescript
import { raceWithCleanup } from '@/lib/utils/concurrent';

// Example: Fetch with timeout and cleanup
const result = await raceWithCleanup([
  async (signal) => {
    const response = await fetch(url, { signal });
    return response.json();
  },
  async (signal) => {
    // Alternative data source
    const response = await fetch(backupUrl, { signal });
    return response.json();
  }
], {
  timeout: 5000, // 5 second timeout
  onCleanup: (error) => {
    console.log('Cleaning up failed operation:', error);
  }
});
```

### 2. `Mutex`

Prevents concurrent access to critical sections.

```typescript
import { Mutex } from '@/lib/utils/concurrent';

const mutex = new Mutex();

// Example: Prevent concurrent state updates
async function updateCriticalState(data: any) {
  return mutex.runExclusive(async () => {
    // Only one execution at a time
    const current = await readState();
    const updated = processUpdate(current, data);
    await saveState(updated);
  });
}
```

### 3. `Semaphore`

Limits the number of concurrent operations.

```typescript
import { Semaphore } from '@/lib/utils/concurrent';

const semaphore = new Semaphore(3); // Max 3 concurrent operations

// Example: Rate-limited API calls
async function fetchUserData(userId: string) {
  return semaphore.runWithLimit(async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  });
}
```

### 4. `createDebouncedAsync`

Debounces async function calls with proper cancellation.

```typescript
import { createDebouncedAsync } from '@/lib/utils/concurrent';

// Example: Debounced search
const { execute: search, cancel } = createDebouncedAsync(
  async (query: string) => {
    const response = await fetch(`/api/search?q=${query}`);
    return response.json();
  },
  300 // 300ms debounce
);

// Usage
search('bitcoin'); // Cancelled
search('bitcoin price'); // Cancelled
search('bitcoin price usd'); // Executed after 300ms

// Cleanup
cancel(); // Cancel any pending operation
```

### 5. `StateUpdateQueue`

Ensures state updates are processed sequentially to prevent race conditions.

```typescript
import { StateUpdateQueue } from '@/lib/utils/concurrent';

// Example: Sequential WebSocket updates
const stateQueue = new StateUpdateQueue(
  initialState,
  async (newState) => {
    await persistState(newState);
    updateUI(newState);
  }
);

// Queue updates - processed in order
websocket.onmessage = (event) => {
  stateQueue.enqueue(async (currentState) => {
    const update = JSON.parse(event.data);
    return mergeUpdate(currentState, update);
  });
};
```

## Usage Patterns

### WebSocket State Management

The BinanceWebSocketManager uses mutexes to prevent race conditions:

```typescript
class BinanceWebSocketManager {
  private connectionMutex = new Mutex();
  private statusMutex = new Mutex();

  async subscribe(symbol: string, callback: PriceUpdateCallback) {
    return this.connectionMutex.runExclusive(async () => {
      // Safe connection management
      if (!this.connections.has(symbol)) {
        await this.createConnection(symbol);
      }
      // ...
    });
  }
}
```

### Safe Async Hooks

React hooks with proper cleanup and cancellation:

```typescript
export function useAsyncState<T>(asyncFn: () => Promise<T>) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Cancel any pending operations on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async () => {
    // Cancel previous execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const result = await asyncFn();
      
      // Check if still mounted and not aborted
      if (mountedRef.current && !signal.aborted) {
        setState(result);
      }
    } catch (error) {
      if (!mountedRef.current || signal.aborted) {
        return; // Don't update state
      }
      setError(error);
    }
  }, [asyncFn]);
}
```

### Multi-Timeframe Data Fetching

Fetching data from multiple sources with timeout and cancellation:

```typescript
async function fetchMultiTimeframeData(
  symbol: string,
  timeframes: TimeframeConfig[],
  signal?: AbortSignal
) {
  const fetchPromises = timeframes.map(config => 
    withTimeout(
      async (innerSignal) => {
        // Combine signals for proper cancellation
        const controller = new AbortController();
        const combinedSignal = controller.signal;
        
        const abortHandler = () => controller.abort();
        signal?.addEventListener('abort', abortHandler);
        innerSignal.addEventListener('abort', abortHandler);
        
        try {
          return await fetchTimeframeData(config, combinedSignal);
        } finally {
          // Cleanup listeners
          signal?.removeEventListener('abort', abortHandler);
          innerSignal.removeEventListener('abort', abortHandler);
        }
      },
      10000 // 10 second timeout per timeframe
    )
  );
  
  const results = await Promise.allSettled(fetchPromises);
  // Process results...
}
```

## Best Practices

1. **Always use AbortController for cancellable operations**
   - Pass AbortSignal through the entire async chain
   - Clean up event listeners to prevent memory leaks

2. **Protect shared state with Mutex**
   - Use mutex for any state that can be updated from multiple sources
   - Keep critical sections as small as possible

3. **Debounce user-triggered async operations**
   - Search queries
   - Form validation
   - Data refetching

4. **Use StateUpdateQueue for sequential updates**
   - WebSocket message handling
   - Database write operations
   - UI state synchronization

5. **Set reasonable timeouts**
   - Network requests: 10-30 seconds
   - Local operations: 1-5 seconds
   - Use exponential backoff for retries

## Migration Guide

### Replacing Promise.race

Before:
```typescript
const result = await Promise.race([
  fetchData(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 5000)
  )
]);
```

After:
```typescript
const result = await raceWithCleanup([
  (signal) => fetchData({ signal })
], {
  timeout: 5000
});
```

### Replacing setState in async operations

Before:
```typescript
const fetchData = async () => {
  const data = await api.getData();
  setState(data); // Might cause race condition
};
```

After:
```typescript
const stateQueue = new StateUpdateQueue(initialState, setState);

const fetchData = async () => {
  const data = await api.getData();
  await stateQueue.enqueue(() => data);
};
```

## Testing

The concurrent utilities come with comprehensive tests. Run them with:

```bash
npm test lib/utils/__tests__/concurrent.test.ts
```

## Performance Considerations

1. **Mutex overhead**: Minimal for UI operations, consider Semaphore for high-frequency operations
2. **AbortController**: Native browser API, very efficient
3. **StateUpdateQueue**: Adds slight delay but ensures consistency
4. **Debouncing**: Reduces overall load by preventing unnecessary operations

## Troubleshooting

### Common Issues

1. **"Operation aborted" errors**
   - Normal when component unmounts or operation is cancelled
   - Check if error handling distinguishes between abort and real errors

2. **State updates after unmount**
   - Ensure all async operations check mounted status
   - Use AbortController for proper cleanup

3. **Deadlocks with Mutex**
   - Avoid nested mutex locks
   - Keep critical sections short
   - Use timeouts for mutex acquisition if needed

4. **Memory leaks**
   - Always remove event listeners
   - Clear timeouts and intervals
   - Abort pending operations on cleanup