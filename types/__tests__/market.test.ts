import { validateBinanceKlines } from '../market';

// Mock ProcessedKline data (already processed)
const mockProcessedKlines = [
  {
    time: 1640995200000,
    open: 47000,
    high: 47500,
    low: 46800,
    close: 47200,
    volume: 1234.56
  },
  {
    time: 1640995260000,
    open: 47200,
    high: 47300,
    low: 47000,
    close: 47100,
    volume: 987.65
  }
];

// Mock raw Binance data (2D array format)
const mockRawBinanceData = [
  [1640995200000, "47000", "47500", "46800", "47200", "1234.56", 1640995259999, "58000000", 100, "617.28", "29000000", "0"],
  [1640995260000, "47200", "47300", "47000", "47100", "987.65", 1640995319999, "46000000", 95, "493.83", "23000000", "0"]
];

describe('validateBinanceKlines - Dual Mode', () => {
  test('handles already processed data (API route response)', () => {
    const result = validateBinanceKlines(mockProcessedKlines);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mockProcessedKlines[0]);
    expect(result[1]).toEqual(mockProcessedKlines[1]);
  });

  test('handles raw Binance data (direct API call)', () => {
    const result = validateBinanceKlines(mockRawBinanceData);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      time: 1640995200000,
      open: 47000,
      high: 47500,
      low: 46800,
      close: 47200,
      volume: 1234.56
    });
  });

  test('handles empty array', () => {
    const result = validateBinanceKlines([]);
    expect(result).toEqual([]);
  });

  test('throws error for non-array input', () => {
    expect(() => {
      validateBinanceKlines({ error: 'Invalid symbol' });
    }).toThrow('Invalid klines payload: expected array, got object');
  });

  test('handles Binance error response', () => {
    const binanceError = {
      code: -1121,
      msg: "Invalid symbol."
    };
    
    expect(() => {
      validateBinanceKlines(binanceError);
    }).toThrow('Invalid klines payload: expected array, got object');
  });

  test('filters out invalid kline entries in production mode', () => {
    // Mock console.error to suppress expected error logs in test
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Test production mode behavior by mocking environment
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true
    });
    
    // Clear the module cache to reload the schema with new environment
    jest.resetModules();
    // Re-import to get the new environment context
    const { validateBinanceKlines: prodValidateBinanceKlines } = require('../market');
    
    const mixedData = [
      [1640995200000, "47000", "47500", "46800", "47200", "1234.56", 1640995259999, "58000000", 100, "617.28", "29000000", "0"],
      null, // Invalid entry
      ['invalid'], // Too short
      [1640995260000, "47200", "47300", "47000", "47100", "987.65", 1640995319999, "46000000", 95, "493.83", "23000000", "0"]
    ];
    
    const result = prodValidateBinanceKlines(mixedData);
    expect(result).toHaveLength(2); // Should filter out invalid entries
    expect(result[0].time).toBe(1640995200000);
    expect(result[1].time).toBe(1640995260000);
    
    // Restore original environment and console
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true
    });
    console.error = originalConsoleError;
    
    // Clear module cache again to restore normal imports
    jest.resetModules();
  });
});