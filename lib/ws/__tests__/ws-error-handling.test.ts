/**
 * WSManager Error Handling Tests
 */

import { WSManager } from '../WSManager';
import { MockWebSocket, setupWebSocketMocking } from './websocket-mock';

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
  setupWebSocketMocking();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle connection errors', (done) => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 1,
      baseRetryDelay: 10
    });
    
    manager.subscribe('test@stream').subscribe({
      next: () => {},
      error: (error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('Max retry attempts');
        done();
      }
    });
    
    // Simulate error immediately
    setTimeout(() => {
      const ws = MockWebSocket.getAllInstances()[0];
      if (ws) {
        ws.simulateError(new Error('Connection failed'));
        ws.close(1006);
      }
    }, 10);
  });

  it('should handle WebSocket close events', (done) => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 0
    });
    
    manager.subscribe('test@stream').subscribe({
      next: () => {},
      error: (error) => {
        expect(error).toBeDefined();
        done();
      }
    });
    
    setTimeout(() => {
      const ws = MockWebSocket.getAllInstances()[0];
      if (ws) {
        ws.close(1000, 'Normal closure');
      }
    }, 10);
  });

  it('should retry on failure with exponential backoff', () => {
    const manager = new WSManager({
      url: 'wss://test.com',
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      maxRetryAttempts: 3
    });
    
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

  it('should cleanup on error', (done) => {
    const manager = new WSManager({
      url: 'wss://test.com',
      maxRetryAttempts: 0
    });
    
    const sub = manager.subscribe('test@stream').subscribe({
      next: () => {},
      error: () => {
        // After error, stream should be cleaned up
        setTimeout(() => {
          expect(manager.getActiveStreamsCount()).toBe(0);
          done();
        }, 50);
      }
    });
    
    // Force error
    setTimeout(() => {
      const ws = MockWebSocket.getAllInstances()[0];
      if (ws) {
        ws.simulateError(new Error('Test error'));
        ws.close(1006);
      }
    }, 10);
  });

  afterEach(() => {
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });
});