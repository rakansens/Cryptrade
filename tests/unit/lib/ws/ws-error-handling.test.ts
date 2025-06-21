/**
 * WSManager Error Handling Tests
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, setupWebSocketMocking } from '@/lib/ws/websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager Error Handling', () => {
  const cleanupMock = setupWebSocketMocking();
  let managers: WSManager[] = [];
  
  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    managers = [];
  });

  it('should handle connection errors', async () => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 1,
      baseRetryDelay: 10
    });
    managers.push(manager);
    
    // Create a promise that resolves when error is received
    const errorReceived = new Promise<void>((resolve) => {
      manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: (error) => {
          expect(error).toBeDefined();
          expect(error.message).toContain('Max retry attempts');
          resolve();
        }
      });
    });
    
    // Simulate error immediately
    await new Promise(resolve => setTimeout(resolve, 50));
    const ws = MockWebSocket.getAllInstances()[0];
    if (ws) {
      ws.simulateError(new Error('Connection failed'));
      ws.close(1006);
    }
    
    // Wait for error
    await errorReceived;
  }, 10000);

  it('should handle WebSocket close events', async () => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 0
    });
    managers.push(manager);
    
    // Create a promise that resolves when error is received
    const errorReceived = new Promise<void>((resolve) => {
      manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: (error) => {
          expect(error).toBeDefined();
          resolve();
        }
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    const ws = MockWebSocket.getAllInstances()[0];
    if (ws) {
      ws.close(1000, 'Normal closure');
    }
    
    // Wait for error
    await errorReceived;
  }, 10000);

  it('should retry on failure with exponential backoff', () => {
    const manager = new WSManager({
      url: 'wss://test.com',
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      maxRetryAttempts: 3
    });
    managers.push(manager);
    
    // Test retry delay calculation
    const delay1 = manager.getRetryDelayPreview(1);
    const delay2 = manager.getRetryDelayPreview(2);
    const delay3 = manager.getRetryDelayPreview(3);
    
    expect(delay1.exponentialDelay).toBe(200); // 100 * 2^1
    expect(delay2.exponentialDelay).toBe(400); // 100 * 2^2
    expect(delay3.exponentialDelay).toBe(800); // 100 * 2^3
    
    // All should be within bounds
    expect(delay1.clampedDelay).toBeLessThanOrEqual(1000);
    expect(delay2.clampedDelay).toBeLessThanOrEqual(1000);
    expect(delay3.clampedDelay).toBeLessThanOrEqual(1000);
    
    manager.destroy();
  });

  it('should handle invalid stream names gracefully', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    managers.push(manager);
    
    // Subscribe with empty stream name
    const sub = manager.subscribe('').subscribe({
      next: () => {},
      error: () => {}
    });
    
    // Should still create a connection
    expect(manager.getActiveStreamsCount()).toBe(1);
    
    sub.unsubscribe();
    manager.destroy();
  });

  it('should cleanup on error', async () => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 0
    });
    managers.push(manager);
    
    // Create a promise that resolves when cleanup is confirmed
    const cleanupConfirmed = new Promise<void>((resolve) => {
      manager.subscribe('test@stream').subscribe({
        next: () => {},
        error: () => {
          // After error, stream should be cleaned up
          setTimeout(() => {
            expect(manager.getActiveStreamsCount()).toBe(0);
            resolve();
          }, 100);
        }
      });
    });
    
    // Force error
    await new Promise(resolve => setTimeout(resolve, 50));
    const ws = MockWebSocket.getAllInstances()[0];
    if (ws) {
      ws.simulateError(new Error('Test error'));
      ws.close(1006);
    }
    
    // Wait for cleanup
    await cleanupConfirmed;
  }, 10000);

  afterEach(() => {
    // Clean up all managers
    managers.forEach(manager => manager.destroy());
    managers = [];
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });
});