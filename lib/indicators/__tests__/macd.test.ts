import { describe, it, expect } from '@jest/globals';
import { calculateMACD, getMACDColor, getMACDSignal } from '../macd';
import type { MACDData } from '@/types/market';

describe('calculateMACD', () => {
  // Simple test data with known pattern
  const simpleTestData = Array.from({ length: 50 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 100 + Math.sin(i * 0.2) * 10 // Sinusoidal pattern
  }));

  // Trending data for testing crossovers
  const trendingUpData = Array.from({ length: 50 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 100 + i * 2 // Linear uptrend
  }));

  const trendingDownData = Array.from({ length: 50 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 200 - i * 2 // Linear downtrend
  }));

  describe('basic calculations', () => {
    it('should calculate MACD with default parameters (12, 26, 9)', () => {
      const result = calculateMACD(simpleTestData);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBe(simpleTestData.length - 26 - 9 + 1); // 50 - 26 - 9 + 1 = 16
      
      result.forEach(point => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('macd');
        expect(point).toHaveProperty('signal');
        expect(point).toHaveProperty('histogram');
        
        expect(typeof point.time).toBe('number');
        expect(typeof point.macd).toBe('number');
        expect(typeof point.signal).toBe('number');
        expect(typeof point.histogram).toBe('number');
        
        // Verify histogram calculation
        expect(point.histogram).toBeCloseTo(point.macd - point.signal, 10);
      });
    });

    it('should calculate MACD with custom parameters', () => {
      const result = calculateMACD(simpleTestData, 5, 10, 3);
      
      // Result length should be data.length - slowPeriod - signalPeriod + 1
      expect(result.length).toBe(simpleTestData.length - 10 - 3 + 1); // 50 - 10 - 3 + 1 = 38
      
      result.forEach(point => {
        expect(point.histogram).toBeCloseTo(point.macd - point.signal, 10);
      });
    });

    it('should return empty array when insufficient data', () => {
      const insufficientData = simpleTestData.slice(0, 20);
      const result = calculateMACD(insufficientData); // Needs at least 26 + 9 = 35 data points
      
      expect(result).toHaveLength(0);
    });

    it('should handle minimum required data points', () => {
      const minData = simpleTestData.slice(0, 35); // Exactly 26 + 9 points
      const result = calculateMACD(minData);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('macd');
      expect(result[0]).toHaveProperty('signal');
      expect(result[0]).toHaveProperty('histogram');
    });
  });

  describe('trend detection', () => {
    it('should show positive MACD values in uptrend', () => {
      const result = calculateMACD(trendingUpData);
      
      // In a strong uptrend, MACD should be mostly positive
      const lastFewPoints = result.slice(-5);
      lastFewPoints.forEach(point => {
        expect(point.macd).toBeGreaterThan(0);
      });
    });

    it('should show negative MACD values in downtrend', () => {
      const result = calculateMACD(trendingDownData);
      
      // In a strong downtrend, MACD should be mostly negative
      const lastFewPoints = result.slice(-5);
      lastFewPoints.forEach(point => {
        expect(point.macd).toBeLessThan(0);
      });
    });

    it('should detect convergence and divergence', () => {
      // Create data with convergence pattern
      const convergenceData = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + (i < 25 ? i * 2 : 150 - (i - 25) * 0.5) // Up then slow down
      }));
      
      const result = calculateMACD(convergenceData);
      
      // MACD should start positive and move towards zero
      if (result.length > 10) {
        const early = result[5].macd;
        const late = result[result.length - 1].macd;
        expect(Math.abs(late)).toBeLessThan(Math.abs(early));
      }
    });
  });

  describe('signal line crossovers', () => {
    it('should calculate signal line as EMA of MACD', () => {
      const result = calculateMACD(simpleTestData);
      
      // Signal should be smoother than MACD
      let macdVariance = 0;
      let signalVariance = 0;
      
      for (let i = 1; i < result.length; i++) {
        macdVariance += Math.abs(result[i].macd - result[i-1].macd);
        signalVariance += Math.abs(result[i].signal - result[i-1].signal);
      }
      
      // Signal line should have less variance (be smoother)
      expect(signalVariance).toBeLessThan(macdVariance);
    });
  });

  describe('edge cases', () => {
    it('should handle constant price data', () => {
      const constantData = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 // Constant price
      }));
      
      const result = calculateMACD(constantData);
      
      result.forEach(point => {
        expect(point.macd).toBeCloseTo(0, 10);
        expect(point.signal).toBeCloseTo(0, 10);
        expect(point.histogram).toBeCloseTo(0, 10);
      });
    });

    it('should handle volatile data', () => {
      const volatileData = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + (i % 2 === 0 ? 20 : -20) // Oscillating
      }));
      
      const result = calculateMACD(volatileData);
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(point => {
        expect(isFinite(point.macd)).toBe(true);
        expect(isFinite(point.signal)).toBe(true);
        expect(isFinite(point.histogram)).toBe(true);
      });
    });

    it('should maintain time alignment', () => {
      const result = calculateMACD(simpleTestData);
      
      // First result should align with correct time index
      const expectedFirstIndex = 26 + 9 - 1; // slowPeriod + signalPeriod - 1
      expect(result[0].time).toBe(simpleTestData[expectedFirstIndex].time);
      
      // Check all times are in order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].time).toBeGreaterThan(result[i-1].time);
      }
    });
  });

  describe('numerical accuracy', () => {
    it('should calculate EMA correctly', () => {
      // Test with simple data where we can verify EMA calculation
      const simpleData = [
        { time: 1000, close: 10 },
        { time: 2000, close: 20 },
        { time: 3000, close: 30 },
        { time: 4000, close: 25 },
        { time: 5000, close: 15 }
      ];
      
      // For very short periods to test
      const result = calculateMACD(simpleData, 2, 3, 2);
      
      expect(result.length).toBeGreaterThan(0);
      // Verify calculations are reasonable
      result.forEach(point => {
        expect(Math.abs(point.macd)).toBeLessThan(50); // Should be reasonable given input range
      });
    });

    it('should handle large numbers without overflow', () => {
      const largeNumberData = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 50000 + Math.sin(i * 0.2) * 1000
      }));
      
      const result = calculateMACD(largeNumberData);
      
      result.forEach(point => {
        expect(isFinite(point.macd)).toBe(true);
        expect(isFinite(point.signal)).toBe(true);
        expect(isFinite(point.histogram)).toBe(true);
      });
    });
  });
});

