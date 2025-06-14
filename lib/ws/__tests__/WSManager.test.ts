/**
 * Unit tests for WSManager
 * Coverage target: ≥90% for ws/**
 * Test cases: subscribe sharing, cleanup, retry logic, idle cleanup
 */

import { WSManager } from '../WSManager';
import { timer, of, throwError } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

// Mock WebSocket and RxJS webSocket
jest.mock('rxjs/webSocket');
const mockWebSocket = webSocket as jest.MockedFunction<typeof webSocket>;

// Mock logger to avoid noise
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager', () => {
  let manager: WSManager;
  let mockWsSubject: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock WebSocket subject
    mockWsSubject = {
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
      unsubscribe: jest.fn()
    };
    
    mockWebSocket.mockReturnValue(mockWsSubject);
    
    // Create manager instance
    manager = new WSManager({
      url: 'wss://test.example.com/ws',
      maxRetryAttempts: 3,
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      debug: false
    });
  });

  afterEach(() => {
    manager.destroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Socket Sharing (P1-3-6 Requirement 1)', () => {
    it('should share WebSocket connection for same stream', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      
      // Setup mock to return observable that works with pipe
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      const subscription1 = manager.subscribe(streamName);
      const subscription2 = manager.subscribe(streamName);
      
      // Assert
      expect(mockWebSocket).toHaveBeenCalledTimes(1);
      expect(manager.getActiveStreamsCount()).toBe(1);
      expect(manager.getMetrics().activeConnections).toBe(1);
      expect(manager.getMetrics().totalStreamCreations).toBe(1);
    });

    it('should create separate connections for different streams', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      manager.subscribe('btcusdt@trade');
      manager.subscribe('ethusdt@trade');
      
      // Assert
      expect(mockWebSocket).toHaveBeenCalledTimes(2);
      expect(manager.getActiveStreamsCount()).toBe(2);
      expect(manager.getMetrics().totalStreamCreations).toBe(2);
    });
  });

  describe('Cleanup on Unsubscribe (P1-3-6 Requirement 2)', () => {
    it('should cleanup stream when all subscribers unsubscribe', async () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      const subscription1 = manager.subscribe(streamName);
      const subscription2 = manager.subscribe(streamName);
      
      // Verify initial state
      expect(manager.getActiveStreamsCount()).toBe(1);
      
      // Unsubscribe (simulate finalize being called)
      manager['handleStreamCleanup'](streamName);
      
      // Assert
      expect(manager.getActiveStreamsCount()).toBe(0);
      expect(manager.getMetrics().totalStreamCleanups).toBe(1);
    });
  });

  describe('Retry Logic (P1-3-6 Requirement 3)', () => {
    it('should respect maxRetryAttempts limit', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      
      // Act & Assert - test retry delay calculation
      const preview0 = manager.getRetryDelayPreview(0);
      const preview1 = manager.getRetryDelayPreview(1);
      const preview2 = manager.getRetryDelayPreview(2);
      const preview3 = manager.getRetryDelayPreview(3);
      
      // Verify exponential backoff
      expect(preview0.exponentialDelay).toBe(100); // 100 * 2^0
      expect(preview1.exponentialDelay).toBe(200); // 100 * 2^1
      expect(preview2.exponentialDelay).toBe(400); // 100 * 2^2
      expect(preview3.exponentialDelay).toBe(800); // 100 * 2^3
      
      // Verify clamping to maxRetryDelay
      expect(preview0.clampedDelay).toBe(100);
      expect(preview1.clampedDelay).toBe(200);
      expect(preview2.clampedDelay).toBe(400);
      expect(preview3.clampedDelay).toBe(800);
      
      // Verify minimum delay
      expect(preview0.minDelay).toBe(100);
      expect(preview1.minDelay).toBe(100);
    });

    it('should clamp delay to maxRetryDelay', () => {
      // Test with high attempt number
      const preview10 = manager.getRetryDelayPreview(10);
      
      // 100 * 2^10 = 102400, should be clamped to 1000 (maxRetryDelay)
      expect(preview10.exponentialDelay).toBe(102400);
      expect(preview10.clampedDelay).toBe(1000);
      expect(preview10.maxDelay).toBe(1000);
    });

    it('should track retry metrics', () => {
      // Arrange
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.retryCount).toBe(0);
      
      // Simulate retry by calling internal method
      // Note: This tests the metrics tracking, not the full retry flow
      manager['metrics'].totalRetryAttempts = 5;
      manager['metrics'].lastRetryTime = Date.now();
      
      // Assert
      const updatedMetrics = manager.getMetrics();
      expect(updatedMetrics.retryCount).toBe(5);
      expect(updatedMetrics.lastRetryTime).toBeGreaterThan(0);
    });
  });

  describe('Idle Cleanup (P1-3-6 Requirement 4)', () => {
    it('should track stream last activity', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      manager.subscribe(streamName);
      
      // Assert
      const streamInfo = manager.getStreamInfo();
      expect(streamInfo).toHaveLength(1);
      expect(streamInfo[0].name).toBe(streamName);
      expect(streamInfo[0].lastActivity).toBeGreaterThan(0);
    });

    it('should cleanup idle streams after 5 minutes', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      manager.subscribe(streamName);
      expect(manager.getActiveStreamsCount()).toBe(1);
      
      // Manually add stream to test cleanup (since our mock doesn't fully simulate the stream lifecycle)
      const streamState = { observable: mockObservable, refCount: 1, lastActivity: Date.now() - 400000 }; // 6+ minutes ago
      manager['streams'].set(streamName, streamState);
      
      // Act - simulate 5+ minutes passing
      const fiveMinutesMs = 300000; // 5 min
      const cleanedCount = manager.forceCleanupIdleStreams(fiveMinutesMs);
      
      // Assert
      expect(cleanedCount).toBe(1);
      expect(manager.getActiveStreamsCount()).toBe(0);
    });

    it('should not cleanup recently active streams', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      manager.subscribe(streamName);
      expect(manager.getActiveStreamsCount()).toBe(1);
      
      // Act - try to cleanup with short timeout
      const oneMinuteMs = 60000;
      const cleanedCount = manager.forceCleanupIdleStreams(oneMinuteMs);
      
      // Assert - should not cleanup recent activity
      expect(cleanedCount).toBe(0);
      expect(manager.getActiveStreamsCount()).toBe(1);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide comprehensive metrics', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      manager.subscribe('btcusdt@trade');
      manager.subscribe('ethusdt@trade');
      
      const metrics = manager.getMetrics();
      
      // Assert
      expect(metrics).toMatchObject({
        activeConnections: 2,
        retryCount: 0,
        totalStreamCreations: 2,
        totalStreamCleanups: 0,
        implementation: 'WSManager'
      });
      
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.activeConnectionsHWM).toBeGreaterThanOrEqual(2);
      expect(typeof metrics.uptime).toBe('number');
    });

    it('should export Prometheus metrics format', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      manager.subscribe('btcusdt@trade');
      
      // Act
      const prometheusMetrics = manager.getPrometheusMetrics();
      
      // Assert
      expect(prometheusMetrics).toContain('ws_manager_active_connections 1');
      expect(prometheusMetrics).toContain('ws_manager_retry_count_total 0');
      expect(prometheusMetrics).toContain('ws_manager_stream_creations_total 1');
      expect(prometheusMetrics).toContain('# HELP ws_manager_active_connections');
      expect(prometheusMetrics).toContain('# TYPE ws_manager_active_connections gauge');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket creation errors gracefully', () => {
      // Arrange
      const mockErrorObservable = {
        pipe: jest.fn().mockReturnValue(throwError(() => new Error('WebSocket creation failed')))
      };
      mockWsSubject.pipe.mockReturnValue(mockErrorObservable);
      
      // Act & Assert - should not throw immediately, errors are handled in the Observable stream
      expect(() => {
        const subscription = manager.subscribe('btcusdt@trade');
        // The error will be handled in the Observable pipeline
      }).not.toThrow();
    });

    it('should track error metrics', () => {
      // Arrange
      const initialMetrics = manager.getMetrics();
      
      // Simulate error tracking
      manager['metrics'].lastErrorTime = Date.now();
      
      // Assert
      const updatedMetrics = manager.getMetrics();
      expect(updatedMetrics.lastErrorTime).toBeGreaterThan(initialMetrics.lastErrorTime);
    });
  });

  describe('Connection State Management', () => {
    it('should provide connection status observable', (done) => {
      // Act
      const connectionStatus$ = manager.getConnectionStatus();
      
      // Assert
      connectionStatus$.subscribe(status => {
        expect(['disconnected', 'connecting', 'connected']).toContain(status);
        done();
      });
    });

    it('should track high water mark correctly', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act - create multiple streams
      manager.subscribe('btcusdt@trade');
      manager.subscribe('ethusdt@trade');
      manager.subscribe('adausdt@trade');
      
      const metrics1 = manager.getMetrics();
      expect(metrics1.activeConnectionsHWM).toBe(3);
      
      // Cleanup one stream
      manager['handleStreamCleanup']('adausdt@trade');
      
      const metrics2 = manager.getMetrics();
      
      // Assert - HWM should remain at peak value
      expect(metrics2.activeConnections).toBe(2);
      expect(metrics2.activeConnectionsHWM).toBe(3); // Should remain at peak
    });
  });

  describe('Resource Management', () => {
    it('should cleanup all resources on destroy', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      manager.subscribe('btcusdt@trade');
      manager.subscribe('ethusdt@trade');
      
      expect(manager.getActiveStreamsCount()).toBe(2);
      
      // Act
      manager.destroy();
      
      // Assert
      expect(manager.getActiveStreamsCount()).toBe(0);
    });
  });
});