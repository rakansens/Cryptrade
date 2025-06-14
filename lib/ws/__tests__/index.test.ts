/**
 * Unit tests for ws/index.ts exports
 * Ensures all exports are properly available
 */

describe('WSManager Module Exports', () => {
  it('should export WSManager class', () => {
    const { WSManager } = require('../index');
    expect(WSManager).toBeDefined();
    expect(typeof WSManager).toBe('function');
  });

  it('should export BinanceConnectionManagerShim class', () => {
    const { BinanceConnectionManagerShim } = require('../index');
    expect(BinanceConnectionManagerShim).toBeDefined();
    expect(typeof BinanceConnectionManagerShim).toBe('function');
  });

  it('should export singleton binanceConnectionManagerShim', () => {
    const { binanceConnectionManagerShim } = require('../index');
    expect(binanceConnectionManagerShim).toBeDefined();
    expect(typeof binanceConnectionManagerShim).toBe('object');
  });

  it('should export migration utilities', () => {
    const { 
      BinanceConnectionMigration,
      connectionMigration,
      getBinanceConnection,
      createBinanceConnectionAPI
    } = require('../index');
    
    expect(BinanceConnectionMigration).toBeDefined();
    expect(connectionMigration).toBeDefined();
    expect(getBinanceConnection).toBeDefined();
    expect(createBinanceConnectionAPI).toBeDefined();
    
    expect(typeof BinanceConnectionMigration).toBe('function');
    expect(typeof connectionMigration).toBe('object');
    expect(typeof getBinanceConnection).toBe('function');
    expect(typeof createBinanceConnectionAPI).toBe('function');
  });

  it('should have complete type exports available', () => {
    // This test ensures TypeScript types are properly exported
    // by importing the module without errors
    expect(() => {
      require('../index');
    }).not.toThrow();
  });
});