describe('getMACDColor', () => {
  it('should return green color for positive histogram', () => {
    expect(getMACDColor(0.5)).toBe('#0ddfba');
    expect(getMACDColor(10)).toBe('#0ddfba');
    expect(getMACDColor(0.00001)).toBe('#0ddfba');
  });

  it('should return red color for negative histogram', () => {
    expect(getMACDColor(-0.5)).toBe('#ff4d4d');
    expect(getMACDColor(-10)).toBe('#ff4d4d');
    expect(getMACDColor(-0.00001)).toBe('#ff4d4d');
  });

  it('should return green color for zero', () => {
    expect(getMACDColor(0)).toBe('#0ddfba');
  });
});

describe('getMACDSignal', () => {
  it('should detect bullish crossover', () => {
    // MACD crosses above signal
    const signal = getMACDSignal(1.5, 1.0, 0.8, 1.2);
    expect(signal).toBe('bullish');
  });

  it('should detect bearish crossover', () => {
    // MACD crosses below signal
    const signal = getMACDSignal(0.8, 1.2, 1.5, 1.0);
    expect(signal).toBe('bearish');
  });

  it('should return neutral when no crossover', () => {
    // MACD stays above signal
    const signal1 = getMACDSignal(1.5, 1.0, 1.3, 0.8);
    expect(signal1).toBe('neutral');
    
    // MACD stays below signal
    const signal2 = getMACDSignal(0.8, 1.2, 0.7, 1.3);
    expect(signal2).toBe('neutral');
  });

  it('should handle exact crossover points', () => {
    // MACD equals signal previously, now above
    const signal1 = getMACDSignal(1.2, 1.0, 1.0, 1.0);
    expect(signal1).toBe('bullish');
    
    // MACD equals signal previously, now below
    const signal2 = getMACDSignal(0.8, 1.0, 1.0, 1.0);
    expect(signal2).toBe('bearish');
    
    // MACD crosses to exactly equal signal
    const signal3 = getMACDSignal(1.0, 1.0, 0.8, 1.2);
    expect(signal3).toBe('neutral');
  });
});

describe('MACD performance', () => {
  it('should calculate efficiently for large datasets', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      time: 1000 + i * 1000,
      close: 100 + Math.sin(i * 0.1) * 20 + Math.random() * 5
    }));
    
    const startTime = Date.now();
    const result = calculateMACD(largeData);
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    expect(result.length).toBe(largeData.length - 26 - 9 + 1);
  });
});

describe('MACD integration scenarios', () => {
  it('should work with real-world Bitcoin price patterns', () => {
    // Simulate Bitcoin-like price movement
    const btcData = Array.from({ length: 100 }, (_, i) => {
      const trend = i * 100;
      const volatility = Math.sin(i * 0.3) * 500;
      const noise = Math.random() * 200 - 100;
      return {
        time: 1000 + i * 3600000, // Hourly data
        close: 40000 + trend + volatility + noise
      };
    });
    
    const result = calculateMACD(btcData);
    
    expect(result.length).toBeGreaterThan(0);
    
    // Check for reasonable values
    result.forEach(point => {
      expect(Math.abs(point.macd)).toBeLessThan(5000); // Reasonable for BTC
      expect(Math.abs(point.signal)).toBeLessThan(5000);
      expect(Math.abs(point.histogram)).toBeLessThan(1000);
    });
  });
});