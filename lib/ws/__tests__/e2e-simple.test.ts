/**
 * Simplified E2E Tests for WSManager
 * Focus on integration testing without complex WebSocket mocking
 */

import { WSManager } from '../WSManager';
import { getBinanceConnection, createBinanceConnectionAPI } from '../migration';
import { binanceConnectionManagerShim } from '../compat-shim';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSManager E2E Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End API Integration', () => {
    it('should integrate with migration layer correctly', () => {
      // Test migration layer
      const connection = getBinanceConnection();
      
      expect(connection).toBeDefined();
      expect(connection).toHaveProperty('subscribe');
      expect(connection).toHaveProperty('getConnectionStatus');
      expect(connection).toHaveProperty('disconnect');

      // Test unified API
      const api = createBinanceConnectionAPI();
      expect(api).toHaveProperty('subscribe');
      expect(api).toHaveProperty('getConnectionStatus');
      expect(api).toHaveProperty('disconnect');
    });

    it('should maintain backward compatibility through shim', () => {
      const shim = binanceConnectionManagerShim;
      
      // Test core legacy API
      expect(typeof shim.subscribe).toBe('function');
      expect(typeof shim.getConnectionStatus).toBe('function');
      expect(typeof shim.disconnect).toBe('function');

      // Test extended monitoring API
      expect(typeof shim.getMetrics).toBe('function');
      expect(typeof shim.getDebugInfo).toBe('function');
      expect(typeof shim.getPrometheusMetrics).toBe('function');
    });

    it('should provide consistent metrics across all layers', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      const directMetrics = manager.getMetrics();
      const shimMetrics = binanceConnectionManagerShim.getMetrics();

      // Both should provide same core structure
      expect(directMetrics).toHaveProperty('activeConnections');
      expect(directMetrics).toHaveProperty('retryCount');
      expect(directMetrics).toHaveProperty('implementation');

      expect(shimMetrics).toHaveProperty('activeConnections');
      expect(shimMetrics).toHaveProperty('retryCount');
      expect(shimMetrics).toHaveProperty('implementation');

      manager.destroy();
    });
  });

  describe('Configuration and Initialization', () => {
    it('should handle different configuration options', () => {
      const configs = [
        { url: 'wss://test1.com' },
        { url: 'wss://test2.com', maxRetryAttempts: 5 },
        { url: 'wss://test3.com', baseRetryDelay: 500, maxRetryDelay: 10000 },
        { url: 'wss://test4.com', debug: true }
      ];

      configs.forEach(config => {
        const manager = new WSManager(config);
        
        expect(manager).toBeDefined();
        expect(manager.getActiveStreamsCount()).toBe(0);
        
        const metrics = manager.getMetrics();
        expect(metrics.implementation).toBe('WSManager');
        
        manager.destroy();
      });
    });

    it('should validate configuration limits', () => {
      // Test maxRetryDelay clamping
      const manager = new WSManager({
        url: 'wss://test.com',
        maxRetryDelay: 60000 // Should be clamped to 30000
      });

      expect(manager['options'].maxRetryDelay).toBe(30000);
      manager.destroy();
    });
  });

  describe('Stream Management Integration', () => {
    it('should manage stream lifecycle correctly', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Initially no streams
      expect(manager.getActiveStreamsCount()).toBe(0);

      // Add mock streams to simulate subscription
      const streams = ['btcusdt@trade', 'ethusdt@trade', 'adausdt@trade'];
      streams.forEach(streamName => {
        const mockObservable = { pipe: jest.fn() };
        manager['streams'].set(streamName, {
          observable: mockObservable as any,
          refCount: 1,
          lastActivity: Date.now()
        });
      });

      expect(manager.getActiveStreamsCount()).toBe(3);

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(3);

      // Test stream info
      const streamInfo = manager.getStreamInfo();
      expect(streamInfo).toHaveLength(3);
      expect(streamInfo[0]).toHaveProperty('name');
      expect(streamInfo[0]).toHaveProperty('refCount');
      expect(streamInfo[0]).toHaveProperty('lastActivity');

      manager.destroy();
    });

    it('should handle cleanup operations', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        debug: true
      });

      // Add mock streams with different activity times
      const now = Date.now();
      const oldTime = now - 400000; // 6+ minutes ago
      const recentTime = now - 60000; // 1 minute ago

      manager['streams'].set('old@stream', {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: oldTime
      });

      manager['streams'].set('recent@stream', {
        observable: { pipe: jest.fn() } as any,
        refCount: 1,
        lastActivity: recentTime
      });

      expect(manager.getActiveStreamsCount()).toBe(2);

      // Force cleanup with 5 minute threshold
      const cleanedCount = manager.forceCleanupIdleStreams(300000);

      expect(cleanedCount).toBe(1); // Only old stream cleaned
      expect(manager.getActiveStreamsCount()).toBe(1);
      expect(manager['streams'].has('recent@stream')).toBe(true);
      expect(manager['streams'].has('old@stream')).toBe(false);

      manager.destroy();
    });
  });

  describe('Retry Logic Integration', () => {
    it('should calculate retry delays correctly', () => {
      const manager = new WSManager({
        url: 'wss://test.com',
        baseRetryDelay: 1000,
        maxRetryDelay: 30000
      });

      const testCases = [
        { attempt: 0, expectedBase: 1000 },
        { attempt: 1, expectedBase: 2000 },
        { attempt: 2, expectedBase: 4000 },
        { attempt: 3, expectedBase: 8000 },
        { attempt: 10, expectedBase: 1024000, expectedClamped: 30000 }
      ];

      testCases.forEach(({ attempt, expectedBase, expectedClamped }) => {
        const preview = manager.getRetryDelayPreview(attempt);
        
        expect(preview.exponentialDelay).toBe(expectedBase);
        expect(preview.clampedDelay).toBe(expectedClamped || expectedBase);
        expect(preview.minDelay).toBe(100);
        expect(preview.maxDelay).toBeLessThanOrEqual(30000);
      });

      manager.destroy();
    });

    it('should track retry metrics', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Simulate retry attempts
      manager['metrics'].totalRetryAttempts = 10;
      manager['metrics'].lastRetryTime = Date.now();

      const metrics = manager.getMetrics();
      expect(metrics.retryCount).toBe(10);
      expect(metrics.lastRetryTime).toBeGreaterThan(0);

      manager.destroy();
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide Prometheus metrics in correct format', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      const prometheus = manager.getPrometheusMetrics();
      
      // Check required metrics are present
      expect(prometheus).toContain('# HELP ws_manager_active_connections');
      expect(prometheus).toContain('# TYPE ws_manager_active_connections gauge');
      expect(prometheus).toContain('ws_manager_active_connections');
      
      expect(prometheus).toContain('# HELP ws_manager_retry_count_total');
      expect(prometheus).toContain('# TYPE ws_manager_retry_count_total counter');
      expect(prometheus).toContain('ws_manager_retry_count_total');

      expect(prometheus).toContain('# HELP ws_manager_stream_creations_total');
      expect(prometheus).toContain('ws_manager_stream_creations_total');

      manager.destroy();
    });

    it('should track high water mark correctly', () => {
      const manager = new WSManager({
        url: 'wss://test.com'
      });

      // Simulate stream creation activity
      for (let i = 1; i <= 5; i++) {
        manager['streams'].set(`stream${i}`, {
          observable: { pipe: jest.fn() } as any,
          refCount: 1,
          lastActivity: Date.now()
        });
        
        // Update metrics
        manager['metrics'].totalStreamCreations++;
        manager['metrics'].activeConnectionsHWM = Math.max(
          manager['metrics'].activeConnectionsHWM,
          manager.getActiveStreamsCount()
        );
      }

      // Remove some streams
      manager['streams'].delete('stream1');
      manager['streams'].delete('stream2');

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(3); // 5 - 2 removed
      expect(metrics.activeConnectionsHWM).toBe(5); // Should maintain peak

      manager.destroy();
    });
  });

  describe('Feature Flag Integration', () => {
    it('should work with migration feature flags', () => {
      // Test default behavior (should be legacy)
      const connection1 = getBinanceConnection();
      expect(connection1).toBeDefined();

      // Test runtime switching
      const migration = require('../migration').connectionMigration;
      
      const impl1 = migration.getCurrentImplementation();
      expect(['Legacy', 'WSManager']).toContain(impl1);

      // Switch implementations
      migration.enableWSManager();
      expect(migration.getCurrentImplementation()).toBe('WSManager');

      migration.enableLegacy();
      expect(migration.getCurrentImplementation()).toBe('Legacy');
    });

    it('should provide performance metrics for both implementations', () => {
      const migration = require('../migration').connectionMigration;
      
      // Test with WSManager
      migration.enableWSManager();
      const wsMetrics = migration.getPerformanceMetrics();
      expect(wsMetrics.implementation).toBe('WSManager');
      expect(wsMetrics.features).toContain('connection_sharing');
      expect(wsMetrics.features).toContain('exponential_backoff_with_jitter');

      // Test with Legacy
      migration.enableLegacy();
      const legacyMetrics = migration.getPerformanceMetrics();
      expect(legacyMetrics.implementation).toBe('Legacy');
      expect(legacyMetrics.features).toContain('basic_reconnection');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid configurations gracefully', () => {
      // Should not throw for missing required options
      expect(() => {
        new WSManager({ url: '' });
      }).not.toThrow();

      // Should handle edge case values
      expect(() => {
        new WSManager({
          url: 'wss://test.com',
          maxRetryAttempts: 0,
          baseRetryDelay: 0,
          maxRetryDelay: 0
        });
      }).not.toThrow();
    });

    it('should provide consistent API even with errors', () => {
      const manager = new WSManager({
        url: 'wss://invalid-url'
      });

      // Core methods should still work
      expect(typeof manager.getMetrics).toBe('function');
      expect(typeof manager.getActiveStreamsCount).toBe('function');
      expect(typeof manager.getStreamInfo).toBe('function');
      expect(typeof manager.destroy).toBe('function');

      const metrics = manager.getMetrics();
      expect(metrics.implementation).toBe('WSManager');

      manager.destroy();
    });
  });
});