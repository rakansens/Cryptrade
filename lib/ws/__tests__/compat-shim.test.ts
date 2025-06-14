/**
 * Unit tests for BinanceConnectionManagerShim
 * Tests backward compatibility and API equivalence
 */

import { BinanceConnectionManagerShim } from '../compat-shim';
import { WSManager } from '../WSManager';
import { of, throwError } from 'rxjs';

// Mock WSManager
jest.mock('../WSManager');
const MockWSManager = WSManager as jest.MockedClass<typeof WSManager>;

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('BinanceConnectionManagerShim', () => {
  let shim: BinanceConnectionManagerShim;
  let mockWSManager: jest.Mocked<WSManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock WSManager instance
    mockWSManager = {
      subscribe: jest.fn(),
      getConnectionStatus: jest.fn(),
      getActiveStreamsCount: jest.fn(),
      getStreamInfo: jest.fn(),
      getMetrics: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      destroy: jest.fn(),
      forceCleanupIdleStreams: jest.fn(),
      getRetryDelayPreview: jest.fn()
    } as any;

    // Setup WSManager constructor mock
    MockWSManager.mockImplementation(() => mockWSManager);
    
    // Create shim instance
    shim = new BinanceConnectionManagerShim();
  });

  afterEach(() => {
    shim.disconnect();
  });

  describe('API Compatibility', () => {
    it('should provide the same subscribe API as legacy manager', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Act
      const unsubscribe = shim.subscribe(streamName, handler);
      
      // Assert
      expect(mockWSManager.subscribe).toHaveBeenCalledWith(streamName);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should provide getConnectionStatus method', () => {
      // Arrange
      mockWSManager.getConnectionStatus.mockReturnValue(of('connected') as any);
      
      // Act
      const status = shim.getConnectionStatus();
      
      // Assert
      expect(typeof status).toBe('boolean');
      expect(mockWSManager.getConnectionStatus).toHaveBeenCalled();
    });

    it('should provide disconnect method', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Subscribe first
      shim.subscribe(streamName, handler);
      
      // Act
      shim.disconnect();
      
      // Assert
      expect(mockWSManager.destroy).toHaveBeenCalled();
    });
  });

  describe('Handler Integration', () => {
    it('should call handler with data from Observable', (done) => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const testData = { e: 'trade', s: 'BTCUSDT', p: '50000' };
      const handler = jest.fn((data) => {
        // Assert
        expect(data).toEqual(testData);
        done();
      });
      
      mockWSManager.subscribe.mockReturnValue(of(testData) as any);
      
      // Act
      shim.subscribe(streamName, handler);
    });

    it('should handle Observable errors gracefully', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler = jest.fn();
      const error = new Error('Connection failed');
      
      mockWSManager.subscribe.mockReturnValue(throwError(() => error) as any);
      
      // Act & Assert - should not throw
      expect(() => {
        shim.subscribe(streamName, handler);
      }).not.toThrow();
    });

    it('should handle handler errors gracefully', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Act & Assert - should not throw
      expect(() => {
        shim.subscribe(streamName, handler);
      }).not.toThrow();
    });
  });

  describe('Subscription Management', () => {
    it('should track multiple subscriptions to same stream', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Act
      const unsub1 = shim.subscribe(streamName, handler1);
      const unsub2 = shim.subscribe(streamName, handler2);
      
      // Assert
      const debugInfo = shim.getDebugInfo();
      expect(debugInfo.activeStreams).toBe(1);
      expect(debugInfo.subscriptions[0].subscriptionCount).toBe(2);
    });

    it('should properly unsubscribe individual handlers', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Act
      const unsub1 = shim.subscribe(streamName, handler1);
      const unsub2 = shim.subscribe(streamName, handler2);
      
      // Unsubscribe first handler
      unsub1();
      
      // Assert
      const debugInfo = shim.getDebugInfo();
      expect(debugInfo.subscriptions[0].subscriptionCount).toBe(1);
    });

    it('should remove stream when all handlers unsubscribe', () => {
      // Arrange
      const streamName = 'btcusdt@trade';
      const handler = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockWSManager.subscribe.mockReturnValue(of({ test: 'data' }) as any);
      
      // Act
      const unsub = shim.subscribe(streamName, handler);
      expect(shim.getDebugInfo().activeStreams).toBe(1);
      
      unsub();
      
      // Assert
      expect(shim.getDebugInfo().activeStreams).toBe(0);
    });
  });

  describe('Metrics Integration', () => {
    it('should expose WSManager metrics through shim', () => {
      // Arrange
      const mockMetrics = {
        activeConnections: 2,
        retryCount: 5,
        totalStreamCreations: 10,
        totalStreamCleanups: 3,
        implementation: 'WSManager'
      };
      
      mockWSManager.getMetrics.mockReturnValue(mockMetrics as any);
      
      // Act
      const metrics = shim.getMetrics();
      
      // Assert
      expect(metrics).toEqual(mockMetrics);
      expect(mockWSManager.getMetrics).toHaveBeenCalled();
    });

    it('should expose Prometheus metrics through shim', () => {
      // Arrange
      const mockPrometheusOutput = '# HELP ws_manager_active_connections\\nws_manager_active_connections 2';
      mockWSManager.getPrometheusMetrics.mockReturnValue(mockPrometheusOutput);
      
      // Act
      const prometheus = shim.getPrometheusMetrics();
      
      // Assert
      expect(prometheus).toBe(mockPrometheusOutput);
      expect(mockWSManager.getPrometheusMetrics).toHaveBeenCalled();
    });

    it('should provide debug info with WSManager metrics', () => {
      // Arrange
      const mockMetrics = {
        activeConnections: 1,
        retryCount: 0,
        implementation: 'WSManager'
      };
      
      mockWSManager.getActiveStreamsCount.mockReturnValue(1);
      mockWSManager.getStreamInfo.mockReturnValue([
        { name: 'btcusdt@trade', refCount: 1, lastActivity: Date.now() }
      ]);
      mockWSManager.getMetrics.mockReturnValue(mockMetrics as any);
      
      // Act
      const debugInfo = shim.getDebugInfo();
      
      // Assert
      expect(debugInfo.wsManagerInfo.metrics).toEqual(mockMetrics);
      expect(debugInfo.wsManagerInfo.activeStreams).toBe(1);
      expect(debugInfo.wsManagerInfo.streamInfo).toHaveLength(1);
    });
  });

  describe('WSManager Access', () => {
    it('should provide access to underlying WSManager', () => {
      // Act
      const wsManager = shim.getWSManager();
      
      // Assert
      expect(wsManager).toBe(mockWSManager);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle WSManager initialization errors', () => {
      // Arrange
      MockWSManager.mockImplementation(() => {
        throw new Error('WSManager init failed');
      });
      
      // Act & Assert - should handle gracefully during construction
      expect(() => {
        new BinanceConnectionManagerShim();
      }).toThrow('WSManager init failed');
    });

    it('should handle subscription before initialization', () => {
      // Arrange - create shim but mark as not initialized
      const shimNotInit = new BinanceConnectionManagerShim();
      (shimNotInit as any).isInitialized = false;
      
      // Act & Assert
      expect(() => {
        shimNotInit.subscribe('btcusdt@trade', jest.fn());
      }).toThrow('BinanceConnectionManager not initialized');
    });
  });
});