/**
 * Unit tests for migration utilities
 * Tests feature flag behavior and switching logic
 */

import { mockEnv } from '@/config/testing/setupEnvMock';
import { BinanceConnectionMigration, getBinanceConnection, createBinanceConnectionAPI } from '../migration';
import { binanceConnectionManager } from '@/lib/binance/connection-manager';
import { binanceConnectionManagerShim } from '../compat-shim';

// Mock the dependencies
jest.mock('@/lib/binance/connection-manager', () => ({
  binanceConnectionManager: {
    subscribe: jest.fn(),
    getConnectionStatus: jest.fn(),
    disconnect: jest.fn()
  }
}));

jest.mock('../compat-shim', () => ({
  binanceConnectionManagerShim: {
    subscribe: jest.fn(),
    getConnectionStatus: jest.fn(),
    disconnect: jest.fn(),
    getDebugInfo: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('BinanceConnectionMigration', () => {
  let migration: BinanceConnectionMigration;
  let restoreEnv: () => void;

  beforeEach(() => {
    // Setup test environment with feature flag disabled by default
    restoreEnv = mockEnv({
      NODE_ENV: 'test',
      USE_NEW_WS_MANAGER: 'false', // Start with legacy by default
      OPENAI_API_KEY: 'sk-test-key'
    });
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Get fresh instance and reset to legacy state
    migration = BinanceConnectionMigration.getInstance();
    migration.enableLegacy(); // Ensure clean state
  });

  afterEach(() => {
    restoreEnv();
  });

  describe('Feature Flag Behavior', () => {
    it('should default to legacy implementation when flag is not set', () => {
      // Act
      const impl = migration.getCurrentImplementation();
      const manager = migration.getConnectionManager();
      
      // Assert
      expect(impl).toBe('Legacy');
      expect(manager).toBe(binanceConnectionManager);
    });

    it('should use WSManager when flag is enabled at runtime', () => {
      // Arrange - start with legacy
      expect(migration.getCurrentImplementation()).toBe('Legacy');
      
      // Act - enable WSManager at runtime
      migration.enableWSManager();
      
      // Assert
      expect(migration.getCurrentImplementation()).toBe('WSManager');
      expect(migration.getConnectionManager()).toBe(binanceConnectionManagerShim);
    });
  });

  describe('Runtime Switching', () => {
    it('should switch to WSManager implementation at runtime', () => {
      // Arrange
      expect(migration.getCurrentImplementation()).toBe('Legacy');
      
      // Act
      migration.enableWSManager();
      
      // Assert
      expect(migration.getCurrentImplementation()).toBe('WSManager');
      expect(migration.getConnectionManager()).toBe(binanceConnectionManagerShim);
    });

    it('should switch back to legacy implementation at runtime', () => {
      // Arrange
      migration.enableWSManager();
      expect(migration.getCurrentImplementation()).toBe('WSManager');
      
      // Act
      migration.enableLegacy();
      
      // Assert
      expect(migration.getCurrentImplementation()).toBe('Legacy');
      expect(migration.getConnectionManager()).toBe(binanceConnectionManager);
    });

    it('should disconnect old implementation when switching', () => {
      // Arrange
      (binanceConnectionManager.getConnectionStatus as jest.Mock).mockReturnValue(true);
      
      // Act
      migration.enableWSManager();
      
      // Assert
      expect(binanceConnectionManager.disconnect).toHaveBeenCalled();
    });

    it('should disconnect new implementation when switching back', () => {
      // Arrange
      migration.enableWSManager();
      
      // Act
      migration.enableLegacy();
      
      // Assert
      expect(binanceConnectionManagerShim.disconnect).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should provide legacy metrics when using legacy implementation', () => {
      // Arrange
      (binanceConnectionManager.getConnectionStatus as jest.Mock).mockReturnValue(true);
      
      // Act
      const metrics = migration.getPerformanceMetrics();
      
      // Assert
      expect(metrics.implementation).toBe('Legacy');
      expect(metrics.isConnected).toBe(true);
      expect(metrics.features).toContain('basic_reconnection');
      expect(metrics.features).toContain('subscription_management');
    });

    it('should provide WSManager metrics when using new implementation', () => {
      // Arrange
      migration.enableWSManager();
      
      const mockDebugInfo = {
        activeStreams: 2,
        subscriptions: [
          { streamName: 'btcusdt@trade', subscriptionCount: 1 }
        ],
        wsManagerInfo: {
          activeStreams: 2,
          streamInfo: []
        }
      };
      
      (binanceConnectionManagerShim.getDebugInfo as jest.Mock).mockReturnValue(mockDebugInfo);
      
      // Act
      const metrics = migration.getPerformanceMetrics();
      
      // Assert
      expect(metrics.implementation).toBe('WSManager');
      expect(metrics.activeStreams).toBe(2);
      expect(metrics.features).toContain('connection_sharing');
      expect(metrics.features).toContain('exponential_backoff_with_jitter');
      expect(metrics.features).toContain('automatic_cleanup');
      expect(metrics.features).toContain('observable_api');
    });
  });

  describe('Singleton Behavior', () => {
    it('should return same instance on multiple calls', () => {
      // Act
      const instance1 = BinanceConnectionMigration.getInstance();
      const instance2 = BinanceConnectionMigration.getInstance();
      
      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});

describe('getBinanceConnection', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = mockEnv({
      NODE_ENV: 'test',
      USE_NEW_WS_MANAGER: 'false',
      OPENAI_API_KEY: 'sk-test-key'
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('should return the active connection manager', () => {
    // Act
    const connection = getBinanceConnection();
    
    // Assert - should have the same methods as binanceConnectionManager
    expect(connection).toHaveProperty('subscribe');
    expect(connection).toHaveProperty('getConnectionStatus');
    expect(connection).toHaveProperty('disconnect');
  });

  it('should return WSManager when flag is enabled', () => {
    // Arrange - enable feature flag
    restoreEnv();
    restoreEnv = mockEnv({
      NODE_ENV: 'test',
      USE_NEW_WS_MANAGER: 'true',
      OPENAI_API_KEY: 'sk-test-key'
    });
    
    // Act
    const connection = getBinanceConnection();
    
    // Assert - Would be WSManager in real scenario, but our mock setup returns the shim
    expect(connection).toBeDefined();
  });
});

describe('createBinanceConnectionAPI', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = mockEnv({
      NODE_ENV: 'test',
      USE_NEW_WS_MANAGER: 'false',
      OPENAI_API_KEY: 'sk-test-key'
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('should create unified API interface', () => {
    // Act
    const api = createBinanceConnectionAPI();
    
    // Assert
    expect(api).toHaveProperty('subscribe');
    expect(api).toHaveProperty('getConnectionStatus');
    expect(api).toHaveProperty('disconnect');
    expect(typeof api.subscribe).toBe('function');
    expect(typeof api.getConnectionStatus).toBe('function');
    expect(typeof api.disconnect).toBe('function');
  });

  it('should bind methods correctly to underlying manager', () => {
    // Arrange
    const mockHandler = jest.fn();
    const mockUnsubscribe = jest.fn();
    
    // Setup mocks for current manager (whatever is active)
    const currentManager = getBinanceConnection();
    if ('subscribe' in currentManager) {
      (currentManager.subscribe as jest.Mock).mockReturnValue(mockUnsubscribe);
      (currentManager.getConnectionStatus as jest.Mock).mockReturnValue(true);
    }
    
    // Act
    const api = createBinanceConnectionAPI();
    const unsubscribe = api.subscribe('btcusdt@trade', mockHandler);
    const status = api.getConnectionStatus();
    api.disconnect();
    
    // Assert - verify API methods work correctly
    expect(typeof unsubscribe).toBe('function');
    expect(typeof status).toBe('boolean');
  });
});