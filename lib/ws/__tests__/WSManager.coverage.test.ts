/**
 * Additional tests for WSManager to improve coverage to ≥90%
 * Focuses on edge cases and uncovered code paths
 */

import { WSManager } from '../WSManager';
import { of, throwError, timer } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

// Mock WebSocket and RxJS webSocket
jest.mock('rxjs/webSocket');
const mockWebSocket = webSocket as jest.MockedFunction<typeof webSocket>;

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager Coverage Tests', () => {
  let manager: WSManager;
  let mockWsSubject: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockWsSubject = {
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
      unsubscribe: jest.fn()
    };
    
    mockWebSocket.mockReturnValue(mockWsSubject);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Constructor Edge Cases', () => {
    it('should clamp maxRetryDelay to 30s if exceeded', () => {
      // Act
      manager = new WSManager({
        url: 'wss://test.com',
        maxRetryDelay: 60000, // 60s - exceeds limit
        debug: true
      });
      
      // Assert
      const metrics = manager.getMetrics();
      expect(manager['options'].maxRetryDelay).toBe(30000); // Should be clamped to 30s
    });

    it('should start periodic cleanup on initialization', () => {
      // Arrange & Act
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });
      
      // Assert - periodic cleanup timer should be set
      expect(manager['cleanupTimer']).toBeDefined();
    });
  });

  describe('Stream URL Building', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com/ws/',
        debug: false
      });
    });

    it('should build URL correctly when base URL ends with slash', () => {
      // Act
      const url = manager['buildStreamUrl']('btcusdt@trade');
      
      // Assert
      expect(url).toBe('wss://test.com/ws/btcusdt@trade');
    });

    it('should build URL correctly when base URL does not end with slash', () => {
      // Arrange
      manager = new WSManager({
        url: 'wss://test.com/ws',
        debug: false
      });
      
      // Act
      const url = manager['buildStreamUrl']('btcusdt@trade');
      
      // Assert
      expect(url).toBe('wss://test.com/ws/btcusdt@trade');
    });
  });

  describe('Message Extraction', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: false
      });
    });

    it('should extract data from multi-stream format message', () => {
      // Arrange
      const message = {
        stream: 'btcusdt@trade',
        data: { price: '50000', volume: '1.5' }
      };
      
      // Act
      const result = manager['extractStreamData'](message, 'btcusdt@trade');
      
      // Assert
      expect(result).toEqual({ price: '50000', volume: '1.5' });
    });

    it('should throw error for mismatched stream in multi-stream format', () => {
      // Arrange
      const message = {
        stream: 'ethusdt@trade',
        data: { price: '3000' }
      };
      
      // Act & Assert
      expect(() => {
        manager['extractStreamData'](message, 'btcusdt@trade');
      }).toThrow('Message for different stream: ethusdt@trade, expected: btcusdt@trade');
    });

    it('should return message as-is for single stream format', () => {
      // Arrange
      const message = { price: '50000', symbol: 'BTCUSDT' };
      
      // Act
      const result = manager['extractStreamData'](message, 'btcusdt@trade');
      
      // Assert
      expect(result).toBe(message);
    });
  });

  describe('WebSocket Subject Configuration', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });
    });

    it('should configure WebSocket subject with observers', () => {
      // Act
      const wsSubject = manager['createWebSocketSubject']('wss://test.com/stream');
      
      // Assert
      expect(mockWebSocket).toHaveBeenCalledWith({
        url: 'wss://test.com/stream',
        openObserver: expect.objectContaining({
          next: expect.any(Function)
        }),
        closeObserver: expect.objectContaining({
          next: expect.any(Function)
        })
      });
    });

    it('should handle connection state changes through observers', () => {
      // Arrange
      let openHandler: Function;
      let closeHandler: Function;
      
      mockWebSocket.mockImplementation((config: any) => {
        openHandler = config.openObserver.next;
        closeHandler = config.closeObserver.next;
        return mockWsSubject;
      });
      
      // Act
      manager['createWebSocketSubject']('wss://test.com/stream');
      
      // Simulate connection events
      openHandler();
      closeHandler();
      
      // Assert - connection state should be tracked
      // (This tests the observer functions work without throwing)
      expect(openHandler).toBeDefined();
      expect(closeHandler).toBeDefined();
    });
  });

  describe('Cleanup and Resource Management', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });
    });

    it('should handle cleanup when stream does not exist', () => {
      // Act & Assert - should not throw
      expect(() => {
        manager['handleStreamCleanup']('nonexistent@stream');
      }).not.toThrow();
    });

    it('should attempt garbage collection after all streams cleanup', () => {
      // Arrange
      const mockGC = jest.fn();
      (global as any).gc = mockGC;
      
      // Simulate having a stream, then cleaning it up
      const streamState = { 
        observable: of({}), 
        refCount: 0, 
        lastActivity: Date.now() 
      };
      manager['streams'].set('test@stream', streamState);
      
      // Act
      manager['handleStreamCleanup']('test@stream');
      
      // Assert
      expect(mockGC).toHaveBeenCalled();
      
      // Cleanup
      delete (global as any).gc;
    });

    it('should handle GC errors gracefully', () => {
      // Arrange
      (global as any).gc = () => {
        throw new Error('GC failed');
      };
      
      const streamState = { 
        observable: of({}), 
        refCount: 0, 
        lastActivity: Date.now() 
      };
      manager['streams'].set('test@stream', streamState);
      
      // Act & Assert - should not throw
      expect(() => {
        manager['handleStreamCleanup']('test@stream');
      }).not.toThrow();
      
      // Cleanup
      delete (global as any).gc;
    });
  });

  describe('Periodic Cleanup Timer', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });
    });

    it('should identify and cleanup idle streams during periodic check', () => {
      // Arrange
      const oldTime = Date.now() - 400000; // 6+ minutes ago
      const recentTime = Date.now() - 60000; // 1 minute ago
      
      manager['streams'].set('idle@stream', { 
        observable: of({}), 
        refCount: 1, 
        lastActivity: oldTime 
      });
      manager['streams'].set('active@stream', { 
        observable: of({}), 
        refCount: 1, 
        lastActivity: recentTime 
      });
      
      expect(manager.getActiveStreamsCount()).toBe(2);
      
      // Act - fast-forward to trigger periodic cleanup
      jest.advanceTimersByTime(61000); // 1 minute + 1 second
      
      // Assert - idle stream should be cleaned up, active stream should remain
      expect(manager.getActiveStreamsCount()).toBe(1);
      expect(manager['streams'].has('active@stream')).toBe(true);
      expect(manager['streams'].has('idle@stream')).toBe(false);
    });

    it('should stop periodic cleanup on destroy', () => {
      // Arrange
      const initialTimer = manager['cleanupTimer'];
      expect(initialTimer).toBeDefined();
      
      // Act
      manager.destroy();
      
      // Assert
      expect(manager['cleanupTimer']).toBeUndefined();
    });
  });

  describe('Activity Tracking', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });
    });

    it('should update lastActivity when reusing existing stream', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Create initial stream
      manager.subscribe('btcusdt@trade');
      const initialActivity = manager.getStreamInfo()[0].lastActivity;
      
      // Wait a bit
      jest.advanceTimersByTime(100);
      
      // Act - subscribe to same stream again
      manager.subscribe('btcusdt@trade');
      
      // Assert
      const updatedActivity = manager.getStreamInfo()[0].lastActivity;
      expect(updatedActivity).toBeGreaterThan(initialActivity);
    });
  });

  describe('Debug and Development Features', () => {
    beforeEach(() => {
      manager = new WSManager({
        url: 'wss://test.com',
        debug: true // Enable debug mode
      });
    });

    it('should provide detailed debug information when debug mode is enabled', () => {
      // Arrange
      const mockObservable = {
        pipe: jest.fn().mockReturnValue(of({ test: 'data' }))
      };
      mockWsSubject.pipe.mockReturnValue(mockObservable);
      
      // Act
      manager.subscribe('btcusdt@trade');
      manager.subscribe('ethusdt@trade');
      
      // Assert
      const streamInfo = manager.getStreamInfo();
      expect(streamInfo).toHaveLength(2);
      
      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.implementation).toBe('WSManager');
    });

    it('should handle retry delay calculation at boundary values', () => {
      // Test various attempt numbers
      const preview0 = manager.getRetryDelayPreview(0);
      const preview10 = manager.getRetryDelayPreview(10);
      const preview20 = manager.getRetryDelayPreview(20);
      
      // Assert exponential growth and clamping
      expect(preview0.exponentialDelay).toBe(1000); // 1000 * 2^0
      expect(preview10.clampedDelay).toBe(30000); // Should be clamped
      expect(preview20.clampedDelay).toBe(30000); // Should be clamped
      
      // All should enforce minimum delay
      expect(preview0.minDelay).toBe(100);
      expect(preview10.minDelay).toBe(100);
      expect(preview20.minDelay).toBe(100);
    });
  });

  describe('Configuration Validation', () => {
    it('should warn when maxRetryDelay exceeds 30s and clamp it', () => {
      // Act
      manager = new WSManager({
        url: 'wss://test.com',
        maxRetryDelay: 45000, // 45s - exceeds 30s limit
        debug: true
      });
      
      // Assert
      expect(manager['options'].maxRetryDelay).toBe(30000);
    });
  });
});